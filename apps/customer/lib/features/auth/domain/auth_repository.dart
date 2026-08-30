/// Result of a successful registration — `otpDebug` is only ever populated
/// by the API outside of production (see apps/api AuthService.register);
/// the app should not rely on it being present once real SMS/email
/// delivery lands (Sprint 11).
class RegistrationResult {
  const RegistrationResult({required this.userId, this.otpDebug});

  final String userId;
  final String? otpDebug;
}

abstract class AuthRepository {
  Future<RegistrationResult> register({
    required String fullName,
    String? email,
    String? phone,
    required String password,
  });

  Future<void> verifyOtp({
    required String identifier,
    required String code,
    required String purpose,
  });

  Future<void> login({required String identifier, required String password});

  Future<void> logout();

  Future<bool> isLoggedIn();
}
