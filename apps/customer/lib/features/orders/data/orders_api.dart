import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../domain/order_models.dart';

class OrdersApi {
  OrdersApi(this._dio);

  final Dio _dio;

  Future<List<LaylatyOrder>> listOrders() async {
    try {
      final response = await _dio.get('/orders');
      return (response.data as List)
          .map((o) => LaylatyOrder.fromJson(o as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<LaylatyOrder> getOrder(String orderId) async {
    try {
      final response = await _dio.get('/orders/$orderId');
      return LaylatyOrder.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
