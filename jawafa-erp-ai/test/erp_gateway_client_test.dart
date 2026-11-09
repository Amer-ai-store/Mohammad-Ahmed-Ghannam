import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/network/erp_gateway_client.dart';

void main() {
  const tenant = '11111111-1111-4111-8111-111111111111';

  test('API client refuses plaintext remote URLs and invalid company IDs', () {
    expect(
      () => ErpGatewayClient(
        baseUri: Uri.parse('http://example.com'),
        tenantId: tenant,
        accessTokenProvider: () async => 'opaque-test-token',
        syntheticLoopbackHttpOnly: true,
      ),
      throwsArgumentError,
    );
    expect(
      () => ErpGatewayClient(
        baseUri: Uri.parse('https://erp.example.test'),
        tenantId: 'not-a-uuid',
        accessTokenProvider: () async => 'opaque-test-token',
      ),
      throwsArgumentError,
    );
    expect(
      () => ErpGatewayClient(
        baseUri: Uri.parse('https://user:password@erp.example.test'),
        tenantId: tenant,
        accessTokenProvider: () async => 'opaque-test-token',
      ),
      throwsArgumentError,
    );
  });

  test('API requires an in-memory access token, no client credentials stored', () async {
    final client = ErpGatewayClient(
      baseUri: Uri.parse('https://erp.example.test'),
      tenantId: tenant,
      accessTokenProvider: () async => '',
    );
    await expectLater(client.readCheques(),
      throwsA(isA<ErpGatewayError>().having((e) => e.code,'code','AUTH_REQUIRED')));
    client.close();
  });

  test('real local HTTP fixture receives GET with tenant and ephemeral token', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    String? method;
    String? authorization;
    String? tenantHeader;
    String? uri;
    server.listen((request) {
      method = request.method;
      uri = request.uri.path;
      authorization = request.headers.value(HttpHeaders.authorizationHeader);
      tenantHeader = request.headers.value('x-erp-tenant-id');
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode({
        'items': [{
          'cheque_id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'reference_no': 'SYNTHETIC-CHEQUE',
          'direction': 'received',
          'amount_fils': '1200500',
          'current_state': 'registered',
          'event_count': 1
        }]
      }));
      request.response.close();
    });
    final client = ErpGatewayClient(
      baseUri: Uri.parse('http://127.0.0.1:${server.port}'),
      tenantId: tenant,
      syntheticLoopbackHttpOnly: true,
      accessTokenProvider: () async => 'synthetic-ephemeral-jwt',
    );
    try {
      final records = await client.readCheques();
      expect(records.length, 1);
      expect(records.single.reference, 'SYNTHETIC-CHEQUE');
      expect(records.single.amountFils, '1200500');
      expect(records.single.state, 'registered');
      expect(method, 'GET');
      expect(uri, '/v1/cheques');
      expect(authorization, 'Bearer synthetic-ephemeral-jwt');
      expect(tenantHeader, tenant);
    } finally {
      client.close();
      await server.close(force: true);
    }
  });

  test('unauthorized API response does not reveal private response contents', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((request) {
      request.response.statusCode = HttpStatus.forbidden;
      request.response.write('PRIVATE SQL DETAILS SHOULD NOT LEAK');
      request.response.close();
    });
    final client = ErpGatewayClient(
      baseUri: Uri.parse('http://127.0.0.1:${server.port}'),
      tenantId: tenant,
      syntheticLoopbackHttpOnly: true,
      accessTokenProvider: () async => 'synthetic-ephemeral-jwt',
    );
    try {
      await expectLater(client.readCheques(),
        throwsA(isA<ErpGatewayError>().having((e) => e.code,'code','API_ACCESS_DENIED')));
    } finally {
      client.close();
      await server.close(force: true);
    }
  });
}
