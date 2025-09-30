import React from 'react';

interface DocumentPreviewProps {
    htmlContent: string;
    hasContent: boolean;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ htmlContent, hasContent }) => {
    return (
        <div className="h-full w-full overflow-y-auto">
            {hasContent ? (
                <div
                    className="p-8 prose prose-invert max-w-none docx-preview"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
            ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Upload a DOCX file to see the preview here.</p>
                </div>
            )}
        </div>
    );
};
