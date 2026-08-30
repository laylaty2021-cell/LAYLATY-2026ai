import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/orders_api.dart';
import '../domain/order_models.dart';

final ordersApiProvider = Provider<OrdersApi>((ref) {
  return OrdersApi(ref.watch(apiClientProvider).dio);
});

final ordersListProvider = FutureProvider.autoDispose<List<LaylatyOrder>>((
  ref,
) {
  return ref.watch(ordersApiProvider).listOrders();
});

final orderDetailProvider = FutureProvider.autoDispose.family<LaylatyOrder, String>(
  (ref, orderId) {
    return ref.watch(ordersApiProvider).getOrder(orderId);
  },
);
