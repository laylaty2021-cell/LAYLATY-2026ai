import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../orders/presentation/order_detail_screen.dart';
import 'cart_controller.dart';

/// One store's cart (blueprint §14 — a cart is always scoped to a single
/// store, never mixed across stores). Reached from StoreDetailScreen's
/// cart icon.
class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({required this.storeId, super.key});

  final String storeId;

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  bool _checkingOut = false;

  Future<void> _removeItem(String cartItemId) async {
    try {
      await ref.read(cartApiProvider).removeItem(cartItemId);
      ref.invalidate(cartProvider(widget.storeId));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _checkout() async {
    setState(() => _checkingOut = true);
    try {
      final order = await ref.read(cartApiProvider).checkout(widget.storeId);
      ref.invalidate(cartProvider(widget.storeId));
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => OrderDetailScreen(orderId: order.id),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _checkingOut = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cartAsync = ref.watch(cartProvider(widget.storeId));

    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: cartAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load: $error')),
        data: (cart) {
          if (cart.items.isEmpty) {
            return const Center(child: Text('Your cart is empty.'));
          }
          return Column(
            children: [
              Expanded(
                child: ListView.builder(
                  itemCount: cart.items.length,
                  itemBuilder: (context, index) {
                    final item = cart.items[index];
                    return ListTile(
                      title: Text('${item.itemType} · qty ${item.quantity}'),
                      subtitle: Text(
                        '${item.unitPrice.toStringAsFixed(0)} SAR each',
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => _removeItem(item.id),
                      ),
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Subtotal'),
                        Text('${cart.subtotal.toStringAsFixed(0)} SAR'),
                      ],
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _checkingOut ? null : _checkout,
                      child: _checkingOut
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Checkout'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
