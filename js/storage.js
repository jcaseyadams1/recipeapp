/**
 * Storage Module
 * Handles MariaDB database and local storage operations
 */

import { CONFIG } from './config.js';
import { AppError, ErrorTypes } from './utils.js';

export class StorageManager {
    constructor() {
        this.recipesFileName = 'recipes.json';
        this.backupDir = 'backups';
        this.apiUrl = '/recipeapp/api/recipes.php'; // Full absolute path
    }

    /**
     * Saves a recipe to database via API
     * @param {Object} recipe - Recipe to save
     * @returns {Promise<Object>} - Save result
     */
    async saveRecipe(recipe) {
        let databaseSaved = false;
        const errors = [];

        // Save to database via API
        try {
            await this.saveToDatabase(recipe);
            databaseSaved = true;
            console.log('Recipe saved to database');
        } catch (error) {
            console.error('Database save failed:', error);
            errors.push(`Database: ${error.message}`);

            // Fallback to localStorage for offline functionality
            try {
                await this.saveToLocalStorageFallback(recipe);
                console.log('Recipe saved to localStorage as fallback');
            } catch (fallbackError) {
                errors.push(`Fallback: ${fallbackError.message}`);
            }
        }

        return {
            success: databaseSaved,
            localSaved: databaseSaved,
            errors
        };
    }

    /**
     * Saves recipe to database via API
     * @param {Object} recipe - Recipe to save
     */
    async saveToDatabase(recipe) {
        try {
            const cleanRecipe = this.prepareRecipeForDatabase(recipe);
            console.log('Saving recipe to database:', { title: cleanRecipe.title, recipeId: cleanRecipe.recipeId, url: cleanRecipe.url });

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cleanRecipe)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save recipe');
            }

