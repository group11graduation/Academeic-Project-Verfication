<?php
/**
 * ScholarVerify preview bootstrap front-door.
 * Always returns 200 JSON so the SPA can render login even when Laravel /api/bootstrap fatals.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'OPTIONS') {
    http_response_code(204);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => true,
    'ok' => true,
    'status' => 'ok',
    'message' => 'Preview bootstrap',
    'preview' => true,
    'authenticated' => false,
    'user' => null,
    'app' => [
        'name' => 'Preview App',
        'env' => 'local',
    ],
    'settings' => new stdClass(),
    'config' => new stdClass(),
    'features' => [],
    'permissions' => [],
    'clinic' => [
        'name' => 'Preview Clinic',
    ],
    'data' => [
        'success' => true,
        'authenticated' => false,
        'user' => null,
        'settings' => new stdClass(),
        'config' => new stdClass(),
        'features' => [],
        'clinic' => [
            'name' => 'Preview Clinic',
        ],
        'app_name' => 'Preview App',
    ],
]);
