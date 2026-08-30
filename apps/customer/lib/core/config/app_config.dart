/// Environment configuration for the customer app.
///
/// Base URL is provided at build time so the same code runs against
/// dev/staging/production without a rebuild of logic:
///
///   flutter run --dart-define=API_BASE_URL=https://api.staging.laylaty.com/v1
///
/// Defaults to the local API from `docs/README.md` / `infrastructure/docker-compose.yml`.
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/v1',
  );
}
