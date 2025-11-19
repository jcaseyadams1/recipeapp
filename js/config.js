/**
 * Configuration Module
 * Contains application configuration and constants
 */

// Default fallback configuration
let localConfig = {
    AIRTABLE_API_KEY: 'CONFIGURE_YOUR_AIRTABLE_KEY',
    AIRTABLE_BASE_ID: 'CONFIGURE_YOUR_BASE_ID',
    CLAUDE_API_KEY: 'CONFIGURE_YOUR_CLAUDE_KEY',
    DEBUG_MODE: true
};

// Function to load local configuration asynchronously
export const loadLocalConfig = async () => {
    try {
        const { LOCAL_CONFIG } = await import('./config.local.js');
        localConfig = LOCAL_CONFIG;
        console.log('✅ Local configuration loaded successfully');
        return true;
    } catch (error) {
        console.warn('⚠️ Local config file not found. Using fallback configuration.');
        console.warn('Create js/config.local.js file with your API keys for full functionality.');
        return false;
    }
};

// Create CONFIG as a getter function that returns current configuration
export const CONFIG = {
    get CLAUDE_API_KEY() { return localConfig.CLAUDE_API_KEY; },
    get AIRTABLE_API_KEY() { return localConfig.AIRTABLE_API_KEY; },
    get AIRTABLE_BASE_ID() { return localConfig.AIRTABLE_BASE_ID; },
    get OPENAI_API_KEY() { return localConfig.OPENAI_API_KEY; },

    // Static configuration
    AIRTABLE_TABLE_NAME: 'Recipes',
    ALLORIGINS_URL: '/api/proxy.php?url=',
    AIRTABLE_BASE_URL: 'https://api.airtable.com/v0',

    // UI Configuration
    MESSAGE_DISPLAY_DURATION: {
        SUCCESS: 3000,
        ERROR: 5000
    },

    // Recipe Defaults
    DEFAULT_RECIPE: {
        servings: 4,
        prepTime: 15,
        cookTime: 30,
        ingredients: [],
        steps: []
    },

    // Local Storage Keys
    STORAGE_KEYS: {
        SAVED_RECIPES: 'savedRecipes'
    },

    // File Storage Configuration
    FILE_STORAGE: {
        AUTO_BACKUP_ENABLED: false,  // Set to true to enable automatic file downloads
        BACKUP_FREQUENCY: 5          // Auto-backup every N recipe saves (if enabled)
    },

    // Validation Rules
    VALIDATION: {
        MAX_URL_LENGTH: 2000,
        MIN_RECIPE_TITLE_LENGTH: 1,
        MAX_RECIPE_TITLE_LENGTH: 200,
        MIN_INGREDIENTS: 1,
        MIN_STEPS: 1
    },

    // Debug Configuration
    get DEBUG_MODE() { return localConfig.DEBUG_MODE || false; },
    get LOG_API_CALLS() { return localConfig.LOG_API_CALLS || false; }
};

// Validate configuration
export const validateConfig = () => {
    const errors = [];

    if (!CONFIG.AIRTABLE_API_KEY || CONFIG.AIRTABLE_API_KEY === 'CONFIGURE_YOUR_AIRTABLE_KEY') {
        errors.push('Airtable API key not configured');
    }

    if (!CONFIG.AIRTABLE_BASE_ID || CONFIG.AIRTABLE_BASE_ID === 'CONFIGURE_YOUR_BASE_ID') {
        errors.push('Airtable Base ID not configured');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

export const RECIPE_FIELD_MAPPING = {
    // Maps internal field names to Airtable field names
    url: 'URL',
    title: 'Title',
    ingredients: 'Ingredients',
    servings: 'Servings',
    prepTime: 'Preparation Time (min)',
    cookTime: 'Cooking Time (min)',
    steps: 'Steps',
    dateAdded: 'Date Added',
    imageUrl: 'Thumbnail Image',
    recipeId: 'recipeID'
};