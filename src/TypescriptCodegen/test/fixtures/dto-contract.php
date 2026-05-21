<?php

/**
 * Test fixture for class DTO support in codegen.
 */

namespace App\Dto;

class Message
{
    public string $id;
    public string $text;
    public int $timestamp;
    public ?string $attachmentUrl = null;
    protected string $secret;       // should be skipped
    private int $internal;           // should be skipped
    public static string $meta = ''; // should be skipped
}

class Order
{
    public function __construct(
        public string $orderId,
        public readonly int $amount,
        protected string $internalNote, // should be skipped
        public ?string $note = null,
    ) {}
}
