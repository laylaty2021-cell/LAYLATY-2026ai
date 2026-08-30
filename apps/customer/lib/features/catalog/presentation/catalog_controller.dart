import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/catalog_api.dart';
import '../domain/catalog_item.dart';

final catalogApiProvider = Provider<CatalogApi>((ref) {
  return CatalogApi(ref.watch(apiClientProvider).dio);
});

/// A store's catalog items, keyed by storeId so Riverpod caches per-store
/// and refetches when navigating to a different store.
final storeCatalogProvider = FutureProvider.autoDispose
    .family<List<CatalogItem>, String>((ref, storeId) {
      return ref.watch(catalogApiProvider).search(storeId: storeId);
    });
