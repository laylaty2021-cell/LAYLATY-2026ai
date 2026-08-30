import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'token_storage.dart';

/// Single Dio instance shared by every feature's `*Api` class (blueprint
/// "Networking conventions" in docs/mobile/flutter-architecture.md). The
/// auth interceptor attaches the access token and, on a 401, calls
/// `/auth/refresh` exactly once and retries the original request — mirroring
/// the rotation behavior in apps/api/src/modules/auth/auth.service.ts.
class ApiClient {
  ApiClient(this._tokenStorage) {
    _dio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));
    _refreshDio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));
    _dio.interceptors.add(_AuthInterceptor(_dio, _refreshDio, _tokenStorage));
  }

  final TokenStorage _tokenStorage;
  late final Dio _dio;
  late final Dio _refreshDio;

  Dio get dio => _dio;
}

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._dio, this._refreshDio, this._tokenStorage);

  final Dio _dio;
  final Dio _refreshDio;
  final TokenStorage _tokenStorage;
  Future<bool>? _refreshInFlight;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _tokenStorage.accessToken;
    if (token != null && !options.path.startsWith('/auth/')) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final isUnauthorized = err.response?.statusCode == 401;
    final alreadyRetried = err.requestOptions.extra['retried'] == true;

    if (isUnauthorized && !alreadyRetried) {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        final retryOptions = err.requestOptions..extra['retried'] = true;
        try {
          final response = await _dio.fetch(retryOptions);
          return handler.resolve(response);
        } on DioException catch (retryError) {
          return handler.next(retryError);
        }
      }
    }
    handler.next(err);
  }

  Future<bool> _refreshAccessToken() {
    // Coalesce concurrent 401s into a single refresh call.
    return _refreshInFlight ??= _doRefresh().whenComplete(
      () => _refreshInFlight = null,
    );
  }

  Future<bool> _doRefresh() async {
    final refreshToken = await _tokenStorage.refreshToken;
    if (refreshToken == null) return false;

    try {
      final response = await _refreshDio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      await _tokenStorage.save(
        accessToken: response.data['accessToken'] as String,
        refreshToken: response.data['refreshToken'] as String,
      );
      return true;
    } on DioException {
      await _tokenStorage.clear();
      return false;
    }
  }
}
