import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laylaty_customer/main.dart';

// flutter_secure_storage talks to native code over a MethodChannel that
// doesn't exist in the widget-test environment (no real device/emulator);
// this stubs it out so TokenStorage.isLoggedIn() resolves instead of
// throwing a MissingPluginException.
const _secureStorageChannel = MethodChannel(
  'plugins.it_nomads.com/flutter_secure_storage',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_secureStorageChannel, (call) async {
          if (call.method == 'readAll') return <String, String>{};
          return null; // 'read' -> no stored token; 'write'/'delete' -> void
        });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_secureStorageChannel, null);
  });

  testWidgets('shows the login screen when no session is stored', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: LaylatyApp()));
    await tester.pumpAndSettle();

    expect(find.text('Laylaty'), findsWidgets);
    expect(
      find.widgetWithText(TextFormField, 'Email or phone'),
      findsOneWidget,
    );
  });
}
