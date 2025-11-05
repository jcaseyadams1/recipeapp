<?php
/**
 * Database Setup and Migration Script
 * Run this once to set up the database and migrate data from localStorage backup
 */

require_once 'config.php';

// Check if we can connect to the database
try {
    $pdo->query("SELECT 1");
    echo json_encode(['status' => 'success', 'message' => 'Database connection successful']);
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Check if recipes table exists and has the correct structure
try {
    $stmt = $pdo->query("DESCRIBE recipes");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $requiredColumns = ['id', 'recipeId', 'title', 'prepTime', 'cookTime', 'servings',
                       'dateAdded', 'extractedText', 'imageUrl', 'originalImageName',
                       'url', 'ingredients', 'steps'];

    $missingColumns = array_diff($requiredColumns, $columns);

    if (empty($missingColumns)) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Database table structure is correct',
            'columns' => $columns
        ]);
    } else {
        echo json_encode([
            'status' => 'warning',
            'message' => 'Missing columns: ' . implode(', ', $missingColumns),
            'found_columns' => $columns,
            'missing_columns' => $missingColumns
        ]);
    }

} catch(PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Table check failed: ' . $e->getMessage()
    ]);
}
?>