            const result = await response.json();
            console.log('Recipe saved successfully:', result);
            return result;
        } catch (error) {
            throw new AppError(
                'Failed to save to database',
                ErrorTypes.STORAGE_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Saves recipe to local storage (fallback)
     * @param {Object} recipe - Recipe to save
     */
    async saveToLocalStorageFallback(recipe) {
        try {
            // Get current local recipes
            let localRecipes = this.getLocalRecipesFromStorage();
            console.log('Current local recipes:', localRecipes.map(r => ({ title: r.title, recipeId: r.recipeId, url: r.url })));

            // Clean up the recipe object before saving
            const cleanRecipe = this.prepareRecipeForLocalStorage(recipe);
            console.log('Saving recipe to fallback storage:', { title: cleanRecipe.title, recipeId: cleanRecipe.recipeId, url: cleanRecipe.url });

            // Check if recipe already exists (update vs create)
            const existingIndex = localRecipes.findIndex(r => {
                if (cleanRecipe.url && r.url) {
                    return r.url === cleanRecipe.url;
                } else if (cleanRecipe.recipeId && r.recipeId) {
                    return r.recipeId === cleanRecipe.recipeId;
                }
                return false;
            });

            if (existingIndex > -1) {
                console.log('Updating existing recipe at index', existingIndex, ':', localRecipes[existingIndex].title);
                localRecipes[existingIndex] = cleanRecipe;
            } else {
                console.log('Creating new recipe:', cleanRecipe.title);
                localRecipes.unshift(cleanRecipe);
            }

            console.log('Recipes after save:', localRecipes.map(r => ({ title: r.title, recipeId: r.recipeId })));

            // Save to local storage
            localStorage.setItem(CONFIG.STORAGE_KEYS.SAVED_RECIPES, JSON.stringify(localRecipes));

            // Conditionally save to file based on configuration
            if (CONFIG.FILE_STORAGE.AUTO_BACKUP_ENABLED) {
                const shouldBackup = localRecipes.length % CONFIG.FILE_STORAGE.BACKUP_FREQUENCY === 0;
                if (shouldBackup) {
                    console.log(`Auto-backup triggered (every ${CONFIG.FILE_STORAGE.BACKUP_FREQUENCY} recipes)`);
                    await this.saveToFile(localRecipes);
                }
            }

        } catch (error) {
            throw new AppError(
                'Failed to save to local storage',
                ErrorTypes.STORAGE_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Save recipes to a local file
     * @param {Array} recipes - Array of recipes to save
     */
    async saveToFile(recipes) {
        try {
            const recipesData = {
                version: '1.0',
                lastUpdated: new Date().toISOString(),
                recipeCount: recipes.length,
                recipes: recipes
            };

            const jsonString = JSON.stringify(recipesData, null, 2);

            // Try to use File System Access API (modern browsers)
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: this.recipesFileName,
                        types: [{
                            description: 'Recipe files',
                            accept: { 'application/json': ['.json'] }
                        }]
                    });

                    const writable = await fileHandle.createWritable();
                    await writable.write(jsonString);
                    await writable.close();

                    console.log('Recipes saved to file successfully');
                    return;
                } catch (fileError) {
                    if (fileError.name !== 'AbortError') {
                        console.warn('File save failed, falling back to download:', fileError);
                    }
                }
            }

            // Fallback: Download as file
            this.downloadAsFile(jsonString, this.recipesFileName, 'application/json');

        } catch (error) {
            console.error('Failed to save to file:', error);
            // Don't throw - file saving is optional
        }
    }

    /**
     * Download data as a file
     * @param {string} data - Data to download
     * @param {string} filename - Filename
     * @param {string} type - MIME type
     */
    downloadAsFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
        console.log('Recipe file downloaded:', filename);
    }

    /**
     * Create a backup of current recipes
     */
    async createBackup() {
        try {
            const recipes = this.getLocalRecipes();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupFilename = `recipes-backup-${timestamp}.json`;

            const backupData = {
                version: '1.0',
                backupDate: new Date().toISOString(),
                recipeCount: recipes.length,
                recipes: recipes
            };

            const jsonString = JSON.stringify(backupData, null, 2);
            this.downloadAsFile(jsonString, backupFilename, 'application/json');

            console.log('Backup created:', backupFilename);
            return backupFilename;
        } catch (error) {
            console.error('Failed to create backup:', error);
            throw new AppError('Failed to create backup', ErrorTypes.STORAGE_ERROR, { originalError: error });
        }
    }

    /**
     * Decode HTML entities in text
     * @param {string} text - Text containing HTML entities
     * @returns {string} - Decoded text
     */
    decodeHtmlEntities(text) {
        if (!text || typeof text !== 'string') return text;

        // Create a temporary element to decode HTML entities
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        let decoded = textarea.value;

        // Handle additional common entities that might not be decoded properly
        const entityMap = {
            '&amp;#32;': ' ',
            '&#32;': ' ',
            '&amp;#39;': "'",
            '&#39;': "'",
            '&amp;#x27;': "'",
            '&#x27;': "'",
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&nbsp;': ' ',
            '&apos;': "'"
        };

        // Replace entities
        for (const [entity, replacement] of Object.entries(entityMap)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
        }

        // Handle numeric entities like &#32; (space)
        decoded = decoded.replace(/&#(\d+);/g, (match, code) => {
            return String.fromCharCode(parseInt(code, 10));
        });

        // Handle hex entities like &#x27; (apostrophe)
        decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
            return String.fromCharCode(parseInt(code, 16));
        });

        return decoded;
    }

    /**
     * Prepares recipe for local storage
     * @param {Object} recipe - Recipe object
     * @returns {Object} - Cleaned recipe
     */
    prepareRecipeForLocalStorage(recipe) {
        return {
            ...recipe,
            imageUrl: typeof recipe.imageUrl === 'string'
                ? recipe.imageUrl
                : (recipe.imageUrl?.url || null),
            dateAdded: new Date().toISOString()
        };
    }

    /**
     * Loads saved recipes from database via API
     * @returns {Promise<Array>} - Array of recipes
     */
    async loadSavedRecipes() {
        console.log('🔄 storage.loadSavedRecipes() called - attempting DATABASE first');

        try {
            const recipes = await this.loadFromDatabase();
            console.log(`✅ DATABASE SUCCESS: ${recipes.length} recipes loaded:`, recipes.map(r => r.title));
            return recipes;
        } catch (error) {
            console.error('❌ DATABASE FAILED, trying localStorage fallback:', error);

            // Fallback to localStorage
            try {
                const localRecipes = this.getLocalRecipesFromStorage();
                console.log(`⚠️ FALLBACK: loaded ${localRecipes.length} recipes from localStorage`);
                return localRecipes.sort((a, b) => {
                    const dateA = new Date(a.dateAdded || 0);
                    const dateB = new Date(b.dateAdded || 0);
                    return dateB - dateA;
                });
            } catch (fallbackError) {
                console.error('❌ FALLBACK ALSO FAILED:', fallbackError);
                return [];
            }
        }
    }

    /**
     * Loads recipes from database via API
     * @returns {Promise<Array>} - Array of recipes
     */
    async loadFromDatabase() {
        const absoluteUrl = new URL(this.apiUrl, window.location.href).href;
        console.log(`🔗 Attempting to fetch from: ${this.apiUrl}`);
        console.log(`🌐 Resolved absolute URL: ${absoluteUrl}`);
        console.log(`📍 Current page URL: ${window.location.href}`);

        try {
            const response = await fetch(this.apiUrl);
            console.log(`📡 API Response status: ${response.status} ${response.statusText}`);
            console.log(`📡 Response URL: ${response.url}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ API Error Response: ${errorText}`);
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const recipes = await response.json();
            console.log(`✅ Successfully loaded ${recipes.length} recipes from database`);
            console.log('📊 Database recipes:', recipes.map(r => ({ title: r.title, id: r.id, recipeId: r.recipeId })));
            return recipes;
        } catch (error) {
            console.error('🚨 loadFromDatabase() failed:', error);
            throw new AppError(
                'Failed to load from database',
                ErrorTypes.STORAGE_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Gets recipes from local storage (for fallback)
     * @returns {Array} - Array of recipes
     */
    getLocalRecipesFromStorage() {
        return this.getLocalRecipes();
    }

    /**
     * Gets recipes from local storage (legacy method)
     * @returns {Array} - Array of recipes
     */
    getLocalRecipes() {
        try {
            const recipesJson = localStorage.getItem(CONFIG.STORAGE_KEYS.SAVED_RECIPES);
            let recipes = recipesJson ? JSON.parse(recipesJson) : [];

            // Assign recipeId to OCR recipes that don't have one (for any remaining old recipes)
            let needsUpdate = false;
            recipes = recipes.map(recipe => {
                if (!recipe.url && !recipe.recipeId) {
                    // This is an old OCR recipe without a recipeId - assign one
                    recipe.recipeId = 'ocr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                    needsUpdate = true;
                    console.log('Assigned recipeId to legacy OCR recipe:', recipe.title, recipe.recipeId);
                }
                return recipe;
            });

            // Save back to localStorage if we made changes
            if (needsUpdate) {
                localStorage.setItem(CONFIG.STORAGE_KEYS.SAVED_RECIPES, JSON.stringify(recipes));
            }

            return recipes;
        } catch (error) {
            console.error('Error parsing local recipes:', error);
            return [];
        }
    }

    /**
     * Safely parses JSON with fallback
     * @param {string} jsonString - JSON string to parse
     * @param {*} fallback - Fallback value if parsing fails
     * @returns {*} - Parsed value or fallback
     */
    safeJsonParse(jsonString, fallback = null) {
        if (!jsonString) return fallback;

        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('JSON parse error:', error);
            return fallback;
        }
    }

    /**
     * Prepares recipe for database storage
     * @param {Object} recipe - Recipe object
     * @returns {Object} - Cleaned recipe
     */
    prepareRecipeForDatabase(recipe) {
        return {
            ...recipe,
            imageUrl: typeof recipe.imageUrl === 'string'
                ? recipe.imageUrl
                : (recipe.imageUrl?.url || null),
            dateAdded: recipe.dateAdded || new Date().toISOString()
        };
    }

    /**
     * Deletes a recipe from database via API
     * @param {string} recipeUrl - URL of recipe to delete
     * @param {string} recipeId - Recipe ID to delete
     */
    async deleteFromDatabase(recipeUrl, recipeId) {
        try {
            const params = new URLSearchParams();
            if (recipeId) {
                params.append('recipeId', recipeId);
            } else if (recipeUrl) {
                params.append('url', recipeUrl);
            } else {
                throw new Error('Either recipeId or URL must be provided');
            }

            const response = await fetch(`${this.apiUrl}?${params.toString()}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete recipe');
            }

            const result = await response.json();
            console.log('Recipe deleted from database:', result);
            return result;
        } catch (error) {
            throw new AppError(
                'Failed to delete from database',
                ErrorTypes.STORAGE_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Deletes a recipe from database via API
     * @param {string} recipeUrl - URL of recipe to delete
     * @param {string} recipeId - Recipe ID to delete
     * @returns {Promise<Object>} - Delete result
     */
    async deleteRecipe(recipeUrl, recipeId) {
        console.log('deleteRecipe called with URL:', recipeUrl, 'Recipe ID:', recipeId);

        const results = {
            localDeleted: false,
            errors: []
        };

        // Delete from database via API
        try {
            console.log('Deleting from database...');
            await this.deleteFromDatabase(recipeUrl, recipeId);
            results.localDeleted = true;
            console.log('Successfully deleted from database');
        } catch (error) {
            console.error('Database delete error:', error);
            results.errors.push(`Database delete failed: ${error.message}`);

            // Fallback to localStorage delete
            try {
                console.log('Attempting fallback delete from localStorage...');
                this.deleteFromLocalStorage(recipeUrl, recipeId);
                results.localDeleted = true;
                console.log('Successfully deleted from localStorage fallback');
            } catch (fallbackError) {
                console.error('Fallback delete error:', fallbackError);
                results.errors.push(`Fallback delete failed: ${fallbackError.message}`);
            }
        }

        console.log('Delete results:', results);
        return results;
    }

    /**
     * Deletes recipe from local storage
     * @param {string} recipeUrl - Recipe URL to delete
     */
    deleteFromLocalStorage(recipeUrl, recipeId) {
        const localRecipes = this.getLocalRecipes();
        console.log('Deleting from local storage - URL:', recipeUrl, 'RecipeID:', recipeId);
        console.log('Available recipes before deletion:', localRecipes.map(r => ({ title: r.title, url: r.url, recipeId: r.recipeId })));

        // Filter out recipes by URL first, then by recipeId
        const filteredRecipes = localRecipes.filter(r => {
            if (recipeUrl && recipeUrl.trim().length > 0) {
                const shouldKeep = r.url !== recipeUrl;
                console.log(`URL comparison: "${r.url}" !== "${recipeUrl}" = ${shouldKeep} (${r.title})`);
                return shouldKeep;
            }
            if (recipeId) {
                const shouldKeep = r.recipeId !== recipeId;
                console.log(`RecipeID comparison: "${r.recipeId}" !== "${recipeId}" = ${shouldKeep} (${r.title})`);
                return shouldKeep;
            }
            console.log('No identifier provided, keeping recipe:', r.title);
            return true; // Keep recipe if no identifier provided
        });

        console.log('Local storage deletion: original count:', localRecipes.length, 'filtered count:', filteredRecipes.length);
        console.log('Remaining recipes after deletion:', filteredRecipes.map(r => ({ title: r.title, url: r.url, recipeId: r.recipeId })));

        localStorage.setItem(CONFIG.STORAGE_KEYS.SAVED_RECIPES, JSON.stringify(filteredRecipes));
    }

    /**
     * Clear local storage completely
     */
    clearLocalStorage() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.SAVED_RECIPES);
        console.log('Local storage cleared');
    }

    /**
     * Clears all saved recipes (with confirmation)
     * @param {boolean} confirmed - Confirmation flag
     * @returns {Promise<Object>} - Clear result
     */
    async clearAllRecipes(confirmed = false) {
        if (!confirmed) {
            throw new AppError(
                'Clear operation must be confirmed',
                ErrorTypes.VALIDATION_ERROR
            );
        }

        const results = {
            localCleared: false,
            errors: []
        };

        // Clear local storage
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.SAVED_RECIPES);
            results.localCleared = true;
        } catch (error) {
            results.errors.push(`Local storage clear failed: ${error.message}`);
        }

        return results;
    }
}