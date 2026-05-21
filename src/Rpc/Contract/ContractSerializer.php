<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract;

use PhpWebsocketRpc\Rpc\Payload\Payload;

/**
 * Handles encoding/decoding values for wire transmission in the contract system.
 *
 * - Scalars pass through as-is (msgpack native).
 * - Arrays are recursively encoded/decoded.
 * - Objects are encoded as [FQCN, public_properties] and reconstructed via
 *   constructor injection or property hydration on decode.
 * - Payload subclasses use their existing toArray()/fromArray() methods.
 */
final class ContractSerializer
{
    /**
     * Encode a value for wire transmission.
     *
     * - Scalars pass through as-is (msgpack native).
     * - Backed enums (string/int) are encoded as their backing value (scalar).
     * - Unit enums are encoded as their case name (string).
     * - Arrays are recursively encoded.
     * - Payload subclasses use their toArray() method.
     * - Other objects are encoded as [FQCN, props].
     */
    public static function encode(mixed $value): mixed
    {
        if ($value === null || \is_scalar($value)) {
            return $value;
        }

        // Backed enums: send the backing value (string/int) directly
        if ($value instanceof \BackedEnum) {
            return $value->value;
        }

        // Unit enums: send the case name as a string
        if ($value instanceof \UnitEnum) {
            return $value->name;
        }

        if (\is_array($value)) {
            $result = [];
            foreach ($value as $k => $v) {
                $result[$k] = self::encode($v);
            }
            return $result;
        }

        if ($value instanceof Payload) {
            return $value->toArray();
        }

        if (\is_object($value)) {
            return self::encodeObject($value);
        }

        return $value;
    }

    /**
     * Decode a value from wire transmission.
     *
     * When $expectedType is a class-string and the decoded value is an
     * [FQCN, props] array, it is reconstructed as that type.
     *
     * Backed enums are reconstructed from their scalar backing value.
     * Unit enums are reconstructed from their case name string.
     */
    public static function decode(mixed $value, ?string $expectedType = null): mixed
    {
        // Try to reconstruct a backed enum from scalar value
        if ($expectedType !== null && \is_subclass_of($expectedType, \BackedEnum::class)) {
            return $expectedType::from($value);
        }

        // Try to reconstruct a unit enum from case name
        if ($expectedType !== null && \is_subclass_of($expectedType, \UnitEnum::class)) {
            $const = $expectedType . '::' . $value;
            if (\defined($const)) {
                return \constant($const);
            }
            return $value;
        }

        if ($value === null || \is_scalar($value)) {
            return $value;
        }

        if (\is_array($value) && \count($value) === 2 && \is_string($value[0]) && \is_array($value[1])) {
            return self::decodeObject($value, $expectedType);
        }

        if (\is_array($value)) {
            $result = [];
            foreach ($value as $k => $v) {
                $result[$k] = self::decode($v);
            }
            return $result;
        }

        return $value;
    }

    /**
     * Encode an arbitrary object to [FQCN, props] format.
     *
     * @return array{0: string, 1: array<string, mixed>}
     */
    private static function encodeObject(object $obj): array
    {
        $ref = new \ReflectionClass($obj);
        $props = [];

        foreach ($ref->getProperties(\ReflectionProperty::IS_PUBLIC) as $prop) {
            if ($prop->isStatic()) {
                continue;
            }

            $props[$prop->getName()] = self::encode($prop->getValue($obj));
        }

        return [$ref->getName(), $props];
    }

    /**
     * Decode an [FQCN, props] array back to an object.
     *
     * - Payload subclasses use fromArray().
     * - Other objects are reconstructed via constructor or property hydration.
     */
    private static function decodeObject(array $data, ?string $expectedType): mixed
    {
        [$fqcn, $props] = $data;

        // Payload subclasses use their existing fromArray
        if (\is_subclass_of($fqcn, Payload::class)) {
            return $fqcn::fromArray($props);
        }

        // If expectedType is a built-in, return as-is (unlikely but safe)
        if (
            $expectedType !== null
            && \in_array(
                \strtolower($expectedType),
                [
                    'int',
                    'float',
                    'string',
                    'bool',
                    'array',
                    'null',
                    'mixed',
                    'void',
                    'never',
                ],
                true,
            )
        ) {
            return $data;
        }

        // If FQCN doesn't exist, return the raw data
        if (!\class_exists($fqcn)) {
            return $data;
        }

        $ref = new \ReflectionClass($fqcn);
        $constructor = $ref->getConstructor();

        if ($constructor !== null) {
            return self::hydrateViaConstructor($ref, $constructor, $props);
        }

        return self::hydrateViaProperties($ref, $props);
    }

    /**
     * Reconstruct an object by calling its constructor with mapped parameters.
     */
    private static function hydrateViaConstructor(
        \ReflectionClass $ref,
        \ReflectionMethod $constructor,
        array $props,
    ): object {
        $params = [];

        foreach ($constructor->getParameters() as $param) {
            $name = $param->getName();

            if (!\array_key_exists($name, $props)) {
                if ($param->isDefaultValueAvailable()) {
                    $params[] = $param->getDefaultValue();
                } else {
                    throw new \RuntimeException(\sprintf(
                        'Missing required constructor parameter "$%s" for %s',
                        $name,
                        $ref->getName(),
                    ));
                }
            } else {
                $type = $param->getType();
                $typeName = $type instanceof \ReflectionNamedType ? $type->getName() : null;
                $params[] = self::decode($props[$name], $typeName);
            }
        }

        /** @var object */
        return $ref->newInstance(...$params);
    }

    /**
     * Reconstruct an object by setting public properties (no constructor).
     */
    private static function hydrateViaProperties(\ReflectionClass $ref, array $props): object
    {
        $obj = $ref->newInstanceWithoutConstructor();

        foreach ($props as $name => $value) {
            if (!$ref->hasProperty($name)) {
                continue;
            }

            $prop = $ref->getProperty($name);
            $propType = $prop->getType();
            $typeName = $propType instanceof \ReflectionNamedType ? $propType->getName() : null;

            $prop->setValue($obj, self::decode($value, $typeName));
        }

        return $obj;
    }
}
