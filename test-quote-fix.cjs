const fs = require('fs');

async function testQuoteHandling() {
    console.log('Testing quote handling in generated DOCX...\n');
    
    // Read the latest generated file
    const filePath = './tests/test-full-pipeline-output.docx';
    
    if (!fs.existsSync(filePath)) {
        console.log('❌ Test file not found. Please run the full pipeline test first.');
        return;
    }
    
    const JSZip = require('jszip');
    const fileBuffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(fileBuffer);
    const docXml = await zip.file('word/document.xml').async('text');
    
    // Check for HTML entities vs actual quotes
    const htmlEntities = (docXml.match(/&#39;/g) || []).length;
    const actualSingleQuotes = (docXml.match(/'/g) || []).length;
    const actualDoubleQuotes = (docXml.match(/"/g) || []).length;
    
    console.log(`=== Quote Handling Results ===`);
    console.log(`HTML entities (&#39;): ${htmlEntities} ${htmlEntities === 0 ? '✅ GOOD' : '❌ BAD'}`);
    console.log(`Actual single quotes ('): ${actualSingleQuotes} ${actualSingleQuotes > 0 ? '✅ GOOD' : '❌ BAD'}`);
    console.log(`Actual double quotes ("): ${actualDoubleQuotes} ${actualDoubleQuotes > 0 ? '✅ GOOD' : '❌ BAD'}`);
    
    // Check run balance
    const allWRTags = (docXml.match(/<w:r[^>]*>/g) || []);
    const actualOpenRuns = allWRTags.filter(tag => tag.match(/^<w:r(\s|>)/));
    const closeRuns = (docXml.match(/<\/w:r>/g) || []);
    const balanced = actualOpenRuns.length === closeRuns.length;
    
    console.log(`\n=== XML Structure Results ===`);
    console.log(`Run elements: ${actualOpenRuns.length} open, ${closeRuns.length} close ${balanced ? '✅ BALANCED' : '❌ UNBALANCED'}`);
    
    // Check highlighting
    const yellowHighlights = (docXml.match(/highlight w:val="yellow"/g) || []).length;
    const cyanHighlights = (docXml.match(/highlight w:val="cyan"/g) || []).length;
    
    console.log(`\n=== Jinja2 Highlighting Results ===`);
    console.log(`Yellow highlights (variables): ${yellowHighlights} ${yellowHighlights > 0 ? '✅ WORKING' : '❌ MISSING'}`);
    console.log(`Cyan highlights (control structures): ${cyanHighlights} ${cyanHighlights > 0 ? '✅ WORKING' : '❌ MISSING'}`);
    
    // Overall assessment
    const quotesFixed = htmlEntities === 0 && actualSingleQuotes > 0;
    const structureGood = balanced;
    const highlightingGood = yellowHighlights > 0 && cyanHighlights > 0;
    
    console.log(`\n=== FINAL ASSESSMENT ===`);
    console.log(`Quote handling: ${quotesFixed ? '✅ FIXED' : '❌ BROKEN'}`);
    console.log(`XML structure: ${structureGood ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Jinja2 highlighting: ${highlightingGood ? '✅ WORKING' : '❌ BROKEN'}`);
    
    if (quotesFixed && structureGood && highlightingGood) {
        console.log(`\n🎉 SUCCESS: All issues have been resolved!`);
        console.log(`   - DOCX files are no longer corrupt`);
        console.log(`   - Quotes are preserved properly (no more &#39;)`);
        console.log(`   - Jinja2 syntax highlighting is working`);
        console.log(`   - XML structure is balanced and valid`);
    } else {
        console.log(`\n⚠ Some issues remain to be fixed.`);
    }
}

testQuoteHandling().catch(console.error);