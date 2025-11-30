/**
 * Main Application Module
 * Orchestrates all other modules and handles application lifecycle
 */

import { CONFIG, validateConfig, loadLocalConfig } from './config.js';
import { UIController } from './ui.js';
import { RecipeExtractor } from './recipeExtractor.js';
import { StorageManager } from './storage.js';
import { Validator, AppError, ErrorTypes } from './utils.js';
import { OCRProcessor } from './ocr.js';

class RecipeKeeperApp {
    constructor() {
        this.ui = null;
        this.extractor = null;
        this.storage = null;
        this.ocrProcessor = null;
        this.isInitialized = false;

        // Bind methods to maintain context
        this.handleRecipeFetch = this.handleRecipeFetch.bind(this);
        this.handleRecipeSave = this.handleRecipeSave.bind(this);
        this.handleViewChange = this.handleViewChange.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleImageOCR = this.handleImageOCR.bind(this);
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing Recipe Keeper App...');

            // Load local configuration first
            await loadLocalConfig();

            // Initialize modules
            this.ui = new UIController();
            this.extractor = new RecipeExtractor();
            this.storage = new StorageManager();
            this.ocrProcessor = new OCRProcessor();

            // Setup event listeners
            this.setupEventListeners();

            // Initialize UI
            this.ui.init();

            // Validate configuration
            this.validateConfiguration();

            // Load initial data
            await this.loadInitialData();

            this.isInitialized = true;
            console.log('Recipe Keeper App initialized successfully');

        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.handleError(error, 'Failed to initialize application');
        }
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Recipe fetch requests
        document.addEventListener('recipe-fetch-requested', this.handleRecipeFetch);

        // Recipe save requests
        document.addEventListener('recipe-save-requested', this.handleRecipeSave);

        // View changes
        document.addEventListener('view-changed', this.handleViewChange);

        // Search
        document.addEventListener('recipe-search', this.handleSearch);

        // Recipe deletion
        document.addEventListener('recipe-delete-requested', this.handleRecipeDelete.bind(this));

        // Image OCR requests
        document.addEventListener('image-ocr-requested', this.handleImageOCR);

        // Multiple images OCR requests
        document.addEventListener('multiple-images-ocr-requested', this.handleMultipleImagesOCR.bind(this));

        // Refresh saved recipes requests
        document.addEventListener('refresh-saved-recipes', () => {
            this.loadSavedRecipes();
        });

        // Backup and restore requests
        document.addEventListener('backup-requested', this.handleBackupRequest.bind(this));
        document.addEventListener('restore-requested', this.handleRestoreRequest.bind(this));

