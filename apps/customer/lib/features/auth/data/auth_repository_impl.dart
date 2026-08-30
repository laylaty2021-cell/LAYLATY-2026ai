import '../../../core/network/token_storage.dart';
import '../domain/auth_repository.dart';
import 'auth_api.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._api, this._tokenStorage);

  final AuthApi _api;
  final TokenStorage _tokenStorage;

  @override
  Future<RegistrationResult> register({
    required String fullName,
    String? email,
    String? phone,
    required String password,
  }) async {
    final response = await _api.register(
      fullName: fullName,
      email: email,
      phone: phone,
      password: password,
    );
    return RegistrationResult(
      userId: response['userId'] as String,
      otpDebug: response['otpDebug'] as String?,
    );
  }

  @override
  Future<void> verifyOtp({
    required String identifier,
    required String code,
    required String purpose,
  }) {
    return _api.verifyOtp(identifier: identifier, code: code, purpose: purpose);
  }

  @override
  Future<void> login({
    required String identifier,
    required String password,
  }) async {
    final response = await _api.login(
      identifier: identifier,
      password: password,
    );
    await _tokenStorage.save(
      accessToken: response['accessToken'] as String,
      refreshToken: response['refreshToken'] as String,
    );
  }

  @override
  Future<void> logout() async {
    final refreshToken = await _tokenStorage.refreshToken;
    if (refreshToken != null) {
      try {
        await _api.logout(refreshToken);
      } catch (_) {
        // Best-effort server-side revocation; local session is cleared
        // regardless so the user is never stuck logged in on-device.
      }
    }
    await _tokenStorage.clear();
  }

  @override
  Future<bool> isLoggedIn() async {
    final token = await _tokenStorage.accessToken;
    return token != null;
  }
}
