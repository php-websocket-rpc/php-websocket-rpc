<?php

/**
 * Authentication/Authorization contract example.
 *
 * This file defines interfaces and implementations for the auth demo.
 */

use PhpWebsocketRpc\Rpc\Contract\Attribute\NeedAuthorization;
use PhpWebsocketRpc\Rpc\Contract\AuthService;

// ─── Protected Service Interface ─────────────────────────────────

#[NeedAuthorization]
interface SecureDataService
{
    public function getSecret(): string;
}

interface MixedAccessService
{
    public function getPublicInfo(): string;

    #[NeedAuthorization]
    public function getProfile(): string;

    #[NeedAuthorization(roles: ['admin'])]
    public function adminOnly(): string;
}

// ─── Service Implementations ─────────────────────────────────────

class SecureDataServiceImpl implements SecureDataService
{
    public function getSecret(): string
    {
        return 'the-secret-password';
    }
}

class MixedAccessServiceImpl implements MixedAccessService
{
    public function getPublicInfo(): string
    {
        return 'public-info';
    }

    public function getProfile(): string
    {
        return 'user-profile-data';
    }

    public function adminOnly(): string
    {
        return 'admin-level-access';
    }
}
