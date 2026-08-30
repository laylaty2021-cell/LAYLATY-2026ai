import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../domain/event_models.dart';

class EventsApi {
  EventsApi(this._dio);

  final Dio _dio;

  Future<List<LaylatyEvent>> listEvents() async {
    try {
      final response = await _dio.get('/events');
      return (response.data as List)
          .map((e) => LaylatyEvent.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<LaylatyEvent> createEvent({
    required String name,
    required String eventType,
    required DateTime eventDate,
    String? city,
    double? budgetTotal,
  }) async {
    try {
      final response = await _dio.post(
        '/events',
        data: {
          'name': name,
          'eventType': eventType,
          'eventDate': eventDate.toIso8601String().split('T').first,
          'city': ?city,
          'budgetTotal': ?budgetTotal,
        },
      );
      return LaylatyEvent.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<EventDashboard> getDashboard(String eventId) async {
    try {
      final response = await _dio.get('/events/$eventId');
      return EventDashboard.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
