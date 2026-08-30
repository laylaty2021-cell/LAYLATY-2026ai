import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'events_controller.dart';

/// blueprint §21 "الصفحة الرئيسية": days remaining, budget status, tasks,
/// recommended services, upcoming bookings/orders — for the platform's
/// central object, the event, not any single store (blueprint §7/§48).
class EventDashboardScreen extends ConsumerWidget {
  const EventDashboardScreen({super.key, required this.eventId});

  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(eventDashboardProvider(eventId));

    return Scaffold(
      appBar: AppBar(title: const Text('Your event')),
      body: dashboardAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load: $error')),
        data: (dashboard) {
          final plannedTotal = dashboard.budgetItems.fold<double>(
            0,
            (sum, item) => sum + item.plannedAmount,
          );
          final actualTotal = dashboard.budgetItems.fold<double>(
            0,
            (sum, item) => sum + item.actualAmount,
          );

          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(eventDashboardProvider(eventId)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  dashboard.event.name,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 4),
                Text('${dashboard.daysRemaining} days remaining'),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _StatColumn(
                          label: 'Budget spent',
                          value: actualTotal.toStringAsFixed(0),
                        ),
                        _StatColumn(
                          label: 'Budget planned',
                          value: plannedTotal.toStringAsFixed(0),
                        ),
                        _StatColumn(
                          label: 'Bookings',
                          value: '${dashboard.bookingCount}',
                        ),
                        _StatColumn(
                          label: 'Orders',
                          value: '${dashboard.orderCount}',
                        ),
                      ],
                    ),
                  ),
                ),
                if (dashboard.recommendedServiceHints.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    'Recommended for you',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  ...dashboard.recommendedServiceHints.map(
                    (hint) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.recommend),
                        title: Text(hint.replaceAll('_', ' ')),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Text('Tasks', style: Theme.of(context).textTheme.titleMedium),
                if (dashboard.tasks.isEmpty) const Text('No tasks yet.'),
                ...dashboard.tasks.map(
                  (task) => CheckboxListTile(
                    value: task.status == 'done',
                    onChanged:
                        null, // task status updates: TODO wire PATCH endpoint
                    title: Text(task.title),
                    subtitle: task.dueDate != null
                        ? Text(
                            'Due ${task.dueDate!.toIso8601String().split('T').first}',
                          )
                        : null,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: Theme.of(context).textTheme.titleLarge),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
