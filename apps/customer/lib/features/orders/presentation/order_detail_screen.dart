import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'orders_controller.dart';

class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({required this.orderId, super.key});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Order')),
      body: orderAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load: $error')),
        data: (order) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Order #${order.orderNumber}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(order.status.replaceAll('_', ' ')),
              const SizedBox(height: 24),
              ...order.items.map(
                (item) => Card(
                  child: ListTile(
                    title: Text(item.nameSnapshot),
                    subtitle: Text('${item.itemType} · qty ${item.quantity}'),
                    trailing: Text(
                      '${item.totalPrice.toStringAsFixed(0)} ${order.currency}',
                    ),
                  ),
                ),
              ),
              const Divider(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total'),
                  Text('${order.totalAmount.toStringAsFixed(0)} ${order.currency}'),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