        // Global error handling
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError(event.error, 'An unexpected error occurred');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, 'An unexpected error occurred');
        });
    }

    /**
     * Handle recipe fetch requests
     * @param {CustomEvent} event - Event with recipe URL
     */
    async handleRecipeFetch(event) {
        const { url } = event.detail;

        try {
            // Validate URL
            const validatedUrl = Validator.validateUrl(url);
            if (!validatedUrl) {
                throw new AppError('Invalid URL format', ErrorTypes.VALIDATION_ERROR);
            }

            this.ui.showLoading(true);
            this.ui.hideMessages();

            console.log('Fetching recipe from:', validatedUrl);

            // Extract recipe
            const recipe = await this.extractor.extractRecipe(validatedUrl);

            // Display recipe
            this.ui.displayRecipe(recipe);
            this.ui.showSuccess('Recipe extracted successfully!');

            // Clear URL input
            const urlInput = this.ui.elements.recipeUrl;
            if (urlInput) {
                urlInput.value = '';
            }

        } catch (error) {
            console.error('Recipe fetch error:', error);
            this.handleError(error, 'Failed to fetch recipe');
        } finally {
            this.ui.showLoading(false);
        }
    }

    /**
     * Handle recipe save requests
     * @param {CustomEvent} event - Event with recipe data
     */
    async handleRecipeSave(event) {
        const { recipe } = event.detail;

        try {
            if (!recipe) {
                throw new AppError('No recipe to save', ErrorTypes.VALIDATION_ERROR);
            }

            console.log('Saving recipe:', recipe.title);

            // Save recipe
            const result = await this.storage.saveRecipe(recipe);

            if (result.success) {
                this.ui.showSuccess('Recipe saved to your collection!');

                // Clear image upload UI after successful save
                this.ui.clearImageUpload();

                // Refresh saved recipes if we're on that view
                const currentView = document.querySelector('.view-container.active');
                if (currentView && currentView.id === 'savedView') {
                    await this.loadSavedRecipes();
                }
            } else {
                throw new AppError(
                    result.errors.join('; '),
                    ErrorTypes.STORAGE_ERROR
                );
            }

        } catch (error) {
            console.error('Recipe save error:', error);
            this.handleError(error, 'Failed to save recipe');
        }
    }

    /**
     * Handle view changes
     * @param {CustomEvent} event - Event with view ID
     */
    async handleViewChange(event) {
        const { viewId } = event.detail;

        try {
            switch (viewId) {
                case 'savedView':
                    await this.loadSavedRecipes();
                    break;
                case 'homeView':
                    // Clear search when going back to home
                    const searchInput = this.ui.elements.searchInput;
                    if (searchInput) {
                        searchInput.value = '';
                    }
                    break;
            }
        } catch (error) {
            console.error('View change error:', error);
            this.handleError(error, 'Error loading view');
        }
    }

    /**
     * Handle search requests
     * @param {CustomEvent} event - Event with search query
     */
    handleSearch(event) {
        const { query } = event.detail;

        try {
            this.ui.filterSavedRecipes(query);
        } catch (error) {
            console.error('Search error:', error);
            this.handleError(error, 'Search failed');
        }
    }

    /**
     * Handle recipe deletion requests
     * @param {CustomEvent} event - Event with recipe URL, recipeId, and title
     */
    async handleRecipeDelete(event) {
        const { url, recipeId, title } = event.detail;

        try {
            console.log('Deleting recipe:', title, 'URL:', url, 'Recipe ID:', recipeId);

            // Delete from storage using URL or recipeId
            const result = await this.storage.deleteRecipe(url, recipeId);

            if (result.localDeleted) {
                this.ui.showSuccess(`"${title}" deleted successfully`);

                // Refresh the saved recipes view
                await this.loadSavedRecipes();

                console.log('Recipe deleted successfully');
            } else {
                throw new AppError(
                    'Failed to delete recipe from storage',
                    ErrorTypes.STORAGE_ERROR,
                    { errors: result.errors }
                );
            }

        } catch (error) {
            console.error('Recipe delete error:', error);
            this.handleError(error, 'Failed to delete recipe');
        }
    }

    /**
     * Handle file OCR requests (images and PDFs)
     * @param {CustomEvent} event - Event with file
     */
    async handleImageOCR(event) {
        const { imageFile } = event.detail; // Keep variable name for compatibility

        try {
            if (!imageFile) {
                throw new AppError('No file provided', ErrorTypes.VALIDATION_ERROR);
            }

            console.log('Processing file for OCR:', imageFile.name, 'Type:', imageFile.type);

            this.ui.showLoading(true);
            this.ui.hideMessages();

            // Process image through OCR
            const recipe = await this.ocrProcessor.processFileToRecipe(imageFile);

            // Display the extracted recipe
            this.ui.displayRecipe(recipe);
            this.ui.showSuccess('Recipe extracted successfully!');

            console.log('OCR processing completed successfully');

        } catch (error) {
            console.error('OCR error:', error);
            this.handleError(error, 'Failed to extract recipe from file');
        } finally {
            this.ui.showLoading(false);
        }
    }

    /**
     * Handle multiple images OCR requests
     * @param {CustomEvent} event - Event with multiple image files
     */
    async handleMultipleImagesOCR(event) {
        const { imageFiles } = event.detail;

        try {
            if (!imageFiles || imageFiles.length === 0) {
                throw new AppError('No files provided', ErrorTypes.VALIDATION_ERROR);
            }

            console.log(`Processing ${imageFiles.length} images for OCR...`);

            this.ui.showLoading(true);
            this.ui.hideMessages();

            // Update loading text to show progress
            const loadingContainer = document.querySelector('#loadingContainer p');
            if (loadingContainer) {
                loadingContainer.textContent = `Extracting recipe from ${imageFiles.length} images...`;
            }

            // Process multiple images through OCR
            const recipe = await this.ocrProcessor.processMultipleImagesToRecipe(imageFiles);

            // Display the extracted recipe
            this.ui.displayRecipe(recipe);
            this.ui.showSuccess(`Recipe extracted successfully from ${imageFiles.length} images!`);

            console.log('Multiple images OCR processing completed successfully');

        } catch (error) {
            console.error('Multiple images OCR error:', error);
            this.handleError(error, 'Failed to extract recipe from images');
        } finally {
            this.ui.showLoading(false);

            // Reset loading text
            const loadingContainer = document.querySelector('#loadingContainer p');
            if (loadingContainer) {
                loadingContainer.textContent = 'Extracting recipe...';
            }
        }
    }

    /**
     * Load saved recipes
     */
    async loadSavedRecipes() {
        try {
            console.log('app.loadSavedRecipes() called');
            const recipes = await this.storage.loadSavedRecipes();
            console.log(`Storage returned ${recipes.length} recipes:`, recipes.map(r => r.title));
            this.ui.displaySavedRecipes(recipes);
            console.log(`Loaded ${recipes.length} saved recipes`);
        } catch (error) {
            console.error('Failed to load saved recipes:', error);
            this.ui.showError('Failed to load saved recipes');
        }
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            // Pre-load saved recipes for better UX
            await this.loadSavedRecipes();
        } catch (error) {
            console.warn('Failed to load initial data:', error);
            // Don't throw - this is not critical for app startup
        }
    }

    /**
     * Validate application configuration
     */
    validateConfiguration() {
        const validation = validateConfig();

        if (!validation.isValid) {
            console.warn('Configuration issues:', validation.errors);
            this.ui.showError('Configuration incomplete. Some features may not work properly. Check console for details.');
        } else {
            console.log('✅ Configuration validated successfully');
        }

        // Log debug mode status
        if (CONFIG.DEBUG_MODE) {
            console.log('🐛 Debug mode enabled');
        }
    }

    /**
     * Handle application errors
     * @param {Error|AppError} error - Error to handle
     * @param {string} fallbackMessage - Fallback message if error doesn't have one
     */
    handleError(error, fallbackMessage = 'An error occurred') {
        let message = fallbackMessage;
        let shouldShowToUser = true;

        if (error instanceof AppError) {
            message = error.message;

            // Log detailed error info for debugging
            console.error('AppError details:', {
                type: error.type,
                message: error.message,
                details: error.details,
                timestamp: error.timestamp
            });

            // Customize message based on error type
            switch (error.type) {
                case ErrorTypes.VALIDATION_ERROR:
                    // Validation errors are usually user-friendly
                    break;
                case ErrorTypes.NETWORK_ERROR:
                    message = 'Network error. Please check your internet connection.';
                    break;
                case ErrorTypes.API_ERROR:
                    message = 'Service temporarily unavailable. Please try again later.';
                    break;
                case ErrorTypes.STORAGE_ERROR:
                    message = 'Failed to save data. Check your storage permissions.';
                    break;
                case ErrorTypes.EXTRACTION_ERROR:
                    message = 'Could not extract recipe from this website. Please try a different URL.';
                    break;
                default:
                    message = fallbackMessage;
            }
        } else if (error instanceof Error) {
            console.error('Unexpected error:', error);

            // Don't show technical error messages to users
            if (error.message.includes('fetch') || error.message.includes('network')) {
                message = 'Network error. Please check your internet connection.';
            }
        }

        if (shouldShowToUser && this.ui) {
            this.ui.showError(message);
        }
    }

    /**
     * Export recipe data (for backup/migration)
     * @returns {Promise<Object>} - Exported data
     */
    async exportData() {
        try {
            const recipes = await this.storage.loadSavedRecipes();
            return {
                version: '1.0',
                exportDate: new Date().toISOString(),
                recipes: recipes,
                recipesCount: recipes.length
            };
        } catch (error) {
            console.error('Export failed:', error);
            throw new AppError('Failed to export data', ErrorTypes.STORAGE_ERROR);
        }
    }

    /**
     * Import recipe data (for backup/migration)
     * @param {Object} data - Data to import
     * @returns {Promise<Object>} - Import result
     */
    async importData(data) {
        try {
            if (!data || !data.recipes || !Array.isArray(data.recipes)) {
                throw new AppError('Invalid import data format', ErrorTypes.VALIDATION_ERROR);
            }

            let imported = 0;
            let failed = 0;

            for (const recipe of data.recipes) {
                try {
                    await this.storage.saveRecipe(recipe);
                    imported++;
                } catch (error) {
                    console.error('Failed to import recipe:', recipe.title, error);
                    failed++;
                }
            }

            return {
                imported,
                failed,
                total: data.recipes.length
            };

        } catch (error) {
            console.error('Import failed:', error);
            throw new AppError('Failed to import data', ErrorTypes.STORAGE_ERROR);
        }
    }

    /**
     * Cleanup and destroy the application
     */
    destroy() {
        try {
            // Remove event listeners
            document.removeEventListener('recipe-fetch-requested', this.handleRecipeFetch);
            document.removeEventListener('recipe-save-requested', this.handleRecipeSave);
            document.removeEventListener('view-changed', this.handleViewChange);
            document.removeEventListener('recipe-search', this.handleSearch);
            document.removeEventListener('image-ocr-requested', this.handleImageOCR);

            // Cleanup modules
            if (this.ui) {
                this.ui.destroy();
            }

            this.isInitialized = false;
            console.log('Recipe Keeper App destroyed');

        } catch (error) {
            console.error('Error during app cleanup:', error);
        }
    }

    /**
     * Get application status
     * @returns {Object} - Application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            modules: {
                ui: !!this.ui,
                extractor: !!this.extractor,
                storage: !!this.storage,
                ocr: !!this.ocrProcessor
            },
            version: '2.0.0'
        };
    }

    /**
     * Handle backup request
     */
    async handleBackupRequest() {
        try {
            console.log('Creating backup...');
            // Note: Removed info message since UI doesn't have showMessage, backup is fast enough

            const backupFilename = await this.storage.createBackup();
            this.ui.showSuccess(`Backup created: ${backupFilename}`);

        } catch (error) {
            console.error('Backup failed:', error);
            this.handleError(error, 'Failed to create backup');
        }
    }

    /**
     * Handle restore request
     * @param {Event} event - Event with file details
     */
    async handleRestoreRequest(event) {
        try {
            const { file } = event.detail;
            console.log('Restoring from file:', file.name);

            if (!file.name.endsWith('.json')) {
                throw new AppError('Please select a valid JSON backup file', ErrorTypes.VALIDATION_ERROR);
            }

            this.ui.showLoading(true);

            const text = await file.text();
            const backupData = JSON.parse(text);

            // Validate backup structure
            if (!backupData.recipes || !Array.isArray(backupData.recipes)) {
                throw new AppError('Invalid backup file format', ErrorTypes.VALIDATION_ERROR);
            }

            // Get current recipe count from database
            const currentRecipes = await this.storage.loadSavedRecipes();

            // Confirm before overwriting
            const confirmed = confirm(`This will add ${backupData.recipes.length} recipes from the backup to your current ${currentRecipes.length} recipes. Continue?`);

            if (!confirmed) {
                this.ui.showMessage('Restore cancelled', 'info');
                return;
            }

            // Restore recipes to database
            let imported = 0;
            let failed = 0;

            for (const recipe of backupData.recipes) {
                try {
                    await this.storage.saveToDatabase(recipe);
                    imported++;
                } catch (error) {
                    console.error('Failed to restore recipe:', recipe.title, error);
                    failed++;
                }
            }

            // Reload recipes from database
            await this.loadSavedRecipes();

            if (failed > 0) {
                this.ui.showSuccess(`Restored ${imported} recipes. ${failed} recipes failed to import.`);
            } else {
                this.ui.showSuccess(`Successfully restored ${imported} recipes from ${file.name}`);
            }

        } catch (error) {
            console.error('Restore failed:', error);
            this.handleError(error, 'Failed to restore from backup');
        } finally {
            this.ui.showLoading(false);
        }
    }
}

