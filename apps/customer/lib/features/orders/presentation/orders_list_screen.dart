import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'order_detail_screen.dart';
import 'orders_controller.dart';

class OrdersListScreen extends ConsumerWidget {
  const OrdersListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(ordersListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load: $error')),
        data: (orders) {
          if (orders.isEmpty) {
            return const Center(child: Text("You haven't placed an order yet."));
          }
          return ListView.builder(
            itemCount: orders.length,
            itemBuilder: (context, index) {
              final order = orders[index];
              return ListTile(
                title: Text('Order #${order.orderNumber}'),
                subtitle: Text(order.status.replaceAll('_', ' ')),
                trailing: Text(
                  '${order.totalAmount.toStringAsFixed(0)} ${order.currency}',
                ),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => OrderDetailScreen(orderId: order.id),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
