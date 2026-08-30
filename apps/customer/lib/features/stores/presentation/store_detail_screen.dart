import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../cart/presentation/cart_controller.dart';
import '../../cart/presentation/cart_screen.dart';
import '../../catalog/presentation/catalog_controller.dart';
import 'stores_controller.dart';

/// A store's public profile plus its catalog (blueprint §15) — the
/// customer-facing counterpart to apps/merchant's store detail page.
class StoreDetailScreen extends ConsumerWidget {
  const StoreDetailScreen({required this.slug, super.key});

  final String slug;

  Future<void> _addToCart(
    BuildContext context,
    WidgetRef ref,
    String storeId,
    String itemType,
    String itemId,
  ) async {
    try {
      await ref
          .read(cartApiProvider)
          .addItem(storeId: storeId, itemType: itemType, itemId: itemId);
      ref.invalidate(cartProvider(storeId));
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Added to cart')));
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final storeAsync = ref.watch(storeBySlugProvider(slug));

    return Scaffold(
      appBar: AppBar(
        title: Text(storeAsync.valueOrNull?.name ?? 'Store'),
        actions: [
          if (storeAsync.valueOrNull != null)
            IconButton(
              icon: const Icon(Icons.shopping_cart_outlined),
              tooltip: 'Cart',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) =>
                      CartScreen(storeId: storeAsync.value!.id),
                ),
              ),
            ),
        ],
      ),
      body: storeAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load: $error')),
        data: (store) {
          final catalogAsync = ref.watch(storeCatalogProvider(store.id));
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                store.businessType.replaceAll('_', ' '),
                style: Theme.of(context).textTheme.labelLarge,
              ),
              if (store.city != null) ...[
                const SizedBox(height: 4),
                Text(store.city!, style: Theme.of(context).textTheme.bodyMedium),
              ],
              if (store.description != null) ...[
                const SizedBox(height: 12),
                Text(store.description!),
              ],
              const SizedBox(height: 24),
              Text('Catalog', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              catalogAsync.when(
                loading: () =>
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                error: (error, _) => Text('Failed to load catalog: $error'),
                data: (items) {
                  if (items.isEmpty) {
                    return const Text('This store has nothing listed yet.');
                  }
                  return Column(
                    children: items
                        .map(
                          (item) => Card(
                            child: ListTile(
                              title: Text(item.name),
                              subtitle: Text(item.itemType),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${item.price.toStringAsFixed(0)} ${item.currency}',
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.add_shopping_cart),
                                    tooltip: 'Add to cart',
                                    onPressed: () => _addToCart(
                                      context,
                                      ref,
                                      store.id,
                                      item.itemType,
                                      item.itemId,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}
