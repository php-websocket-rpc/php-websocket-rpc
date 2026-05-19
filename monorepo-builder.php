<?php

declare(strict_types=1);

use Symplify\MonorepoBuilder\Config\MBConfig;

return static function (MBConfig $mbConfig): void {
    $mbConfig->packageDirectories([__DIR__ . '/src']);

    // Data appended to all package composer.json during merge/propagate
    $mbConfig->dataToAppend([
        'require' => [
            'php' => '>=8.5',
        ],
    ]);

    // Data prepended — version must NOT be appended (syncs from root)
    $mbConfig->dataToRemove([
        'replace' => [],
    ]);
};
