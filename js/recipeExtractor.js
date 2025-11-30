/**
 * Recipe Extraction Module
 * Handles extracting recipe data from web pages
 */

import { CONFIG } from './config.js';
import { Formatter, AppError, ErrorTypes, RecipeValidator } from './utils.js';

export class RecipeExtractor {
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
     * Fetches and extracts recipe from URL
     * @param {string} url - Recipe URL
     * @returns {Promise<Object>} - Extracted recipe
     */
    async extractRecipe(url) {
        try {
            // Fetch webpage content
            const htmlContent = await this.fetchWebpage(url);

            // Extract recipe from HTML
            const recipe = await this.extractRecipeFromHtml(htmlContent, url);

            // Validate extracted recipe
            const validation = RecipeValidator.validateRecipe(recipe);
            if (!validation.isValid) {
                throw new AppError(
                    'Extracted recipe data is invalid',
                    ErrorTypes.EXTRACTION_ERROR,
                    { errors: validation.errors, recipe }
                );
            }

            return validation.validatedRecipe;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to extract recipe: ${error.message}`,
                ErrorTypes.EXTRACTION_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Fetches webpage content using AllOrigins API
     * @param {string} url - URL to fetch
     * @returns {Promise<string>} - HTML content
     */
    async fetchWebpage(url) {
        try {
            const allOriginsUrl = `${CONFIG.ALLORIGINS_URL}${encodeURIComponent(url)}`;
            const response = await fetch(allOriginsUrl);

            if (!response.ok) {
                throw new AppError(
                    `Failed to fetch webpage: ${response.status} ${response.statusText}`,
                    ErrorTypes.NETWORK_ERROR
                );
            }

            return await response.text();
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                'Network error while fetching webpage',
                ErrorTypes.NETWORK_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Extracts recipe from HTML content
     * @param {string} htmlContent - HTML content
     * @param {string} sourceUrl - Original URL
     * @returns {Object} - Extracted recipe
     */
    async extractRecipeFromHtml(htmlContent, sourceUrl) {
        console.log('Extracting recipe from webpage...');

        // Safely extract hostname
        let hostname = 'website';
        try {
            hostname = new URL(sourceUrl).hostname;
        } catch (e) {
            console.warn('Could not parse URL for hostname:', sourceUrl);
        }

        const recipe = {
            url: sourceUrl,
            title: 'Recipe from ' + hostname,
            ingredients: [],
            servings: CONFIG.DEFAULT_RECIPE.servings,
            prepTime: CONFIG.DEFAULT_RECIPE.prepTime,
            cookTime: CONFIG.DEFAULT_RECIPE.cookTime,
            steps: [],
            imageUrl: null
        };

        // Try JSON-LD extraction first (most reliable)
        const jsonLdRecipe = this.extractFromJsonLd(htmlContent);
        if (jsonLdRecipe) {
            Object.assign(recipe, jsonLdRecipe);
            if (recipe.ingredients.length > 0 || recipe.steps.length > 0) {
                console.log('Successfully extracted from JSON-LD');
                return recipe;
            }
        }

        // Fallback to HTML pattern matching
        this.extractFromHtmlPatterns(htmlContent, recipe);

        // Ensure we have some content
        if (recipe.ingredients.length === 0) {
            recipe.ingredients = [
                { amount: '', unit: '', item: 'Could not extract ingredients - please check the original recipe' }
            ];
        }

        if (recipe.steps.length === 0) {
            recipe.steps = ['Could not extract instructions - please check the original recipe'];
        }

        console.log('Local extraction completed:', recipe.title);
        return recipe;
    }

    /**
     * Cleans JSON-LD content for parsing
     * @param {string} jsonContent - Raw JSON content
     * @returns {string} - Cleaned JSON content
     */
    cleanJsonLd(jsonContent) {
        let cleaned = jsonContent.trim();

        // Remove HTML comments
        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

        // Remove CDATA wrappers
        cleaned = cleaned.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');

        // Unescape common HTML entities that might be in the JSON
        cleaned = cleaned.replace(/&quot;/g, '"');
        cleaned = cleaned.replace(/&amp;/g, '&');
        cleaned = cleaned.replace(/&lt;/g, '<');
        cleaned = cleaned.replace(/&gt;/g, '>');

        // Remove trailing commas before } or ] (common JSON error)
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

        return cleaned;
    }

    /**
     * Extracts recipe from JSON-LD structured data
     * @param {string} htmlContent - HTML content
     * @returns {Object|null} - Extracted recipe data or null
     */
    extractFromJsonLd(htmlContent) {
        const jsonLdMatches = htmlContent.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

        for (const match of jsonLdMatches) {
            try {
                const cleanedJson = this.cleanJsonLd(match[1]);
                const jsonData = JSON.parse(cleanedJson);
                const recipeData = this.findRecipeInJsonLd(jsonData);

                if (recipeData) {
                    return this.parseJsonLdRecipe(recipeData);
                }
            } catch (e) {
                // Try to extract just the error location for debugging
                console.warn('JSON-LD parsing failed:', e.message);
            }
        }

        return null;
    }

    /**
     * Checks if a JSON-LD type matches Recipe
     * @param {string|Array} type - The @type value
     * @returns {boolean} - True if it's a Recipe type
     */
    isRecipeType(type) {
        if (!type) return false;
        if (typeof type === 'string') {
            return type.toLowerCase() === 'recipe';
        }
        if (Array.isArray(type)) {
            return type.some(t => typeof t === 'string' && t.toLowerCase() === 'recipe');
        }
        return false;
    }

    /**
     * Finds recipe data in JSON-LD structure
     * @param {Object} jsonData - Parsed JSON-LD data
     * @returns {Object|null} - Recipe data or null
     */
    findRecipeInJsonLd(jsonData) {
        if (this.isRecipeType(jsonData['@type'])) {
            return jsonData;
        }

        if (Array.isArray(jsonData)) {
            return jsonData.find(item => this.isRecipeType(item['@type']));
        }

        if (jsonData['@graph']) {
            return jsonData['@graph'].find(item => this.isRecipeType(item['@type']));
        }

        // Check for nested itemListElement (some sites use this)
        if (jsonData.itemListElement && Array.isArray(jsonData.itemListElement)) {
            for (const item of jsonData.itemListElement) {
                if (item.item && this.isRecipeType(item.item['@type'])) {
                    return item.item;
                }
            }
        }

        return null;
    }

    /**
     * Parses JSON-LD recipe data
     * @param {Object} recipeData - JSON-LD recipe data
     * @returns {Object} - Parsed recipe
     */
    parseJsonLdRecipe(recipeData) {
        const recipe = {};

        // Title
        if (recipeData.name) {
            recipe.title = recipeData.name;
        }

        // Image
        if (recipeData.image) {
            if (typeof recipeData.image === 'string') {
                recipe.imageUrl = recipeData.image;
            } else if (recipeData.image.url) {
                recipe.imageUrl = recipeData.image.url;
            } else if (Array.isArray(recipeData.image)) {
                recipe.imageUrl = recipeData.image[0];
            }
        }

        // Servings - handle both string and array formats
        if (recipeData.recipeYield) {
            let yieldValue = recipeData.recipeYield;
            // Handle array format like ["4 servings", "4"]
            if (Array.isArray(yieldValue)) {
                yieldValue = yieldValue[0];
            }
            // Extract number from string like "4 servings" or "Serves 4"
            if (typeof yieldValue === 'string') {
                const match = yieldValue.match(/(\d+)/);
                if (match) {
                    recipe.servings = parseInt(match[1]);
                }
            } else if (typeof yieldValue === 'number') {
                recipe.servings = yieldValue;
            }
        }

        // Times
        if (recipeData.prepTime) {
            const minutes = Formatter.parseDuration(recipeData.prepTime);
            if (minutes) recipe.prepTime = minutes;
        }
        if (recipeData.cookTime) {
            const minutes = Formatter.parseDuration(recipeData.cookTime);
            if (minutes) recipe.cookTime = minutes;
        }

        // Ingredients
        if (recipeData.recipeIngredient && Array.isArray(recipeData.recipeIngredient)) {
            recipe.ingredients = this.parseIngredients(recipeData.recipeIngredient);
        }

        // Instructions
        if (recipeData.recipeInstructions) {
            recipe.steps = this.parseInstructions(recipeData.recipeInstructions);
        }

        return recipe;
    }

    /**
     * Parses ingredients from JSON-LD
     * @param {Array} ingredients - Raw ingredients array
     * @returns {Array} - Parsed ingredients
     */
    parseIngredients(ingredients) {
        return ingredients.map(ing => {
            const text = this.decodeHtmlEntities(ing.trim());

            // Advanced ingredient parsing with multiple patterns
            const patterns = [
                // Pattern: "1/2 cup flour" or "2 tablespoons sugar"
                /^([\d\/.½⅓⅔¼¾⅛⅜⅝⅞\-\s]+)?\s*(?:\(([\d\/.]+)[^)]*\))?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(.+)$/,
                // Simpler pattern: "1/2 flour" or just "flour"
                /^([\d\/.½⅓⅔¼¾⅛⅜⅝⅞\-\s]+)?\s*(.+)$/
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    if (match.length > 4) {
                        // Complex pattern match
                        return {
                            amount: (match[1] || match[2] || '').trim(),
                            unit: match[3] || '',
                            item: match[4] || text
                        };
                    } else {
                        // Simple pattern match
                        return {
                            amount: match[1] || '',
                            unit: '',
                            item: match[2] || text
                        };
                    }
                }
            }

            // Fallback
            return { amount: '', unit: '', item: text };
        });
    }

    /**
     * Parses instructions from JSON-LD
     * @param {Array} instructions - Raw instructions array
     * @returns {Array} - Parsed instructions
     */
    parseInstructions(instructions) {
        return instructions
            .map(inst => {
                let text = '';
                if (typeof inst === 'string') text = inst.trim();
                else if (inst.text) text = inst.text.trim();
                else if (inst.name) text = inst.name.trim();
                else if (inst['@type'] === 'HowToStep' && inst.text) text = inst.text.trim();
                else if (inst.instruction) text = inst.instruction.trim();
                else if (inst.description) text = inst.description.trim();

                return this.decodeHtmlEntities(text);
            })
            .filter(step => step.length > 0);
    }

    /**
     * Extracts recipe using HTML pattern matching
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object to populate
     */
    extractFromHtmlPatterns(htmlContent, recipe) {
        // Extract title
        this.extractTitleFromHtml(htmlContent, recipe);

        // Extract ingredients
        this.extractIngredientsFromHtml(htmlContent, recipe);

        // Extract steps
        this.extractStepsFromHtml(htmlContent, recipe);

        // Extract image
        this.extractImageFromHtml(htmlContent, recipe);
    }

    /**
     * Extracts title from HTML patterns
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object
     */
    extractTitleFromHtml(htmlContent, recipe) {
        const titlePatterns = [
            /<h1[^>]*class="[^"]*recipe[^"]*"[^>]*>([^<]+)<\/h1>/i,
            /<h1[^>]*>([^<]+)<\/h1>/i,
            /<h2[^>]*class="[^"]*recipe[^"]*"[^>]*>([^<]+)<\/h2>/i,
            /<title>([^<]+)<\/title>/i
        ];

        for (const pattern of titlePatterns) {
            const match = htmlContent.match(pattern);
            if (match && match[1].trim()) {
                recipe.title = this.decodeHtmlEntities(match[1].trim())
                    .replace(/\s*\|.*$/, '')
                    .replace(/Recipe\s*[-–]\s*/i, '');
                break;
            }
        }
    }

    /**
     * Extracts ingredients from HTML patterns
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object
     */
    extractIngredientsFromHtml(htmlContent, recipe) {
        const ingredientPatterns = [
            /<li[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            /<li[^>]*itemprop="recipeIngredient"[^>]*>([\s\S]*?)<\/li>/gi,
            /<span[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
            /<p[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/p>/gi
        ];

        for (const pattern of ingredientPatterns) {
            const matches = [...htmlContent.matchAll(pattern)];
            for (const match of matches) {
                const text = this.decodeHtmlEntities(match[1].replace(/<[^>]*>/g, '').trim());
                if (text && text.length > 2) {
                    const parsed = this.parseIngredientText(text);
                    recipe.ingredients.push(parsed);
                }
            }
            if (recipe.ingredients.length > 0) break;
        }
    }

    /**
     * Parses ingredient text
     * @param {string} text - Raw ingredient text
     * @returns {Object} - Parsed ingredient
     */
    parseIngredientText(text) {
        const parts = text.match(/^([\d\/.½⅓⅔¼¾⅛⅜⅝⅞]+)?\s*([a-zA-Z]+)?\s*(.+)$/);
        if (parts) {
            return {
                amount: parts[1] || '',
                unit: parts[2] || '',
                item: parts[3] || text
            };
        }
        return {
            amount: '',
            unit: '',
            item: text
        };
    }

    /**
     * Extracts steps from HTML patterns
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object
     */
    extractStepsFromHtml(htmlContent, recipe) {
        const stepPatterns = [
            // AllRecipes specific patterns
            /<li[^>]*data-testid="instruction-text"[^>]*>([\s\S]*?)<\/li>/gi,
            /<p[^>]*class="[^"]*recipe-summary__item[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
            /<div[^>]*class="[^"]*recipe-instruction[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
            // Generic patterns
            /<li[^>]*class="[^"]*instruction[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            /<li[^>]*itemprop="recipeInstructions"[^>]*>([\s\S]*?)<\/li>/gi,
            /<div[^>]*class="[^"]*direction[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
            /<div[^>]*class="[^"]*step[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
            /<p[^>]*class="[^"]*instruction[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
            // Ordered list patterns
            /<ol[^>]*class="[^"]*instructions[^"]*"[^>]*>[\s\S]*?<\/ol>/gi
        ];

        for (const pattern of stepPatterns) {
            if (pattern.source.includes('<ol')) {
                // Handle ordered list extraction
                const olMatch = htmlContent.match(pattern);
                if (olMatch) {
                    const liMatches = [...olMatch[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
                    for (const liMatch of liMatches) {
                        const text = this.decodeHtmlEntities(liMatch[1].replace(/<[^>]*>/g, '').trim());
                        if (text && text.length > 10) {
                            recipe.steps.push(text);
                        }
                    }
                }
            } else {
                const matches = [...htmlContent.matchAll(pattern)];
                for (const match of matches) {
                    const text = this.decodeHtmlEntities(match[1].replace(/<[^>]*>/g, '').trim());
                    if (text && text.length > 10) {
                        recipe.steps.push(text);
                    }
                }
            }
            if (recipe.steps.length > 0) break;
        }
    }

    /**
     * Extracts image from HTML patterns
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object
     */
    extractImageFromHtml(htmlContent, recipe) {
        const imgPatterns = [
            // Meta tags (most reliable)
            /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i,
            /<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i,
            /<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i,
            // Schema.org
            /<img[^>]*itemprop="image"[^>]*src="([^"]+)"/i,
            // Recipe-specific classes
            /<img[^>]*class="[^"]*recipe[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*hero[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]+)"/i,
            // Data attributes
            /<img[^>]*data-src="([^"]+)"[^>]*class="[^"]*recipe/i,
            // Picture element source
            /<source[^>]*srcset="([^"]+)"[^>]*type="image/i
        ];

        for (const pattern of imgPatterns) {
            const match = htmlContent.match(pattern);
            if (match && match[1]) {
                let imageUrl = match[1];
                // Handle srcset - take the first URL
                if (imageUrl.includes(' ')) {
                    imageUrl = imageUrl.split(' ')[0].split(',')[0].trim();
                }
                recipe.imageUrl = imageUrl;
                break;
            }
        }
    }

    /**
     * Resolves a potentially relative URL to an absolute URL
     * @param {string} url - URL to resolve
     * @param {string} baseUrl - Base URL for resolution
     * @returns {string} - Absolute URL
     */
    resolveUrl(url, baseUrl) {
        if (!url) return url;
        // Already absolute
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        // Protocol-relative
        if (url.startsWith('//')) {
            return 'https:' + url;
        }
        // Relative URL
        try {
            return new URL(url, baseUrl).href;
        } catch (e) {
            return url;
        }
    }
}