# Recipe Keeper

A full-featured web application for saving, organizing, and managing your favorite recipes. Extract recipes from URLs or photos, adjust serving sizes, and access your collection from any device.

## Features

- **Recipe Extraction from URLs** - Paste any recipe URL and automatically extract ingredients, instructions, and metadata
- **Photo/PDF OCR** - Extract recipes from photos or PDF files using OpenAI Vision API
- **Serving Size Adjustment** - Scale ingredients up or down with real-time calculations
- **Recipe Organization** - Save, search, and manage your recipe collection
- **Ingredient Checklist** - Track ingredients while cooking
- **Step-by-Step Instructions** - Follow along with progress tracking
- **Backup & Restore** - Export and import your recipes as JSON
- **Offline Support** - LocalStorage fallback when database is unavailable
- **Mobile-First Design** - Optimized for iPhone and mobile devices
- **Print-Friendly** - Clean print layouts for recipe cards

## Screenshots

The app features a clean, iOS-inspired interface with:
- Home view for adding new recipes
- Recipe card with adjustable servings
- My Recipes collection with search
- Detailed cooking instructions view

## Requirements

### Frontend
- Modern web browser with ES6 module support
- JavaScript enabled

### Backend
- PHP 7.4+ with PDO extension
- MariaDB 10.x or MySQL 5.7+
- Web server (Apache/Nginx)

### Optional API Keys
- **OpenAI API Key** - Required for photo/PDF OCR features

## Installation

### 1. Clone or Download

```bash
git clone https://github.com/yourusername/recipeapp.git
cd recipeapp
```

### 2. Database Setup

Create a MariaDB database and user:

```sql
CREATE DATABASE recipe_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'recipeapp'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON recipe_db.* TO 'recipeapp'@'localhost';
FLUSH PRIVILEGES;
```

Create the recipes table:

```sql
USE recipe_db;

CREATE TABLE recipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipeId VARCHAR(255) UNIQUE,
    url TEXT,
    title VARCHAR(500),
    servings INT DEFAULT 4,
    prepTime INT DEFAULT 0,
    cookTime INT DEFAULT 0,
    ingredients JSON,
    steps JSON,
    imageUrl TEXT,
    dateAdded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 3. Configure Database Connection

Edit `api/config.php` with your database credentials:

```php
$host = 'localhost';
$port = '3306';
$dbname = 'recipe_db';
$username = 'recipeapp';
$password = 'your_secure_password';
```

### 4. Configure API Keys (Optional)

Copy and edit the local configuration file:

```bash
cp js/config.local.js js/config.local.js.bak
```

Edit `js/config.local.js` with your API keys:

```javascript
export const LOCAL_CONFIG = {
    OPENAI_API_KEY: 'your-openai-api-key',  // For photo OCR
};
```

### 5. Deploy to Web Server

Copy all files to your web server's document root or a subdirectory.

### 6. Verify Installation

1. Visit `http://your-server/recipeapp/api/setup.php` to verify database connection
2. Open `http://your-server/recipeapp/` to use the app

## Usage

### Adding Recipes from URLs

1. Paste a recipe URL into the input field on the Home page
2. Click "Get Recipe" to extract the recipe
3. Review the extracted ingredients and instructions
4. Click "Save Recipe" to add to your collection

### Adding Recipes from Photos

1. Click the camera/upload icon on the Home page
2. Select a photo or PDF of a recipe
3. Wait for OCR processing
4. Review and save the extracted recipe

### Managing Recipes

- **Search**: Use the search bar in "My Recipes" to find recipes by title or ingredient
- **View Details**: Tap a recipe to see full instructions
- **Adjust Servings**: Use +/- buttons to scale ingredient quantities
- **Delete**: Long-press or use the delete option to remove recipes

### Backup & Restore

- **Create Backup**: Go to My Recipes > Create Backup to download a JSON file
- **Restore**: Use the Restore option to import recipes from a backup file

## Project Structure

```
recipeapp/
├── index.html              # Main application entry point
├── README.md               # This file
├── LICENSE                 # MIT License
├── DATABASE_MIGRATION.md   # Database migration guide
├── .gitignore              # Git ignore rules
│
├── js/                     # Frontend JavaScript modules
│   ├── app.js              # Application orchestrator
│   ├── ui.js               # UI controller
│   ├── storage.js          # Database/storage manager
│   ├── recipeExtractor.js  # URL recipe extraction
│   ├── ocr.js              # Photo/PDF OCR processor
│   ├── config.js           # Configuration module
│   ├── config.local.js     # Local API keys (not tracked)
│   └── utils.js            # Utility functions
│
├── api/                    # PHP backend
│   ├── config.php          # Database configuration
│   ├── recipes.php         # REST API endpoints
│   ├── proxy.php           # CORS proxy for recipe URLs
│   ├── setup.php           # Database verification
│   ├── backup.php          # Backup functionality
│   └── migrate.php         # Data migration utilities
│
├── styles/
│   └── main.css            # Application styles
│
└── data/
    └── recipes.json        # Sample recipe data
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recipes.php` | Get all recipes |
| GET | `/api/recipes.php?id={id}` | Get single recipe |
| GET | `/api/recipes.php?search={query}` | Search recipes |
| POST | `/api/recipes.php` | Create new recipe |
| PUT | `/api/recipes.php` | Update recipe |
| DELETE | `/api/recipes.php` | Delete recipe |

## Supported Recipe Websites

The app extracts recipes from most sites using structured data (JSON-LD), including:
- AllRecipes
- Food Network
- Serious Eats
- Bon Appetit
- Tasty
- And many more...

## Troubleshooting

### Recipe extraction fails
- Some websites block automated access
- Try a different recipe from the same site
- Check browser console for errors

### Database connection issues
- Verify MariaDB is running
- Check credentials in `api/config.php`
- Visit `/api/setup.php` for diagnostics

### OCR not working
- Ensure OpenAI API key is configured
- Check that the image is clear and readable
- PDF files must be under 20MB

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Recipe extraction uses structured data standards (Schema.org)
- OCR powered by OpenAI Vision API
- Mobile-first design inspired by iOS
