// Test script for prompts configuration
import { loadPromptsConfig, getPromptById, validatePromptConfig, getTestCases } from '../utils/promptUtils.js';

function testPromptsConfig() {
    console.log('🧪 Testing prompts configuration...\n');
    
    // Test loading configuration
    const config = loadPromptsConfig();
    if (!config) {
        console.error('❌ Failed to load prompts configuration');
        return;
    }
    
    console.log('✅ Prompts configuration loaded successfully');
    console.log(`📋 Found ${config.prompts?.length || 0} prompts and ${config.tests?.length || 0} test cases\n`);
    
    // Test each prompt
    if (config.prompts) {
        config.prompts.forEach(prompt => {
            console.log(`🔍 Testing prompt: ${prompt.id} (${prompt.label || 'No label'})`);
            
            const validation = validatePromptConfig(prompt);
            if (validation.isValid) {
                console.log('✅ Prompt configuration is valid');
            } else {
                console.log('❌ Prompt configuration has errors:');
                validation.errors.forEach(error => console.log(`   - ${error}`));
            }
            
            // Check system prompt content
            const systemMsg = prompt.prompt?.find(p => p.role === 'system');
            if (systemMsg) {
                console.log(`📝 System prompt length: ${systemMsg.content.length} characters`);
                
                // Check for common patterns
                const hasInstructions = systemMsg.content.includes('Instructions');
                const hasVariableNaming = systemMsg.content.includes('Variable Naming');
                const hasJinja2 = systemMsg.content.includes('Jinja2');
                
                console.log(`   - Has Instructions section: ${hasInstructions ? '✅' : '❌'}`);
                console.log(`   - Has Variable Naming rules: ${hasVariableNaming ? '✅' : '❌'}`);
                console.log(`   - Mentions Jinja2: ${hasJinja2 ? '✅' : '❌'}`);
            }
            
            // Check response schema
            if (prompt.responseSchema) {
                const hasResults = prompt.responseSchema.properties?.results;
                const hasRequiredFields = hasResults && 
                    hasResults.items?.properties?.context &&
                    hasResults.items?.properties?.original &&
                    hasResults.items?.properties?.replacement;
                
                console.log(`   - Response schema structure: ${hasRequiredFields ? '✅' : '❌'}`);
            }
            
            console.log('');
        });
    }
    
    // Test specific prompt retrieval
    console.log('🔍 Testing prompt retrieval...');
    const defaultPrompt = getPromptById('default');
    if (defaultPrompt) {
        console.log('✅ Default prompt retrieved successfully');
        console.log(`   ID: ${defaultPrompt.id}`);
        console.log(`   Label: ${defaultPrompt.label || 'No label'}`);
    } else {
        console.log('❌ Failed to retrieve default prompt');
    }
    
    // Test cases validation
    console.log('\n🧪 Testing test cases...');
    const testCases = getTestCases();
    if (testCases.length > 0) {
        console.log(`✅ Found ${testCases.length} test cases`);
        
        testCases.forEach((testCase, index) => {
            console.log(`\n📋 Test case ${index + 1}: ${testCase.description || 'No description'}`);
            
            // Check if test has required properties
            const hasVars = testCase.vars && typeof testCase.vars === 'object';
            const hasAssertions = testCase.assert && Array.isArray(testCase.assert);
            const hasDocumentText = testCase.vars?.documentText;
            
            console.log(`   - Has variables: ${hasVars ? '✅' : '❌'}`);
            console.log(`   - Has documentText: ${hasDocumentText ? '✅' : '❌'}`);
            console.log(`   - Has assertions: ${hasAssertions ? '✅' : '❌'}`);
            
            if (hasAssertions) {
                console.log(`   - Assertion types: ${testCase.assert.map(a => a.type).join(', ')}`);
            }
        });
    } else {
        console.log('⚠️  No test cases found');
    }
    
    console.log('\n🎉 Prompts configuration test completed!');
}

// Run the test
testPromptsConfig();