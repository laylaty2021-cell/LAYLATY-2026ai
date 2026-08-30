/// Mirrors the `Cart`/`CartItem` schemas in docs/api/openapi.yaml.
class CartItem {
  const CartItem({
    required this.id,
    required this.itemType,
    required this.itemId,
    required this.quantity,
    required this.unitPrice,
  });

  final String id;
  final String itemType;
  final String itemId;
  final int quantity;
  final double unitPrice;

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
    id: json['id'] as String,
    itemType: json['itemType'] as String,
    itemId: json['itemId'] as String,
    quantity: json['quantity'] as int,
    // Prisma serializes Decimal fields as strings over JSON.
    unitPrice: double.parse(json['unitPrice'].toString()),
  );
}

class Cart {
  const Cart({
    required this.id,
    required this.storeId,
    required this.status,
    required this.items,
  });

  final String id;
  final String storeId;
  final String status;
  final List<CartItem> items;

  double get subtotal =>
      items.fold(0, (sum, item) => sum + item.unitPrice * item.quantity);

  factory Cart.fromJson(Map<String, dynamic> json) => Cart(
    id: json['id'] as String,
    storeId: json['storeId'] as String,
    status: json['status'] as String,
    items: (json['items'] as List)
        .map((i) => CartItem.fromJson(i as Map<String, dynamic>))
        .toList(),
  );
}
