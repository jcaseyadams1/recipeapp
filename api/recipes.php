<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        if (isset($_GET['search'])) {
            searchRecipes($_GET['search']);
        } elseif (isset($_GET['id'])) {
            getRecipeById($_GET['id']);
        } else {
            getAllRecipes();
        }
        break;

    case 'POST':
        createRecipe();
        break;

    case 'PUT':
        updateRecipe();
        break;

    case 'DELETE':
        deleteRecipe();
        break;

    default:
        sendResponse(['error' => 'Method not allowed'], 405);
}

function getAllRecipes() {
    global $pdo;

    try {
        $stmt = $pdo->query("SELECT * FROM recipes ORDER BY dateAdded DESC");
        $recipes = $stmt->fetchAll();

        // Parse JSON fields
        foreach($recipes as &$recipe) {
            $recipe['ingredients'] = json_decode($recipe['ingredients'], true) ?: [];
            $recipe['steps'] = json_decode($recipe['steps'], true) ?: [];
        }

        sendResponse($recipes);
    } catch(PDOException $e) {
        sendResponse(['error' => 'Failed to fetch recipes: ' . $e->getMessage()], 500);
    }
}

function getRecipeById($id) {
    global $pdo;

    try {
        $stmt = $pdo->prepare("SELECT * FROM recipes WHERE id = ? OR recipeId = ?");
        $stmt->execute([$id, $id]);
        $recipe = $stmt->fetch();

        if (!$recipe) {
            sendResponse(['error' => 'Recipe not found'], 404);
        }

        // Parse JSON fields
        $recipe['ingredients'] = json_decode($recipe['ingredients'], true) ?: [];
        $recipe['steps'] = json_decode($recipe['steps'], true) ?: [];

        sendResponse($recipe);
    } catch(PDOException $e) {
        sendResponse(['error' => 'Failed to fetch recipe: ' . $e->getMessage()], 500);
    }
}

function createRecipe() {
    global $pdo;

    $input = getJsonInput();

    if (!$input || !isset($input['title']) || empty($input['title'])) {
        sendResponse(['error' => 'Recipe title is required'], 400);
    }

    try {
        // Generate recipeId if not provided
        $recipeId = $input['recipeId'] ?? 'recipe_' . uniqid();

        // Check if recipe already exists (by URL or recipeId)
        $checkStmt = $pdo->prepare("SELECT id FROM recipes WHERE recipeId = ? OR (url IS NOT NULL AND url != '' AND url = ?)");
        $checkStmt->execute([$recipeId, $input['url'] ?? '']);

        if ($checkStmt->fetch()) {
            // Update existing recipe instead
            return updateExistingRecipe($input, $recipeId);
        }

        $stmt = $pdo->prepare("
            INSERT INTO recipes (recipeId, title, prepTime, cookTime, servings,
                               dateAdded, extractedText, imageUrl, originalImageName,
                               url, ingredients, steps)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $recipeId,
            $input['title'],
            $input['prepTime'] ?? 0,
            $input['cookTime'] ?? 0,
            $input['servings'] ?? 1,
            $input['dateAdded'] ?? date('Y-m-d H:i:s'),
            $input['extractedText'] ?? '',
            $input['imageUrl'] ?? '',
            $input['originalImageName'] ?? '',
            $input['url'] ?? '',
            json_encode($input['ingredients'] ?? []),
            json_encode($input['steps'] ?? [])
        ]);

        sendResponse([
            'success' => true,
            'id' => $pdo->lastInsertId(),
            'recipeId' => $recipeId,
            'message' => 'Recipe created successfully'
        ]);
    } catch(PDOException $e) {
        sendResponse(['error' => 'Failed to save recipe: ' . $e->getMessage()], 500);
    }
}

