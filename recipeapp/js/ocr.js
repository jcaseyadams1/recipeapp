/**
 * OCR Module - OpenAI Vision API Integration
 * Handles image upload, processing, and text extraction
 */

import { CONFIG } from './config.js';
import { AppError, ErrorTypes } from './utils.js';

export class OCRProcessor {
    constructor() {
        this.maxImageSize = 4 * 1024 * 1024; // 4MB limit for upload
        this.maxStorageSize = 1 * 1024 * 1024; // 1MB limit for storage
        this.supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    }

    /**
     * Validate uploaded file (image or PDF)
     * @param {File} file - File to validate
     * @returns {boolean} - Validation result
     */
    validateFile(file) {
        if (!file) {
            throw new AppError('No file selected', ErrorTypes.VALIDATION_ERROR);
        }

        if (!this.supportedFormats.includes(file.type)) {
            throw new AppError(
                'Unsupported file format. Please use JPEG, PNG, WebP, or PDF.',
                ErrorTypes.VALIDATION_ERROR
            );
        }

        // Different size limits for different file types
        const maxSize = file.type === 'application/pdf' ? 20 * 1024 * 1024 : 10 * 1024 * 1024; // 20MB for PDF, 10MB for images

        if (file.size > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            throw new AppError(
                `File too large. Please use a file smaller than ${maxSizeMB}MB.`,
                ErrorTypes.VALIDATION_ERROR
            );
        }

        console.log('File validation passed:', file.name, file.type, file.size, 'bytes');

        return true;
    }

    /**
     * Validate uploaded image file (backward compatibility)
     * @param {File} file - Image file to validate
     * @returns {boolean} - Validation result
     */
    validateImage(file) {
        return this.validateFile(file);
    }

    /**
     * Convert image file to base64 data URL
     * @param {File} file - Image file
     * @returns {Promise<string>} - Base64 data URL
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Estimate base64 string size in bytes
     * @param {string} base64String - Base64 data URL
     * @returns {number} - Estimated size in bytes
     */
    estimateBase64Size(base64String) {
        // Remove data URL prefix and calculate actual size
        const base64Data = base64String.split(',')[1] || base64String;
        return Math.ceil(base64Data.length * 0.75); // Base64 is ~33% larger than binary
    }

