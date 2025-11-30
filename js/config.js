/**
 * Configuration Module
 * Contains application configuration and constants
 */

// Default fallback configuration
let localConfig = {
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
// Calculate base path from script location for reliable API paths
const getBasePath = () => {
    // Try to get base path from current script or document location
    const scripts = document.getElementsByTagName('script');
    for (const script of scripts) {
        if (script.src && script.src.includes('/js/')) {
            // Extract base path from script src (e.g., "/recipeapp/js/app.js" -> "/recipeapp/")
            const match = script.src.match(/^(.*?)\/js\//);
            if (match) {
                return match[1] + '/';
            }
        }
    }
    // Fallback: use document location
    const path = window.location.pathname;
    const lastSlash = path.lastIndexOf('/');
    return path.substring(0, lastSlash + 1);
};

export const CONFIG = {
    get CLAUDE_API_KEY() { return localConfig.CLAUDE_API_KEY; },
    get OPENAI_API_KEY() { return localConfig.OPENAI_API_KEY; },

    // Dynamic configuration - calculate proxy URL based on page location
    get ALLORIGINS_URL() {
        return getBasePath() + 'api/proxy.php?url=';
    },

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

    // Configuration validation - currently no required external services
    // OpenAI key is optional (only needed for OCR features)

    return {
        isValid: true,
        errors
    };
};