<?php
/**
 * Database Setup Script
 * Run this once to set up the database for Recipe Keeper
 *
 * Usage: Visit http://your-server/recipeapp/api/setup.php in your browser
 */

// Database configuration - UPDATE THESE VALUES
$host = 'localhost';
$port = '3306';
$dbname = 'recipe_db';
$username = 'recipeapp';
$password = 'your_secure_password';

header('Content-Type: text/html; charset=UTF-8');

echo '<!DOCTYPE html>
<html>
<head>
    <title>Recipe Keeper - Database Setup</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        h1 { color: #333; }
        .success { color: #28a745; background: #d4edda; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .error { color: #721c24; background: #f8d7da; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .info { color: #0c5460; background: #d1ecf1; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .warning { color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; }
        code { background: #e9e9e9; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
<h1>Recipe Keeper - Database Setup</h1>';

// Step 1: Test connection to MySQL server (without database)
echo '<h2>Step 1: Testing MySQL Connection</h2>';
try {
    $dsn = "mysql:host=$host;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    echo '<div class="success">MySQL connection successful!</div>';
} catch(PDOException $e) {
    echo '<div class="error">MySQL connection failed: ' . htmlspecialchars($e->getMessage()) . '</div>';
    echo '<div class="info">Make sure MySQL/MariaDB is running and the username/password in this file are correct.</div>';
    echo '</body></html>';
    exit;
}

// Step 2: Create database if it doesn't exist
echo '<h2>Step 2: Creating Database</h2>';
try {
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo '<div class="success">Database <code>' . htmlspecialchars($dbname) . '</code> is ready!</div>';
    $pdo->exec("USE `$dbname`");
} catch(PDOException $e) {
    echo '<div class="error">Failed to create database: ' . htmlspecialchars($e->getMessage()) . '</div>';
    echo '</body></html>';
    exit;
}

// Step 3: Create recipes table
echo '<h2>Step 3: Creating Recipes Table</h2>';
$createTableSQL = "
CREATE TABLE IF NOT EXISTS recipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipeId VARCHAR(255) NOT NULL UNIQUE,
    url TEXT,
    title VARCHAR(500) NOT NULL,
    servings INT DEFAULT 4,
    prepTime INT DEFAULT 0,
    cookTime INT DEFAULT 0,
    ingredients JSON,
    steps JSON,
    imageUrl LONGTEXT,
    extractedText TEXT,
    originalImageName VARCHAR(255),
    dateAdded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_title (title(100)),
    INDEX idx_dateAdded (dateAdded)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

try {
    $pdo->exec($createTableSQL);
    echo '<div class="success">Recipes table is ready!</div>';
} catch(PDOException $e) {
    echo '<div class="error">Failed to create table: ' . htmlspecialchars($e->getMessage()) . '</div>';
    echo '</body></html>';
    exit;
}

// Step 4: Check if sample data needed
echo '<h2>Step 4: Sample Data</h2>';
try {
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM recipes");
    $count = $stmt->fetch()['count'];

    if ($count == 0) {
        // Insert sample recipe
        $sampleRecipe = [
            'recipeId' => 'sample_chocolate_chip_cookies',
            'url' => '',
            'title' => 'Classic Chocolate Chip Cookies',
            'servings' => 24,
            'prepTime' => 15,
            'cookTime' => 12,
            'ingredients' => json_encode([
                ['amount' => '2 1/4', 'unit' => 'cups', 'item' => 'all-purpose flour'],
                ['amount' => '1', 'unit' => 'tsp', 'item' => 'baking soda'],
                ['amount' => '1', 'unit' => 'tsp', 'item' => 'salt'],
                ['amount' => '1', 'unit' => 'cup', 'item' => 'butter, softened'],
                ['amount' => '3/4', 'unit' => 'cup', 'item' => 'granulated sugar'],
                ['amount' => '3/4', 'unit' => 'cup', 'item' => 'packed brown sugar'],
                ['amount' => '2', 'unit' => 'large', 'item' => 'eggs'],
                ['amount' => '1', 'unit' => 'tsp', 'item' => 'vanilla extract'],
                ['amount' => '2', 'unit' => 'cups', 'item' => 'chocolate chips']
            ]),
            'steps' => json_encode([
                'Preheat oven to 375°F (190°C).',
                'Mix flour, baking soda, and salt in a bowl; set aside.',
                'Beat butter and both sugars in a large bowl until creamy.',
                'Add eggs and vanilla to the butter mixture; beat well.',
                'Gradually blend in flour mixture.',
                'Stir in chocolate chips.',
                'Drop rounded tablespoons of dough onto ungreased baking sheets.',
                'Bake for 9 to 11 minutes or until golden brown.',
                'Cool on baking sheets for 2 minutes; remove to wire racks to cool completely.'
            ]),
            'imageUrl' => '',
            'extractedText' => '',
            'originalImageName' => ''
        ];

        $stmt = $pdo->prepare("
            INSERT INTO recipes (recipeId, url, title, servings, prepTime, cookTime, ingredients, steps, imageUrl, extractedText, originalImageName)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $sampleRecipe['recipeId'],
            $sampleRecipe['url'],
            $sampleRecipe['title'],
            $sampleRecipe['servings'],
            $sampleRecipe['prepTime'],
            $sampleRecipe['cookTime'],
            $sampleRecipe['ingredients'],
            $sampleRecipe['steps'],
            $sampleRecipe['imageUrl'],
            $sampleRecipe['extractedText'],
            $sampleRecipe['originalImageName']
        ]);

        echo '<div class="success">Sample recipe "Classic Chocolate Chip Cookies" added!</div>';
    } else {
        echo '<div class="info">Database already contains ' . $count . ' recipe(s). No sample data added.</div>';
    }
} catch(PDOException $e) {
    echo '<div class="warning">Could not add sample data: ' . htmlspecialchars($e->getMessage()) . '</div>';
}

// Step 5: Verify table structure
echo '<h2>Step 5: Verifying Table Structure</h2>';
try {
    $stmt = $pdo->query("DESCRIBE recipes");
    $columns = $stmt->fetchAll();

    echo '<div class="success">Table structure verified!</div>';
    echo '<pre>';
    echo "Column Name          | Type                | Null | Key | Default\n";
    echo "--------------------+---------------------+------+-----+------------------\n";
    foreach ($columns as $col) {
        printf("%-20s| %-19s | %-4s | %-3s | %s\n",
            $col['Field'],
            $col['Type'],
            $col['Null'],
            $col['Key'],
            $col['Default'] ?? 'NULL'
        );
    }
    echo '</pre>';
} catch(PDOException $e) {
    echo '<div class="error">Could not verify table structure: ' . htmlspecialchars($e->getMessage()) . '</div>';
}

// Summary
echo '<h2>Setup Complete!</h2>';
echo '<div class="success">
    <strong>Your Recipe Keeper database is ready to use!</strong><br><br>
    Next steps:<br>
    1. Update <code>api/config.php</code> with your database credentials if you haven\'t already<br>
    2. Visit your Recipe Keeper app to start adding recipes<br>
    3. (Optional) Configure your OpenAI API key in <code>js/config.local.js</code> for photo OCR
</div>';

echo '<h3>Database Credentials for config.php</h3>';
echo '<pre>';
echo htmlspecialchars('$host = \'' . $host . '\';
$port = \'' . $port . '\';
$dbname = \'' . $dbname . '\';
$username = \'' . $username . '\';
$password = \'your_secure_password\';');
echo '</pre>';

echo '</body></html>';
?>
