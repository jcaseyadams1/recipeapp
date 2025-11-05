/**
 * Local Configuration - API Keys and Sensitive Data
 *
 * THIS FILE SHOULD NOT BE COMMITTED TO VERSION CONTROL
 *
 * Copy this file and update with your actual API keys:
 * - Get Airtable API key from: https://airtable.com/create/tokens
 * - Get Airtable Base ID from your base URL
 * - Claude API key is optional (not currently used in production)
 */

export const LOCAL_CONFIG = {
    // Airtable Configuration
    AIRTABLE_API_KEY: 'patEBCO7niHIayw4Y.738ca84782896cb6beb23875a1017a292718e144f962bde1cbafb21483136120',
    AIRTABLE_BASE_ID: 'app6wgIiXq8dzEKHq',

    // Claude API Configuration (optional)
    CLAUDE_API_KEY: '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',

    // OpenAI Configuration for OCR (add your key to enable photo OCR)
    OPENAI_API_KEY: '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',

    // Development flags
    DEBUG_MODE: false,
    LOG_API_CALLS: false
};