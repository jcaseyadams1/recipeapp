/**
 * Local Configuration Template
 *
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to: config.local.js
 * 2. Replace the placeholder values with your actual API keys
 * 3. The config.local.js file will be ignored by git for security
 *
 * API Key Setup:
 * - Airtable API Key: https://airtable.com/create/tokens
 * - Airtable Base ID: Found in your Airtable base URL
 * - Claude API Key: Optional (currently not used in production)
 */

export const LOCAL_CONFIG = {
    // Airtable Configuration (REQUIRED)
    AIRTABLE_API_KEY: 'YOUR_AIRTABLE_API_KEY_HERE',
    AIRTABLE_BASE_ID: 'YOUR_AIRTABLE_BASE_ID_HERE',

    // Claude API Configuration (OPTIONAL)
    CLAUDE_API_KEY: 'YOUR_CLAUDE_API_KEY_HERE',

    // OpenAI Configuration for OCR (OPTIONAL)
    OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY_HERE',

    // Development Settings
    DEBUG_MODE: false,
    LOG_API_CALLS: false
};