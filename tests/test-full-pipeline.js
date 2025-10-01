// Test full DOCX processing pipeline with Jinja2 highlighting
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFullPipeline() {
    console.log('Testing full DOCX processing pipeline with Jinja2 highlighting...');
    
    try {
        // Read a sample DOCX file
        const sampleFilePath = path.join(__dirname, '..', 'sample_files', 'sample_security_deposit_letter.docx');
        
        if (!fs.existsSync(sampleFilePath)) {
            console.error('Sample file not found:', sampleFilePath);
            return;
        }
        
        console.log('Reading sample file:', sampleFilePath);
        const fileBuffer = fs.readFileSync(sampleFilePath);
        const file = new File([fileBuffer], 'sample.docx', { 
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        
        // Create test suggestions with Jinja2 syntax
        const testSuggestions = [
            {
                id: '1',
                original: 'landlord',
                replacement: '{{ landlord_name }}',
                status: 'accepted'
            },
            {
                id: '2', 
                original: 'tenant',
                replacement: '{{ tenant_name }}',
                status: 'accepted'
            },
            {
                id: '3',
                original: 'deposit',
                replacement: '{{ security_deposit }}',
                status: 'accepted'
            },
            {
                id: '4',
                original: 'lease',
                replacement: '{% if lease_type == "residential" %}residential lease{% else %}commercial lease{% endif %}',
                status: 'accepted'
            }
        ];
        
        console.log('Processing DOCX with Jinja2 suggestions...');
        
        // Simulate the docxProcessor functionality for testing
        const JSZip = (await import('jszip')).default;
        
        // Read the DOCX file
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Get the document XML
        const documentXml = await zip.file('word/document.xml')?.async('text');
        if (!documentXml) {
            throw new Error('Could not find document.xml in DOCX file');
        }
        
        console.log('Original document.xml length:', documentXml.length);
        
        // Apply text replacements
        let modifiedXml = documentXml;
        
        testSuggestions.forEach((suggestion, index) => {
            console.log(`Applying suggestion ${index + 1}: "${suggestion.original}" → "${suggestion.replacement}"`);
            
            // Simple text replacement for testing
            const regex = new RegExp(escapeRegex(suggestion.original), 'gi');
            const beforeLength = modifiedXml.length;
            modifiedXml = modifiedXml.replace(regex, escapeXml(suggestion.replacement));
            const afterLength = modifiedXml.length;
            
            if (afterLength !== beforeLength) {
                console.log(`✓ Replacement successful (${beforeLength} → ${afterLength} chars)`);
            } else {
                console.log(`⚠ No replacement made for "${suggestion.original}"`);
            }
        });
        
        // Apply Jinja2 highlighting
        console.log('Applying Jinja2 syntax highlighting...');
        modifiedXml = highlightJinja2Syntax(modifiedXml);
        
        // Validate XML structure
        console.log('Validating XML structure...');
        const isValid = validateXmlStructure(modifiedXml);
        
        if (!isValid) {
            throw new Error('Modified XML is invalid');
        }
        
        console.log('✓ XML structure is valid');
        
        // Update the ZIP
        zip.file('word/document.xml', modifiedXml);
        
        // Generate the new DOCX
        const modifiedDocx = await zip.generateAsync({
            type: 'arraybuffer',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        // Save the result
        const outputPath = path.join(__dirname, 'test-full-pipeline-output.docx');
        fs.writeFileSync(outputPath, new Uint8Array(modifiedDocx));
        
        console.log('Success! Generated DOCX with Jinja2 highlighting');
        console.log('File saved to:', outputPath);
        console.log('File size:', modifiedDocx.byteLength, 'bytes');
        
        // Analyze the final XML for verification
        console.log('\n=== Final XML Analysis ===');
        const finalXml = await JSZip.loadAsync(modifiedDocx).then(z => z.file('word/document.xml')?.async('text'));
        if (finalXml) {
            const variableHighlights = (finalXml.match(/<w:highlight w:val="yellow"\/>/g) || []).length;
            const controlHighlights = (finalXml.match(/<w:highlight w:val="cyan"\/>/g) || []).length;
            
            console.log(`Found ${variableHighlights} yellow highlights (variables)`);
            console.log(`Found ${controlHighlights} cyan highlights (control structures)`);
            
            // Show sample of highlighted content
            const highlightSample = finalXml.match(/<w:r><w:rPr><w:highlight[^>]*>[^<]*<w:t>[^<]*<\/w:t><\/w:r>/g);
            if (highlightSample) {
                console.log('Sample highlighted content:', highlightSample.slice(0, 3));
            }
        }
        
    } catch (error) {
        console.error('Error during full pipeline test:', error);
        console.error('Error details:', error.message);
        console.error('Stack:', error.stack);
    }
}

function highlightJinja2Syntax(xml) {
    console.log('Starting Jinja2 syntax highlighting pass');
    
    let result = xml;
    
    // First, highlight Jinja2 variables {{ variable }}
    result = highlightJinja2Variables(result);
    
    // Then, highlight Jinja2 control structures {% if/for/... %}
    result = highlightJinja2ControlStructures(result);
    
    console.log('Jinja2 syntax highlighting completed');
    return result;
}

function highlightJinja2Variables(xml) {
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
}

function highlightJinja2ControlStructures(xml) {
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
            
            // Add the control structure with highlighting only inside the brackets
            const controlContent = ctrlMatch[1].trim(); // content inside {% %}
            
            // Structure: {% <highlighted>control</highlighted> %}
            parts.push(`<w:t${attributes}>${escapeXml('{%')}</w:t>`);
            parts.push(`<w:r><w:rPr><w:highlight w:val="cyan"/></w:rPr><w:t>${escapeXml(controlContent)}</w:t></w:r>`);
            parts.push(`<w:t${attributes}>${escapeXml('%}')}</w:t>`);
            
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

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateXmlStructure(xml) {
    try {
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

testFullPipeline();