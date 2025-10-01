import JSZip from 'jszip';
import { Suggestion, SuggestionStatus } from '../types';

interface DocxProcessor {
    processOriginalDocx: (originalFile: File, acceptedSuggestions: Suggestion[]) => Promise<Blob>;
}

class DocxTextReplacer implements DocxProcessor {
    async processOriginalDocx(originalFile: File, acceptedSuggestions: Suggestion[]): Promise<Blob> {
        console.log('Processing original DOCX with', acceptedSuggestions.length, 'accepted suggestions');
        
        try {
            // Read the original DOCX file as an array buffer
            const arrayBuffer = await originalFile.arrayBuffer();
            
            // Parse the DOCX (which is actually a ZIP file)
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // The main document content is in word/document.xml
            const documentXml = await zip.file('word/document.xml')?.async('text');
            
            if (!documentXml) {
                throw new Error('Could not find document.xml in DOCX file');
            }
            
            console.log('Original document.xml length:', documentXml.length);
            
            // Debug: Check for tabs in the original XML
            const tabElements = (documentXml.match(/<w:tab[^>]*\/?>/g) || []).length;
            const literalTabs = (documentXml.match(/\t/g) || []).length;
            console.log(`Document contains ${tabElements} <w:tab> elements and ${literalTabs} literal tab characters`);
            
            // Apply text replacements to the XML content
            let modifiedXml = documentXml;
            
            // First, extract plain text from XML to match against our suggestions
            const plainText = this.extractPlainTextFromXml(documentXml);
            console.log('Extracted plain text length:', plainText.length);
            
            // Debug: Check for tabs in extracted text
            const extractedTabs = (plainText.match(/\t/g) || []).length;
            console.log(`Extracted text contains ${extractedTabs} tab characters`);
            if (extractedTabs > 0) {
                console.log('Sample of extracted text with tabs:', plainText.substring(0, 200).replace(/\t/g, '[TAB]'));
            }
            
            console.log(`Processing ${acceptedSuggestions.length} suggestions`);
            
            // Debug: Check what types of suggestions we have
            const tabSuggestions = acceptedSuggestions.filter(s => s.original === '\t');
            if (tabSuggestions.length > 0) {
                console.log(`Found ${tabSuggestions.length} tab suggestions:`, tabSuggestions);
            }
            
            // Sort suggestions by length (longest first) to avoid partial replacements
            const sortedSuggestions = acceptedSuggestions.sort((a, b) => b.original.length - a.original.length);
            
            sortedSuggestions.forEach((suggestion, index) => {
                const displayOriginal = suggestion.original.replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                console.log(`Applying suggestion ${index + 1}:`, {
                    original: displayOriginal,
                    replacement: suggestion.replacement,
                    originalLength: suggestion.original.length,
                    isWhitespace: /^[\s\t\n\r]+$/.test(suggestion.original)
                });
                
                // Skip if this text has already been replaced (check if replacement is already in the XML)
                // For tabs, be more specific since {{ }} might appear in other contexts
                if (suggestion.original === '\t') {
                    // For tab replacements, check if the exact replacement wrapped in <w:t> already exists
                    const wrappedReplacement = `<w:t>${this.escapeXml(suggestion.replacement)}</w:t>`;
                    if (modifiedXml.includes(wrappedReplacement)) {
                        console.log(`⚠ Tab replacement "${suggestion.replacement}" already exists in document, skipping`);
                        return;
                    }
                } else if (modifiedXml.includes(suggestion.replacement)) {
                    console.log(`⚠ Replacement "${suggestion.replacement}" already exists in document, skipping`);
                    return;
                }
                
                // Count occurrences before replacement to limit replacements
                const occurrenceCount = this.countOccurrences(modifiedXml, suggestion.original);
                if (occurrenceCount === 0) {
                    if (suggestion.original === '\t') {
                        console.log(`⚠ Tab character not found in document (neither <w:tab/> elements nor literal tabs), skipping`);
                        // Debug: Show what tab-related content exists
                        const tabSample = modifiedXml.substring(0, 1000);
                        const tabElementsInSample = (tabSample.match(/<w:tab[^>]*\/?>/g) || []).length;
                        console.log(`Debug: First 1000 chars contain ${tabElementsInSample} <w:tab> elements`);
                    } else {
                        console.log(`⚠ Text "${displayOriginal}" not found in document directly`);
                        
                        // Check if text exists in plain text (might be split across elements)
                        const currentPlainText = this.extractPlainTextFromXml(modifiedXml);
                        if (!currentPlainText.includes(suggestion.original)) {
                            console.log(`⚠ Text "${displayOriginal}" not found anywhere, skipping`);
                            return;
                        }
                        console.log(`✓ Found "${displayOriginal}" in plain text - attempting cross-element replacement`);
                    }
                }
                
                if (occurrenceCount > 10) {
                    console.warn(`⚠ Text "${displayOriginal}" appears ${occurrenceCount} times, this might cause issues. Limiting to first occurrence.`);
                }
                
                try {
                    const beforeLength = modifiedXml.length;
                    const beforeXml = modifiedXml; // Keep backup
                    
                    // Use a safer replacement approach with limits
                    modifiedXml = this.safeReplaceText(modifiedXml, suggestion.original, suggestion.replacement, Math.min(occurrenceCount, 1));
                    
                    // If direct replacement failed but text exists in plain text, try cross-element replacement
                    const newLength = modifiedXml.length;
                    if (newLength === beforeLength && occurrenceCount === 0) {
                        console.log(`Direct replacement failed, trying cross-element replacement for "${displayOriginal}"`);
                        
                        // First try the simple cross-element method
                        let crossResult = this.replaceTextAcrossXmlTags(modifiedXml, suggestion.original, suggestion.replacement, 1);
                        if (crossResult !== modifiedXml) {
                            modifiedXml = crossResult;
                            console.log(`Simple cross-element replacement succeeded for "${displayOriginal}"`);
                        } else {
                            console.log(`Simple cross-element replacement failed, trying complex multi-element replacement`);
                            
                            // Try the more sophisticated method for text spanning multiple elements
                            crossResult = this.replaceTextSpanningMultipleElements(modifiedXml, suggestion.original, suggestion.replacement);
                            if (crossResult !== modifiedXml) {
                                modifiedXml = crossResult;
                                console.log(`Complex multi-element replacement succeeded for "${displayOriginal}"`);
                            } else {
                                console.log(`All cross-element replacement attempts failed for "${displayOriginal}"`);
                            }
                        }
                    }
                    
                    const afterLength = modifiedXml.length;
                    const wasReplaced = afterLength !== beforeLength;
                    
                    // Check for runaway replacement (string grew too much)
                    if (afterLength > beforeLength * 1.2) {
                        console.error(`Replacement caused excessive growth, reverting. Before: ${beforeLength}, After: ${afterLength}`);
                        modifiedXml = beforeXml; // Revert to state before this replacement
                        return;
                    }
                    
                    // Validate XML structure after each replacement
                    if (wasReplaced && !this.isValidXml(modifiedXml)) {
                        console.error(`Replacement of "${suggestion.original}" corrupted XML structure, reverting`);
                        modifiedXml = beforeXml; // Revert to state before this replacement
                        console.log(`⚠ Skipped replacement "${displayOriginal}" due to XML structure concerns`);
                        return;
                    }
                    
                    console.log(`Replacement ${wasReplaced ? 'SUCCESS' : 'FAILED'}. XML length: ${beforeLength} → ${afterLength}`);
                    
                    if (wasReplaced) {
                        console.log(`✓ Successfully replaced "${displayOriginal}" with "${suggestion.replacement}"`);
                    } else {
                        console.warn(`⚠ Could not find text "${displayOriginal}" in DOCX XML`);
                        // For debugging: show a sample of the XML and analyze tab representations
                        if (suggestion.original === '\t') {
                            console.log('=== TAB CHARACTER ANALYSIS ===');
                            
                            // Look for various tab representations in the XML
                            const tabElementMatches = modifiedXml.match(/<w:tab[^>]*\/?>/g);
                            if (tabElementMatches) {
                                console.log(`Found ${tabElementMatches.length} <w:tab> elements:`, tabElementMatches.slice(0, 5));
                            }
                            
                            const textElementsWithTabs = modifiedXml.match(/<w:t[^>]*>[^<]*\t[^<]*<\/w:t>/g);
                            if (textElementsWithTabs) {
                                console.log(`Found ${textElementsWithTabs.length} text elements containing tabs:`, textElementsWithTabs.slice(0, 3));
                            }
                            
                            const literalTabs = (modifiedXml.match(/\t/g) || []).length;
                            console.log(`Found ${literalTabs} literal tab characters in XML`);
                            
                            // Show a broader sample that might contain tabs
                            const xmlSample = modifiedXml.substring(1000, 3000);
                            console.log(`XML sample (chars 1000-3000):`, xmlSample);
                            
                            console.log('=== END TAB ANALYSIS ===');
                        } else if (suggestion.original.length <= 10) {
                            const sampleXml = modifiedXml.substring(0, 1000) + '...';
                            console.log(`Sample XML start:`, sampleXml);
                        }
                    }
                    
                } catch (replaceError) {
                    console.error(`Error replacing "${displayOriginal}":`, replaceError);
                    // Continue with other suggestions
                }
            });
            
            // Validate the modified XML before saving
            if (!this.isValidXml(modifiedXml)) {
                console.error('Modified XML is invalid, reverting to original');
                throw new Error('Text replacement resulted in invalid XML structure. This can happen when selected text spans across formatting boundaries.');
            }
            
            // Apply Jinja2 syntax highlighting as a final pass
            console.log('Applying Jinja2 syntax highlighting...');
            modifiedXml = this.highlightJinja2Syntax(modifiedXml);
            
            // Update the document.xml in the ZIP
            zip.file('word/document.xml', modifiedXml);
            
            console.log('Generating modified DOCX blob...');
            
            // Generate the new DOCX file
            const modifiedDocx = await zip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            
            console.log('Modified DOCX generated successfully, size:', modifiedDocx.size);
            return modifiedDocx;
            
        } catch (error) {
            console.error('Error processing DOCX:', error);
            throw new Error(`Failed to process DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private extractPlainTextFromXml(xml: string): string {
        // Convert special DOCX elements to their text equivalents BEFORE removing tags
        let processedXml = xml
            .replace(/<w:tab[^>]*\/?>/g, '\t')  // Convert <w:tab/> elements to literal tabs
            .replace(/<w:br[^>]*\/?>/g, '\n')  // Convert <w:br/> elements to newlines
            .replace(/<w:p[^>]*>/g, '\n');     // Convert paragraph starts to newlines
        
        // Remove XML tags and extract text content
        return processedXml
            .replace(/<[^>]*>/g, '') // Remove all remaining XML tags
            .replace(/&lt;/g, '<')   // Decode XML entities
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/\n\s*\n/g, '\n')  // Normalize multiple newlines
            .replace(/[ ]+/g, ' ')      // Normalize spaces (but preserve tabs and newlines)
            .trim();
    }
    
    private replaceTextAcrossXmlTags(xml: string, searchText: string, replacement: string, maxReplacements?: number): string {
        // SAFE approach: Only replace text within individual <w:t> elements
        // This prevents breaking XML structure by replacing across element boundaries
        
        console.log(`Attempting safe cross-tag replacement for: "${searchText}"`);
        
        // Find all <w:t> elements and process them individually
        let result = xml;
        const textElementRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
        let replacementsMade = 0;
        
        result = result.replace(textElementRegex, (match, attributes, textContent) => {
            // Only replace within this specific text element
            if (textContent.includes(searchText) && (!maxReplacements || replacementsMade < maxReplacements)) {
                console.log(`Found "${searchText}" in text element: "${textContent}"`);
                const newContent = textContent.replace(new RegExp(this.escapeRegex(searchText), maxReplacements && maxReplacements - replacementsMade === 1 ? '' : 'g'), replacement);
                replacementsMade++;
                return `<w:t${attributes}>${newContent}</w:t>`;
            }
            return match;
        });
        
        // If no replacement was made in text elements, try a more conservative approach
        if (result === xml) {
            console.log(`No replacement in text elements, trying word boundary approach`);
            
            // Only try replacement if we can find the exact text surrounded by word boundaries
            // and not crossing XML tag boundaries
            const safePattern = `(>[^<]*?)${this.escapeRegex(searchText)}([^<]*?<)`;
            const safeRegex = new RegExp(safePattern, 'g');
            
            result = xml.replace(safeRegex, (match, before, after) => {
                console.log(`Safe replacement found: "${match}"`);
                return `${before}${replacement}${after}`;
            });
        }
        
        return result;
    }

    private replaceTextSpanningMultipleElements(xml: string, searchText: string, replacement: string): string {
        console.log(`Attempting complex cross-element replacement for: "${searchText}"`);
        
        try {
            // Strategy: Find all <w:t> elements and their text content, 
            // then see if concatenating them (ignoring other elements) contains our search text
            
            // Extract all <w:t> elements with their positions
            const textElements: Array<{
                fullMatch: string;
                startPos: number;
                endPos: number;
                textContent: string;
                attributes: string;
            }> = [];
            
            const textElementRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
            let match;
            
            while ((match = textElementRegex.exec(xml)) !== null) {
                textElements.push({
                    fullMatch: match[0],
                    startPos: match.index,
                    endPos: match.index + match[0].length,
                    textContent: match[2],
                    attributes: match[1]
                });
            }
            
            if (textElements.length === 0) {
                console.log('No <w:t> elements found');
                return xml;
            }
            
            // Try to find the search text by concatenating consecutive <w:t> elements
            // (allowing for other XML elements in between)
            for (let startIdx = 0; startIdx < textElements.length; startIdx++) {
                let combinedText = textElements[startIdx].textContent;
                
                // Try extending the search by including subsequent elements
                for (let endIdx = startIdx; endIdx < textElements.length; endIdx++) {
                    if (endIdx > startIdx) {
                        combinedText += textElements[endIdx].textContent;
                    }
                    
                    // Check if our combined text contains the search text
                    if (combinedText.includes(searchText)) {
                        console.log(`Found "${searchText}" spanning elements ${startIdx} to ${endIdx}`);
                        console.log(`Combined text: "${combinedText}"`);
                        
                        // Found it! Now we need to replace and reconstruct
                        const replacedText = combinedText.replace(searchText, replacement);
                        
                        // Create a single replacement element
                        const newElement = `<w:t${textElements[startIdx].attributes}>${this.escapeXml(replacedText)}</w:t>`;
                        
                        // Replace from start of first element to end of last element
                        const beforePart = xml.substring(0, textElements[startIdx].startPos);
                        const afterPart = xml.substring(textElements[endIdx].endPos);
                        
                        const result = beforePart + newElement + afterPart;
                        console.log(`Successfully replaced text spanning multiple elements`);
                        return result;
                    }
                    
                    // If we've already found a match or gone too far, break
                    if (combinedText.length > searchText.length * 2) {
                        break;
                    }
                }
            }
            
            console.log(`Search text "${searchText}" not found in any combination of elements`);
            return xml;
            
        } catch (error) {
            console.error('Error in complex cross-element replacement:', error);
            return xml;
        }
    }
    
    private findSimilarText(plainText: string, searchText: string): string | null {
        // Find text that's similar to what we're looking for (for debugging)
        const words = searchText.split(' ');
        const firstWord = words[0];
        const lastWord = words[words.length - 1];
        
        if (firstWord && lastWord && firstWord !== lastWord) {
            // Look for text that starts with the first word and ends with the last word
            const pattern = new RegExp(`${this.escapeRegex(firstWord)}[\\s\\S]*?${this.escapeRegex(lastWord)}`, 'i');
            const match = plainText.match(pattern);
            return match ? match[0] : null;
        }
        
        // Look for the first word
        if (firstWord) {
            const pattern = new RegExp(`\\b${this.escapeRegex(firstWord)}\\b[\\s\\S]{0,50}`, 'i');
            const match = plainText.match(pattern);
            return match ? match[0] : null;
        }
        
        return null;
    }
    
    private findXmlSnippetContaining(xml: string, searchText: string): string | null {
        // Find a snippet of XML that might contain the text we're looking for
        const words = searchText.split(' ');
        const firstWord = words[0];
        
        if (firstWord) {
            const pattern = new RegExp(`[^<>]*${this.escapeRegex(firstWord)}[^<>]*`, 'i');
            const match = xml.match(pattern);
            return match ? match[0].substring(0, 200) : null;
        }
        
        return null;
    }
    
    private safeReplaceText(xml: string, original: string, replacement: string, maxReplacements?: number): string {
        try {
            // Handle empty suggestions
            if (!original || original.length === 0) {
                console.warn(`Skipping empty suggestion`);
                return xml;
            }
            
            console.log(`Attempting to replace: "${original}" (length: ${original.length}) with: "${replacement}"`);
            
            // Escape XML characters in the replacement text
            const escapedReplacement = this.escapeXml(replacement);
            
            // Handle different types of text replacements
            const isWhitespaceOnly = /^[\s\t\n\r]+$/.test(original);
            const isSingleTab = original === '\t';
            const hasNonWhitespace = /\S/.test(original);
            
            if (isWhitespaceOnly) {
                console.log(`Handling whitespace-only replacement: "${original}"`);
                return this.replaceWhitespaceText(xml, original, escapedReplacement, maxReplacements);
            }
            
            if (isSingleTab) {
                console.log(`Handling single tab replacement`);
                return this.replaceTabCharacter(xml, escapedReplacement, maxReplacements);
            }
            
            // For regular text with non-whitespace characters, use standard replacement
            if (hasNonWhitespace) {
                return this.replaceRegularText(xml, original, escapedReplacement, maxReplacements);
            }
            
            console.warn(`Unhandled replacement case for: "${original}"`);
            return xml;
            
        } catch (error) {
            console.error(`Error in safeReplaceText for "${original}":`, error);
            return xml; // Return original if replacement fails
        }
    }
    
    private replaceRegularText(xml: string, original: string, replacement: string, maxReplacements?: number): string {
        // Normalize the original text
        const normalizedOriginal = original.trim().replace(/\s+/g, ' ');
        
        // Try exact replacement first (limit to maxReplacements if specified)
        const exactRegex = new RegExp(this.escapeRegex(original), maxReplacements ? '' : 'g');
        let result = xml;
        
        if (maxReplacements && maxReplacements > 0) {
            // Replace only the specified number of occurrences
            let replacements = 0;
            result = xml.replace(new RegExp(this.escapeRegex(original), 'g'), (match) => {
                if (replacements < maxReplacements) {
                    replacements++;
                    return replacement;
                }
                return match;
            });
        } else {
            result = xml.replace(exactRegex, replacement);
        }
        
        // If that didn't work, try normalized version
        if (result === xml && normalizedOriginal !== original) {
            if (maxReplacements && maxReplacements > 0) {
                let replacements = 0;
                result = xml.replace(new RegExp(this.escapeRegex(normalizedOriginal), 'g'), (match) => {
                    if (replacements < maxReplacements) {
                        replacements++;
                        return replacement;
                    }
                    return match;
                });
            } else {
                const normalizedRegex = new RegExp(this.escapeRegex(normalizedOriginal), 'g');
                result = xml.replace(normalizedRegex, replacement);
            }
        }
        
        // Try context-aware replacement across XML tags
        if (result === xml) {
            result = this.replaceTextAcrossXmlTags(xml, original, replacement, maxReplacements);
        }
        
        // Safety check: ensure we're not creating a runaway replacement
        if (result.length > xml.length * 1.5) {
            console.warn(`Replacement would cause excessive growth, skipping: "${original}"`);
            return xml;
        }
        
        return result;
    }
    
    private replaceWhitespaceText(xml: string, original: string, replacement: string, maxReplacements?: number): string {
        try {
            console.log('Starting whitespace text replacement...');
            
            // First, let's find where tabs might be in the XML
            const xmlSample = xml.substring(0, 2000);
            console.log('XML sample to analyze:', xmlSample);
            
            // Tab characters in DOCX XML are often represented as:
            // 1. <w:tab/> elements
            // 2. <w:t xml:space="preserve">	</w:t> (literal tab in text element)
            // 3. Within text runs as actual tab characters
            
            let result = xml;
            
            // For tab characters, delegate to the specialized tab replacement method
            if (original === '\t') {
                console.log('Delegating tab replacement to specialized method');
                return this.replaceTabCharacter(xml, replacement, maxReplacements);
            }
            
            // For other whitespace characters, use a controlled approach
            let safePattern = original
                .replace(/\t/g, '\\t')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/ /g, '\\s');
            
            console.log(`Replacing whitespace pattern: "${safePattern}" with max replacements: ${maxReplacements || 'unlimited'}`);
            
            if (maxReplacements && maxReplacements > 0) {
                let replacementsMade = 0;
                const whitespaceRegex = new RegExp(safePattern, 'g');
                result = xml.replace(whitespaceRegex, (match) => {
                    if (replacementsMade < maxReplacements) {
                        replacementsMade++;
                        return replacement;
                    }
                    return match;
                });
            } else {
                const whitespaceRegex = new RegExp(safePattern, 'g');
                result = xml.replace(whitespaceRegex, replacement);
            }
            
            if (result === xml) {
                // Look for the whitespace pattern in text content between tags
                let replacementsMade = 0;
                result = xml.replace(/>([^<]*)</g, (match, textContent) => {
                    if (textContent.includes(original)) {
                        if (!maxReplacements || replacementsMade < maxReplacements) {
                            const newContent = textContent.replace(new RegExp(this.escapeRegex(original), maxReplacements && maxReplacements - replacementsMade === 1 ? '' : 'g'), replacement);
                            replacementsMade++;
                            return `>${newContent}<`;
                        }
                    }
                    return match;
                });
            }
            
            return result;
            
        } catch (error) {
            console.error(`Error replacing whitespace text: "${original}":`, error);
            return xml;
        }
    }
    
    private replaceTabCharacter(xml: string, replacement: string, maxReplacements?: number): string {
        try {
            console.log(`Replacing tab characters with "${replacement}", max replacements: ${maxReplacements || 'unlimited'}`);
            
            let result = xml;
            let replacementsMade = 0;
            
            // Strategy 1: Replace <w:tab/> elements (most common in DOCX)
            // These need to be replaced with proper <w:t> elements containing the replacement text
            const tabElementRegex = /<w:tab\s*\/>/g;
            const wrappedReplacement = `<w:t>${replacement}</w:t>`;
            
            if (maxReplacements && maxReplacements > 0) {
                result = result.replace(tabElementRegex, (match) => {
                    if (replacementsMade < maxReplacements) {
                        replacementsMade++;
                        console.log(`Replaced <w:tab/> element ${replacementsMade} with wrapped text`);
                        return wrappedReplacement;
                    }
                    return match;
                });
            } else {
                // Replace all occurrences
                const tabMatches = result.match(tabElementRegex);
                if (tabMatches) {
                    console.log(`Found ${tabMatches.length} <w:tab/> elements to replace`);
                    result = result.replace(tabElementRegex, wrappedReplacement);
                    replacementsMade = tabMatches.length;
                }
            }
            
            // Strategy 2: Replace literal tab characters within <w:t> elements
            if (!maxReplacements || replacementsMade < maxReplacements) {
                result = result.replace(/<w:t([^>]*)>([^<]*\t[^<]*)<\/w:t>/g, (match, attributes, textContent) => {
                    if (!maxReplacements || replacementsMade < maxReplacements) {
                        console.log(`Found tab in text element: "${textContent}"`);
                        const newContent = textContent.replace(/\t/g, replacement);
                        replacementsMade++;
                        return `<w:t${attributes}>${newContent}</w:t>`;
                    }
                    return match;
                });
            }
            
            // Strategy 3: Replace any remaining literal tab characters (fallback)
            if (!maxReplacements || replacementsMade < maxReplacements) {
                if (maxReplacements && maxReplacements > 0) {
                    result = result.replace(/\t/g, (match) => {
                        if (replacementsMade < maxReplacements) {
                            replacementsMade++;
                            return replacement;
                        }
                        return match;
                    });
                } else {
                    const literalTabs = (result.match(/\t/g) || []).length;
                    if (literalTabs > 0) {
                        console.log(`Replacing ${literalTabs} literal tab characters`);
                        result = result.replace(/\t/g, replacement);
                        replacementsMade += literalTabs;
                    }
                }
            }
            
            console.log(`Tab replacement complete: ${replacementsMade} replacements made`);
            return result;
            
        } catch (error) {
            console.error(`Error replacing tab character:`, error);
            return xml;
        }
    }

    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
            // Note: Single quotes don't need escaping in Word document text content
    }

    private createHighlightedJinjaVariable(replacement: string): string {
        // Check if this is a Jinja2 variable (contains {{ and }})
        const jinjaMatch = replacement.match(/^(\{\{\s*)([^}]+)(\s*\}\})$/);
        
        if (jinjaMatch) {
            const [, openTags, variableContent, closeTags] = jinjaMatch;
            
            // Create XML for highlighted Jinja2 variable
            // Structure: {{ <highlighted>variable.content</highlighted> }}
            return `<w:t>${this.escapeXml(openTags)}</w:t>` +
                   `<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>${this.escapeXml(variableContent)}</w:t></w:r>` +
                   `<w:t>${this.escapeXml(closeTags)}</w:t>`;
        } else {
            // Not a Jinja2 variable, return as regular text
            return `<w:t>${this.escapeXml(replacement)}</w:t>`;
        }
    }
    
    private wrapInTextElement(text: string): string {
        // Escape XML characters and wrap in <w:t> element
        const escapedText = this.escapeXml(text);
        return `<w:t>${escapedText}</w:t>`;
    }
    
    private isInsideTextElement(xml: string, position: number): boolean {
        // Check if a position in the XML is inside a <w:t> element
        const beforePosition = xml.substring(0, position);
        const lastOpenTag = beforePosition.lastIndexOf('<w:t');
        const lastCloseTag = beforePosition.lastIndexOf('</w:t>');
        
        return lastOpenTag > lastCloseTag;
    }

    private highlightJinja2Syntax(xml: string): string {
        console.log('Starting Jinja2 syntax highlighting pass');
        
        let result = xml;
        
        // First, highlight Jinja2 variables {{ variable }}
        result = this.highlightJinja2Variables(result);
        
        // Then, highlight Jinja2 control structures {% if/for/... %}
        result = this.highlightJinja2ControlStructures(result);
        
        console.log('Jinja2 syntax highlighting completed');
        return result;
    }

    private highlightJinja2Variables(xml: string): string {
        console.log('Applying Jinja2 variable highlighting...');
        
        // FIXED: Strategy: Replace entire <w:t> elements that contain Jinja2 variables
        // with properly structured highlighting runs, ensuring balanced XML structure
        const textElementRegex = /<w:t([^>]*)>([^<]*\{\{[^}]+\}\}[^<]*)<\/w:t>/g;
        
        return xml.replace(textElementRegex, (match, attributes, textContent) => {
            console.log(`Processing text with Jinja2 variables: "${textContent}"`);
            
            // Build properly balanced runs
            const runs = [];
            let lastIndex = 0;
            
            // Find all Jinja2 variables in this text element
            const variableRegex = /\{\{([^}]*)\}\}/g;
            let varMatch;
            
            while ((varMatch = variableRegex.exec(textContent)) !== null) {
                // Add text before the variable as a normal run
                if (varMatch.index > lastIndex) {
                    const beforeText = textContent.substring(lastIndex, varMatch.index);
                    if (beforeText) {
                        runs.push(`<w:r><w:t${attributes}>${this.escapeXml(beforeText)}</w:t></w:r>`);
                    }
                }
                
                // Add the variable with highlighting, preserving spaces
                const variableContent = varMatch[1]; // content inside {{ }} with original spacing
                const trimmedContent = variableContent.trim();
                const leadingSpace = variableContent.match(/^\s*/)[0];
                const trailingSpace = variableContent.match(/\s*$/)[0];
                
                // Create three separate runs for: {{space, highlighted content, space}}
                if (leadingSpace) {
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml('{{' + leadingSpace)}</w:t></w:r>`);
                    runs.push(`<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>${this.escapeXml(trimmedContent)}</w:t></w:r>`);
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml(trailingSpace + '}}')}</w:t></w:r>`);
                } else {
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml('{{')}</w:t></w:r>`);
                    runs.push(`<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>${this.escapeXml(trimmedContent)}</w:t></w:r>`);
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml(trailingSpace + '}}')}</w:t></w:r>`);
                }
                
                lastIndex = varMatch.index + varMatch[0].length;
            }
            
            // Add any remaining text after the last variable
            if (lastIndex < textContent.length) {
                const afterText = textContent.substring(lastIndex);
                if (afterText) {
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml(afterText)}</w:t></w:r>`);
                }
            }
            
            // Return all runs joined together - they're all properly balanced
            return runs.join('');
        });
    }

    private highlightJinja2ControlStructures(xml: string): string {
        console.log('Applying Jinja2 control structure highlighting...');
        
        // FIXED: Strategy: Replace entire <w:t> elements that contain Jinja2 control structures
        // with properly structured highlighting runs, ensuring balanced XML structure
        const textElementRegex = /<w:t([^>]*)>([^<]*\{%[^%]+%\}[^<]*)<\/w:t>/g;
        
        return xml.replace(textElementRegex, (match, attributes, textContent) => {
            console.log(`Processing text with Jinja2 control structures: "${textContent}"`);
            
            // Build properly balanced runs
            const runs = [];
            let lastIndex = 0;
            
            // Find all Jinja2 control structures in this text element
            const controlRegex = /\{%([^%]*?)%\}/g;
            let ctrlMatch;
            
            while ((ctrlMatch = controlRegex.exec(textContent)) !== null) {
                // Add text before the control structure as a normal run
                if (ctrlMatch.index > lastIndex) {
                    const beforeText = textContent.substring(lastIndex, ctrlMatch.index);
                    if (beforeText) {
                        runs.push(`<w:r><w:t${attributes}>${this.escapeXml(beforeText)}</w:t></w:r>`);
                    }
                }
                
                // Add the control structure with highlighting, preserving spaces
                const controlContent = ctrlMatch[1]; // content inside {% %} with original spacing
                const trimmedContent = controlContent.trim();
                const leadingSpace = controlContent.match(/^\s*/)[0];
                const trailingSpace = controlContent.match(/\s*$/)[0];
                
                // Create three separate runs for: {%space, highlighted content, space%}
                if (leadingSpace) {
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml('{%' + leadingSpace)}</w:t></w:r>`);
                    runs.push(`<w:r><w:rPr><w:highlight w:val="cyan"/></w:rPr><w:t>${this.escapeXml(trimmedContent)}</w:t></w:r>`);
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml(trailingSpace + '%}')}</w:t></w:r>`);
                } else {
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml('{%')}</w:t></w:r>`);
                    runs.push(`<w:r><w:rPr><w:highlight w:val="cyan"/></w:rPr><w:t>${this.escapeXml(trimmedContent)}</w:t></w:r>`);
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml(trailingSpace + '%}')}</w:t></w:r>`);
                }
                
                lastIndex = ctrlMatch.index + ctrlMatch[0].length;
            }
            
            // Add any remaining text after the last control structure
            if (lastIndex < textContent.length) {
                const afterText = textContent.substring(lastIndex);
                if (afterText) {
                    runs.push(`<w:r><w:t${attributes}>${this.escapeXml(afterText)}</w:t></w:r>`);
                }
            }
            
            // Return all runs joined together - they're all properly balanced
            return runs.join('');
        });
    }
    
    private escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    private countOccurrences(text: string, searchString: string): number {
        if (!searchString || searchString.length === 0) {
            return 0;
        }
        
        // Special handling for tab characters - count <w:tab/> elements in XML
        if (searchString === '\t') {
            const tabElements = text.match(/<w:tab[^>]*\/?>/g);
            const literalTabs = text.match(/\t/g);
            const totalTabs = (tabElements ? tabElements.length : 0) + (literalTabs ? literalTabs.length : 0);
            console.log(`Counting tabs: ${tabElements ? tabElements.length : 0} <w:tab> elements + ${literalTabs ? literalTabs.length : 0} literal tabs = ${totalTabs} total`);
            return totalTabs;
        }
        
        const regex = new RegExp(this.escapeRegex(searchString), 'g');
        const matches = text.match(regex);
        return matches ? matches.length : 0;
    }
    
    private isValidXml(xml: string): boolean {
        try {
            // Basic XML validation: check for balanced tags and no malformed content
            
            // Check for basic XML structure issues
            if (xml.includes('<>') || xml.includes('</>')) {
                console.error('XML contains empty tags');
                return false;
            }
            
            // Check for unclosed/malformed tags (basic check)
            const tagStack: string[] = [];
            const tagRegex = /<\/?([a-zA-Z:][a-zA-Z0-9:._-]*)[^>]*>/g;
            let match;
            
            while ((match = tagRegex.exec(xml)) !== null) {
                const fullTag = match[0];
                const tagName = match[1];
                
                // Skip self-closing tags and processing instructions
                if (fullTag.endsWith('/>') || fullTag.startsWith('<?') || fullTag.startsWith('<!')) {
                    continue;
                }
                
                if (fullTag.startsWith('</')) {
                    // Closing tag
                    const expectedTag = tagStack.pop();
                    if (expectedTag !== tagName) {
                        console.error(`XML tag mismatch: expected </${expectedTag}> but found </${tagName}>`);
                        return false;
                    }
                } else {
                    // Opening tag
                    tagStack.push(tagName);
                }
            }
            
            if (tagStack.length > 0) {
                console.error(`XML has unclosed tags: ${tagStack.join(', ')}`);
                return false;
            }
            
            // Check for common XML corruption patterns
            if (xml.includes('<<') || xml.includes('>>')) {
                console.error('XML contains doubled angle brackets');
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('Error validating XML:', error);
            return false;
        }
    }
}

// Export a singleton instance
export const docxProcessor = new DocxTextReplacer();