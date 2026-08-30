/// Mirrors the `Store` schema in docs/api/openapi.yaml. Hand-written
/// `fromJson` (no code generation) — see event_models.dart for the same
/// convention.
class LaylatyStore {
  const LaylatyStore({
    required this.id,
    required this.name,
    required this.slug,
    required this.businessType,
    required this.status,
    this.description,
    this.city,
    this.logoUrl,
  });

  final String id;
  final String name;
  final String slug;
  final String businessType;
  final String status;
  final String? description;
  final String? city;
  final String? logoUrl;

  factory LaylatyStore.fromJson(Map<String, dynamic> json) => LaylatyStore(
    id: json['id'] as String,
    name: json['name'] as String,
    slug: json['slug'] as String,
    businessType: json['businessType'] as String,
    status: json['status'] as String,
    description: json['description'] as String?,
    city: json['city'] as String?,
    logoUrl: json['logoUrl'] as String?,
  );
}
