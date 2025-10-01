// Utility functions for working with prompts configuration
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load prompts configuration from prompts.json
 */
export function loadPromptsConfig() {
    try {
        const promptsPath = path.join(__dirname, '..', 'prompts.json');
        const promptsData = fs.readFileSync(promptsPath, 'utf8');
        return JSON.parse(promptsData);
    } catch (error) {
        console.error('Error loading prompts configuration:', error);
        return null;
    }
}

/**
 * Get a specific prompt by ID
 */
export function getPromptById(promptId = 'default') {
    const config = loadPromptsConfig();
    if (!config || !config.prompts) {
        return null;
    }
    
    return config.prompts.find(p => p.id === promptId);
}

/**
 * Get the system prompt content for a specific prompt ID
 */
export function getSystemPrompt(promptId = 'default') {
    const promptConfig = getPromptById(promptId);
    if (!promptConfig || !promptConfig.prompt) {
        return null;
    }
    
    const systemMessage = promptConfig.prompt.find(p => p.role === 'system');
    return systemMessage ? systemMessage.content : null;
}

/**
 * Replace variables in prompt content
 */
export function renderPrompt(promptContent, variables = {}) {
    let rendered = promptContent;
    
    // Replace {{variable}} patterns with actual values
    Object.entries(variables).forEach(([key, value]) => {
        const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        rendered = rendered.replace(pattern, value);
    });
    
    return rendered;
}

/**
 * Get test cases for a specific prompt
 */
export function getTestCases(promptId = 'default') {
    const config = loadPromptsConfig();
    if (!config || !config.tests) {
        return [];
    }
    
    // Return all tests or filter by prompt ID if specified in test metadata
    return config.tests.filter(test => {
        return !test.promptId || test.promptId === promptId;
    });
}

/**
 * Validate that a prompt configuration is valid
 */
export function validatePromptConfig(promptConfig) {
    const errors = [];
    
    if (!promptConfig.id) {
        errors.push('Prompt must have an id');
    }
    
    if (!promptConfig.prompt || !Array.isArray(promptConfig.prompt)) {
        errors.push('Prompt must have a prompt array');
    } else {
        const hasSystem = promptConfig.prompt.some(p => p.role === 'system');
        if (!hasSystem) {
            errors.push('Prompt must have at least one system message');
        }
    }
    
    if (!promptConfig.responseSchema) {
        errors.push('Prompt should have a responseSchema');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

export default {
    loadPromptsConfig,
    getPromptById,
    getSystemPrompt,
    renderPrompt,
    getTestCases,
    validatePromptConfig
};