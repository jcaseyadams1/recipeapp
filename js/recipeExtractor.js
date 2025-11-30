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
     * Fetches webpage content using proxy API
     * @param {string} url - URL to fetch
     * @returns {Promise<string>} - HTML content
     */
    async fetchWebpage(url) {
        try {
            const proxyUrl = `${CONFIG.ALLORIGINS_URL}${encodeURIComponent(url)}`;
            console.log('Fetching via proxy:', proxyUrl);

            const response = await fetch(proxyUrl);

            if (!response.ok) {
                // Try to get error message from response
                let errorMsg = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMsg = errorData.error;
                    }
                } catch (e) {
                    errorMsg = `${response.status} ${response.statusText}`;
                }
                throw new AppError(
                    `Failed to fetch webpage: ${errorMsg}`,
                    ErrorTypes.NETWORK_ERROR
                );
            }

            return await response.text();
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            console.error('Fetch error:', error);
            throw new AppError(
                `Network error: ${error.message || 'Check your Internet connection'}`,
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
            if (recipe.ingredients.length > 0 && recipe.steps.length > 0) {
                console.log('Successfully extracted from JSON-LD');
                return recipe;
            }
        }

        // Try microdata extraction second
        const microdataRecipe = this.extractFromMicrodata(htmlContent);
        if (microdataRecipe) {
            // Merge microdata with existing recipe (fill gaps)
            if (microdataRecipe.title && recipe.title.startsWith('Recipe from')) {
                recipe.title = microdataRecipe.title;
            }
            if (microdataRecipe.ingredients?.length > 0 && recipe.ingredients.length === 0) {
                recipe.ingredients = microdataRecipe.ingredients;
            }
            if (microdataRecipe.steps?.length > 0 && recipe.steps.length === 0) {
                recipe.steps = microdataRecipe.steps;
            }
            if (microdataRecipe.imageUrl && !recipe.imageUrl) {
                recipe.imageUrl = microdataRecipe.imageUrl;
            }
            if (recipe.ingredients.length > 0 && recipe.steps.length > 0) {
                console.log('Successfully extracted from microdata');
                return recipe;
            }
        }

        // Fallback to HTML pattern matching
        this.extractFromHtmlPatterns(htmlContent, recipe);

        // Check if this looks like a JavaScript-rendered page with minimal content
        const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const isMinimalContent = textContent.length < 1000;

        // Ensure we have some content with helpful error messages
        if (recipe.ingredients.length === 0) {
            let errorMsg = 'Could not extract ingredients';
            if (isMinimalContent) {
                errorMsg += ' - this site may require JavaScript to load content. Try using the photo feature instead.';
            } else {
                errorMsg += ' - please check the original recipe';
            }
            recipe.ingredients = [{ amount: '', unit: '', item: errorMsg }];
        }

        if (recipe.steps.length === 0) {
            let errorMsg = 'Could not extract instructions';
            if (isMinimalContent) {
                errorMsg += ' - this site may require JavaScript to load content. Try using the photo feature instead.';
            } else {
                errorMsg += ' - please check the original recipe';
            }
            recipe.steps = [errorMsg];
        }

        console.log('Local extraction completed:', recipe.title);
        return recipe;
    }

    /**
     * Extracts recipe data from microdata (itemprop attributes)
     * @param {string} htmlContent - HTML content
     * @returns {Object|null} - Extracted recipe data or null
     */
    extractFromMicrodata(htmlContent) {
        const recipe = {};

        // Extract title from itemprop="name"
        const titleMatch = htmlContent.match(/<[^>]*itemprop=["']name["'][^>]*>([^<]+)</i) ||
                          htmlContent.match(/<[^>]*itemprop=["']name["'][^>]*content=["']([^"']+)["']/i);
        if (titleMatch) {
            recipe.title = this.decodeHtmlEntities(titleMatch[1].trim());
        }

        // Extract ingredients from itemprop="recipeIngredient" or "ingredients"
        const ingredientMatches = [
            ...htmlContent.matchAll(/<[^>]*itemprop=["'](?:recipeIngredient|ingredients)["'][^>]*>([^<]*)</gi),
            ...htmlContent.matchAll(/<[^>]*itemprop=["'](?:recipeIngredient|ingredients)["'][^>]*content=["']([^"']+)["']/gi)
        ];
        if (ingredientMatches.length > 0) {
            recipe.ingredients = ingredientMatches
                .map(m => this.decodeHtmlEntities(m[1].trim()))
                .filter(text => text.length > 2)
                .map(text => this.parseIngredientText(text));
        }

        // Extract instructions from itemprop="recipeInstructions"
        const instructionMatches = [
            ...htmlContent.matchAll(/<[^>]*itemprop=["']recipeInstructions["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)
        ];
        if (instructionMatches.length > 0) {
            recipe.steps = instructionMatches
                .map(m => this.decodeHtmlEntities(m[1].replace(/<[^>]*>/g, ' ').trim()))
                .filter(text => text.length > 5);
        }

        // Extract image from itemprop="image"
        const imageMatch = htmlContent.match(/<img[^>]*itemprop=["']image["'][^>]*src=["']([^"']+)["']/i) ||
                          htmlContent.match(/<[^>]*itemprop=["']image["'][^>]*content=["']([^"']+)["']/i);
        if (imageMatch) {
            recipe.imageUrl = imageMatch[1];
        }

        return (recipe.ingredients?.length > 0 || recipe.steps?.length > 0) ? recipe : null;
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
     * @param {Array|string} instructions - Raw instructions (array or string)
     * @returns {Array} - Parsed instructions
     */
    parseInstructions(instructions) {
        // Handle string instructions (some sites put all steps in one string)
        if (typeof instructions === 'string') {
            return instructions
                .split(/\n|(?:\d+\.\s)/)
                .map(s => this.decodeHtmlEntities(s.trim()))
                .filter(s => s.length > 5);
        }

        if (!Array.isArray(instructions)) {
            return [];
        }

        const steps = [];

        for (const inst of instructions) {
            // Handle HowToSection (contains nested steps)
            if (inst['@type'] === 'HowToSection') {
                // Extract steps from within the section
                if (inst.itemListElement && Array.isArray(inst.itemListElement)) {
                    for (const item of inst.itemListElement) {
                        const text = this.extractStepText(item);
                        if (text) steps.push(text);
                    }
                }
                // Some sites use 'steps' instead of 'itemListElement'
                if (inst.steps && Array.isArray(inst.steps)) {
                    for (const item of inst.steps) {
                        const text = this.extractStepText(item);
                        if (text) steps.push(text);
                    }
                }
            } else {
                // Handle direct step
                const text = this.extractStepText(inst);
                if (text) steps.push(text);
            }
        }

        return steps;
    }

    /**
     * Extracts text from a single instruction step
     * @param {Object|string} inst - Instruction object or string
     * @returns {string} - Step text
     */
    extractStepText(inst) {
        let text = '';
        if (typeof inst === 'string') {
            text = inst.trim();
        } else if (inst.text) {
            text = inst.text.trim();
        } else if (inst.name && inst['@type'] === 'HowToStep') {
            // Some sites put the instruction in 'name' when 'text' is missing
            text = inst.name.trim();
        } else if (inst.description) {
            text = inst.description.trim();
        } else if (inst.instruction) {
            text = inst.instruction.trim();
        } else if (inst.item?.text) {
            // Handle itemListElement wrapper
            text = inst.item.text.trim();
        }

        // Strip HTML tags that might be in the text
        text = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        return text.length > 0 ? this.decodeHtmlEntities(text) : '';
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
            // Standard patterns
            /<li[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            /<li[^>]*itemprop="recipeIngredient"[^>]*>([\s\S]*?)<\/li>/gi,
            // AllRecipes patterns
            /<span[^>]*data-ingredient-name="true"[^>]*>([\s\S]*?)<\/span>/gi,
            /<li[^>]*class="[^"]*mntl-structured-ingredients__list-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            // Food Network patterns
            /<span[^>]*class="[^"]*o-Ingredients__a-Ingredient[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
            // Epicurious / Bon Appetit patterns
            /<div[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
            // Tasty patterns
            /<li[^>]*class="[^"]*xs-mb1[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            // BBC Good Food patterns
            /<li[^>]*class="[^"]*pb-xxs[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            // Generic patterns (broader matching)
            /<span[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
            /<p[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
            // Data attribute patterns
            /<[^>]*data-ingredient[^>]*>([\s\S]*?)<\/[^>]+>/gi,
            // Checkbox label patterns (common in modern recipe sites)
            /<label[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/label>/gi
        ];

        for (const pattern of ingredientPatterns) {
            const matches = [...htmlContent.matchAll(pattern)];
            for (const match of matches) {
                const text = this.cleanExtractedText(match[1]);
                if (text && text.length > 2 && !this.isBoilerplateText(text)) {
                    const parsed = this.parseIngredientText(text);
                    recipe.ingredients.push(parsed);
                }
            }
            if (recipe.ingredients.length > 2) break; // Need at least 3 ingredients
        }

        // Try extracting from ingredient lists if still empty
        if (recipe.ingredients.length === 0) {
            this.extractIngredientsFromLists(htmlContent, recipe);
        }

        // Try blog-style extraction as last resort
        if (recipe.ingredients.length === 0) {
            this.extractIngredientsFromBlogFormat(htmlContent, recipe);
        }
    }

    /**
     * Extracts ingredients from blog-style format (headers followed by lists)
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object
     */
    extractIngredientsFromBlogFormat(htmlContent, recipe) {
        // Look for "Ingredients" header followed by a list
        const headerPatterns = [
            /<h[2-4][^>]*>[^<]*ingredients[^<]*<\/h[2-4]>\s*([\s\S]*?)(?=<h[2-4]|<\/article|<\/main|$)/gi,
            /<strong>[^<]*ingredients[^<]*<\/strong>\s*([\s\S]*?)(?=<strong>|<h[2-4]|$)/gi,
            /<b>[^<]*ingredients[^<]*<\/b>\s*([\s\S]*?)(?=<b>|<h[2-4]|$)/gi
        ];

        for (const pattern of headerPatterns) {
            const matches = [...htmlContent.matchAll(pattern)];
            for (const match of matches) {
                // Extract list items or paragraphs from the section
                const section = match[1];
                const liMatches = [...section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];

                if (liMatches.length > 0) {
                    for (const liMatch of liMatches) {
                        const text = this.cleanExtractedText(liMatch[1]);
                        if (text && text.length > 2 && !this.isBoilerplateText(text)) {
                            recipe.ingredients.push(this.parseIngredientText(text));
                        }
                    }
                } else {
                    // Try paragraph-based ingredients
                    const pMatches = [...section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
                    for (const pMatch of pMatches) {
                        const text = this.cleanExtractedText(pMatch[1]);
                        // Check if it looks like an ingredient (has numbers or common units)
                        if (text && text.length > 3 && text.length < 200 &&
                            /\d|cup|tbsp|tsp|oz|lb|gram|ml|pinch|dash/i.test(text)) {
                            recipe.ingredients.push(this.parseIngredientText(text));
                        }
                    }
                }
                if (recipe.ingredients.length > 2) return;
            }
        }
    }

    /**
     * Extracts ingredients from unordered/ordered lists with ingredient-related classes
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object
     */
    extractIngredientsFromLists(htmlContent, recipe) {
        // Find lists that are likely ingredient lists
        const listPatterns = [
            /<ul[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
            /<ul[^>]*id="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
            /<div[^>]*class="[^"]*ingredient[^"]*"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/gi
        ];

        for (const listPattern of listPatterns) {
            const listMatches = [...htmlContent.matchAll(listPattern)];
            for (const listMatch of listMatches) {
                const liMatches = [...listMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
                for (const liMatch of liMatches) {
                    const text = this.cleanExtractedText(liMatch[1]);
                    if (text && text.length > 2 && !this.isBoilerplateText(text)) {
                        recipe.ingredients.push(this.parseIngredientText(text));
                    }
                }
                if (recipe.ingredients.length > 2) return;
            }
        }
    }

    /**
     * Cleans extracted text by removing HTML and normalizing whitespace
     * @param {string} text - Raw extracted text
     * @returns {string} - Cleaned text
     */
    cleanExtractedText(text) {
        if (!text) return '';
        return this.decodeHtmlEntities(
            text
                .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
                .replace(/\s+/g, ' ')       // Normalize whitespace
                .trim()
        );
    }

    /**
     * Checks if text is likely boilerplate (ads, buttons, etc.)
     * @param {string} text - Text to check
     * @returns {boolean} - True if boilerplate
     */
    isBoilerplateText(text) {
        const lower = text.toLowerCase();
        const boilerplatePatterns = [
            /^(advertisement|sponsored|subscribe|sign up|log in|print|share|save|pin|email)/i,
            /^(jump to|skip to|view|see|read more|click|tap)/i,
            /^\d+\s*(comments?|reviews?|ratings?)/i,
            /^(nutrition|calories|serving size)/i
        ];
        return boilerplatePatterns.some(p => p.test(lower)) || text.length > 500;
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
            /<p[^>]*class="[^"]*mntl-sc-block-html[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
            /<div[^>]*class="[^"]*recipe-instruction[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
            // Food Network patterns
            /<li[^>]*class="[^"]*o-Method__m-Step[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            // Epicurious / Bon Appetit / Serious Eats patterns
            /<p[^>]*class="[^"]*instruction[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
            /<div[^>]*class="[^"]*step-instruction[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
            // NYT Cooking patterns
            /<li[^>]*class="[^"]*recipe-steps[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            // BBC Good Food patterns
            /<li[^>]*class="[^"]*method-steps[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            // Tasty patterns
            /<li[^>]*class="[^"]*prep-steps[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            // Generic patterns
            /<li[^>]*class="[^"]*instruction[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            /<li[^>]*class="[^"]*direction[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            /<li[^>]*class="[^"]*step[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            /<li[^>]*itemprop="recipeInstructions"[^>]*>([\s\S]*?)<\/li>/gi,
            /<div[^>]*class="[^"]*direction[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
            /<div[^>]*class="[^"]*step[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
            // Data attribute patterns
            /<[^>]*data-instruction[^>]*>([\s\S]*?)<\/[^>]+>/gi
        ];

        for (const pattern of stepPatterns) {
            const matches = [...htmlContent.matchAll(pattern)];
            for (const match of matches) {
                const text = this.cleanExtractedText(match[1]);
                if (text && text.length > 15 && !this.isBoilerplateText(text)) {
                    recipe.steps.push(text);
                }
            }
            if (recipe.steps.length > 1) break; // Need at least 2 steps
        }

        // Try extracting from instruction lists if still empty
        if (recipe.steps.length === 0) {
            this.extractStepsFromLists(htmlContent, recipe);
        }

        // Try blog-style extraction as last resort
        if (recipe.steps.length === 0) {
            this.extractStepsFromBlogFormat(htmlContent, recipe);
        }
    }

    /**
     * Extracts steps from blog-style format (headers followed by content)
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object
     */
    extractStepsFromBlogFormat(htmlContent, recipe) {
        // Look for common instruction headers
        const headerPatterns = [
            /<h[2-4][^>]*>[^<]*(?:instructions?|directions?|method|steps?|how to make)[^<]*<\/h[2-4]>\s*([\s\S]*?)(?=<h[2-4]|<\/article|<\/main|$)/gi,
            /<strong>[^<]*(?:instructions?|directions?|method)[^<]*<\/strong>\s*([\s\S]*?)(?=<strong>|<h[2-4]|$)/gi
        ];

        for (const pattern of headerPatterns) {
            const matches = [...htmlContent.matchAll(pattern)];
            for (const match of matches) {
                const section = match[1];

                // Try ordered list first
                const olMatch = section.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
                if (olMatch) {
                    const liMatches = [...olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
                    for (const liMatch of liMatches) {
                        const text = this.cleanExtractedText(liMatch[1]);
                        if (text && text.length > 15 && !this.isBoilerplateText(text)) {
                            recipe.steps.push(text);
                        }
                    }
                } else {
                    // Try paragraphs
                    const pMatches = [...section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
                    for (const pMatch of pMatches) {
                        const text = this.cleanExtractedText(pMatch[1]);
                        if (text && text.length > 30 && !this.isBoilerplateText(text)) {
                            recipe.steps.push(text);
                        }
                    }
                }
                if (recipe.steps.length > 1) return;
            }
        }
    }

    /**
     * Extracts steps from ordered/unordered lists with instruction-related classes
     * @param {string} htmlContent - HTML content
     * @param {Object} recipe - Recipe object
     */
    extractStepsFromLists(htmlContent, recipe) {
        // Find lists that are likely instruction lists
        const listPatterns = [
            /<ol[^>]*class="[^"]*(?:instruction|direction|method|step|recipe)[^"]*"[^>]*>([\s\S]*?)<\/ol>/gi,
            /<ol[^>]*id="[^"]*(?:instruction|direction|method|step)[^"]*"[^>]*>([\s\S]*?)<\/ol>/gi,
            /<ul[^>]*class="[^"]*(?:instruction|direction|method|step)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
            /<div[^>]*class="[^"]*(?:instruction|direction|method)[^"]*"[^>]*>[\s\S]*?<ol[^>]*>([\s\S]*?)<\/ol>/gi
        ];

        for (const listPattern of listPatterns) {
            const listMatches = [...htmlContent.matchAll(listPattern)];
            for (const listMatch of listMatches) {
                const liMatches = [...listMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
                for (const liMatch of liMatches) {
                    const text = this.cleanExtractedText(liMatch[1]);
                    if (text && text.length > 15 && !this.isBoilerplateText(text)) {
                        recipe.steps.push(text);
                    }
                }
                if (recipe.steps.length > 1) return;
            }
        }

        // Last resort: look for numbered paragraphs
        if (recipe.steps.length === 0) {
            const numberedSteps = [...htmlContent.matchAll(/<p[^>]*>\s*(?:Step\s*)?\d+[.:]\s*([\s\S]*?)<\/p>/gi)];
            for (const match of numberedSteps) {
                const text = this.cleanExtractedText(match[1]);
                if (text && text.length > 15 && !this.isBoilerplateText(text)) {
                    recipe.steps.push(text);
                }
            }
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