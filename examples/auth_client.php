<?php

/**
 * Authentication/Authorization client example.
 *
 * Demonstrates:
 *   1. Calling authenticate() with a token
 *   2. Accessing protected methods after authentication
 *   3. Handling auth failures (invalid token, insufficient permissions)
 *   4. Logging out
 *
 * Run after starting auth_server.php:
 *   php examples/auth_server.php     (terminal 1)
 *   php examples/auth_client.php     (terminal 2)
 */

declare(strict_types=1);

use PhpWebsocketRpc\Rpc\Contract\AuthService;
use PhpWebsocketRpc\RpcClient\Client\RpcClient;

require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/auth_contract.php';

$passed = 0;
$failed = 0;

function assert_eq(mixed $expected, mixed $actual, string $label): void
{
    global $passed, $failed;
    if ($expected === $actual) {
        $passed++;
        echo "  ✓ $label\n";
    } else {
        $failed++;
        echo "  ✗ $label: expected " . \var_export($expected, true) . ", got " . \var_export($actual, true) . "\n";
    }
}

try {
    echo "Connecting to ws://127.0.0.1:9503/rpc...\n";
    $client = RpcClient::connect('ws://127.0.0.1:9503/rpc');
    echo "✓ Connected\n\n";

    // ─── Test 1: Access protected method without auth ─────────

    echo "═══ Test 1: Unauthenticated access should fail ═══\n";
    $secureData = $client->createProxy(SecureDataService::class);

    try {
        $secureData->getSecret();
        echo "  ✗ Should have thrown!\n";
        $failed++;
    } catch (\PhpWebsocketRpc\Rpc\Exception\AuthenticationException $e) {
        assert_eq(-32010, $e->getRpcCode(), 'Error code is AUTHENTICATION_FAILED');
    }

    // ─── Test 2: Authenticate with invalid token ────────────

    echo "\n═══ Test 2: Invalid token should fail ═══\n";
    $auth = $client->createProxy(AuthService::class);

    try {
        $auth->authenticate('invalid-token');
        echo "  ✗ Should have thrown!\n";
        $failed++;
    } catch (\PhpWebsocketRpc\Rpc\Exception\AuthenticationException $e) {
        assert_eq(-32010, $e->getRpcCode(), 'Error code is AUTHENTICATION_FAILED');
    }

    // ─── Test 3: Authenticate with valid token (alice) ─────

    echo "\n═══ Test 3: Authenticate as alice (customer role) ═══\n";
    $user = $auth->authenticate('tok-alice');
    assert_eq('alice', $user->id, 'User ID matches');
    assert_eq(['customer'], $user->roles, 'Roles match');

    // ─── Test 4: Access protected method after auth ─────────

    echo "\n═══ Test 4: Access protected methods after auth ═══\n";
    $secret = $secureData->getSecret();
    assert_eq('the-secret-password', $secret, 'SecureDataService->getSecret() works');

    // ─── Test 5: Mixed access service ───────────────────────

    echo "\n═══ Test 5: Mixed access (public vs protected) ═══\n";
    $mixed = $client->createProxy(MixedAccessService::class);

    $public = $mixed->getPublicInfo();
    assert_eq('public-info', $public, 'Public method works without auth');

    $profile = $mixed->getProfile();
    assert_eq('user-profile-data', $profile, 'Protected method works after auth');

    // ─── Test 6: Role-based authorization ───────────────────

    echo "\n═══ Test 6: Alice cannot access admin-only method ═══\n";
    try {
        $mixed->adminOnly();
        echo "  ✗ Should have thrown!\n";
        $failed++;
    } catch (\PhpWebsocketRpc\Rpc\Exception\AuthorizationException $e) {
        assert_eq(-32011, $e->getRpcCode(), 'Error code is AUTHORIZATION_FAILED');
    }

    // ─── Test 7: Authenticate as admin ──────────────────────

    echo "\n═══ Test 7: Authenticate as bob (admin role) ═══\n";
    $user = $auth->authenticate('tok-admin');
    assert_eq('bob', $user->id, 'User ID matches');
    assert_eq(['admin'], $user->roles, 'Roles match');

    $adminResult = $mixed->adminOnly();
    assert_eq('admin-level-access', $adminResult, 'Admin can access admin-only method');

    // ─── Test 8: Logout then access fails again ─────────────

    echo "\n═══ Test 8: Logout should revoke access ═══\n";
    $auth->logout();

    try {
        $secureData->getSecret();
        echo "  ✗ Should have thrown after logout!\n";
        $failed++;
    } catch (\PhpWebsocketRpc\Rpc\Exception\AuthenticationException $e) {
        assert_eq(-32010, $e->getRpcCode(), 'Error code is AUTHENTICATION_FAILED after logout');
    }

    // ─── Summary ────────────────────────────────────────────

    $client->close();

    echo "\n═══ Results ═══\n";
    echo "  Passed: $passed\n";
    echo "  Failed: $failed\n";

    if ($failed > 0) {
        echo "\n❌ Some tests failed!\n";
        exit(1);
    }

    echo "\n✓ All auth tests passed!\n";

} catch (\Throwable $e) {
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
