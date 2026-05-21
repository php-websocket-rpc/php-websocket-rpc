<?php

/**
 * Test fixture for enum support in codegen.
 */

enum Status: string
{
    case Active = 'active';
    case Inactive = 'inactive';
}

enum Priority: int
{
    case Low = 1;
    case Medium = 2;
    case High = 3;
}

enum Unit
{
    case Draft;
    case Published;
}

interface ConfigService
{
    public function setStatus(Status $status): void;
    public function getStatus(): Status;
    public function setPriority(Priority $priority): void;
    public function getPriorities(): array;
    public function setUnit(Unit $unit): void;
}
