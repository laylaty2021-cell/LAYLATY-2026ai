import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../orders/domain/order_models.dart';
import '../domain/cart_models.dart';

class CartApi {
  CartApi(this._dio);

  final Dio _dio;

  Future<Cart> getCart(String storeId) async {
    try {
      final response = await _dio.get(
        '/cart',
        queryParameters: {'storeId': storeId},
      );
      return Cart.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<Cart> addItem({
    required String storeId,
    required String itemType,
    required String itemId,
    int quantity = 1,
  }) async {
    try {
      final response = await _dio.post(
        '/cart/items',
        data: {
          'storeId': storeId,
          'itemType': itemType,
          'itemId': itemId,
          'quantity': quantity,
        },
      );
      return Cart.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> removeItem(String cartItemId) async {
    try {
      await _dio.delete('/cart/items/$cartItemId');
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<LaylatyOrder> checkout(String storeId) async {
    try {
      final response = await _dio.post(
        '/cart/checkout',
        data: {'storeId': storeId},
      );
      return LaylatyOrder.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
