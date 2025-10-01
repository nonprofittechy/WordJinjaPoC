// Script to test prompts with sample data
import { loadPromptsConfig, getPromptById, renderPrompt } from '../utils/promptUtils.js';

async function testPromptWithSample() {
    console.log('🧪 Testing prompt with sample data...\n');
    
    const config = loadPromptsConfig();
    if (!config) {
        console.error('❌ Failed to load prompts configuration');
        return;
    }
    
    const defaultPrompt = getPromptById('default');
    if (!defaultPrompt) {
        console.error('❌ Could not find default prompt');
        return;
    }
    
    console.log(`📋 Testing prompt: ${defaultPrompt.label}`);
    
    // Sample document text
    const sampleDocument = `
SECURITY DEPOSIT DEMAND LETTER

Dear [LANDLORD NAME],

I am writing to demand the return of my security deposit for the apartment I rented at [PROPERTY ADDRESS]. According to my lease agreement signed on [LEASE DATE], I paid a security deposit of $[DEPOSIT AMOUNT].

I vacated the apartment on [MOVE_OUT_DATE] and left it in good condition. Under state law, you had 21 days to return my deposit or provide an itemized list of deductions.

If you do not return my deposit by [DEADLINE DATE], I will pursue legal action.

Sincerely,
[TENANT NAME]
[TENANT ADDRESS]
[TENANT PHONE]
`;

    console.log('📄 Sample document:');
    console.log(sampleDocument);
    console.log('');
    
    // Get the system prompt
    const systemMessage = defaultPrompt.prompt.find(p => p.role === 'system');
    if (systemMessage) {
        console.log('🤖 System prompt (first 200 characters):');
        console.log(systemMessage.content.substring(0, 200) + '...');
        console.log('');
    }
    
    // Show what the rendered user prompt would look like
    const userMessage = defaultPrompt.prompt.find(p => p.role === 'user');
    if (userMessage) {
        const renderedUserPrompt = renderPrompt(userMessage.content, { documentText: sampleDocument });
        console.log('👤 User prompt (first 300 characters):');
        console.log(renderedUserPrompt.substring(0, 300) + '...');
        console.log('');
    }
    
    // Show expected response structure
    console.log('📋 Expected response schema:');
    console.log(JSON.stringify(defaultPrompt.responseSchema, null, 2));
    console.log('');
    
    // Show test cases
    const testCases = config.tests || [];
    console.log(`🧪 Available test cases: ${testCases.length}`);
    testCases.forEach((testCase, index) => {
        console.log(`${index + 1}. ${testCase.description}`);
        console.log(`   Document: "${testCase.vars?.documentText?.substring(0, 50)}..."`);
        console.log(`   Expected: ${testCase.assert?.length || 0} assertions`);
    });
    
    console.log('\n✅ Prompt testing completed!');
    console.log('\n💡 To test with real API:');
    console.log('   1. Upload a document to http://localhost:5176/');
    console.log('   2. Check the network tab for /api/generate-labels requests');
    console.log('   3. Compare responses with expected schema');
}

testPromptWithSample();