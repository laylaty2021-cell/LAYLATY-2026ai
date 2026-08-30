import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/otp_verify_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/events/presentation/events_list_screen.dart';

/// Redirect logic is the one thing that must live above individual screens:
/// an unauthenticated user is bounced to /login from anywhere, and a
/// logged-in user never sees /login or /register again. Everything below
/// the top level (event detail, create-event, ...) is plain Navigator
/// pushes from within EventsListScreen — no need to make every screen in
/// the app independently deep-linkable for this MVP.
GoRouter buildRouter(Ref ref) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: _AuthStatusListenable(ref),
    redirect: (context, state) {
      final status = ref.read(authControllerProvider).status;
      final onAuthRoute =
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          state.matchedLocation == '/otp-verify';

      if (status == AuthStatus.unknown) return null; // still checking session
      if (status == AuthStatus.unauthenticated && !onAuthRoute) return '/login';
      if (status == AuthStatus.authenticated && onAuthRoute) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const EventsListScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/otp-verify',
        builder: (context, state) =>
            OtpVerifyScreen(identifier: state.extra as String),
      ),
    ],
  );
}

/// Bridges Riverpod's Notifier to go_router's ChangeNotifier-based
/// refreshListenable so a login/logout immediately re-runs `redirect`.
class _AuthStatusListenable extends ChangeNotifier {
  _AuthStatusListenable(Ref ref) {
    ref.listen(authControllerProvider, (_, _) => notifyListeners());
  }
}
