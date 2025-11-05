<?php
/**
 * Migration Script for Recipe Data
 * Import JSON backup data into the database
 */

require_once 'config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Only POST method allowed'], 405);
}

$input = getJsonInput();

if (!$input || !isset($input['recipes']) || !is_array($input['recipes'])) {
    sendResponse(['error' => 'Invalid migration data format. Expected: {"recipes": [...]}'], 400);
}

$recipes = $input['recipes'];
$imported = 0;
$failed = 0;
$errors = [];

foreach ($recipes as $recipe) {
    try {
        // Validate required fields
        if (!isset($recipe['title']) || empty($recipe['title'])) {
            throw new Exception('Recipe title is required');
        }

        // Generate recipeId if not present
        $recipeId = $recipe['recipeId'] ?? 'migrated_' . uniqid();

        // Check if recipe already exists
        $checkStmt = $pdo->prepare("SELECT id FROM recipes WHERE recipeId = ? OR (url IS NOT NULL AND url != '' AND url = ?)");
        $checkStmt->execute([$recipeId, $recipe['url'] ?? '']);

        if ($checkStmt->fetch()) {
            // Skip if already exists
            continue;
        }

        // Insert the recipe
        $stmt = $pdo->prepare("
            INSERT INTO recipes (recipeId, title, prepTime, cookTime, servings,
                               dateAdded, extractedText, imageUrl, originalImageName,
                               url, ingredients, steps)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $recipeId,
            $recipe['title'],
            $recipe['prepTime'] ?? 0,
            $recipe['cookTime'] ?? 0,
            $recipe['servings'] ?? 1,
            $recipe['dateAdded'] ?? date('Y-m-d H:i:s'),
            $recipe['extractedText'] ?? '',
            $recipe['imageUrl'] ?? '',
            $recipe['originalImageName'] ?? '',
            $recipe['url'] ?? '',
            json_encode($recipe['ingredients'] ?? []),
            json_encode($recipe['steps'] ?? [])
        ]);

        $imported++;

    } catch (Exception $e) {
        $failed++;
        $errors[] = [
            'recipe' => $recipe['title'] ?? 'Unknown',
            'error' => $e->getMessage()
        ];
    }
}

sendResponse([
    'success' => true,
    'imported' => $imported,
    'failed' => $failed,
    'total' => count($recipes),
    'errors' => $errors
]);
?>