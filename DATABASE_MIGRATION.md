# Recipe Keeper - Database Migration Guide

This guide will help you migrate your Recipe Keeper app from Local Storage to MariaDB.

## Prerequisites

- MariaDB running on your Asustor NAS (port 3306)
- PHP with PDO MySQL extension
- phpMyAdmin access

## Setup Steps

### 1. Database Configuration

1. Open `api/config.php` and update these settings:
   ```php
   $dbname = 'your_database_name';  // Replace with your database name
   $username = 'your_db_user';      // Replace with your database username
   $password = 'your_db_password';  // Replace with your database password
   ```

### 2. Database User Setup

In phpMyAdmin, create a dedicated user for the app:

```sql
-- Create user (replace 'recipeapp' and 'secure_password' with your values)
CREATE USER 'recipeapp'@'localhost' IDENTIFIED BY 'secure_password';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON your_database.recipes TO 'recipeapp'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Test Database Connection

Visit: `http://your-nas-ip/your-app-folder/api/setup.php`

This will verify:
- Database connection works
- Table structure is correct
- All required columns exist

### 4. Export Current Data (Optional)

If you have existing recipes in localStorage:

1. Open your Recipe Keeper app
2. Go to "My Recipes"
3. Click "Create Backup"
4. Save the JSON file

### 5. Migrate Existing Data

If you have a backup file:

```javascript
// In browser console, upload your backup:
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    const text = await file.text();
    const data = JSON.parse(text);

    const response = await fetch('/api/migrate.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await response.json();
    console.log('Migration result:', result);
};
fileInput.click();
```

### 6. Switch to Database Mode

The app is now configured to use the database. It will:
- Save new recipes to MariaDB
- Load recipes from MariaDB
- Fall back to localStorage if database is unavailable

## Troubleshooting

### Database Connection Issues
- Check MariaDB is running on port 3306
- Verify username/password in `config.php`
- Ensure database user has correct permissions

### API Errors
- Check PHP error logs
- Visit `/api/setup.php` to test connection
- Verify table structure matches the CREATE statement

### Migration Issues
- Ensure backup JSON has correct format
- Check for duplicate recipeId values
- Review migration errors in the response

## File Structure

```
your-recipe-app/
├── api/
│   ├── config.php     # Database configuration
│   ├── recipes.php    # Main API endpoints
│   ├── setup.php      # Database verification
│   └── migrate.php    # Data migration
├── js/
│   └── storage.js     # Updated to use database API
└── index.html         # Your existing app
```

## Benefits

- **Persistent Storage**: Data survives browser clearing
- **Better Performance**: Database queries vs localStorage parsing
- **Backup/Restore**: Built into database system
- **Multi-device**: Access from any device on your network
- **Scalability**: Can handle thousands of recipes

## Fallback Behavior

The app maintains offline functionality:
- If database is unavailable, falls back to localStorage
- Saves to localStorage when database fails
- Attempts database sync when connection restored