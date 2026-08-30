import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';

/// Thin wrapper around POST /auth/* — matches docs/api/openapi.yaml
/// exactly. This is the only class in the auth feature that knows about
/// HTTP/JSON; everything else works with plain Dart types.
class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> register({
    required String fullName,
    String? email,
    String? phone,
    required String password,
  }) => _post('/auth/register', {
    'fullName': fullName,
    if (email != null) 'email': email,
    if (phone != null) 'phone': phone,
    'password': password,
  });

  Future<void> verifyOtp({
    required String identifier,
    required String code,
    required String purpose,
  }) => _post('/auth/otp/verify', {
    'identifier': identifier,
    'code': code,
    'purpose': purpose,
  });

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) => _post('/auth/login', {'identifier': identifier, 'password': password});

  Future<void> logout(String refreshToken) =>
      _post('/auth/logout', {'refreshToken': refreshToken});

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await _dio.post(path, data: data);
      return response.data as Map<String, dynamic>? ?? {};
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
