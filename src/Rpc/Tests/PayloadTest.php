<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Tests\Payload;

use PHPUnit\Framework\TestCase;
use PhpWebsocketRpc\Rpc\Payload\Error;
use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\Rpc\Payload\RpcResponse;
use PhpWebsocketRpc\Rpc\Serialization\Serializer;

class PayloadTest extends TestCase
{
    public function testPayloadHasUniqueId(): void
    {
        $a = $this->createPayload();
        $b = $this->createPayload();
        $this->assertNotNull($a->id);
        $this->assertNotSame($a->id, $b->id);
    }

    public function testSerializationRoundTrip(): void
    {
        $serializer = new Serializer();
        $payload = $this->createPayload();

        $packed = $serializer->encode($payload);
        $decoded = $serializer->decode($packed);

        $this->assertInstanceOf($payload::class, $decoded);
        $this->assertSame($payload->id, $decoded->id);
    }

    public function testRpcResponseSuccess(): void
    {
        $response = new RpcResponse('test-id-1', null, null);
        $this->assertTrue($response->isSuccess());
        $this->assertNull($response->getError());
    }

    public function testRpcResponseError(): void
    {
        $error = new Error(Error::METHOD_NOT_FOUND, 'Not found');
        $response = new RpcResponse('test-id-2', null, $error);
        $this->assertFalse($response->isSuccess());
        $this->assertSame(-32601, $response->getError()->code);
    }

    public function testErrorSerialization(): void
    {
        $serializer = new Serializer();
        $error = new Error(-32000, 'timeout', ['key' => 'val']);
        $response = new RpcResponse('id-3', null, $error);

        $packed = $serializer->encode($response);
        $decoded = $serializer->decode($packed);

        $this->assertInstanceOf(RpcResponse::class, $decoded);
        $this->assertFalse($decoded->isSuccess());
        $this->assertSame(-32000, $decoded->getError()->code);
        $this->assertSame('timeout', $decoded->getError()->message);
        $this->assertSame(['key' => 'val'], $decoded->getError()->data);
        $this->assertNull($decoded->getError()->exceptionClass);
    }

    public function testErrorWithExceptionClass(): void
    {
        $serializer = new Serializer();
        $error = new Error(-32001, 'Insufficient funds', ['balance' => 10], 'Domain\\InsufficientFunds');
        $response = new RpcResponse('id-4', null, $error);

        $packed = $serializer->encode($response);
        $decoded = $serializer->decode($packed);

        $this->assertFalse($decoded->isSuccess());
        $this->assertSame(-32001, $decoded->getError()->code);
        $this->assertSame('Insufficient funds', $decoded->getError()->message);
        $this->assertSame(['balance' => 10], $decoded->getError()->data);
        $this->assertSame('Domain\\InsufficientFunds', $decoded->getError()->exceptionClass);
    }

    public function testErrorBackwardCompatibility(): void
    {
        // Old format (3 elements) must still decode correctly
        $serializer = new Serializer();
        $error = new Error(-32602, 'Bad params', ['field' => 'amount']);
        $response = new RpcResponse('id-5', null, $error);

        $packed = $serializer->encode($response);
        $decoded = $serializer->decode($packed);

        $this->assertSame(-32602, $decoded->getError()->code);
        $this->assertSame('Bad params', $decoded->getError()->message);
        $this->assertSame(['field' => 'amount'], $decoded->getError()->data);
        $this->assertNull($decoded->getError()->exceptionClass);
    }

    private function createPayload(): Payload
    {
        return new class extends Payload implements Kind\RpcRequest {
            public function __construct(
                public readonly string $value = 'test',
            ) {
                parent::__construct();
            }

            public static function responseClass(): string
            {
                return self::class;
            }
        };
    }
}