    /**
     * Compress image to tiny size for mobile photos
     * @param {File} file - Original image file
     * @returns {Promise<string>} - Tiny compressed base64 data URL
     */
    async compressImageTiny(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Tiny sizing for mobile photos (max 400px)
                const maxSize = 400;
                let { width, height } = img;

                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress aggressively
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.3); // Low quality but readable
                resolve(compressedDataUrl);
            };

            img.onerror = () => reject(new Error('Failed to load image for tiny compression'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Ultra compress image for extreme size reduction
     * @param {File} file - Original image file
     * @returns {Promise<string>} - Ultra compressed base64 data URL
     */
    async compressImageUltra(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Ultra tiny sizing (max 300px)
                const maxSize = 300;
                let { width, height } = img;

                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress extremely aggressively
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.2); // Very low quality but text should be readable
                resolve(compressedDataUrl);
            };

            img.onerror = () => reject(new Error('Failed to load image for ultra compression'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Compress image if needed (optional optimization)
     * @param {File} file - Original image file
     * @returns {Promise<string>} - Compressed base64 data URL
     */
    async compressImage(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions (max 800px on longest side for storage)
                const maxSize = 800;
                let { width, height } = img;

                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress more aggressively for storage
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve(compressedDataUrl);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Extract text from image using OpenAI Vision API
     * @param {string} imageDataUrl - Base64 image data URL
     * @returns {Promise<string>} - Extracted text
     */
    async extractTextFromImage(imageDataUrl) {
        if (!CONFIG.OPENAI_API_KEY || CONFIG.OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            throw new AppError(
                'OpenAI API key not configured. Add your OpenAI API key to config.local.js to enable OCR.',
                ErrorTypes.API_ERROR
            );
        }

        try {
            console.log('Sending image to OpenAI Vision API...');

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini", // Use the latest vision model
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `Please extract ALL text from this image. This appears to be a recipe, so pay special attention to:
                                    - Recipe title
                                    - Ingredients list with quantities
                                    - Step-by-step instructions
                                    - Cooking times, temperatures, serving sizes

                                    Please return the text exactly as it appears, preserving formatting and structure. If there are multiple columns or sections, please maintain that organization.`
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: imageDataUrl
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new AppError(
                    `OpenAI API error: ${errorData.error?.message || response.statusText}`,
                    ErrorTypes.API_ERROR,
                    { status: response.status, errorData }
                );
            }

            const data = await response.json();
            const extractedText = data.choices[0]?.message?.content;

            if (!extractedText) {
                throw new AppError(
                    'No text extracted from image',
                    ErrorTypes.EXTRACTION_ERROR
                );
            }

            console.log('Text extracted successfully');
            return extractedText;

        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to extract text from image: ${error.message}`,
                ErrorTypes.API_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Extract text from PDF using client-side PDF.js library
     * @param {File} pdfFile - PDF file object
     * @returns {Promise<string>} - Extracted text
     */
    async extractTextFromPDF(pdfFile) {
        try {
            console.log('Extracting text from PDF using PDF.js...');

            // Convert file to ArrayBuffer
            const arrayBuffer = await pdfFile.arrayBuffer();

            // Load PDF.js library dynamically if not already loaded
            if (typeof pdfjsLib === 'undefined') {
                await this.loadPDFJS();
            }

            // Load the PDF document
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            console.log('PDF loaded, pages:', pdf.numPages);

            let fullText = '';

            // Extract text from each page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();

                console.log(`Page ${pageNum} text items:`, textContent.items.length);

                if (textContent.items.length === 0) {
                    console.warn(`Page ${pageNum} has no text items - might be an image-only page`);
                    continue;
                }

                // Combine text items with better spacing
                const pageText = textContent.items
                    .map(item => {
                        // Log first few items for debugging
                        if (pageNum === 1 && textContent.items.indexOf(item) < 3) {
                            console.log('Text item:', item.str, 'Transform:', item.transform);
                        }
                        return item.str;
                    })
                    .filter(str => str && str.trim().length > 0) // Filter out empty strings
                    .join(' ')
                    .trim();

                console.log(`Page ${pageNum} extracted text length:`, pageText.length);
                console.log(`Page ${pageNum} text preview:`, pageText.substring(0, 100));

                if (pageText && pageText.length > 0) {
                    fullText += `\n\nPage ${pageNum}:\n${pageText}`;
                }
            }

            if (!fullText.trim()) {
                console.warn('No text extracted from PDF - attempting image-based OCR');
                console.log('🖼️ Converting PDF pages to images for OCR processing...');

                // Fallback to image-based OCR for scanned PDFs
                const imageBasedText = await this.processPDFAsImages(pdf);
                console.log('✅ Image-based OCR completed');
                return imageBasedText;
            }

            console.log('Total extracted text length:', fullText.length);
            console.log('✅ Text-based extraction completed');
            return fullText.trim();

        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            console.error('PDF text extraction error:', error);
            throw new AppError(
                `Failed to extract text from PDF: ${error.message}`,
                ErrorTypes.EXTRACTION_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Process PDF as images when text extraction fails (for scanned PDFs)
     * @param {Object} pdf - PDF.js document object
     * @returns {Promise<string>} - Extracted text from images
     */
    async processPDFAsImages(pdf) {
        try {
            let allExtractedText = '';

            // Process each page as an image
            for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) { // Limit to first 5 pages
                console.log(`🖼️ Converting page ${pageNum} to image...`);

                const page = await pdf.getPage(pageNum);

                // Set up canvas for rendering
                const scale = 2.0; // Higher scale for better OCR quality
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Render page to canvas
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Convert canvas to data URL
                const imageDataUrl = canvas.toDataURL('image/png');

                console.log(`📖 Extracting text from page ${pageNum} image...`);

                // Extract text using Vision API
                const pageText = await this.extractTextFromImage(imageDataUrl);

                if (pageText && pageText.trim()) {
                    allExtractedText += `\n\nPage ${pageNum}:\n${pageText.trim()}`;
                    console.log(`✅ Page ${pageNum} text extracted successfully`);
                } else {
                    console.warn(`⚠️ No text found on page ${pageNum}`);
                }

                // Clean up canvas
                canvas.remove();
            }

            if (!allExtractedText.trim()) {
                throw new AppError(
                    'No text could be extracted from PDF pages using OCR',
                    ErrorTypes.EXTRACTION_ERROR
                );
            }

            return allExtractedText.trim();

        } catch (error) {
            console.error('PDF image processing error:', error);
            throw new AppError(
                `Failed to process PDF as images: ${error.message}`,
                ErrorTypes.EXTRACTION_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Load PDF.js library dynamically
     * @returns {Promise<void>}
     */
    async loadPDFJS() {
        return new Promise((resolve, reject) => {
            if (typeof pdfjsLib !== 'undefined') {
                resolve();
                return;
            }

            // Load PDF.js from CDN
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                // Set worker source
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                console.log('PDF.js loaded successfully');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load PDF.js library'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Parse text directly to recipe format using OpenAI completions API
     * @param {string} text - Raw text from PDF
     * @returns {Promise<Object>} - Structured recipe data
     */
    async parseTextToRecipe(text) {
        if (!CONFIG.OPENAI_API_KEY || CONFIG.OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            throw new AppError(
                'OpenAI API key not configured. Add your OpenAI API key to config.local.js to enable recipe parsing.',
                ErrorTypes.API_ERROR
            );
        }

        try {
            console.log('Parsing text into structured recipe format using OpenAI...');

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "user",
                            content: `Please parse the following text into a structured recipe format. Extract and organize the information into JSON format with the following structure:

{
  "title": "Recipe name",
  "servings": number,
  "prepTime": number (in minutes),
  "cookTime": number (in minutes),
  "ingredients": [
    {"amount": "1", "unit": "cup", "item": "flour"},
    {"amount": "2", "unit": "", "item": "eggs"}
  ],
  "steps": [
    "First step instruction",
    "Second step instruction"
  ]
}

Here's the text to parse:

${text}

Please return ONLY the JSON object, no additional text or formatting.`
                        }
                    ],
                    max_tokens: 2000,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new AppError(
                    `OpenAI API error: ${errorData.error?.message || response.statusText}`,
                    ErrorTypes.API_ERROR,
                    { status: response.status, errorData }
                );
            }

            const data = await response.json();
            const jsonResponse = data.choices[0]?.message?.content;

            if (!jsonResponse) {
                throw new AppError(
                    'No response from OpenAI API',
                    ErrorTypes.API_ERROR
                );
            }

            // Parse the JSON response
            const recipe = JSON.parse(jsonResponse);

            // Validate required fields and provide defaults
            const validatedRecipe = {
                title: recipe.title || 'Untitled Recipe',
                servings: parseInt(recipe.servings) || 1,
                prepTime: parseInt(recipe.prepTime) || 0,
                cookTime: parseInt(recipe.cookTime) || 0,
                ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
                steps: Array.isArray(recipe.steps) ? recipe.steps : [],
                recipeId: 'pdf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
            };

            console.log('Recipe parsed successfully from text');
            return validatedRecipe;

        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            console.error('Recipe parsing error:', error);
            throw new AppError(
                `Failed to parse recipe from text: ${error.message}`,
                ErrorTypes.API_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Parse extracted text into recipe format using OpenAI
     * @param {string} extractedText - Raw extracted text
     * @returns {Promise<Object>} - Structured recipe data
     */
    async parseRecipeText(extractedText) {
        console.log('Parsing extracted text into structured recipe format using OpenAI...');

        if (!CONFIG.OPENAI_API_KEY || CONFIG.OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            throw new AppError(
                'OpenAI API key not configured. Add your OpenAI API key to config.local.js to enable OCR.',
                ErrorTypes.API_ERROR
            );
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "user",
                            content: `Please parse this recipe text and return ONLY a valid JSON object with the following structure:

{
  "title": "Recipe title (string)",
  "ingredients": [
    {
      "amount": "quantity (string, e.g., '2', '1/2')",
      "unit": "unit of measurement (string, e.g., 'cup', 'tsp')",
      "item": "ingredient name (string)"
    }
  ],
  "steps": ["step 1", "step 2", "step 3"],
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30
}

Rules:
- Extract ONLY actual ingredients from the ingredients list, not section headers like "Ingredients"
- Extract ONLY actual cooking steps from the instructions, not section headers like "Instructions" or "Directions"
- For ingredients without clear amounts, use empty string for amount and unit
- Keep ingredient items descriptive but concise
- Keep cooking steps clear and actionable
- Times should be in minutes as integers (0 if not specified)
- Servings should be an integer (4 if not specified)
- Return ONLY the JSON object, no additional text or explanation

Recipe text to parse:

${extractedText}`
                        }
                    ],
                    max_tokens: 1500,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new AppError(
                    `OpenAI API error: ${errorData.error?.message || response.statusText}`,
                    ErrorTypes.API_ERROR,
                    { status: response.status, errorData }
                );
            }

            const data = await response.json();
            const structuredResponse = data.choices[0]?.message?.content;

            if (!structuredResponse) {
                throw new AppError(
                    'No structured response from OpenAI',
                    ErrorTypes.EXTRACTION_ERROR
                );
            }

            // Parse the JSON response
            let parsedRecipe;
            try {
                parsedRecipe = JSON.parse(structuredResponse);
            } catch (parseError) {
                console.error('Failed to parse OpenAI JSON response:', structuredResponse);
                throw new AppError(
                    'Invalid JSON response from OpenAI',
                    ErrorTypes.EXTRACTION_ERROR,
                    { originalResponse: structuredResponse }
                );
            }

            // Validate and normalize the parsed recipe
            const recipe = {
                title: parsedRecipe.title || 'Recipe from Photo',
                ingredients: Array.isArray(parsedRecipe.ingredients) ? parsedRecipe.ingredients : [],
                steps: Array.isArray(parsedRecipe.steps) ? parsedRecipe.steps : [],
                servings: parseInt(parsedRecipe.servings) || 4,
                prepTime: parseInt(parsedRecipe.prepTime) || 0,
                cookTime: parseInt(parsedRecipe.cookTime) || 0,
                url: null,
                imageUrl: null,
                extractedText: extractedText, // Keep original text for reference
                recipeId: 'ocr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9) // Unique ID for OCR recipes
            };

            // Ensure ingredients have the correct structure
            recipe.ingredients = recipe.ingredients.map(ingredient => {
                if (typeof ingredient === 'string') {
                    // Convert string ingredients to structured format
                    return this.parseIngredientLine(ingredient);
                }
                return {
                    amount: ingredient.amount || '',
                    unit: ingredient.unit || '',
                    item: ingredient.item || ingredient
                };
            });

            // If no structured data found, put everything in steps
            if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
                recipe.steps = ['Original text from image:', extractedText];
            }

            console.log('Parsed recipe using OpenAI:', recipe.title, `${recipe.ingredients.length} ingredients`, `${recipe.steps.length} steps`);
            return recipe;

        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            console.error('Failed to parse recipe text with OpenAI:', error);

            // Fallback to simple parsing if OpenAI fails
            return this.fallbackParseRecipeText(extractedText);
        }
    }

    /**
     * Fallback parsing method if OpenAI fails
     * @param {string} extractedText - Raw extracted text
     * @returns {Object} - Basic structured recipe data
     */
    fallbackParseRecipeText(extractedText) {
        console.log('Using fallback parsing method...');

        return {
            title: 'Recipe from Photo',
            ingredients: [],
            steps: ['Original text from image:', extractedText],
            servings: 4,
            prepTime: 0,
            cookTime: 0,
            url: null,
            imageUrl: null,
            extractedText: extractedText,
            recipeId: 'ocr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9) // Unique ID for OCR recipes
        };
    }

    /**
     * Parse individual ingredient line
     * @param {string} line - Raw ingredient line
     * @returns {Object} - Structured ingredient
     */
    parseIngredientLine(line) {
        // Try to extract amount, unit, and item
        const patterns = [
            /^([\d\/.½⅓⅔¼¾⅛⅜⅝⅞]+)\s*([a-zA-Z]+)?\s+(.+)$/,
            /^(.+)$/ // Fallback - just the text
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                if (match.length > 3) {
                    return {
                        amount: match[1] || '',
                        unit: match[2] || '',
                        item: match[3] || line
                    };
                } else {
                    return {
                        amount: '',
                        unit: '',
                        item: line
                    };
                }
            }
        }

        return {
            amount: '',
            unit: '',
            item: line
        };
    }

    /**
     * Process multiple images to extract a single recipe
     * @param {Array<File>} imageFiles - Array of image files to process
     * @returns {Promise<Object>} - Extracted recipe object
     */
    async processMultipleImagesToRecipe(imageFiles) {
        try {
            console.log(`📸 Processing ${imageFiles.length} images for recipe extraction...`);

            // Validate all files
            imageFiles.forEach(file => this.validateFile(file));

            let allExtractedText = '';
            let firstImageDataUrl = null;

            // Process each image and combine the extracted text
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                console.log(`📖 Processing image ${i + 1} of ${imageFiles.length}: ${file.name}`);

                // Convert to base64
                const imageDataUrl = await this.fileToBase64(file);

                // Save the first image for the recipe thumbnail
                if (i === 0) {
                    // Compress for storage
                    const storageDataUrl = await this.compressImage(file);
                    const storageSize = this.estimateBase64Size(storageDataUrl);

                    if (storageSize > this.maxStorageSize) {
                        firstImageDataUrl = await this.compressImageTiny(file);
                    } else {
                        firstImageDataUrl = storageDataUrl;
                    }
                }

                // Extract text from this image
                const extractedText = await this.extractTextFromImage(imageDataUrl);

                if (extractedText && extractedText.trim()) {
                    allExtractedText += `\n\n--- Page ${i + 1} ---\n${extractedText.trim()}`;
                    console.log(`✅ Page ${i + 1} text extracted successfully`);
                } else {
                    console.warn(`⚠️ No text found on page ${i + 1}`);
                }
            }

            if (!allExtractedText.trim()) {
                throw new AppError(
                    'No text could be extracted from any of the images',
                    ErrorTypes.EXTRACTION_ERROR
                );
            }

            console.log('📝 Combined text from all images, parsing into recipe...');

            // Parse the combined text into a recipe format
            const recipe = await this.parseRecipeText(allExtractedText);

            // Attach the first image as the recipe thumbnail
            recipe.imageUrl = firstImageDataUrl;
            recipe.originalImageName = imageFiles[0].name;
            recipe.sourceImageCount = imageFiles.length;

            console.log(`✅ Successfully processed ${imageFiles.length} images into recipe!`);
            return recipe;

        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to process multiple images: ${error.message}`,
                ErrorTypes.EXTRACTION_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Process file (image or PDF) to extract recipe using OpenAI API
     * @param {File} file - File to process
     * @returns {Promise<Object>} - Extracted recipe object
     */
    async processFileToRecipe(file) {
        this.validateFile(file);

        if (file.type === 'application/pdf') {
            return await this.processPDFToRecipe(file);
        } else {
            return await this.processImageToRecipe(file);
        }
    }

    /**
     * Process PDF to extract recipe using PDF.js text extraction and OpenAI completions
     * @param {File} pdfFile - PDF file to process
     * @returns {Promise<Object>} - Extracted recipe object
     */
    async processPDFToRecipe(pdfFile) {
        try {
            console.log('📋 Processing PDF:', pdfFile.name, 'Size:', (pdfFile.size/1024/1024).toFixed(2), 'MB');

            // Extract text from PDF using PDF.js (with image fallback)
            console.log('🔍 Extracting text from PDF...');
            const extractedText = await this.extractTextFromPDF(pdfFile);

            if (!extractedText || extractedText.trim().length < 50) {
                throw new AppError(
                    'PDF appears to be empty or contains insufficient text for recipe extraction',
                    ErrorTypes.EXTRACTION_ERROR
                );
            }

            console.log('📝 Extracted text preview:', extractedText.substring(0, 200) + '...');

            // Parse text directly into recipe format using OpenAI completions API
            console.log('🤖 Parsing extracted text into recipe format...');
            const recipe = await this.parseTextToRecipe(extractedText);

            // For PDFs, we don't store the actual file content as imageUrl
            recipe.originalFileName = pdfFile.name;
            recipe.sourceType = 'pdf';

            console.log('✅ PDF processing complete!');
            return recipe;

        } catch (error) {
            console.error('PDF processing error:', error);
            throw new AppError(
                `Failed to process PDF: ${error.message}`,
                ErrorTypes.EXTRACTION_ERROR,
                { originalError: error }
            );
        }
    }

    /**
     * Process complete image-to-recipe workflow
     * @param {File} imageFile - Uploaded image file
     * @returns {Promise<Object>} - Processed recipe
     */
    async processImageToRecipe(imageFile) {
        try {
            // Validate image
            this.validateImage(imageFile);

            // Use original quality for OCR, compress only if needed for storage
            let imageDataUrlForOCR;
            let imageDataUrlForStorage;

            console.log('📏 Original image size:', imageFile.size, 'bytes (', (imageFile.size/1024/1024).toFixed(2), 'MB)');

            // Always use original quality for OCR to get best text extraction
            if (imageFile.size <= this.maxImageSize) {
                console.log('📖 Using original quality for OCR (under 4MB)');
                imageDataUrlForOCR = await this.fileToBase64(imageFile);
                imageDataUrlForStorage = imageDataUrlForOCR; // Use same for storage initially
            } else {
                console.log('🔄 Compressing for OCR (over 4MB limit)');
                imageDataUrlForOCR = await this.compressImage(imageFile);
                imageDataUrlForStorage = imageDataUrlForOCR;
            }

            // Check if we need to compress further for storage (Airtable limits)
            const storageSize = this.estimateBase64Size(imageDataUrlForStorage);
            console.log('💾 Storage size estimate:', storageSize, 'bytes (', (storageSize/1024/1024).toFixed(2), 'MB)');

            if (storageSize > this.maxStorageSize) {
                console.log('⚡ Compressing further for storage only...');
                imageDataUrlForStorage = await this.compressImageTiny(imageFile);

                const newStorageSize = this.estimateBase64Size(imageDataUrlForStorage);
                if (newStorageSize > this.maxStorageSize) {
                    console.log('🎯 Using ultra compression for storage...');
                    imageDataUrlForStorage = await this.compressImageUltra(imageFile);
                }
            }

            // Extract text using OCR with high quality image
            console.log('🔍 Extracting text using OpenAI Vision API...');
            const extractedText = await this.extractTextFromImage(imageDataUrlForOCR);

            // Parse text into recipe format using OpenAI
            const recipe = await this.parseRecipeText(extractedText);

            // Save the storage-optimized image with the recipe
            recipe.imageUrl = imageDataUrlForStorage;
            recipe.originalImageName = imageFile.name;

            console.log('✅ OCR processing complete!');
            const finalStorageSize = this.estimateBase64Size(imageDataUrlForStorage);
            console.log('📦 Final storage size:', finalStorageSize, 'bytes (', (finalStorageSize/1024/1024).toFixed(2), 'MB)');

            return recipe;

        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to process image: ${error.message}`,
                ErrorTypes.EXTRACTION_ERROR,
                { originalError: error }
            );
        }
    }
}