// Initialize app when DOM is ready
let app = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = new RecipeKeeperApp();
        await app.init();

        // Make app available globally for debugging
        window.recipeApp = app;

        // Add helper functions for debugging
        window.clearLocalStorage = () => {
            app.storage.clearLocalStorage();
            console.log('Local storage cleared! Refresh page to see changes.');
        };

        // Add recovery function for database data
        window.recoverDatabaseRecipes = async () => {
            try {
                console.log('Attempting to load recipes from database...');
                const dbRecipes = await app.storage.loadFromDatabase();
                console.log('Found', dbRecipes.length, 'recipes in database:');
                dbRecipes.forEach(recipe => {
                    console.log('- ' + recipe.title, '(ID:', recipe.recipeId || recipe.id, ')');
                });
                return dbRecipes;
            } catch (error) {
                console.error('Failed to load from database:', error);
                return [];
            }
        };

        window.showLocalStorage = () => {
            const recipes = app.storage.getLocalRecipes();
            console.log('Local storage recipes:', recipes);
            return recipes;
        };

        window.deleteAllDatabaseRecords = async () => {
            console.log('⚠️ Database record deletion disabled for safety. Use phpMyAdmin if needed.');
            return { message: 'Use phpMyAdmin to manage database records directly' };
        };

        window.syncLocalToDatabase = async () => {
            try {
                const localRecipes = app.storage.getLocalRecipes();
                console.log('Syncing local recipes to database...');
                console.log('Local recipes:', localRecipes.length);

                let synced = 0;
                let skipped = 0;

                for (const localRecipe of localRecipes) {
                    try {
                        await app.storage.saveToDatabase(localRecipe);
                        synced++;
                        console.log(`Synced: ${localRecipe.title}`);
                    } catch (error) {
                        console.error(`Failed to sync: ${localRecipe.title}`, error);
                        skipped++;
                    }
                }

                console.log(`Sync complete. Synced: ${synced}, Failed: ${skipped}`);
                console.log('Refresh page to see changes.');
                return { synced, failed: skipped, total: localRecipes.length };
            } catch (error) {
                console.error('Sync failed:', error);
            }
        };

    } catch (error) {
        console.error('Failed to start Recipe Keeper App:', error);

        // Show fallback error message
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff6b6b;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        errorDiv.textContent = 'Failed to start Recipe Keeper. Please refresh the page.';
        document.body.appendChild(errorDiv);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});

// Export for module usage
export default RecipeKeeperApp;