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
            
            // Apply text replacements to the XML content
            let modifiedXml = documentXml;
            
            // First, extract plain text from XML to match against our suggestions
            const plainText = this.extractPlainTextFromXml(documentXml);
            console.log('Extracted plain text length:', plainText.length);
            
            console.log(`Processing ${acceptedSuggestions.length} suggestions`);
            
            acceptedSuggestions.forEach((suggestion, index) => {
                const displayOriginal = suggestion.original.replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                console.log(`Applying suggestion ${index + 1}:`, {
                    original: displayOriginal,
                    replacement: suggestion.replacement,
                    originalLength: suggestion.original.length,
                    isWhitespace: /^[\s\t\n\r]+$/.test(suggestion.original)
                });
                
                try {
                    const beforeLength = modifiedXml.length;
                    
                    // Use a safer replacement approach
                    modifiedXml = this.safeReplaceText(modifiedXml, suggestion.original, suggestion.replacement);
                    
                    const afterLength = modifiedXml.length;
                    const wasReplaced = afterLength !== beforeLength;
                    
                    // Check for runaway replacement (string grew too much)
                    if (afterLength > beforeLength * 2) {
                        console.error(`Replacement caused excessive growth, reverting. Before: ${beforeLength}, After: ${afterLength}`);
                        modifiedXml = documentXml; // Revert to original
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
        // Remove XML tags and extract text content
        return xml
            .replace(/<[^>]*>/g, '') // Remove all XML tags
            .replace(/&lt;/g, '<')   // Decode XML entities
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    }
    
    private replaceTextAcrossXmlTags(xml: string, searchText: string, replacement: string): string {
        // This is a more sophisticated approach that can handle text split across XML tags
        // Create a pattern that allows for XML tags between characters
        const characters = searchText.split('');
        const flexiblePattern = characters
            .map(char => this.escapeRegex(char))
            .join('(?:<[^>]*>)*\\s*'); // Allow XML tags and whitespace between characters
        
        const regex = new RegExp(flexiblePattern, 'gi');
        return xml.replace(regex, replacement);
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
    
    private safeReplaceText(xml: string, original: string, replacement: string): string {
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
                return this.replaceWhitespaceText(xml, original, escapedReplacement);
            }
            
            if (isSingleTab) {
                console.log(`Handling single tab replacement`);
                return this.replaceTabCharacter(xml, escapedReplacement);
            }
            
            // For regular text with non-whitespace characters, use standard replacement
            if (hasNonWhitespace) {
                return this.replaceRegularText(xml, original, escapedReplacement);
            }
            
            console.warn(`Unhandled replacement case for: "${original}"`);
            return xml;
            
        } catch (error) {
            console.error(`Error in safeReplaceText for "${original}":`, error);
            return xml; // Return original if replacement fails
        }
    }
    
    private replaceRegularText(xml: string, original: string, replacement: string): string {
        // Normalize the original text
        const normalizedOriginal = original.trim().replace(/\s+/g, ' ');
        
        // Try exact replacement first
        const exactRegex = new RegExp(this.escapeRegex(original), 'g');
        let result = xml.replace(exactRegex, replacement);
        
        // If that didn't work, try normalized version
        if (result === xml && normalizedOriginal !== original) {
            const normalizedRegex = new RegExp(this.escapeRegex(normalizedOriginal), 'g');
            result = xml.replace(normalizedRegex, replacement);
        }
        
        // Try context-aware replacement across XML tags
        if (result === xml) {
            result = this.replaceTextAcrossXmlTags(xml, original, replacement);
        }
        
        // Safety check: ensure we're not creating a runaway replacement
        if (result.length > xml.length * 1.5) {
            console.warn(`Replacement would cause excessive growth, skipping: "${original}"`);
            return xml;
        }
        
        return result;
    }
    
    private replaceWhitespaceText(xml: string, original: string, replacement: string): string {
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
            
            // Strategy 1: Look for <w:tab/> elements and replace them
            if (original === '\t') {
                console.log('Attempting to replace <w:tab/> elements...');
                const tabElementRegex = /<w:tab\s*\/>/g;
                const beforeTabReplace = result.length;
                
                // Wrap replacement text in proper DOCX text element
                const wrappedReplacement = `<w:t>${replacement}</w:t>`;
                
                result = result.replace(tabElementRegex, wrappedReplacement);
                const afterTabReplace = result.length;
                
                if (afterTabReplace !== beforeTabReplace) {
                    console.log(`✓ Successfully replaced ${(beforeTabReplace - afterTabReplace + wrappedReplacement.length) / wrappedReplacement.length} <w:tab/> elements with wrapped text`);
                    return result;
                }
                
                // Strategy 2: Look for tabs within <w:t> elements
                console.log('Attempting to replace tabs within <w:t> elements...');
                result = result.replace(/<w:t([^>]*)>([^<]*\t[^<]*)<\/w:t>/g, (match, attributes, textContent) => {
                    console.log(`Found tab in text element: "${textContent}"`);
                    const newContent = textContent.replace(/\t/g, replacement);
                    return `<w:t${attributes}>${newContent}</w:t>`;
                });
                
                if (result !== xml) {
                    console.log('✓ Successfully replaced tabs within <w:t> elements');
                    return result;
                }
                
                // Strategy 3: Look for tabs in any text content between tags
                console.log('Attempting to replace tabs in any text content...');
                result = result.replace(/>([^<]*)\t([^<]*)</g, (match, before, after) => {
                    console.log(`Found tab between: "${before}" and "${after}"`);
                    // If we're inside a <w:t> element, don't add extra wrapping
                    if (match.includes('<w:t')) {
                        return `>${before}${replacement}${after}<`;
                    } else {
                        // If not in a text element, wrap the replacement
                        return `>${before}<w:t>${replacement}</w:t>${after}<`;
                    }
                });
                
                if (result !== xml) {
                    console.log('✓ Successfully replaced tabs in text content');
                    return result;
                }
                
                // Strategy 4: Search for common tab patterns in DOCX
                console.log('Attempting to find tab patterns in XML...');
                
                // Look for patterns that might indicate tabs
                const tabPatterns = [
                    /<w:tab[^>]*\/>/g,  // Self-closing tab elements
                    /<w:tab[^>]*><\/w:tab>/g,  // Empty tab elements
                    /\t/g  // Literal tab characters anywhere
                ];
                
                for (const pattern of tabPatterns) {
                    const matches = xml.match(pattern);
                    if (matches) {
                        console.log(`Found ${matches.length} matches for pattern:`, pattern);
                        
                        // For <w:tab> elements, wrap replacement in <w:t>
                        if (pattern.toString().includes('w:tab')) {
                            result = xml.replace(pattern, `<w:t>${replacement}</w:t>`);
                        } else {
                            result = xml.replace(pattern, replacement);
                        }
                        
                        if (result !== xml) {
                            console.log('✓ Successfully replaced using pattern match');
                            return result;
                        }
                    }
                }
            }
            
            // For other whitespace characters, use the original approach
            let safePattern = original
                .replace(/\t/g, '\\t')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/ /g, '\\s');
            
            const whitespaceRegex = new RegExp(safePattern, 'g');
            result = xml.replace(whitespaceRegex, replacement);
            
            if (result === xml) {
                // Look for the whitespace pattern in text content between tags
                result = xml.replace(/>([^<]*)</g, (match, textContent) => {
                    if (textContent.includes(original)) {
                        const newContent = textContent.replace(new RegExp(this.escapeRegex(original), 'g'), replacement);
                        return `>${newContent}<`;
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
    
    private replaceTabCharacter(xml: string, replacement: string): string {
        try {
            // Tab characters in DOCX are often represented as XML entities or special elements
            // Look for actual tab characters first
            let result = xml.replace(/\t/g, replacement);
            
            // Also look for tab representations in DOCX XML
            // Tabs might be represented as <w:tab/> elements
            result = result.replace(/<w:tab\s*\/>/g, replacement);
            
            // Look for text content that contains tabs
            result = result.replace(/>([^<]*\t[^<]*)</g, (match, textContent) => {
                const newContent = textContent.replace(/\t/g, replacement);
                return `>${newContent}<`;
            });
            
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
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
    
    private escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Export a singleton instance
export const docxProcessor = new DocxTextReplacer();