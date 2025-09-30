import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files[0]);
        }
    };

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (disabled) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                onFileSelect(file);
            } else {
                alert("Please upload a valid .docx file.");
            }
        }
    }, [onFileSelect, disabled]);

    return (
        <div className="w-full">
            <label
                htmlFor="docx-upload"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg transition-colors duration-200 ${
                    disabled ? 'cursor-not-allowed bg-gray-800' : 'cursor-pointer hover:bg-gray-700'
                } ${
                    isDragging ? 'border-blue-400 bg-gray-700' : 'border-gray-600'
                }`}
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    <UploadIcon className={`w-10 h-10 mb-3 ${isDragging ? 'text-blue-400' : 'text-gray-400'}`} />
                    <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">DOCX file only</p>
                </div>
                <input
                    id="docx-upload"
                    type="file"
                    className="hidden"
                    accept=".docx"
                    onChange={handleFileChange}
                    disabled={disabled}
                />
            </label>
        </div>
    );
};
