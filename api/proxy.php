<?php
/**
 * Recipe URL Proxy Endpoint
 * Fetches recipe webpage content server-side to avoid CORS issues
 */

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Get URL parameter
$url = $_GET['url'] ?? null;

if (!$url) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'URL parameter is required']);
    exit();
}

// URL decode if double-encoded
$url = urldecode($url);

// Validate URL
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid URL format']);
    exit();
}

// Check if URL uses http or https
$parsedUrl = parse_url($url);
if (!in_array($parsedUrl['scheme'] ?? '', ['http', 'https'])) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Only HTTP and HTTPS URLs are allowed']);
    exit();
}

// Block requests to local/private IP ranges for security
$host = $parsedUrl['host'] ?? '';
if (preg_match('/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i', $host)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Access to local addresses is not allowed']);
    exit();
}

try {
    // Initialize cURL
    $ch = curl_init();

    // Construct referer from the URL's origin
    $referer = $parsedUrl['scheme'] . '://' . $parsedUrl['host'] . '/';

    // Set cURL options with improved headers for better site acceptance
    // Note: SSL verification disabled for local development environments
    // that may not have CA certificates properly configured
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
            'Accept-Encoding: gzip, deflate, br',
            'Connection: keep-alive',
            'Upgrade-Insecure-Requests: 1',
            'Sec-Fetch-Dest: document',
            'Sec-Fetch-Mode: navigate',
            'Sec-Fetch-Site: none',
            'Sec-Fetch-User: ?1',
            'Cache-Control: max-age=0',
            'Referer: ' . $referer
        ],
        CURLOPT_ENCODING => '', // Enable automatic decompression
        CURLOPT_COOKIEFILE => '', // Enable cookies for this request
        CURLOPT_COOKIEJAR => '' // Store cookies received
    ]);

    // Execute request
    $response = curl_exec($ch);

    // Check for errors
    if ($response === false) {
        $error = curl_error($ch);
        $errno = curl_errno($ch);
        curl_close($ch);

        http_response_code(502);
        header('Content-Type: application/json');

        // Provide more helpful error messages
        $errorMessage = 'Failed to fetch URL';
        switch ($errno) {
            case CURLE_COULDNT_RESOLVE_HOST:
                $errorMessage = 'Could not resolve hostname. Please check the URL.';
                break;
            case CURLE_COULDNT_CONNECT:
                $errorMessage = 'Could not connect to the website. The site may be down.';
                break;
            case CURLE_OPERATION_TIMEDOUT:
                $errorMessage = 'Request timed out. The site may be slow or blocking requests.';
                break;
            case CURLE_SSL_CONNECT_ERROR:
                $errorMessage = 'SSL connection error. The site may have certificate issues.';
                break;
            default:
                $errorMessage = 'Failed to fetch URL: ' . $error;
        }

        echo json_encode(['error' => $errorMessage]);
        exit();
    }

    // Get HTTP status code and final URL (after redirects)
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    curl_close($ch);

    // Handle specific HTTP error codes with helpful messages
    if ($httpCode >= 400) {
        http_response_code($httpCode);
        header('Content-Type: application/json');

        $errorMessage = 'Failed to fetch URL: HTTP ' . $httpCode;
        switch ($httpCode) {
            case 403:
                $errorMessage = 'Access denied (403). This site may be blocking automated requests.';
                break;
            case 404:
                $errorMessage = 'Page not found (404). Please check the URL is correct.';
                break;
            case 429:
                $errorMessage = 'Too many requests (429). Please wait a moment and try again.';
                break;
            case 500:
            case 502:
            case 503:
                $errorMessage = 'The recipe website is experiencing issues. Please try again later.';
                break;
        }

        echo json_encode(['error' => $errorMessage]);
        exit();
    }

    // Return the HTML content
    header('Content-Type: text/html; charset=UTF-8');
    echo $response;

} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
