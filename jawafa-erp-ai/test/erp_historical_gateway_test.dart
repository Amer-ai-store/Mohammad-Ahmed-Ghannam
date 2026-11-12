import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/network/erp_gateway_client.dart';
import 'package:jawafa_erp_ai/src/network/erp_historical_report.dart';

import 'historical_report_fixture.dart';

void main() {
  const tenant = '11111111-1111-4111-8111-111111111111';

  test('parser preserves exact daily/MTD integers and mandatory unverified evidence', () {
    final result = ErpHistoricalComparison.parse(
      syntheticHistoricalReport(), requestedDay: '2026-10-02');
    expect(result.years.map((y) => y.year), [2026, 2025, 2024]);
    expect(result.years[0].daily.totals!['sales_before_tax_fils'], 250);
    expect(result.years[0].monthToDate.totals!['sales_before_tax_fils'], 550);
    expect(result.comparisons[0].daily['sales_before_tax_fils'], 10000);
    expect(() => result.years.clear(), throwsUnsupportedError);
    expect(() => result.years[0].daily.totals!['sales_before_tax_fils'] = 0,
        throwsUnsupportedError);
  });

  test('missing historical source stays null rather than inventing zero', () {
    final data = ErpHistoricalComparison.parse(
      syntheticHistoricalReport(missingOlderYear:true),
      requestedDay: '2026-10-02',
    );
    expect(data.years.last.daily.totals, isNull);
    expect(data.years.last.daily.availability, 'NO_POSTED_EVENTS_FOUND');
    expect(data.years.last.monthToDate.totals, isNull);
  });

  test('parser refuses false TrustSoft parity, changed source status and malformed rates', () {
    final wrongParity = syntheticHistoricalReport();
    wrongParity['functionalParityPercent'] = 90;
    expect(() => ErpHistoricalComparison.parse(wrongParity,
      requestedDay:'2026-10-02'), throwsA(isA<ErpHistoricalReportError>()));

    final wrongEvidence = syntheticHistoricalReport();
    wrongEvidence['referenceStatus'] = 'MATCHED_WITH_TRUSTSOFT';
    expect(() => ErpHistoricalComparison.parse(wrongEvidence,
      requestedDay:'2026-10-02'), throwsA(isA<ErpHistoricalReportError>()));

    final badTotal = syntheticHistoricalReport();
    final first = (badTotal['years'] as List).first as Map<String,dynamic>;
    final period = first['daily'] as Map<String,dynamic>;
    final totals = period['totals'] as Map<String,int>;
    totals['sales_before_tax_fils'] = -2; // negative signed totals are legal
    expect(ErpHistoricalComparison.parse(badTotal,
      requestedDay:'2026-10-02').years.first.daily.totals![
        'sales_before_tax_fils'], -2);

    totals['sales_before_tax_fils'] = 1.25 as dynamic;
    expect(() => ErpHistoricalComparison.parse(badTotal,
      requestedDay:'2026-10-02'), throwsA(isA<ErpHistoricalReportError>()));
  });

  test('real loopback receives scoped GET and ephemeral JWT, with no writes', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4,0);
    String? seenMethod, seenPath, seenToken, seenTenant, seenBranch, seenDate;
    server.listen((req) async {
      seenMethod = req.method;
      seenPath = req.uri.path;
      seenToken = req.headers.value(HttpHeaders.authorizationHeader);
      seenTenant = req.headers.value('x-erp-tenant-id');
      seenBranch = req.headers.value('x-erp-branch-id');
      seenDate = req.uri.queryParameters['date'];
      req.response.headers.contentType = ContentType.json;
      req.response.write(jsonEncode(syntheticHistoricalReport()));
      await req.response.close();
    });
    final client = ErpGatewayClient(
      baseUri:Uri.parse('http://127.0.0.1:' + server.port.toString()),
      tenantId:tenant, syntheticLoopbackHttpOnly:true,
      accessTokenProvider:() async => 'SYNTHETIC-TOKEN-IN-MEMORY',
    );
    try {
      final report = await client.readHistoricalComparison(
        date:'2026-10-02',branchId:'BR-A',itemCode:'SKU-A');
      expect(report.years.length,3);
      expect(report.years.first.daily.totals!['sales_before_tax_fils'],250);
      expect(seenMethod,'GET');
      expect(seenPath,'/v1/reports/historical-daily-compare');
      expect(seenDate,'2026-10-02');
      expect(seenTenant,tenant);
      expect(seenBranch,'BR-A');
      expect(seenToken,'Bearer SYNTHETIC-TOKEN-IN-MEMORY');
    } finally {
      client.close();
      await server.close(force:true);
    }
  });

  test('invalid scope and no token fail closed before network or private data', () async {
    final client = ErpGatewayClient(
      baseUri:Uri.parse('https://erp.example.test'),
      tenantId:tenant,accessTokenProvider:() async => '',
    );
    try {
      for(final branch in ['','../ADMIN','=A','SECRET/BRANCH']) {
        await expectLater(
          client.readHistoricalComparison(date:'2026-10-02',branchId:branch),
          throwsA(isA<ErpGatewayError>().having(
            (e)=>e.code,'code','INVALID_REPORT_SCOPE')),
        );
      }
      await expectLater(
        client.readHistoricalComparison(date:'2026-02-30',branchId:'BR-A'),
        throwsA(isA<ErpGatewayError>().having(
          (e)=>e.code,'code','INVALID_REPORT_SCOPE')),
      );
      await expectLater(
        client.readHistoricalComparison(date:'2026-10-02',branchId:'BR-A'),
        throwsA(isA<ErpGatewayError>().having(
          (e)=>e.code,'code','AUTH_REQUIRED')),
      );
    } finally {
      client.close();
    }
  });

  test('server 403 rejects display and never echoes private server content', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4,0);
    server.listen((req) async {
      req.response.statusCode = HttpStatus.forbidden;
      req.response.write('SENSITIVE_PRIVATE_DATABASE_ROW');
      await req.response.close();
    });
    final client = ErpGatewayClient(
      baseUri:Uri.parse('http://127.0.0.1:' + server.port.toString()),
      tenantId:tenant,syntheticLoopbackHttpOnly:true,
      accessTokenProvider:() async => 'SYNTHETIC-SESSION',
    );
    try {
      await expectLater(
        client.readHistoricalComparison(date:'2026-10-02',branchId:'BR-A'),
        throwsA(isA<ErpGatewayError>().having(
          (e)=>e.code,'code','API_ACCESS_DENIED')),
      );
    } finally {
      client.close();
      await server.close(force:true);
    }
  });
}
