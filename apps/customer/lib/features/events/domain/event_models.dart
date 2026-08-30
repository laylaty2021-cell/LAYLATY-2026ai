/// Plain Dart models mirroring the `Event`/`EventTask`/`EventBudgetItem`/
/// `EventDashboard` schemas in docs/api/openapi.yaml. Hand-written
/// `fromJson` (no code generation) to keep this scaffold dependency-light;
/// swap for freezed/json_serializable once the model surface grows.
class LaylatyEvent {
  const LaylatyEvent({
    required this.id,
    required this.name,
    required this.eventType,
    required this.eventDate,
    required this.status,
    this.city,
    this.budgetTotal,
  });

  final String id;
  final String name;
  final String eventType;
  final DateTime eventDate;
  final String status;
  final String? city;
  final double? budgetTotal;

  factory LaylatyEvent.fromJson(Map<String, dynamic> json) => LaylatyEvent(
    id: json['id'] as String,
    name: json['name'] as String,
    eventType: json['eventType'] as String,
    eventDate: DateTime.parse(json['eventDate'] as String),
    status: json['status'] as String,
    city: json['city'] as String?,
    budgetTotal: (json['budgetTotal'] as num?)?.toDouble(),
  );
}

class EventTask {
  const EventTask({
    required this.id,
    required this.title,
    required this.status,
    this.category,
    this.dueDate,
  });

  final String id;
  final String title;
  final String status;
  final String? category;
  final DateTime? dueDate;

  factory EventTask.fromJson(Map<String, dynamic> json) => EventTask(
    id: json['id'] as String,
    title: json['title'] as String,
    status: json['status'] as String,
    category: json['category'] as String?,
    dueDate: json['dueDate'] != null
        ? DateTime.parse(json['dueDate'] as String)
        : null,
  );
}

class EventBudgetItem {
  const EventBudgetItem({
    required this.id,
    required this.category,
    required this.plannedAmount,
    required this.actualAmount,
    required this.status,
  });

  final String id;
  final String category;
  final double plannedAmount;
  final double actualAmount;
  final String status;

  factory EventBudgetItem.fromJson(Map<String, dynamic> json) =>
      EventBudgetItem(
        id: json['id'] as String,
        category: json['category'] as String,
        plannedAmount: (json['plannedAmount'] as num).toDouble(),
        actualAmount: (json['actualAmount'] as num).toDouble(),
        status: json['status'] as String,
      );
}

/// GET /events/{eventId} response — the Event Dashboard aggregate
/// (blueprint §21). This is the screen the whole platform is organized
/// around (blueprint §7/§48): the event, not any single store, is home.
class EventDashboard {
  const EventDashboard({
    required this.event,
    required this.daysRemaining,
    required this.tasks,
    required this.budgetItems,
    required this.bookingCount,
    required this.orderCount,
    required this.recommendedServiceHints,
  });

  final LaylatyEvent event;
  final int daysRemaining;
  final List<EventTask> tasks;
  final List<EventBudgetItem> budgetItems;
  final int bookingCount;
  final int orderCount;
  final List<String> recommendedServiceHints;

  factory EventDashboard.fromJson(Map<String, dynamic> json) => EventDashboard(
    event: LaylatyEvent.fromJson(json['event'] as Map<String, dynamic>),
    daysRemaining: json['daysRemaining'] as int,
    tasks: (json['tasks'] as List)
        .map((t) => EventTask.fromJson(t as Map<String, dynamic>))
        .toList(),
    budgetItems: (json['budgetItems'] as List)
        .map((b) => EventBudgetItem.fromJson(b as Map<String, dynamic>))
        .toList(),
    bookingCount: (json['bookings'] as List).length,
    orderCount: (json['orders'] as List).length,
    recommendedServiceHints: (json['recommendedServices'] as List)
        .map((r) => (r as Map<String, dynamic>)['hint']?.toString() ?? '')
        .where((h) => h.isNotEmpty)
        .toList(),
  );
}
