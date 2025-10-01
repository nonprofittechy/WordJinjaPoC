// Test space preservation in Jinja2 highlighting
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSpacePreservation() {
    console.log('Testing space preservation in Jinja2 highlighting...');
    
    try {
        // Create test XML with various spacing patterns
        const testXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        <w:p>
            <w:r>
                <w:t>Normal: {{ user_name }} (standard spacing)</w:t>
            </w:r>
        </w:p>
        <w:p>
            <w:r>
                <w:t>Tight: {{user_name}} (no spaces)</w:t>
            </w:r>
        </w:p>
        <w:p>
            <w:r>
                <w:t>Loose: {{  user_name  }} (extra spaces)</w:t>
            </w:r>
        </w:p>
        <w:p>
            <w:r>
                <w:t>Control: {% if condition %} vs {%if condition%} vs {%  if condition  %}</w:t>
            </w:r>
        </w:p>
    </w:body>
</w:document>`;

        console.log('Original XML with various spacing:');
        console.log(testXml);
        
        // Apply highlighting functions
        let highlightedXml = testXml;
        highlightedXml = highlightJinja2Variables(highlightedXml);
        highlightedXml = highlightJinja2ControlStructures(highlightedXml);
        
        console.log('\n=== Highlighted XML ===');
        console.log(highlightedXml);
        
        // Save test file
        const zip = new JSZip();
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

        zip.file('word/document.xml', highlightedXml);
        
        const docxBuffer = await zip.generateAsync({
            type: 'arraybuffer',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        const outputPath = path.join(__dirname, 'test-space-preservation.docx');
        fs.writeFileSync(outputPath, new Uint8Array(docxBuffer));
        
        console.log('\nSuccess! Generated DOCX with space preservation test');
        console.log('File saved to:', outputPath);
        console.log('File size:', docxBuffer.byteLength, 'bytes');
        
        // Analyze the results
        console.log('\n=== Space Preservation Analysis ===');
        
        // Look for different spacing patterns in the output
        const normalPattern = highlightedXml.match(/\{\{ <w:rPr><w:highlight[^>]*><w:t>user_name<\/w:t><\/w:r><w:r><w:t> \}\}/);
        const tightPattern = highlightedXml.match(/\{\{<w:rPr><w:highlight[^>]*><w:t>user_name<\/w:t><\/w:r><w:r><w:t>\}\}/);
        const loosePattern = highlightedXml.match(/\{\{  <w:rPr><w:highlight[^>]*><w:t>user_name<\/w:t><\/w:r><w:r><w:t>  \}\}/);
        
        console.log('Normal spacing pattern found:', !!normalPattern);
        console.log('Tight spacing pattern found:', !!tightPattern);
        console.log('Loose spacing pattern found:', !!loosePattern);
        
    } catch (error) {
        console.error('Error during space preservation test:', error);
        console.error('Stack:', error.stack);
    }
}

function highlightJinja2Variables(xml) {
    console.log('Applying Jinja2 variable highlighting...');
    const textElementRegex = /<w:t([^>]*)>([^<]*\{\{[^}]+\}\}[^<]*)<\/w:t>/g;
    
    return xml.replace(textElementRegex, (match, attributes, textContent) => {
        console.log(`Processing text with Jinja2 variables: "${textContent}"`);
        
        const parts = [];
        let lastIndex = 0;
        
        const variableRegex = /\{\{([^}]*)\}\}/g;
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
            
            console.log(`Variable analysis: "${variableContent}" -> leading:"${leadingSpace}" content:"${trimmedContent}" trailing:"${trailingSpace}"`);
            
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
}

function highlightJinja2ControlStructures(xml) {
    console.log('Applying Jinja2 control structure highlighting...');
    const textElementRegex = /<w:t([^>]*)>([^<]*\{%[^%]+%\}[^<]*)<\/w:t>/g;
    
    return xml.replace(textElementRegex, (match, attributes, textContent) => {
        console.log(`Processing text with Jinja2 control structures: "${textContent}"`);
        
        const parts = [];
        let lastIndex = 0;
        
        const controlRegex = /\{%([^%]*?)%\}/g;
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
            
            console.log(`Control analysis: "${controlContent}" -> leading:"${leadingSpace}" content:"${trimmedContent}" trailing:"${trailingSpace}"`);
            
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
}

function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

testSpacePreservation();