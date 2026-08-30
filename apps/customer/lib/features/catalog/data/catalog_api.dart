import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../domain/catalog_item.dart';

class CatalogApi {
  CatalogApi(this._dio);

  final Dio _dio;

  /// GET /catalog/search — public union search across products, services,
  /// and packages. Passing storeId narrows it to one store's catalog (used
  /// by the store detail screen); passing q instead powers general search.
  Future<List<CatalogItem>> search({String? storeId, String? q}) async {
    try {
      final response = await _dio.get(
        '/catalog/search',
        queryParameters: {'storeId': ?storeId, 'q': ?q},
      );
      return (response.data as List)
          .map((i) => CatalogItem.fromJson(i as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
