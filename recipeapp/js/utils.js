/**
 * Utility Functions Module
 * Contains validation, sanitization, and helper functions
 */

import { CONFIG } from './config.js';

/**
 * Input Validation Functions
 */
export const Validator = {
    /**
     * Validates and sanitizes a URL
     * @param {string} url - The URL to validate
     * @returns {string|null} - Sanitized URL or null if invalid
     */
    validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        // Trim and remove potentially dangerous characters
        const trimmed = url.trim();

        if (trimmed.length === 0 || trimmed.length > CONFIG.VALIDATION.MAX_URL_LENGTH) {
            return null;
        }

        // Check for valid URL format
        try {
            const urlObj = new URL(trimmed);
            // Only allow http and https protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return null;
            }
            return urlObj.toString();
        } catch (error) {
            return null;
        }
    },

    /**
     * Validates recipe title
     * @param {string} title - The title to validate
     * @returns {string|null} - Sanitized title or null if invalid
     */
    validateTitle(title) {
        if (!title || typeof title !== 'string') {
            return null;
        }

        const sanitized = this.sanitizeText(title);

        if (sanitized.length < CONFIG.VALIDATION.MIN_RECIPE_TITLE_LENGTH ||
            sanitized.length > CONFIG.VALIDATION.MAX_RECIPE_TITLE_LENGTH) {
            return null;
        }

        return sanitized;
    },

    /**
     * Validates serving count
     * @param {number|string} servings - The serving count
     * @returns {number|null} - Valid serving count or null
     */
    validateServings(servings) {
        const num = parseInt(servings);
        if (isNaN(num) || num < 1 || num > 100) {
            return null;
        }
        return num;
    },

    /**
     * Validates time (prep or cook time)
     * @param {number|string} time - Time in minutes
     * @returns {number|null} - Valid time or null
     */
    validateTime(time) {
        const num = parseInt(time);
        if (isNaN(num) || num < 0 || num > 1440) { // Max 24 hours
            return null;
        }
        return num;
    },

    /**
     * Sanitizes text input by removing HTML and dangerous characters
     * @param {string} text - Text to sanitize
     * @returns {string} - Sanitized text
     */
    sanitizeText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[<>&"']/g, match => { // Escape special characters
                const escapeMap = {
                    '<': '&lt;',
                    '>': '&gt;',
                    '&': '&amp;',
                    '"': '&quot;',
                    "'": '&#x27;'
                };
                return escapeMap[match];
            })
            .trim();
    }
};

/**
 * Recipe Data Validation
 */
export const RecipeValidator = {
    /**
     * Validates a complete recipe object
     * @param {Object} recipe - Recipe object to validate
     * @returns {Object} - Validation result with isValid and errors
     */
    validateRecipe(recipe) {
        const errors = [];
        const validatedRecipe = {};

        // Validate URL
        const url = Validator.validateUrl(recipe.url);
        if (!url) {
            errors.push('Invalid recipe URL');
        } else {
            validatedRecipe.url = url;
        }

        // Validate title
        const title = Validator.validateTitle(recipe.title);
        if (!title) {
            errors.push('Invalid recipe title');
        } else {
            validatedRecipe.title = title;
        }

        // Validate servings
        const servings = Validator.validateServings(recipe.servings);
        if (servings === null) {
            errors.push('Invalid serving count');
        } else {
            validatedRecipe.servings = servings;
        }

        // Validate prep time
        const prepTime = Validator.validateTime(recipe.prepTime);
        if (prepTime === null) {
            errors.push('Invalid preparation time');
        } else {
            validatedRecipe.prepTime = prepTime;
        }

        // Validate cook time
        const cookTime = Validator.validateTime(recipe.cookTime);
        if (cookTime === null) {
            errors.push('Invalid cooking time');
        } else {
            validatedRecipe.cookTime = cookTime;
        }

        // Validate ingredients
        if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < CONFIG.VALIDATION.MIN_INGREDIENTS) {
            errors.push('Recipe must have at least one ingredient');
        } else {
            validatedRecipe.ingredients = this.validateIngredients(recipe.ingredients);
        }

        // Validate steps
        if (!Array.isArray(recipe.steps) || recipe.steps.length < CONFIG.VALIDATION.MIN_STEPS) {
            errors.push('Recipe must have at least one step');
        } else {
            validatedRecipe.steps = this.validateSteps(recipe.steps);
        }

        // Validate image URL (optional)
        if (recipe.imageUrl) {
            const imageUrl = Validator.validateUrl(recipe.imageUrl);
            validatedRecipe.imageUrl = imageUrl;
        }

        return {
            isValid: errors.length === 0,
            errors,
            validatedRecipe: errors.length === 0 ? validatedRecipe : null
        };
    },

    /**
     * Validates ingredients array
     * @param {Array} ingredients - Array of ingredient objects
     * @returns {Array} - Validated ingredients
     */
    validateIngredients(ingredients) {
        return ingredients.map(ingredient => ({
            amount: Validator.sanitizeText(ingredient.amount || ''),
            unit: Validator.sanitizeText(ingredient.unit || ''),
            item: Validator.sanitizeText(ingredient.item || '')
        })).filter(ingredient => ingredient.item.length > 0);
    },

    /**
     * Validates steps array
     * @param {Array} steps - Array of step strings
     * @returns {Array} - Validated steps
     */
    validateSteps(steps) {
        return steps.map(step => Validator.sanitizeText(step))
                   .filter(step => step.length > 0);
    }
};

