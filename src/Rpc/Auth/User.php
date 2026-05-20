<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Auth;

/**
 * Simple value-object implementation of WebsocketUserInterface.
 *
 * This class lives in the core RPC package so it's available to both
 * server and client sides. The ContractSerializer encodes/decodes it
 * via its public readonly properties.
 */
final class User implements WebsocketUserInterface
{
    /**
     * @param string       $id    Unique user identifier
     * @param list<string> $roles User roles
     */
    public function __construct(
        public readonly string $id,
        public readonly array $roles,
    ) {}

    public function getUniqueIdentifier(): string
    {
        return $this->id;
    }

    public function getRoles(): array
    {
        return $this->roles;
    }
}
