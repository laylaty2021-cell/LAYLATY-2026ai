/// Mirrors one entry of the `SellableItem` union returned by
/// GET /catalog/search (docs/api/openapi.yaml).
class CatalogItem {
  const CatalogItem({
    required this.itemType,
    required this.itemId,
    required this.storeId,
    required this.name,
    required this.price,
    required this.currency,
  });

  final String itemType; // product | service | package
  final String itemId;
  final String storeId;
  final String name;
  final double price;
  final String currency;

  factory CatalogItem.fromJson(Map<String, dynamic> json) => CatalogItem(
    itemType: json['itemType'] as String,
    itemId: json['itemId'] as String,
    storeId: json['storeId'] as String,
    name: json['name'] as String,
    // Prisma serializes Decimal fields as strings over JSON.
    price: double.parse(json['price'].toString()),
    currency: json['currency'] as String,
  );
}
