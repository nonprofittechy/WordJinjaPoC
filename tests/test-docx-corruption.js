import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDocxCorruption() {
    console.log('Testing DOCX corruption issues...\n');
    
    // Test the output file from the full pipeline
    const testFilePath = path.join(__dirname, 'test-full-pipeline-output.docx');
    
    if (!fs.existsSync(testFilePath)) {
        console.log('Test file does not exist. Running full pipeline test first...');
        return;
    }
    
    try {
        console.log('1. Reading test DOCX file...');
        const fileBuffer = fs.readFileSync(testFilePath);
        console.log(`   File size: ${fileBuffer.length} bytes`);
        
        console.log('2. Testing if file can be opened as ZIP...');
        const zip = await JSZip.loadAsync(fileBuffer);
        console.log('   ✓ ZIP structure is valid');
        
        console.log('3. Checking essential DOCX files...');
        const requiredFiles = [
            '[Content_Types].xml',
            'word/document.xml',
            '_rels/.rels',
            'word/_rels/document.xml.rels'
        ];
        
        for (const fileName of requiredFiles) {
            const file = zip.file(fileName);
            if (file) {
                const content = await file.async('text');
                console.log(`   ✓ ${fileName} exists (${content.length} chars)`);
                
                // Test if XML files are valid XML
                if (fileName.endsWith('.xml')) {
                    try {
                        // Simple XML validation - try to parse basic structure
                        if (content.includes('<') && content.includes('>')) {
                            // Check for proper XML declaration
                            if (content.startsWith('<?xml')) {
                                console.log(`     - ${fileName} has proper XML structure`);
                            } else {
                                console.log(`     ⚠ ${fileName} missing XML declaration`);
                            }
                            
                            // Check for unmatched tags (very basic)
                            const openTags = (content.match(/<[^\/!][^>]*>/g) || []).length;
                            const closeTags = (content.match(/<\/[^>]*>/g) || []).length;
                            const selfClosing = (content.match(/<[^>]*\/>/g) || []).length;
                            
                            console.log(`     - Tags: ${openTags} open, ${closeTags} close, ${selfClosing} self-closing`);
                            
                            // For document.xml specifically, check for common issues
                            if (fileName === 'word/document.xml') {
                                console.log('4. Analyzing document.xml structure...');
                                
                                // Check for Jinja2 variables and highlighting
                                const jinja2Vars = (content.match(/\{\{[^}]*\}\}/g) || []).length;
                                const jinja2Controls = (content.match(/\{%[^%]*%\}/g) || []).length;
                                const yellowHighlights = (content.match(/w:highlight w:val="yellow"/g) || []).length;
                                const cyanHighlights = (content.match(/w:highlight w:val="cyan"/g) || []).length;
                                
                                console.log(`   - Jinja2 variables: ${jinja2Vars}`);
                                console.log(`   - Jinja2 control structures: ${jinja2Controls}`);
                                console.log(`   - Yellow highlights: ${yellowHighlights}`);
                                console.log(`   - Cyan highlights: ${cyanHighlights}`);
                                
                                // Check for malformed XML patterns
                                const emptyElements = (content.match(/<w:t[^>]*><\/w:t>/g) || []).length;
                                // Count w:r elements properly (not w:rPr, w:rFonts, etc.)
                                const allWRTags = (content.match(/<w:r[^>]*>/g) || []);
                                const actualRunElements = allWRTags.filter(tag => tag.match(/^<w:r(\s|>)/)).length;
                                const runCloseElements = (content.match(/<\/w:r>/g) || []).length;
                                
                                console.log(`   - Empty text elements: ${emptyElements}`);
                                console.log(`   - Run elements: ${actualRunElements} open, ${runCloseElements} close`);
                                
                                if (actualRunElements !== runCloseElements) {
                                    console.log('   ⚠ POTENTIAL ISSUE: Unmatched run elements detected!');
                                } else {
                                    console.log('   ✓ Run elements are properly balanced');
                                }
                                
                                // Look for consecutive runs without text
                                const consecutiveRuns = content.match(/<\/w:r>\s*<w:r>/g);
                                if (consecutiveRuns) {
                                    console.log(`   - Found ${consecutiveRuns.length} consecutive runs (might be inefficient but not corrupt)`);
                                }
                                
                                // Check for incomplete highlighting structures
                                const incompleteHighlights = content.match(/<w:rPr><w:highlight[^>]*><\/w:rPr>/g);
                                if (incompleteHighlights) {
                                    console.log(`   ⚠ Found ${incompleteHighlights.length} highlighting structures without text content`);
                                }
                            }
                        } else {
                            console.log(`     ❌ ${fileName} does not appear to be valid XML`);
                        }
                    } catch (xmlError) {
                        console.log(`     ❌ ${fileName} XML validation failed:`, xmlError.message);
                    }
                }
            } else {
                console.log(`   ❌ ${fileName} is missing!`);
            }
        }
        
        console.log('\n5. Testing if Word can potentially open this file...');
        // Check MIME type declaration
        const contentTypes = zip.file('[Content_Types].xml');
        if (contentTypes) {
            const ctContent = await contentTypes.async('text');
            if (ctContent.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
                console.log('   ✓ Proper DOCX MIME type declared');
            } else {
                console.log('   ⚠ DOCX MIME type not properly declared');
            }
        }
        
        console.log('\n✅ DOCX structure validation completed');
        console.log('If Word still reports the file as corrupt, the issue may be in the XML content structure rather than the ZIP/file format.');
        
    } catch (error) {
        console.error('❌ DOCX validation failed:', error.message);
        
        if (error.message.includes('invalid central directory file header signature')) {
            console.log('This suggests the file is not a valid ZIP archive');
        } else if (error.message.includes('End of central directory record not found')) {
            console.log('This suggests the ZIP file is truncated or incomplete');
        }
    }
}

testDocxCorruption();