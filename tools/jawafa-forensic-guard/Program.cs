// Jawafa Forensic Guard — standalone Windows read-only auditing executable.
// No SQL driver, SQL credentials, data modification, or TrustSoft binary replacement.
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace JawafaForensicGuard {
  class Program {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static int Main(string[] args) {
      try {
        if (args.Length == 0 || args[0] == "--help") {
          Console.WriteLine("JawafaForensicGuard [self-test | health [http://127.0.0.1:3456] | inventory <inventory_tables.csv> <data-folder> <output-json> <optional-comma-separated-tables>]");
          return args.Length == 0 ? 1 : 0;
        }
        if (args[0] == "self-test") return SelfTest();
        if (args[0] == "health") return Health(args.Length > 1 ? args[1] : "http://127.0.0.1:3456");
        if (args[0] == "inventory" && args.Length >= 4)
          return Inventory(args[1], args[2], args[3], args.Length > 4 ? args[4] : "dbo.CheqMovement,dbo.InvPurchaseVouchersTransactionHistory");
        throw new ArgumentException("Unsupported command; use --help.");
      } catch (Exception error) {
        Console.Error.WriteLine("AUDIT_FAILED=" + error.GetType().Name + ":" + error.Message);
        return 3;
      }
    }
    static bool AllowDbOperation(string source, string verb) {
      return String.Equals(source, "Jawafa_DB", StringComparison.OrdinalIgnoreCase)
        && String.Equals(verb, "SELECT", StringComparison.OrdinalIgnoreCase);
    }
    static int SelfTest() {
      if (AllowDbOperation("Jawafa_DB", "UPDATE") || AllowDbOperation("Jawafa_DB","DELETE")
        || AllowDbOperation("Jawafa_DB","INSERT") || AllowDbOperation("Jawafa_DB","EXEC")
        || !AllowDbOperation("Jawafa_DB","SELECT") || AllowDbOperation("OtherDb","SELECT"))
          throw new InvalidOperationException("Read-only application gate test failed.");
      // This application gate does NOT check the actual SQL account's server permissions.
      const string sample = "\"A\",\"B\"\r\n\"quoted\nline\",\"value\"\r\n\"last\",\"value\"\r\n";
      const string escaped = "\uFEFF\"A\",\"B\"\r\"a\"\"b\",\"x\"\r\"multiline\nvalue\",\"y\"";
      if (CountCsvRows(new StringReader(sample)) != 2 ||
          CountCsvRows(new StringReader(escaped)) != 2)
        throw new InvalidOperationException("CSV quoted field / newline / escaped quote parsing failed.");
      bool malformedRejected = false;
      try { CountCsvRows(new StringReader("\"header\"\n\"unterminated")); }
      catch (InvalidDataException) { malformedRejected = true; }
      if (!malformedRejected) throw new InvalidOperationException("Malformed CSV accepted.");
      if (ClassifyTablesStatus(HttpStatusCode.OK) != true ||
          ClassifyTablesStatus(HttpStatusCode.NoContent) != true ||
          ClassifyTablesStatus(HttpStatusCode.Unauthorized) != false ||
          ClassifyTablesStatus(HttpStatusCode.Forbidden) != false ||
          ClassifyTablesStatus(HttpStatusCode.NotFound).HasValue ||
          ClassifyTablesStatus(HttpStatusCode.Redirect).HasValue)
        throw new InvalidOperationException("HTTP authorization probe classification failed.");
      bool traversalRejected = false;
      try { SafeSnapshotCsvPath(Path.GetTempPath(),"../escape"); }
      catch (InvalidDataException) { traversalRejected = true; }
      if (!traversalRejected) throw new InvalidOperationException("CSV snapshot path traversal was permitted.");
      Console.WriteLine("SELF_TEST_PASS application_gate=true csv_rfc4180_cases=true auth_probe_classification=true snapshot_path_protected=true");
      return 0;
    }
    static int Health(string origin) {
      Uri uri = new Uri(origin);
      if (uri.Scheme != Uri.UriSchemeHttp || uri.Host != "127.0.0.1" || uri.IsDefaultPort ||
          uri.UserInfo.Length != 0 || uri.AbsolutePath != "/" ||
          uri.Query.Length != 0 || uri.Fragment.Length != 0)
        throw new ArgumentException("Only http://127.0.0.1:<port>/ local bridge permitted.");
      string response = GetLocal(uri, "/api/health");
      Dictionary<string,object> data = Json.Deserialize<Dictionary<string,object>>(response);
      if (data == null) throw new InvalidDataException("Bridge health response was not an object.");
      bool readOnly = Equals(Val(data,"mode"),"FORENSIC-READ-ONLY");
      bool correctDb = Equals(Val(data,"database"),"Jawafa_DB");
      string account = Val(data,"user");
      bool accountReported = account.Length != 0;
      bool privileged = String.Equals(account,"sa",StringComparison.OrdinalIgnoreCase);
      string credentialSource = Val(data,"passwordSource");
      bool credentialSourceReported = credentialSource.Length != 0;
      bool plain = credentialSource.IndexOf("plain",StringComparison.OrdinalIgnoreCase) >= 0;
      bool? metadataAnonymous = ProbeAnonymousTableInventory(uri);
      // A 404, redirect, or unreachable probe is unknown, NOT evidence of authentication.
      bool risk = privileged || plain || metadataAnonymous != false || !readOnly || !correctDb ||
                  !accountReported || !credentialSourceReported;
      // There is no SQL driver in this executable: only an independent grant audit can verify SELECT-only.
      Console.WriteLine("BRIDGE_AUDIT="+Json.Serialize(new {
        databaseVerified=correctDb,applicationReadOnlyFlag=readOnly,
        sqlAccountReported=accountReported,privilegedSqlAccount=privileged,
        credentialSourceReported=credentialSourceReported,
        plaintextPasswordStorageIndicator=plain,
        anonymousTableInventory=metadataAnonymous,tableProbeVerified=metadataAnonymous.HasValue,
        sqlSelectOnlyPrivilegesVerified=false,
        acceptanceStatus=risk ? "CRITICAL_OR_UNKNOWN_RISK" : "PENDING_INDEPENDENT_SQL_GRANT_VERIFICATION",
        criticalRisk=risk,
        note="Application mode and SQL username are not proof of SQL least privilege; no SQL writes attempted."
      }));
      // Never report full security acceptance without independently verifying SQL grants.
      return risk ? 2 : 4;
    }
    static bool? ClassifyTablesStatus(HttpStatusCode status) {
      int code = (int)status;
      if (code >= 200 && code < 300) return true;
      if (code == 401 || code == 403) return false;
      return null;
    }
    static bool? ProbeAnonymousTableInventory(Uri origin) {
      HttpWebRequest req = (HttpWebRequest)WebRequest.Create(new Uri(origin,"/api/tables"));
      req.Method="GET";req.Timeout=10000;req.ReadWriteTimeout=10000;
      req.AllowAutoRedirect=false;req.Proxy=null;
      try {
        using(var res=(HttpWebResponse)req.GetResponse())
          return ClassifyTablesStatus(res.StatusCode);
      } catch(WebException error) {
        using(var res=error.Response as HttpWebResponse)
          return res == null ? (bool?)null : ClassifyTablesStatus(res.StatusCode);
      }
    }
    static string Val(Dictionary<string,object> data,string key) {
      object value; return data.TryGetValue(key,out value) && value!=null ? value.ToString() : "";
    }
    static string GetLocal(Uri origin,string path) {
      var u = new Uri(origin,path);
      HttpWebRequest req = (HttpWebRequest)WebRequest.Create(u);
      req.Method="GET";req.Timeout=10000;req.ReadWriteTimeout=10000;req.AllowAutoRedirect=false;req.Proxy=null;
      using(var res=(HttpWebResponse)req.GetResponse())
      using(var stream=new StreamReader(res.GetResponseStream(),Encoding.UTF8))
        return stream.ReadToEnd();
    }
    // Strict streaming CSV record counter: quoted newlines and doubled quotes; reject malformed quotes.
    static long CountCsvRows(TextReader reader) {
      char[] buffer = new char[131072]; int n;
      bool inQuotes=false,afterQuote=false,atFieldStart=true,hasContent=false,pendingCr=false,firstChar=true;
      long records=0;
      while((n=reader.Read(buffer,0,buffer.Length))>0) {
        for(int i=0;i<n;i++) {
          char c=buffer[i];
          if(firstChar) { firstChar=false; if(c=='\uFEFF')continue; }
          if(pendingCr && c=='\n') { pendingCr=false; continue; }
          pendingCr=false;
          if(!inQuotes && (c=='\n' || c=='\r')) {
            if(hasContent)records++;
            hasContent=false;atFieldStart=true;afterQuote=false;
            if(c=='\r')pendingCr=true;
            continue;
          }
          if(inQuotes) {
            if(c=='"') { inQuotes=false;afterQuote=true; }
            continue;
          }
          if(afterQuote) {
            if(c=='"') { inQuotes=true;afterQuote=false;continue; }
            if(c==',') { afterQuote=false;atFieldStart=true;hasContent=true;continue; }
            throw new InvalidDataException("Unexpected characters after a quoted CSV field.");
          }
          if(c=='"') {
            if(!atFieldStart)throw new InvalidDataException("Unexpected quote in an unquoted CSV field.");
            inQuotes=true;atFieldStart=false;hasContent=true;
          } else if(c==',') { atFieldStart=true;hasContent=true; }
          else { atFieldStart=false;hasContent=true; }
        }
      }
      if(inQuotes)throw new InvalidDataException("CSV has an unclosed quoted field.");
      if(hasContent)records++;
      return Math.Max(0,records-1);
    }
    static string SafeSnapshotCsvPath(string folder,string name) {
      string root = Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar)
                    + Path.DirectorySeparatorChar;
      string candidate = Path.GetFullPath(Path.Combine(folder,name+".csv"));
      if (!candidate.StartsWith(root,StringComparison.OrdinalIgnoreCase))
        throw new InvalidDataException("CSV target escapes the specified snapshot directory.");
      return candidate;
    }
    static int Inventory(string index,string folder,string destination,string targets) {
      if (!File.Exists(index) || !Directory.Exists(folder))throw new FileNotFoundException("Read-only snapshot input missing.");
      string[] lines=File.ReadAllLines(index,Encoding.UTF8);
      Regex row=new Regex("^\\\"(?<schema>[^\\\"]+)\\\",\\\"(?<name>[^\\\"]+)\\\",\\\"(?<cells>[0-9]+)\\\",\\\"(?<columns>[0-9]+)\\\"$",RegexOptions.Compiled);
      int total=0,nonzero=0,divisible=0,invalid=0;
      var targetMap=new Dictionary<string,long>(StringComparer.OrdinalIgnoreCase);
      var request=new HashSet<string>((targets??"").Split(new[]{','},StringSplitOptions.RemoveEmptyEntries),StringComparer.OrdinalIgnoreCase);
      foreach(string raw in lines){
        var m=row.Match(raw.TrimStart('\uFEFF'));if(!m.Success)continue;
        total++;long cells=long.Parse(m.Groups["cells"].Value);long columns=long.Parse(m.Groups["columns"].Value);
        string name=m.Groups["schema"].Value+"."+m.Groups["name"].Value;
        if(cells>0)nonzero++;
        if(columns>0&&cells%columns==0){divisible++;if(request.Contains(name))targetMap.Add(name,cells/columns);}
        else invalid++;
      }
      var comparisons=new List<object>();int mismatch=0,checkedFiles=0;
      foreach(string name in request){
        long inferred;
        if(!targetMap.TryGetValue(name,out inferred)){comparisons.Add(new{table=name,status="not_in_metadata"});mismatch++;continue;}
        string file=SafeSnapshotCsvPath(folder,name);
        if(!File.Exists(file)){comparisons.Add(new{table=name,status="file_missing"});mismatch++;continue;}
        long actual;
        using(var reader=new StreamReader(file,Encoding.UTF8,true,131072)){actual=CountCsvRows(reader);}
        checkedFiles++;
        bool match=actual==inferred;if(!match)mismatch++;
        comparisons.Add(new {table=name,inferredRows=inferred,actualRows=actual,
          difference=actual-inferred,match=match,source="CSV and metadata; historical snapshot"});
      }
      var report=new {generatedAtUtc=DateTime.UtcNow.ToString("o"),source="historical CSV snapshot",tables=total,nonzero,
        divisibleByDeclaredColumns=divisible,invalidFormula=invalid,requestedTargets=request.Count,
        matchedMetadataTargets=targetMap.Count,compared=checkedFiles,
        mismatch,comparisons,warning="Never write to Jawafa_DB; inferred count is not a live database row count."};
      string json=Json.Serialize(report);
      string parent=Path.GetDirectoryName(Path.GetFullPath(destination));if(!Directory.Exists(parent))throw new DirectoryNotFoundException(parent);
      File.WriteAllText(destination,json,Encoding.UTF8);
      Console.WriteLine("INVENTORY_AUDIT="+json);
      Console.WriteLine("REPORT_SHA256="+Sha256(destination));
      return mismatch>0?2:0;
    }
    static string Sha256(string file) {
      using(var sha=SHA256.Create())using(var stream=File.OpenRead(file)){
        var bytes=sha.ComputeHash(stream);return BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant();
      }
    }
  }
}
