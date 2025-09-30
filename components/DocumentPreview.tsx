import React, { useRef } from 'react';

interface DocumentPreviewProps {
    htmlContent: string;
    hasContent: boolean;
    onTextSelected?: (selectedText: string) => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ 
    htmlContent, 
    hasContent, 
    onTextSelected 
}) => {
    const previewRef = useRef<HTMLDivElement>(null);

    const handleMouseUp = () => {
        if (!onTextSelected) return;
        
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            const selectedText = selection.toString().trim();
            // Only trigger for selections longer than 2 characters to avoid accidental selections
            if (selectedText.length > 2) {
                onTextSelected(selectedText);
            }
        }
    };
    return (
        <div className="h-full w-full overflow-y-auto">
            {hasContent ? (
                <>
                    <div className="bg-amber-800/30 border border-amber-600 text-amber-200 p-3 m-4 rounded-md text-sm">
                        <strong>Preview Note:</strong> This is a simplified HTML preview. The downloaded DOCX will preserve all original formatting, styles, tables, and images.
                    </div>
                    <div className="bg-blue-800/30 border border-blue-600 text-blue-200 p-3 mx-4 mb-4 rounded-md text-sm">
                        <strong>💡 Tip:</strong> Select any text in the preview to create a custom Jinja2 label for content the AI may have missed.
                    </div>
                    <div
                        ref={previewRef}
                        className="p-8 prose prose-invert max-w-none docx-preview select-text"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                        onMouseUp={handleMouseUp}
                        style={{ userSelect: 'text' }}
                    />
                </>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Upload a DOCX file to see the preview here.</p>
                </div>
            )}
        </div>
    );
};
