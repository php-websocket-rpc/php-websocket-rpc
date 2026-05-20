<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract\Attribute;

/**
 * Marks a contract method or interface as requiring authorization.
 *
 * When applied to an interface, all methods inherit the requirement.
 * When applied to a method, only that method is protected (overrides
 * any class-level setting).
 *
 * Usage:
 *   #[NeedAuthorization]
 *   public function getSecretData(): array;
 *
 *   #[NeedAuthorization(roles: ['admin', 'moderator'])]
 *   public function deleteUser(string $id): void;
 *
 * @param string[]|null $roles Optional — if set, the user must have at
 *                              least one of the listed roles. When null,
 *                              any authenticated user is allowed.
 */
#[\Attribute(\Attribute::TARGET_METHOD | \Attribute::TARGET_CLASS)]
final class NeedAuthorization
{
    /**
     * @param string[]|null $roles Required roles (null = any authenticated user)
     */
    public function __construct(
        public readonly ?array $roles = null,
    ) {}
}
