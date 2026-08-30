import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/auth_api.dart';
import '../data/auth_repository_impl.dart';
import '../domain/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AuthRepositoryImpl(
    AuthApi(apiClient.dio),
    ref.watch(tokenStorageProvider),
  );
});

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState(this.status, {this.errorMessage});

  final AuthStatus status;
  final String? errorMessage;
}

/// Drives the router's redirect logic (core/router/app_router.dart) and is
/// the single source of truth for "is someone logged in" across the app.
class AuthController extends Notifier<AuthState> {
  late final AuthRepository _repository;

  @override
  AuthState build() {
    _repository = ref.watch(authRepositoryProvider);
    _checkInitialSession();
    return const AuthState(AuthStatus.unknown);
  }

  Future<void> _checkInitialSession() async {
    final loggedIn = await _repository.isLoggedIn();
    state = AuthState(
      loggedIn ? AuthStatus.authenticated : AuthStatus.unauthenticated,
    );
  }

  Future<void> login(String identifier, String password) async {
    try {
      await _repository.login(identifier: identifier, password: password);
      state = const AuthState(AuthStatus.authenticated);
    } catch (e) {
      state = AuthState(AuthStatus.unauthenticated, errorMessage: e.toString());
      rethrow;
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState(AuthStatus.unauthenticated);
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
