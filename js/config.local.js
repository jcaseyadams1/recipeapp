/**
 * Local Configuration - API Keys and Sensitive Data
 *
 * IMPORTANT: This file is listed in .gitignore and should NOT be committed
 * to version control with real API keys.
 *
 * Setup Instructions:
 * 1. Copy this file or edit it with your actual API keys
 * 2. Get Airtable API key from: https://airtable.com/create/tokens
 * 3. Get Airtable Base ID from your base URL (starts with 'app')
 * 4. OpenAI API key enables photo/PDF OCR features
 * 5. Claude API key is optional (not currently used)
 */

export const LOCAL_CONFIG = {
    // Airtable Configuration (Required for cloud storage)
    AIRTABLE_API_KEY: 'YOUR_AIRTABLE_API_KEY',
    AIRTABLE_BASE_ID: 'YOUR_AIRTABLE_BASE_ID',

    // OpenAI Configuration (Required for photo/PDF OCR)
    OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY',

    // Claude API Configuration (Optional - not currently used)
    CLAUDE_API_KEY: 'YOUR_CLAUDE_API_KEY',

    // Development flags
    DEBUG_MODE: false,
    LOG_API_CALLS: false
};