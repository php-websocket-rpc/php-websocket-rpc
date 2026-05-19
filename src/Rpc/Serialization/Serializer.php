<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Serialization;

use PhpWebsocketRpc\Rpc\Payload\Error;
use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\Rpc\Payload\RpcResponse;

final class Serializer
{
    public function encode(Payload $payload): string
    {
        $data = $payload->toArray();

        $packed = \msgpack_pack($data);
        if ($packed === false) {
            throw new \RuntimeException('Failed to msgpack-encode payload');
        }

        return $packed;
    }

    /**
     * @throws \RuntimeException on invalid format
     */
    public function decode(string $data): Payload
    {
        $arr = \msgpack_unpack($data);

        if (!\is_array($arr) || \count($arr) !== 2 || !\is_string($arr[0])) {
            throw new \RuntimeException('Invalid wire format: expected [FQCN, props]');
        }

        [$class, $props] = $arr;

        if (!\is_array($props)) {
            throw new \RuntimeException('Invalid wire format: props must be an array');
        }

        if ($class === RpcResponse::class) {
            return $this->decodeRpcResponse($props);
        }

        if (!\is_subclass_of($class, Payload::class)) {
            throw new \RuntimeException(\sprintf(
                'Unknown payload class "%s" — must extend %s',
                $class,
                Payload::class,
            ));
        }

        return $class::fromArray($props);
    }

    private function decodeRpcResponse(array $props): RpcResponse
    {
        $id = $props['id'] ?? throw new \RuntimeException('RpcResponse missing id');

        // Decode nested payload (if present)
        $payload = null;
        if (isset($props['payload']) && \is_array($props['payload'])) {
            [$pClass, $pProps] = $props['payload'];
            if (\is_subclass_of($pClass, Payload::class)) {
                $payload = $pClass::fromArray($pProps);
            }
        }

        // Decode nested error (if present)
        $error = null;
        if (isset($props['error']) && \is_array($props['error'])) {
            $error = Error::fromArray($props['error']);
        }

        return new RpcResponse($id, $payload, $error);
    }
}
