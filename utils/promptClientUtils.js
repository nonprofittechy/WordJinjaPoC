/**
 * Client-side utilities for working with prompts
 * This file handles prompt loading and management for the frontend
 */

/**
 * Load prompts configuration from the server
 * @returns {Promise<Object>} The prompts configuration
 */
export async function loadPromptsConfig() {
    try {
        const response = await fetch('/api/prompts/config');
        if (!response.ok) {
            throw new Error(`Failed to load prompts config: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading prompts config:', error);
        throw error;
    }
}

/**
 * Get a specific prompt by ID
 * @param {string} promptId - The ID of the prompt to retrieve
 * @returns {Promise<Object|null>} The prompt object or null if not found
 */
export async function getPromptById(promptId = 'default') {
    try {
        const config = await loadPromptsConfig();
        return config.prompts.find(prompt => prompt.id === promptId) || null;
    } catch (error) {
        console.error(`Error getting prompt by ID (${promptId}):`, error);
        return null;
    }
}

/**
 * Extract the system prompt content from a prompt object
 * @param {Object} prompt - The prompt object
 * @returns {string} The system prompt content
 */
export function extractSystemPrompt(prompt) {
    if (!prompt || !prompt.prompt) {
        return '';
    }
    
    const systemMessage = prompt.prompt.find(msg => msg.role === 'system');
    return systemMessage ? systemMessage.content : '';
}

/**
 * Get the default system prompt content
 * @returns {Promise<string>} The default system prompt content
 */
export async function getDefaultSystemPrompt() {
    try {
        const defaultPrompt = await getPromptById('default');
        return defaultPrompt ? extractSystemPrompt(defaultPrompt) : '';
    } catch (error) {
        console.error('Error getting default system prompt:', error);
        return '';
    }
}