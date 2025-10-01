import { loadPromptsConfig, getPromptById, getSystemPrompt } from '../utils/promptUtils.js';

async function testPromptsUtilities() {
    try {
        console.log('Testing prompts utilities...\n');
        
        // Test 1: Load prompts config
        console.log('1. Testing loadPromptsConfig():');
        const config = loadPromptsConfig();
        console.log('✓ Config loaded successfully');
        console.log('  - Number of prompts:', config.prompts.length);
        console.log('  - First prompt ID:', config.prompts[0].id);
        
        // Test 2: Get prompt by ID
        console.log('\n2. Testing getPromptById():');
        const defaultPrompt = getPromptById('default');
        console.log('✓ Default prompt retrieved successfully');
        console.log('  - Prompt ID:', defaultPrompt.id);
        console.log('  - Prompt label:', defaultPrompt.label);
        
        // Test 3: Get system prompt
        console.log('\n3. Testing getSystemPrompt():');
        const systemPrompt = getSystemPrompt('default');
        console.log('✓ System prompt extracted successfully');
        console.log('  - System prompt length:', systemPrompt.length);
        console.log('  - System prompt preview:', systemPrompt.substring(0, 100) + '...');
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Error stack:', error.stack);
    }
}

testPromptsUtilities();