function updateExistingRecipe($input, $recipeId) {
    global $pdo;

    try {
        $stmt = $pdo->prepare("
            UPDATE recipes SET
                title = ?, prepTime = ?, cookTime = ?, servings = ?,
                dateAdded = ?, extractedText = ?, imageUrl = ?, originalImageName = ?,
                url = ?, ingredients = ?, steps = ?
            WHERE recipeId = ?
        ");

        $stmt->execute([
            $input['title'],
            $input['prepTime'] ?? 0,
            $input['cookTime'] ?? 0,
            $input['servings'] ?? 1,
            $input['dateAdded'] ?? date('Y-m-d H:i:s'),
            $input['extractedText'] ?? '',
            $input['imageUrl'] ?? '',
            $input['originalImageName'] ?? '',
            $input['url'] ?? '',
            json_encode($input['ingredients'] ?? []),
            json_encode($input['steps'] ?? []),
            $recipeId
        ]);

        sendResponse([
            'success' => true,
            'recipeId' => $recipeId,
            'message' => 'Recipe updated successfully'
        ]);
    } catch(PDOException $e) {
        sendResponse(['error' => 'Failed to update recipe: ' . $e->getMessage()], 500);
    }
}

function updateRecipe() {
    global $pdo;

    $input = getJsonInput();
    $recipeId = $_GET['recipeId'] ?? $input['recipeId'] ?? null;

    if (!$recipeId) {
        sendResponse(['error' => 'Recipe ID is required for update'], 400);
    }

    if (!$input || !isset($input['title'])) {
        sendResponse(['error' => 'Invalid recipe data'], 400);
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE recipes SET
                title = ?, prepTime = ?, cookTime = ?, servings = ?,
                extractedText = ?, imageUrl = ?, originalImageName = ?,
                url = ?, ingredients = ?, steps = ?
            WHERE recipeId = ?
        ");

        $stmt->execute([
            $input['title'],
            $input['prepTime'] ?? 0,
            $input['cookTime'] ?? 0,
            $input['servings'] ?? 1,
            $input['extractedText'] ?? '',
            $input['imageUrl'] ?? '',
            $input['originalImageName'] ?? '',
            $input['url'] ?? '',
            json_encode($input['ingredients'] ?? []),
            json_encode($input['steps'] ?? []),
            $recipeId
        ]);

        if ($stmt->rowCount() === 0) {
            sendResponse(['error' => 'Recipe not found'], 404);
        }

        sendResponse([
            'success' => true,
            'message' => 'Recipe updated successfully'
        ]);
    } catch(PDOException $e) {
        sendResponse(['error' => 'Failed to update recipe: ' . $e->getMessage()], 500);
    }
}

function deleteRecipe() {
    global $pdo;

    $recipeId = $_GET['recipeId'] ?? null;
    $url = $_GET['url'] ?? null;
    $id = $_GET['id'] ?? null;

    if (!$recipeId && !$url && !$id) {
        sendResponse(['error' => 'Recipe ID, recipeId, or URL required'], 400);
    }

    try {
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM recipes WHERE id = ?");
            $stmt->execute([$id]);
        } elseif ($recipeId) {
            $stmt = $pdo->prepare("DELETE FROM recipes WHERE recipeId = ?");
            $stmt->execute([$recipeId]);
        } else {
            $stmt = $pdo->prepare("DELETE FROM recipes WHERE url = ?");
            $stmt->execute([$url]);
        }

        if ($stmt->rowCount() === 0) {
            sendResponse(['error' => 'Recipe not found'], 404);
        }

        sendResponse([
            'success' => true,
            'message' => 'Recipe deleted successfully'
        ]);
    } catch(PDOException $e) {
        sendResponse(['error' => 'Failed to delete recipe: ' . $e->getMessage()], 500);
    }
}

function searchRecipes($query) {
    global $pdo;

    try {
        $stmt = $pdo->prepare("
            SELECT * FROM recipes
            WHERE title LIKE ? OR ingredients LIKE ? OR steps LIKE ?
            ORDER BY dateAdded DESC
        ");
        $searchTerm = "%$query%";
        $stmt->execute([$searchTerm, $searchTerm, $searchTerm]);
        $recipes = $stmt->fetchAll();

        // Parse JSON fields
        foreach($recipes as &$recipe) {
            $recipe['ingredients'] = json_decode($recipe['ingredients'], true) ?: [];
            $recipe['steps'] = json_decode($recipe['steps'], true) ?: [];
        }

        sendResponse($recipes);
    } catch(PDOException $e) {
        sendResponse(['error' => 'Search failed: ' . $e->getMessage()], 500);
    }
}
?>