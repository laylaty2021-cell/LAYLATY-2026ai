import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../stores/presentation/stores_list_screen.dart';
import '../domain/event_models.dart';
import 'create_event_screen.dart';
import 'event_dashboard_screen.dart';
import 'events_controller.dart';

/// App home once logged in. Shows the nearest upcoming event's dashboard,
/// or a "plan your first event" prompt for a brand-new customer.
class EventsListScreen extends ConsumerWidget {
  const EventsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(eventsListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Laylaty'),
        actions: [
          IconButton(
            icon: const Icon(Icons.storefront_outlined),
            tooltip: 'Browse stores',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const StoresListScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => const CreateEventScreen())),
        icon: const Icon(Icons.add),
        label: const Text('New event'),
      ),
      body: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load: $error')),
        data: (events) {
          if (events.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  "You don't have an event yet — tap \"New event\" to start planning.",
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return ListView.builder(
            itemCount: events.length,
            itemBuilder: (context, index) {
              final LaylatyEvent event = events[index];
              return ListTile(
                title: Text(event.name),
                subtitle: Text(
                  '${event.eventType} — ${event.eventDate.toIso8601String().split('T').first}',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => EventDashboardScreen(eventId: event.id),
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
