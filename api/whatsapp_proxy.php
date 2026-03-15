<?php
/**
 * WhatsApp Node Server Proxy
 * Forwards all /api/wa/* requests from the browser to the Node server.
 * This avoids CORS issues and mixed-content browser blocks.
 */
require_once '../includes/config.php';
requireAuth();

// Node server base URL — change this if your Node server address changes
define('WA_NODE_URL', 'http://localhost:3001');

// Strip the /api/wa prefix to get the actual Node path
$requestUri  = $_SERVER['REQUEST_URI'] ?? '';
$scriptName  = $_SERVER['SCRIPT_NAME'] ?? '';
// Extract everything after /api/whatsapp_proxy.php
$nodePath = '';
if (isset($_SERVER['PATH_INFO'])) {
    $nodePath = $_SERVER['PATH_INFO'];
} else {
    // Fallback: get ?path= query param
    $nodePath = '/' . ltrim($_GET['path'] ?? '', '/');
}

// Build query string (exclude 'path' param)
$query = $_SERVER['QUERY_STRING'] ?? '';
$query = preg_replace('/(^|&)path=[^&]*/', '', $query);
$query = ltrim($query, '&');
$targetUrl = WA_NODE_URL . $nodePath . ($query ? '?' . $query : '');

// Forward the request via cURL
$method  = $_SERVER['REQUEST_METHOD'];
$rawBody = file_get_contents('php://input');

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

$headers = ['Content-Type: application/json', 'Accept: application/json'];
if ($rawBody) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response   = curl_exec($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError  = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Cannot reach WhatsApp server: ' . $curlError]);
    exit();
}

http_response_code($httpCode ?: 502);
header('Content-Type: application/json');
echo $response;
