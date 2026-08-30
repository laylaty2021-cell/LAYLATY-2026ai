/// Mirrors the `Order`/`OrderItem` schemas in docs/api/openapi.yaml.
class OrderItem {
  const OrderItem({
    required this.id,
    required this.itemType,
    required this.nameSnapshot,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
  });

  final String id;
  final String itemType;
  final String nameSnapshot;
  final int quantity;
  final double unitPrice;
  final double totalPrice;

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
    id: json['id'] as String,
    itemType: json['itemType'] as String,
    nameSnapshot: json['nameSnapshot'] as String,
    quantity: json['quantity'] as int,
    unitPrice: double.parse(json['unitPrice'].toString()),
    totalPrice: double.parse(json['totalPrice'].toString()),
  );
}

class LaylatyOrder {
  const LaylatyOrder({
    required this.id,
    required this.orderNumber,
    required this.storeId,
    required this.status,
    required this.totalAmount,
    required this.currency,
    required this.items,
  });

  final String id;
  final String orderNumber;
  final String storeId;
  final String status;
  final double totalAmount;
  final String currency;
  final List<OrderItem> items;

  factory LaylatyOrder.fromJson(Map<String, dynamic> json) => LaylatyOrder(
    id: json['id'] as String,
    orderNumber: json['orderNumber'] as String,
    storeId: json['storeId'] as String,
    status: json['status'] as String,
    totalAmount: double.parse(json['totalAmount'].toString()),
    currency: json['currency'] as String,
    items: (json['items'] as List)
        .map((i) => OrderItem.fromJson(i as Map<String, dynamic>))
        .toList(),
  );
}
