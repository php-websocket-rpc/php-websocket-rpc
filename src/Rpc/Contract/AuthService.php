<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract;

use PhpWebsocketRpc\Rpc\Auth\WebsocketUserInterface;

/**
 * Built-in authentication contract.
 *
 * Every client can call these methods regardless of their authentication
 * state. The server auto-registers this service when
 * RpcServer::useAuthentication() is called.
 *
 * Usage:
 *   $auth = $client->createProxy(AuthService::class);
 *   $user = $auth->authenticate('jwt-token-here');
 *   // $user contains id + roles from the server
 */
interface AuthService
{
    /**
     * Authenticate with a token and return the user data.
     *
     * On success the server stores the user in the client's session,
     * making protected methods (those marked with #[NeedAuthorization])
     * accessible.
     *
     * @param string $token The authentication token (JWT, session ID, etc.)
     *
     * @return WebsocketUserInterface The authenticated user's data
     *
     * @throws \PhpWebsocketRpc\Rpc\Exception\AuthenticationException
     *         If the token is invalid or expired
     */
    public function authenticate(#[\SensitiveParameter] string $token): WebsocketUserInterface;

    /**
     * Clear the authentication state for the current connection.
     */
    public function logout(): void;
}
