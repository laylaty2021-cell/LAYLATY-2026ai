import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'store_detail_screen.dart';
import 'stores_controller.dart';

/// Browse active stores across the platform (blueprint §15) — reached from
/// EventsListScreen via the storefront icon. Not itself part of the
/// event-centric home; this is where a customer finds who to book/buy from.
class StoresListScreen extends ConsumerWidget {
  const StoresListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final storesAsync = ref.watch(storesSearchProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Browse stores'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(64),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search stores',
                prefixIcon: Icon(Icons.search),
                isDense: true,
                border: OutlineInputBorder(),
              ),
              onSubmitted: (value) =>
                  ref.read(storeSearchQueryProvider.notifier).state = value,
            ),
          ),
        ),
      ),
      body: storesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load: $error')),
        data: (stores) {
          if (stores.isEmpty) {
            return const Center(child: Text('No stores found.'));
          }
          return ListView.builder(
            itemCount: stores.length,
            itemBuilder: (context, index) {
              final store = stores[index];
              return ListTile(
                leading: const CircleAvatar(child: Icon(Icons.storefront)),
                title: Text(store.name),
                subtitle: Text(
                  [store.businessType.replaceAll('_', ' '), store.city]
                      .whereType<String>()
                      .join(' · '),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => StoreDetailScreen(slug: store.slug),
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
