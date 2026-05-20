<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Middleware;

final class MiddlewarePipeline
{
    /** @var list<callable> */
    private array $middlewares = [];

    /**
     * @param callable $middleware Signature depends on context
     */
    public function use(callable $middleware): void
    {
        $this->middlewares[] = $middleware;
    }

    /**
     * Execute the pipeline.
     *
     * @param mixed   $payload  The input payload/request
     * @param callable $terminal The final handler (after all middleware)
     * @param mixed    ...$args  Extra arguments passed through
     *
     * @return mixed The result from the terminal/middleware
     */
    public function execute(mixed $payload, callable $terminal, mixed ...$args): mixed
    {
        $chain = $this->build(0, $terminal);

        return $chain($payload, ...$args);
    }

    /**
     * Recursively build the middleware call chain.
     */
    private function build(int $index, callable $terminal): callable
    {
        if (!\array_key_exists($index, $this->middlewares)) {
            return static function (mixed $payload, mixed ...$args) use ($terminal): mixed {
                return $terminal($payload, ...$args);
            };
        }

        $middleware = $this->middlewares[$index];
        $next = $this->build($index + 1, $terminal);

        return static function (mixed $payload, mixed ...$args) use ($middleware, $next): mixed {
            return $middleware($payload, $next, ...$args);
        };
    }

    /**
     * Return the number of registered middlewares.
     */
    public function count(): int
    {
        return \count($this->middlewares);
    }
}