/**
 * Error Handling Utilities
 */
export class AppError extends Error {
    constructor(message, type = 'GENERAL_ERROR', details = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

export const ErrorTypes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    API_ERROR: 'API_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    EXTRACTION_ERROR: 'EXTRACTION_ERROR',
    GENERAL_ERROR: 'GENERAL_ERROR'
};

/**
 * Formatting Utilities
 */
export const Formatter = {
    /**
     * Format ingredient amount for display
     * @param {string} amount - Original amount
     * @param {number} currentServing - Current serving size
     * @param {number} originalServing - Original serving size
     * @returns {string} - Formatted amount
     */
    formatIngredientAmount(amount, currentServing, originalServing) {
        if (!amount || amount === '') return '';

        const ratio = currentServing / originalServing;

        // Handle fractions
        if (amount.includes('/')) {
            const parts = amount.split('/');
            if (parts.length === 2) {
                const numerator = parseFloat(parts[0]) * ratio;
                const denominator = parseFloat(parts[1]);

                if (numerator % 1 === 0 && denominator % 1 === 0) {
                    return `${numerator}/${denominator}`;
                } else {
                    return (numerator / denominator).toFixed(2).replace(/\.?0+$/, '');
                }
            }
        }

        // Handle regular numbers
        const num = parseFloat(amount);
        if (!isNaN(num)) {
            const adjusted = num * ratio;
            return adjusted % 1 === 0 ? adjusted.toString() : adjusted.toFixed(2).replace(/\.?0+$/, '');
        }

        return amount;
    },

    /**
     * Parse ISO 8601 duration to minutes
     * @param {string} duration - ISO 8601 duration string
     * @returns {number|null} - Duration in minutes
     */
    parseDuration(duration) {
        if (!duration) return null;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (match) {
            const hours = parseInt(match[1] || 0);
            const minutes = parseInt(match[2] || 0);
            return hours * 60 + minutes;
        }
        return null;
    }
};

/**
 * DOM Utilities
 */
export const DOM = {
    /**
     * Safely get element by ID
     * @param {string} id - Element ID
     * @returns {Element|null} - DOM element or null
     */
    getElementById(id) {
        return document.getElementById(id);
    },

    /**
     * Safely query selector
     * @param {string} selector - CSS selector
     * @returns {Element|null} - DOM element or null
     */
    querySelector(selector) {
        return document.querySelector(selector);
    },

    /**
     * Safely query all elements
     * @param {string} selector - CSS selector
     * @returns {NodeList} - NodeList of elements
     */
    querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    },

    /**
     * Add event listener with automatic cleanup tracking
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListener(element, event, handler, options = {}) {
        if (element && typeof handler === 'function') {
            element.addEventListener(event, handler, options);

            // Store reference for cleanup
            if (!element._eventListeners) {
                element._eventListeners = [];
            }
            element._eventListeners.push({ event, handler, options });
        }
    },

    /**
     * Remove all event listeners from an element
     * @param {Element} element - DOM element
     */
    removeAllEventListeners(element) {
        if (element && element._eventListeners) {
            element._eventListeners.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            element._eventListeners = [];
        }
    }
};