// Test DOCX processing functionality
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the DOCX processor - for now let's just test basic file operations

async function testDocxProcessing() {
    console.log('Testing basic DOCX file operations...');
    
    try {
        // Check if sample files exist
        const sampleFilePath = path.join(__dirname, '..', 'sample_files', 'sample_security_deposit_letter.docx');
        
        if (!fs.existsSync(sampleFilePath)) {
            console.error('Sample file not found:', sampleFilePath);
            console.log('Available files in sample_files:');
            const files = fs.readdirSync(path.join(__dirname, '..', 'sample_files'));
            files.forEach(file => console.log(' -', file));
            return;
        }
        
        console.log('Sample file found:', sampleFilePath);
        const fileBuffer = fs.readFileSync(sampleFilePath);
        console.log('File size:', fileBuffer.length, 'bytes');
        
        // Test basic JSZip functionality
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(fileBuffer);
        
        console.log('ZIP loaded successfully');
        console.log('Files in ZIP:');
        Object.keys(zip.files).forEach(filename => {
            console.log(' -', filename);
        });
        
        // Check for document.xml
        const documentXml = zip.file('word/document.xml');
        if (documentXml) {
            const xmlContent = await documentXml.async('text');
            console.log('document.xml found, length:', xmlContent.length);
            console.log('Sample XML (first 200 chars):', xmlContent.substring(0, 200));
        } else {
            console.error('document.xml not found in DOCX');
        }
        
        // Try to regenerate the ZIP
        const newBlob = await zip.generateAsync({
            type: 'arraybuffer',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        console.log('Successfully regenerated ZIP, size:', newBlob.byteLength, 'bytes');
        
        // Save test output
        const outputPath = path.join(__dirname, 'test-output.docx');
        fs.writeFileSync(outputPath, new Uint8Array(newBlob));
        console.log('Saved test output to:', outputPath);
        
    } catch (error) {
        console.error('Error during DOCX testing:', error);
        console.error('Error details:', error.message);
        console.error('Stack:', error.stack);
    }
}

testDocxProcessing();