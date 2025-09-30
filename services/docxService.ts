import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export const createDocxWithDocxLibrary = async (htmlContent: string, filename: string) => {
    try {
        console.log('Creating DOCX with docx library...');
        
        // Convert HTML to plain text and preserve Jinja2 variables
        const textContent = htmlContent
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, ''); // Remove HTML tags
        
        // Split into paragraphs
        const paragraphs = textContent.split('\n\n').filter(p => p.trim());
        
        // Create document paragraphs
        const docParagraphs = paragraphs.map(text => {
            // Check if the paragraph contains Jinja2 variables
            const hasJinjaVars = text.includes('{{') && text.includes('}}');
            
            if (hasJinjaVars) {
                // Split text around Jinja2 variables and create runs
                const parts = text.split(/({{[^}]+}})/);
                const runs = parts.map(part => {
                    if (part.match(/{{[^}]+}}/)) {
                        // This is a Jinja2 variable - make it bold and colored
                        return new TextRun({
                            text: part,
                            bold: true,
                            color: "0066CC"
                        });
                    } else {
                        return new TextRun({
                            text: part
                        });
                    }
                });
                
                return new Paragraph({
                    children: runs
                });
            } else {
                return new Paragraph({
                    children: [new TextRun(text)]
                });
            }
        });
        
        // Create the document
        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: docParagraphs
                }
            ]
        });
        
        // Generate and save the document
        const buffer = await Packer.toBuffer(doc);
        const uint8Array = new Uint8Array(buffer);
        const blob = new Blob([uint8Array], { 
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        
        saveAs(blob, filename);
        console.log('DOCX created and download triggered successfully');
        return true;
        
    } catch (error) {
        console.error('Error creating DOCX with docx library:', error);
        throw error;
    }
};