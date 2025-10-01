// Test file to check html-to-docx functionality
import HTMLtoDOCX from 'html-to-docx';

const testHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Test Document</title>
</head>
<body>
    <p>This is a test document with <strong>bold text</strong> and <em>italic text</em>.</p>
    <p>Testing {{ variable_replacement }} functionality.</p>
</body>
</html>
`;

console.log('Testing html-to-docx conversion...');

try {
    const blob = await HTMLtoDOCX(testHtml);
    console.log('Success! Blob created:', blob.size, 'bytes');
    console.log('Blob type:', blob.type);
} catch (error) {
    console.error('Error during conversion:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
}