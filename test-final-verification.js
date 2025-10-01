import fs from 'fs';
import { DocxProcessor } from './services/docxProcessor.ts';
import JSZip from 'jszip';

async function testFinalVerification() {
    console.log('Final verification test: DOCX processing with quotes and Jinja2 highlighting...\n');
    
    try {
        // Read a sample file
        const filePath = './sample_files/sample_security_deposit_letter.docx';
        const fileBuffer = fs.readFileSync(filePath);
        
        // Create some suggestions that include quotes
        const suggestions = [
            {
                original: 'deposit',
                replacement: "{{ tenant's_deposit_amount }}" // Contains single quote
            },
            {
                original: 'lease',
                replacement: '{% if property_type == "apartment" %}apartment lease{% else %}house lease{% endif %}' // Contains double quotes
            }
        ];
        
        console.log('Processing DOCX with suggestions containing quotes...');
        
        const processor = new DocxProcessor();
        const modifiedBlob = await processor.processDocumentWithSuggestions(fileBuffer, suggestions);
        
        // Save the result
        const outputPath = './test-final-verification-output.docx';
        const buffer = Buffer.from(await modifiedBlob.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`✓ Successfully generated DOCX: ${outputPath}`);
        console.log(`✓ File size: ${buffer.length} bytes`);
        
        // Verify the quotes are handled correctly
        const zip = await JSZip.loadAsync(buffer);
        const docXml = await zip.file('word/document.xml').async('text');
        
        // Check for HTML entities vs actual quotes
        const htmlEntities = (docXml.match(/&#39;/g) || []).length;
        const actualQuotes = (docXml.match(/'/g) || []).length;
        
        console.log(`\n=== Quote Handling Verification ===`);
        console.log(`HTML entities (&#39;): ${htmlEntities} ${htmlEntities === 0 ? '✓' : '❌'}`);
        console.log(`Actual single quotes ('): ${actualQuotes} ${actualQuotes > 0 ? '✓' : '❌'}`);
        
        // Check run balance
        const allWRTags = (docXml.match(/<w:r[^>]*>/g) || []);
        const actualOpenRuns = allWRTags.filter(tag => tag.match(/^<w:r(\s|>)/));
        const closeRuns = (docXml.match(/<\/w:r>/g) || []);
        const balanced = actualOpenRuns.length === closeRuns.length;
        
        console.log(`\n=== XML Structure Verification ===`);
        console.log(`Run elements: ${actualOpenRuns.length} open, ${closeRuns.length} close ${balanced ? '✓' : '❌'}`);
        
        // Check highlighting
        const yellowHighlights = (docXml.match(/highlight w:val="yellow"/g) || []).length;
        const cyanHighlights = (docXml.match(/highlight w:val="cyan"/g) || []).length;
        
        console.log(`\n=== Jinja2 Highlighting Verification ===`);
        console.log(`Yellow highlights (variables): ${yellowHighlights} ${yellowHighlights > 0 ? '✓' : '❌'}`);
        console.log(`Cyan highlights (control structures): ${cyanHighlights} ${cyanHighlights > 0 ? '✓' : '❌'}`);
        
        const allGood = htmlEntities === 0 && actualQuotes > 0 && balanced && yellowHighlights > 0 && cyanHighlights > 0;
        console.log(`\n🎉 Overall status: ${allGood ? 'ALL TESTS PASSED!' : 'Some issues detected'}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testFinalVerification();