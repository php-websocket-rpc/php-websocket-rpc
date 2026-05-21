/**
 * Built-in AuthService types.
 *
 * The PHP server auto-registers this service when
 * `RpcServer::useAuthentication()` is called. These types ship with
 * the client package so you never need to run codegen against the
 * vendor directory.
 *
 * Usage:
 *
 * ```typescript
 * import {
 *     createContractProxy,
 *     AuthServiceProxy,
 *     AuthServiceConfig,
 * } from '@php-websocket-rpc/client';
 *
 * const auth = createContractProxy<AuthServiceProxy>(client, AuthServiceConfig);
 *
 * const user = await auth.authenticate('my-jwt-token');
 * console.log(user.id);    // "alice"
 * console.log(user.roles); // ["customer"]
 *
 * auth.logout();
 * ```
 */

import type { ProxyOptions } from './types';

// ─── Response type ────────────────────────────────────────────

/**
 * User value object returned by `authenticate()`.
 *
 * Matches `PhpWebsocketRpc\Rpc\Auth\User` on the PHP side.
 * The server sends it as `[FQCN, props]` on the wire, which the
 * client already decodes into a plain object with this shape.
 */
export interface AuthUser {
    /** Unique user identifier (user ID, email, UUID, etc.) */
    id: string;
    /** Roles assigned to this user (e.g. `["admin"]`, `["customer"]`) */
    roles: string[];
}

// ─── Proxy interface ──────────────────────────────────────────

/**
 * Proxy interface for the built-in AuthService contract.
 *
 * Methods:
 * - `authenticate(token)` — login with a token, returns user data
 * - `logout()` — clear the auth state for the current connection
 */
export interface AuthServiceProxy {
    /**
     * Authenticate with a token and return the user data.
     *
     * On success the server stores the user in the client's session,
     * making protected methods (those marked with `#[NeedAuthorization]`)
     * accessible.
     *
     * @param token The authentication token (JWT, session ID, etc.)
     * @returns The authenticated user's identity and roles
     */
    authenticate(token: string): Promise<AuthUser>;

    /**
     * Clear the authentication state for the current connection.
     *
     * After calling this, protected methods will require a new
     * `authenticate()` call.
     */
    logout(): void;
}

// ─── Proxy config ─────────────────────────────────────────────

/**
 * ProxyOptions for the built-in AuthService contract.
 *
 * Pass this directly to `createContractProxy()`:
 * ```typescript
 * const auth = createContractProxy<AuthServiceProxy>(client, AuthServiceConfig);
 * ```
 */
export const AuthServiceConfig = {
    /** Matches the PHP FQCN: `PhpWebsocketRpc\Rpc\Contract\AuthService` */
    service: 'PhpWebsocketRpc\\Rpc\\Contract\\AuthService',
    call: ['authenticate'],
    notify: ['logout'],
} satisfies ProxyOptions;
