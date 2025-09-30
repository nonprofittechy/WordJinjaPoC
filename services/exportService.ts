// Alternative export functions for Word documents
export const createRTFDocument = (htmlContent: string, filename: string) => {
    // Convert HTML to RTF format (Rich Text Format)
    // RTF can be opened by Word and supports basic formatting
    
    // Remove HTML tags and convert to RTF
    let rtfContent = htmlContent
        .replace(/<br\s*\/?>/gi, '\\line ')
        .replace(/<p[^>]*>/gi, '\\par ')
        .replace(/<\/p>/gi, '\\par ')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '{\\b $1}')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '{\\b $1}')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '{\\i $1}')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '{\\i $1}')
        .replace(/<u[^>]*>(.*?)<\/u>/gi, '{\\ul $1}')
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '{\\fs28\\b $1}\\par ')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '{\\fs24\\b $1}\\par ')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '{\\fs20\\b $1}\\par ')
        .replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
    
    // RTF document structure
    const rtfDoc = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
\\f0\\fs24 ${rtfContent}
}`;
    
    // Create blob and download
    const blob = new Blob([rtfDoc], { type: 'application/rtf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename.replace('.docx', '.rtf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
};

export const createSimpleDocx = async (htmlContent: string, filename: string) => {
    // Try using a simpler approach with XML
    const docxTemplate = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        <w:p>
            <w:r>
                <w:t>${htmlContent.replace(/<[^>]+>/g, '').substring(0, 1000)}</w:t>
            </w:r>
        </w:p>
    </w:body>
</w:document>`;

    const blob = new Blob([docxTemplate], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
};