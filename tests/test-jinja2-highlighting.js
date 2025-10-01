// Test Jinja2 highlighting functionality
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testJinja2Highlighting() {
    console.log('Testing Jinja2 syntax highlighting...');
    
    try {
        // Import JSZip
        const JSZip = (await import('jszip')).default;
        
        // Create a simple test DOCX with Jinja2 syntax
        const testXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        <w:p>
            <w:r>
                <w:t>Hello {{ user_name }}, welcome to our service!</w:t>
            </w:r>
        </w:p>
        <w:p>
            <w:r>
                <w:t>{% if premium_user %}You have premium access.{% endif %}</w:t>
            </w:r>
        </w:p>
        <w:p>
            <w:r>
                <w:t>Your balance is {{ account.balance }} dollars.</w:t>
            </w:r>
        </w:p>
    </w:body>
</w:document>`;

        console.log('Original XML:');
        console.log(testXml);
        
        // Create a minimal DOCX structure
        const zip = new JSZip();
        
        // Add required files for a valid DOCX
        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

        zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

        zip.file('word/document.xml', testXml);
        
        // Test the highlighting functions directly
        console.log('\n=== Testing highlighting functions ===');
        
        // Simulate the highlighting process
        const highlightJinja2Variables = (xml) => {
            console.log('Applying Jinja2 variable highlighting...');
            const textElementRegex = /<w:t([^>]*)>([^<]*\{\{[^}]+\}\}[^<]*)<\/w:t>/g;
            
            return xml.replace(textElementRegex, (match, attributes, textContent) => {
                console.log(`Processing text with Jinja2 variables: "${textContent}"`);
                
                const parts = [];
                let lastIndex = 0;
                
                const variableRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
                let varMatch;
                
                while ((varMatch = variableRegex.exec(textContent)) !== null) {
                    if (varMatch.index > lastIndex) {
                        const beforeText = textContent.substring(lastIndex, varMatch.index);
                        if (beforeText) {
                            parts.push(`<w:t${attributes}>${escapeXml(beforeText)}</w:t>`);
                        }
                    }
                    
                    // Add the variable with highlighting only inside the brackets, preserving spaces
                    const variableContent = varMatch[1]; // content inside {{ }} with original spacing
                    const trimmedContent = variableContent.trim(); // the actual variable name
                    const leadingSpace = variableContent.match(/^\s*/)[0]; // leading whitespace
                    const trailingSpace = variableContent.match(/\s*$/)[0]; // trailing whitespace
                    
                    // Structure: {{ <space><highlighted>variable</highlighted><space> }}
                    parts.push(`<w:t${attributes}>${escapeXml('{{' + leadingSpace)}</w:t>`);
                    parts.push(`<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>${escapeXml(trimmedContent)}</w:t></w:r>`);
                    parts.push(`<w:t${attributes}>${escapeXml(trailingSpace + '}}')}</w:t>`);
                    
                    lastIndex = varMatch.index + varMatch[0].length;
                }
                
                if (lastIndex < textContent.length) {
                    const afterText = textContent.substring(lastIndex);
                    if (afterText) {
                        parts.push(`<w:t${attributes}>${escapeXml(afterText)}</w:t>`);
                    }
                }
                
                if (parts.length > 1) {
                    const wrappedParts = parts.map(part => {
                        if (part.startsWith('<w:r>')) {
                            return part;
                        } else {
                            return `<w:r>${part}</w:r>`;
                        }
                    });
                    return wrappedParts.join('');
                } else if (parts.length === 1) {
                    return `<w:r>${parts[0]}</w:r>`;
                }
                
                return match;
            });
        };

        const highlightJinja2ControlStructures = (xml) => {
            console.log('Applying Jinja2 control structure highlighting...');
            const textElementRegex = /<w:t([^>]*)>([^<]*\{%[^%]+%\}[^<]*)<\/w:t>/g;
            
            return xml.replace(textElementRegex, (match, attributes, textContent) => {
                console.log(`Processing text with Jinja2 control structures: "${textContent}"`);
                
                const parts = [];
                let lastIndex = 0;
                
                const controlRegex = /\{%\s*([^%]+?)\s*%\}/g;
                let ctrlMatch;
                
                while ((ctrlMatch = controlRegex.exec(textContent)) !== null) {
                    if (ctrlMatch.index > lastIndex) {
                        const beforeText = textContent.substring(lastIndex, ctrlMatch.index);
                        if (beforeText) {
                            parts.push(`<w:t${attributes}>${escapeXml(beforeText)}</w:t>`);
                        }
                    }
                    
                    // Add the control structure with highlighting only inside the brackets, preserving spaces
                    const controlContent = ctrlMatch[1]; // content inside {% %} with original spacing
                    const trimmedContent = controlContent.trim(); // the actual control expression
                    const leadingSpace = controlContent.match(/^\s*/)[0]; // leading whitespace
                    const trailingSpace = controlContent.match(/\s*$/)[0]; // trailing whitespace
                    
                    // Structure: {% <space><highlighted>control</highlighted><space> %}
                    parts.push(`<w:t${attributes}>${escapeXml('{%' + leadingSpace)}</w:t>`);
                    parts.push(`<w:r><w:rPr><w:highlight w:val="cyan"/></w:rPr><w:t>${escapeXml(trimmedContent)}</w:t></w:r>`);
                    parts.push(`<w:t${attributes}>${escapeXml(trailingSpace + '%}')}</w:t>`);
                    
                    lastIndex = ctrlMatch.index + ctrlMatch[0].length;
                }
                
                if (lastIndex < textContent.length) {
                    const afterText = textContent.substring(lastIndex);
                    if (afterText) {
                        parts.push(`<w:t${attributes}>${escapeXml(afterText)}</w:t>`);
                    }
                }
                
                if (parts.length > 1) {
                    const wrappedParts = parts.map(part => {
                        if (part.startsWith('<w:r>')) {
                            return part;
                        } else {
                            return `<w:r>${part}</w:r>`;
                        }
                    });
                    return wrappedParts.join('');
                } else if (parts.length === 1) {
                    return `<w:r>${parts[0]}</w:r>`;
                }
                
                return match;
            });
        };

        const escapeXml = (text) => {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        
        // Apply highlighting
        let highlightedXml = testXml;
        highlightedXml = highlightJinja2Variables(highlightedXml);
        highlightedXml = highlightJinja2ControlStructures(highlightedXml);
        
        console.log('\nHighlighted XML:');
        console.log(highlightedXml);
        
        // Verify that highlighting is only inside brackets
        console.log('\n=== Verification: Highlighting Only Inside Brackets ===');
        const variableMatches = highlightedXml.match(/<w:t[^>]*>\{\{<\/w:t><\/w:r><w:r><w:rPr><w:highlight w:val="yellow"\/><\/w:rPr><w:t>[^<]+<\/w:t><\/w:r><w:r><w:t[^>]*>\}\}/g);
        const controlMatches = highlightedXml.match(/<w:t[^>]*>\{%<\/w:t><\/w:r><w:r><w:rPr><w:highlight w:val="cyan"\/><\/w:rPr><w:t>[^<]+<\/w:t><\/w:r><w:r><w:t[^>]*>%\}/g);
        
        console.log('Variable highlighting patterns found:', variableMatches ? variableMatches.length : 0);
        console.log('Control structure highlighting patterns found:', controlMatches ? controlMatches.length : 0);
        
        if (variableMatches) {
            console.log('Sample variable highlighting:', variableMatches[0]);
        }
        if (controlMatches) {
            console.log('Sample control highlighting:', controlMatches[0]);
        }
        
        // Update the ZIP with highlighted XML
        zip.file('word/document.xml', highlightedXml);
        
        // Generate the DOCX
        const docxBuffer = await zip.generateAsync({
            type: 'arraybuffer',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        // Save the test file
        const outputPath = path.join(__dirname, 'test-jinja2-highlighting.docx');
        fs.writeFileSync(outputPath, new Uint8Array(docxBuffer));
        
        console.log('\nSuccess! Generated DOCX with Jinja2 highlighting');
        console.log('File saved to:', outputPath);
        console.log('File size:', docxBuffer.byteLength, 'bytes');
        
        // Validate the XML structure
        console.log('\n=== XML Validation ===');
        const isValidXml = validateXmlStructure(highlightedXml);
        console.log('XML is valid:', isValidXml);
        
    } catch (error) {
        console.error('Error during Jinja2 highlighting test:', error);
        console.error('Error details:', error.message);
        console.error('Stack:', error.stack);
    }
}

function validateXmlStructure(xml) {
    try {
        // Basic XML validation: check for balanced tags
        if (xml.includes('<>') || xml.includes('</>')) {
            console.error('XML contains empty tags');
            return false;
        }
        
        const tagStack = [];
        const tagRegex = /<\/?([a-zA-Z:][a-zA-Z0-9:._-]*)[^>]*>/g;
        let match;
        
        while ((match = tagRegex.exec(xml)) !== null) {
            const fullTag = match[0];
            const tagName = match[1];
            
            if (fullTag.endsWith('/>') || fullTag.startsWith('<?') || fullTag.startsWith('<!')) {
                continue;
            }
            
            if (fullTag.startsWith('</')) {
                const expectedTag = tagStack.pop();
                if (expectedTag !== tagName) {
                    console.error(`XML tag mismatch: expected </${expectedTag}> but found </${tagName}>`);
                    return false;
                }
            } else {
                tagStack.push(tagName);
            }
        }
        
        if (tagStack.length > 0) {
            console.error(`XML has unclosed tags: ${tagStack.join(', ')}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error validating XML:', error);
        return false;
    }
}

testJinja2Highlighting();