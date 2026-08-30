import 'package:dio/dio.dart';

/// A normalized failure surfaced to the presentation layer. Every `data/`
/// class in every feature should catch DioException and rethrow this
/// instead — screens never inspect Dio/HTTP details directly.
class ApiException implements Exception {
  final int? statusCode;
  final String message;

  const ApiException(this.message, {this.statusCode});

  factory ApiException.fromDioException(DioException error) {
    final data = error.response?.data;
    final serverMessage = data is Map<String, dynamic> ? data['message'] : null;
    final message = serverMessage is String
        ? serverMessage
        : (serverMessage is List && serverMessage.isNotEmpty
              ? serverMessage.first.toString()
              : error.message ?? 'Something went wrong');

    return ApiException(message, statusCode: error.response?.statusCode);
  }

  bool get isUnauthorized => statusCode == 401;
  bool get isConflict => statusCode == 409;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;

  @override
  String toString() => message;
}
