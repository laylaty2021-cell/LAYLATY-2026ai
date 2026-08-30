import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/stores_api.dart';
import '../domain/store_models.dart';

final storesApiProvider = Provider<StoresApi>((ref) {
  return StoresApi(ref.watch(apiClientProvider).dio);
});

/// The active search query, held so the list screen and its search field
/// stay in sync without lifting state up into a StatefulWidget.
final storeSearchQueryProvider = StateProvider.autoDispose<String>((ref) => '');

final storesSearchProvider = FutureProvider.autoDispose<List<LaylatyStore>>((
  ref,
) {
  final query = ref.watch(storeSearchQueryProvider);
  return ref.watch(storesApiProvider).search(q: query.isEmpty ? null : query);
});

final storeBySlugProvider = FutureProvider.autoDispose.family<LaylatyStore, String>(
  (ref, slug) {
    return ref.watch(storesApiProvider).getBySlug(slug);
  },
);
