import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/cart_api.dart';
import '../domain/cart_models.dart';

final cartApiProvider = Provider<CartApi>((ref) {
  return CartApi(ref.watch(apiClientProvider).dio);
});

/// A customer has at most one active cart per store (blueprint §14) —
/// keyed by storeId so switching stores never shows a stale cart.
final cartProvider = FutureProvider.autoDispose.family<Cart, String>((
  ref,
  storeId,
) {
  return ref.watch(cartApiProvider).getCart(storeId);
});
