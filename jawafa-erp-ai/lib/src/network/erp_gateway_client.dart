import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

/// Access tokens are provided transiently by a future authenticated login
/// adapter, and are NEVER persisted, printed or embedded into Flutter assets.
typedef ErpAccessTokenProvider = Future<String> Function();

class ErpGatewayError implements Exception {
  final String code;
  const ErpGatewayError(this.code);
  @override
  String toString() => 'ErpGatewayError($code)';
}

class ErpRemoteCheque {
  final String id;
  final String reference;
  final String direction;
  final String amountFils;
  final String state;
  final int eventCount;
  const ErpRemoteCheque({
    required this.id,
    required this.reference,
    required this.direction,
    required this.amountFils,
    required this.state,
    required this.eventCount,
  });

  factory ErpRemoteCheque.fromJson(Map<String, dynamic> json) {
    return ErpRemoteCheque(
      id: json['cheque_id'] as String,
      reference: json['reference_no'] as String,
      direction: json['direction'] as String,
      amountFils: json['amount_fils'] as String,
      state: json['current_state'] as String,
      eventCount: json['event_count'] as int,
    );
  }
}

class ErpRemotePurchaseInvoice {
  final String id;
  final String supplierId;
  final String originalNumber;
  final String normalizedNumber;
  final String totalFils;
  final String currencyCode;
  final int lineCount;
  final String taxFils;
  final bool linesMatchTotal;

  const ErpRemotePurchaseInvoice({
    required this.id,
    required this.supplierId,
    required this.originalNumber,
    required this.normalizedNumber,
    required this.totalFils,
    required this.currencyCode,
    required this.lineCount,
    required this.taxFils,
    required this.linesMatchTotal,
  });

  factory ErpRemotePurchaseInvoice.fromJson(Map<String, dynamic> json) {
    return ErpRemotePurchaseInvoice(
      id: json['purchase_invoice_id'] as String,
      supplierId: json['supplier_id'] as String,
      originalNumber: json['original_invoice_number'] as String,
      normalizedNumber: json['invoice_number_key'] as String,
      totalFils: json['total_fils'] as String,
      currencyCode: json['currency_code'] as String,
      lineCount: json['line_count'] as int,
      taxFils: json['tax_fils'] as String,
      linesMatchTotal: json['draft_total_matches_lines'] as bool,
    );
  }
}

/// Strictly read-only API adapter for Windows, Android and iOS.
///
/// No database URL, SQL password, writes, refresh-token storage, or hidden
/// financial actions. The test-only HTTP exception is restricted to loopback.
class ErpGatewayClient {
  final Uri baseUri;
  final String tenantId;
  final ErpAccessTokenProvider accessTokenProvider;
  final HttpClient _httpClient;

  ErpGatewayClient({
    required this.baseUri,
    required this.tenantId,
    required this.accessTokenProvider,
    bool syntheticLoopbackHttpOnly = false,
    HttpClient? httpClient,
  }) : _httpClient = httpClient ?? HttpClient() {
    final uuid = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      caseSensitive: false,
    );
    final testLocal = syntheticLoopbackHttpOnly &&
        baseUri.scheme == 'http' &&
        (baseUri.host == '127.0.0.1' || baseUri.host == 'localhost');
    if ((baseUri.scheme != 'https' && !testLocal) ||
        baseUri.userInfo.isNotEmpty ||
        !uuid.hasMatch(tenantId)) {
      throw ArgumentError('INVALID_SECURE_ERP_GATEWAY_CONFIGURATION');
    }
  }

  Future<List<ErpRemoteCheque>> readCheques() async {
    final result = await _get('/v1/cheques');
    final rows = result['items'];
    if (rows is! List) throw const ErpGatewayError('INVALID_RESPONSE');
    return List.unmodifiable(rows.map((row) =>
        ErpRemoteCheque.fromJson(Map<String, dynamic>.from(row as Map))));
  }

  Future<List<ErpRemotePurchaseInvoice>> readPurchaseInvoices() async {
    final result = await _get('/v1/purchase-invoices');
    final rows = result['items'];
    if (rows is! List) throw const ErpGatewayError('INVALID_RESPONSE');
    return List.unmodifiable(rows.map((row) =>
        ErpRemotePurchaseInvoice.fromJson(
          Map<String, dynamic>.from(row as Map),
        )));
  }

  Future<List<Map<String, dynamic>>> readChequeEvents(String chequeId) async {
    if (!RegExp(r'^[0-9a-f-]{36}$', caseSensitive: false).hasMatch(chequeId)) {
      throw const ErpGatewayError('INVALID_CHEQUE_ID');
    }
    final result = await _get('/v1/cheques/$chequeId/events');
    final rows = result['items'];
    if (rows is! List) throw const ErpGatewayError('INVALID_RESPONSE');
    return List.unmodifiable(
      rows.map((row) => Map<String, dynamic>.unmodifiable(
          Map<String, dynamic>.from(row as Map))),
    );
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final token = await accessTokenProvider();
    if (token.trim().isEmpty) throw const ErpGatewayError('AUTH_REQUIRED');
    try {
      final request = await _httpClient
          .getUrl(baseUri.resolve(path))
          .timeout(const Duration(seconds: 8));
      request.followRedirects = false;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      request.headers.set('x-erp-tenant-id', tenantId);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      final response = await request.close().timeout(const Duration(seconds: 8));
      if (response.statusCode != 200) {
        throw ErpGatewayError(
            response.statusCode == 401 || response.statusCode == 403
                ? 'API_ACCESS_DENIED'
                : 'API_RESPONSE_REJECTED');
      }
      final buffer = BytesBuilder(copy: false);
      await for (final chunk in response.timeout(const Duration(seconds: 8))) {
        if (buffer.length + chunk.length > 1024 * 1024) {
          throw const ErpGatewayError('RESPONSE_TOO_LARGE');
        }
        buffer.add(chunk);
      }
      final json = jsonDecode(utf8.decode(buffer.takeBytes()));
      if (json is! Map) throw const ErpGatewayError('INVALID_RESPONSE');
      return Map<String, dynamic>.from(json);
    } on ErpGatewayError {
      rethrow;
    } catch (_) {
      // Do not disclose OIDC token, URI credentials or private source data.
      throw const ErpGatewayError('API_UNAVAILABLE');
    }
  }

  void close() => _httpClient.close(force: true);
}
