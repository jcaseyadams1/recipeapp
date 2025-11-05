<?php
/**
 * Database Backup Script
 * Creates SQL dump of the recipes database
 */

require_once 'config.php';

// Only allow local access for security
if (!in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1', '192.168.86.56'])) {
    http_response_code(403);
    die('Access denied');
}

try {
    $backupDir = __DIR__ . '/../backups';
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }

    $filename = 'recipe_backup_' . date('Y-m-d_H-i-s') . '.sql';
    $filepath = $backupDir . '/' . $filename;

    // Get database configuration
    $host = 'localhost';
    $port = 3306;
    $dbname = 'recipe_db';
    $username = 'recipeapp';
    $password = 'M&rcySu31594';

    // Create mysqldump command
    $command = sprintf(
        'mysqldump -h%s -P%d -u%s -p%s %s > %s 2>&1',
        escapeshellarg($host),
        $port,
        escapeshellarg($username),
        escapeshellarg($password),
        escapeshellarg($dbname),
        escapeshellarg($filepath)
    );

    // Execute backup
    exec($command, $output, $returnCode);

    if ($returnCode === 0 && file_exists($filepath)) {
        $filesize = filesize($filepath);
        sendResponse([
            'success' => true,
            'message' => 'Backup created successfully',
            'filename' => $filename,
            'filepath' => $filepath,
            'filesize' => $filesize,
            'filesize_mb' => round($filesize / 1024 / 1024, 2)
        ]);
    } else {
        throw new Exception('Backup failed: ' . implode('\n', $output));
    }

} catch (Exception $e) {
    sendResponse([
        'success' => false,
        'error' => 'Backup failed: ' . $e->getMessage()
    ], 500);
}
?>