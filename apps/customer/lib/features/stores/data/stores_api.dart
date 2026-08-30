import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../domain/store_models.dart';

class StoresApi {
  StoresApi(this._dio);

  final Dio _dio;

  /// GET /stores — public search/listing (blueprint §15). No auth header
  /// required, but the shared Dio instance attaches one anyway if the
  /// customer happens to be logged in; the endpoint ignores it either way.
  Future<List<LaylatyStore>> search({String? q, String? city}) async {
    try {
      final response = await _dio.get(
        '/stores',
        queryParameters: {'q': ?q, 'city': ?city},
      );
      return (response.data as List)
          .map((s) => LaylatyStore.fromJson(s as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<LaylatyStore> getBySlug(String slug) async {
    try {
      final response = await _dio.get('/stores/$slug');
      return LaylatyStore.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
