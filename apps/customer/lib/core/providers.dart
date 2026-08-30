import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'network/api_client.dart';
import 'network/token_storage.dart';
import 'router/app_router.dart';

/// App-wide singletons. Feature providers depend on these rather than
/// constructing their own Dio/TokenStorage instances.
final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(tokenStorageProvider));
});

final routerProvider = Provider<GoRouter>((ref) => buildRouter(ref));
