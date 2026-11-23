param([ValidateRange(1000,200000)][int]$RecentRows=10000)
$ErrorActionPreference='Stop'
$base='http://127.0.0.2:3456'
$root='C:\ProgramData\SentinelXService\workspace'
function Pull([string]$table,[int]$limit,[long]$offset) {
 if($table -notin @('MPOSSales','MPOSReturn','Items')){throw 'TABLE_NOT_ALLOWED'}
 return Invoke-RestMethod -Uri ($base+'/api/query/'+$table+'?limit='+$limit+'&offset='+$offset) -TimeoutSec 50
}
$health=Invoke-RestMethod ($base+'/api/health') -TimeoutSec 10
if(!$health.ok -or $health.database -ne 'Jawafa_DB'){throw 'SOURCE_HEALTH_FAILED'}
$low=[long]2000000;$high=[long]2110000
while(@((Pull 'MPOSSales' 1 $high).data).Count -gt 0){$low=$high;$high+=1000000;if($high -gt 12000000){throw 'OVER_LIMIT'}}
while(($high-$low) -gt 1){$mid=[long][math]::Floor(($high+$low)/2);if(@((Pull 'MPOSSales' 1 $mid).data).Count -gt 0){$low=$mid}else{$high=$mid}}
$total=$high
$start=[math]::Max(0,$total-$RecentRows)
$days=@{};$samples=@{};$max='0000-00-00';$scanned=0
for($off=$start;$off -lt $total;$off+=5000){
 $r=Pull 'MPOSSales' ([int][math]::Min(5000,$total-$off)) $off
 foreach($x in @($r.data)){
  $scanned++;$date=([string]$x.TransDate).Substring(0,10)
  if($date -gt $max){$max=$date}
  if(!$days.ContainsKey($date)){$days[$date]=0};$days[$date]++
  if($x.StoreId -ne 1 -or $x.IsTransfer -eq $true -or [decimal]$x.Qty -le 0){continue}
  $f=[string]$x.FamCode;$group=if($f.StartsWith('08')){'meat'}elseif($f.StartsWith('06')){'dairy'}elseif($f.StartsWith('02')){'roastery'}elseif($f.StartsWith('0104')){'produce'}else{''}
  if(!$group){continue}
  $id=[string]$x.ItemSeq;$unit=[int]$x.UnitId;$key=$date+'|'+$id+'|'+$unit
  if(!$samples.ContainsKey($key)){$samples[$key]=[pscustomobject]@{date=$date;itemId=$id;unitId=$unit;group=$group;gross=[decimal]0;returns=[decimal]0;records=0;name=''}}
  $samples[$key].gross+=[decimal]$x.Qty;$samples[$key].records++
 }
}
$returnScanned=0;$returnFailed=$false
try{
 for($off=0;$off -lt 500000;$off+=5000){
  $r=Pull 'MPOSReturn' 5000 $off
  $page=@($r.data);if(!$page.Count){break}
  foreach($x in $page){
   $returnScanned++;$date=([string]$x.TrasDate).Substring(0,10)
   $key=$date+'|'+[string]$x.itemseq+'|'+[string]$x.unitid
   if($samples.ContainsKey($key)){$samples[$key].returns+=[decimal]$x.Qty}
  }
  if($page.Count -lt 5000){break}
 }
}catch{$returnFailed=$true}
$names=@{};$inactive=@{}
try{
 for($off=0;$off -lt 250000;$off+=5000){
  $r=Pull 'Items' 5000 $off;$page=@($r.data);if(!$page.Count){break}
  foreach($x in $page){
   $id=[string]$x.ItemcodeSeq
   $names[$id]=([string]$x.Description).Trim()
   $inactive[$id]=(!$x.Active -or $x.notActive -or $x.NonQty)
  }
  if($page.Count -lt 5000){break}
 }
}catch{throw 'ITEM_NAMES_LOOKUP_FAILED'}
$groups=@{meat=@();produce=@();dairy=@();roastery=@()}
foreach($x in $samples.Values){
 if($x.date -ne $max){continue}
 if(!$names.ContainsKey($x.itemId) -or $inactive[$x.itemId]){continue}
 $name=[string]$names[$x.itemId]
 if($name -match '(?i)^\s*خدمة|خدمة تقطيع|^تقطيع'){continue}
 $net=$x.gross-$x.returns;if($net -le 0){continue}
 $groups[$x.group]+=([pscustomobject]@{itemId=$x.itemId;name=$name;net=[math]::Round([double]$net,3);gross=[math]::Round([double]$x.gross,3);returns=[math]::Round([double]$x.returns,3);unitId=$x.unitId;unitName=$(if($x.unitId -eq 51){'كيلوغرام'}elseif($x.unitId -eq 1){'وحدة'}else{'غير مثبت'});rows=$x.records})
}
$limits=@{meat=6;produce=6;dairy=4;roastery=4};$top=@{}
foreach($g in @('meat','produce','dairy','roastery')){$top[$g]=@($groups[$g]|Sort-Object net -Descending|Select-Object -First $limits[$g])}
$report=[ordered]@{state='PARTIAL_READ_ONLY';source='Jawafa_DB.MPOSSales/MPOSReturn';sourceDate=$max;sourceCount=$total;rangeStart=$start;rowsScanned=$scanned;returnRowsScanned=$returnScanned;returnsCompleteFromAvailableTable=(!$returnFailed);dateDistribution=$days;generatedUtc=(Get-Date).ToUniversalTime().ToString('o');groups=$top;notice='INCOMPLETE_WINDOW: never use for today bestseller publication or checkout'}
$out=Join-Path $root 'AAS_POS_LATEST_READONLY.json'
[IO.File]::WriteAllText($out,($report|ConvertTo-Json -Depth 8 -Compress),(New-Object Text.UTF8Encoding $false))
Write-Output ('SUCCESS file='+$out+' scan='+$scanned+' sourceRows='+$total+' lastDate='+$max+' returns='+$returnScanned+' bytes='+(Get-Item $out).Length)
foreach($g in @('meat','produce','dairy','roastery')){Write-Output ('GROUP='+$g+' ranking='+@($top[$g]).Count)}
