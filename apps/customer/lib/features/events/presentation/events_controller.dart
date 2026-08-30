import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/events_api.dart';
import '../domain/event_models.dart';

final eventsApiProvider = Provider<EventsApi>((ref) {
  return EventsApi(ref.watch(apiClientProvider).dio);
});

/// The customer's events, nearest-upcoming first (server already orders
/// by event_date asc — see apps/api EventsService.list).
final eventsListProvider = FutureProvider.autoDispose<List<LaylatyEvent>>((
  ref,
) {
  return ref.watch(eventsApiProvider).listEvents();
});

/// The aggregated dashboard for one event (blueprint §21), keyed by id so
/// Riverpod caches per-event and refetches when the id changes.
final eventDashboardProvider = FutureProvider.autoDispose
    .family<EventDashboard, String>((ref, eventId) {
      return ref.watch(eventsApiProvider).getDashboard(eventId);
    });
