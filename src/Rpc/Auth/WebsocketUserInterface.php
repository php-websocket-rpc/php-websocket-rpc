<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Auth;

/**
 * Represents an authenticated user in the RPC WebSocket system.
 *
 * Implementations carry identity and role information that the server-side
 * AuthenticationProvider returns and the AuthorizationProvider consumes.
 */
interface WebsocketUserInterface
{
    /**
     * Return a unique identifier for this user (e.g. user ID, email, UUID).
     */
    public function getUniqueIdentifier(): string;

    /**
     * Return the roles assigned to this user.
     *
     * @return list<string>
     */
    public function getRoles(): array;
}
