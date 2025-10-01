import React, { useState, useEffect } from 'react';
import { XIcon } from './icons/XIcon';
import { getDefaultSystemPrompt } from '../utils/promptClientUtils.js';

interface CustomizePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (prompt: string, additionalInstructions: string) => void;
    currentPrompt: string;
    currentAdditionalInstructions: string;
}

export const CustomizePromptModal: React.FC<CustomizePromptModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentPrompt,
    currentAdditionalInstructions
}) => {
    const [prompt, setPrompt] = useState(currentPrompt);
    const [additionalInstructions, setAdditionalInstructions] = useState(currentAdditionalInstructions);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [defaultPrompt, setDefaultPrompt] = useState('');

    // Load default prompt from JSON file
    useEffect(() => {
        const loadDefaultPrompt = async () => {
            try {
                const defaultSystemPrompt = await getDefaultSystemPrompt();
                setDefaultPrompt(defaultSystemPrompt);
            } catch (error) {
                console.error('Failed to load default prompt:', error);
                // Fallback to hardcoded prompt if loading fails
                setDefaultPrompt(`You are an expert legal tech assistant. Your task is to process a text document and identify placeholders, turning it into a Jinja2 template. You will return a JSON structure that specifies the modifications.

## Instructions:
1.  **Analyze**: Read the document text and identify any placeholder text (e.g., "John Smith", "________", "[Client's Name]").
2.  **Label**: Replace these placeholders with appropriate Jinja2 variable names based on the provided conventions.
3.  **Contextualize**: For each replacement, provide a snippet of the surrounding text (the "context") to ensure the replacement is unique and understandable. The original placeholder must be part of the context.
4.  **Format**: Return the result as a JSON object containing a single key "results", which is an array of suggestion objects. Each object must have "context", "original" (the exact text to be replaced), and "replacement" (the new Jinja2 label).

## Variable Naming Rules:
-   Use Python snake_case for variable names.
-   Represent people in lists (e.g., \`users\`, \`clients\`, \`other_parties\`). Access individuals with an index (e.g., \`users[0]\`).
-   Use Docassemble object conventions:
    -   **Names**: \`users[0].name.full()\`, \`users[0].name.first\`, \`users[0].name.last\`.
    -   **Addresses**: \`users[0].address.block()\`, \`users[0].address.city\`, \`users[0].address.zip\`.
    -   **Contact**: \`users[0].phone_number\`, \`users[0].email\`.
    -   **Dates**: Use the \`_date\` suffix, e.g., \`signature_date\`.
-   Common list names: \`users\`, \`clients\`, \`plaintiffs\`, \`defendants\`, \`children\`, \`attorneys\`, \`witnesses\`.
-   For generic placeholders, create a descriptive variable name (e.g., "reason for eviction" becomes \`{{ eviction_reason }}\`).

Whenever you can guess the context of the user of the form, use the label "users" for the person who would use the form.
Then, use the label "other_parties" for the person who would be on the other side of the form - opposing party in a lawsuit,
the recipient of a letter, etc.`);
            }
        };
        
        loadDefaultPrompt();
    }, []);

    useEffect(() => {
        setPrompt(currentPrompt);
        setAdditionalInstructions(currentAdditionalInstructions);
        // Reset editing state when modal content changes
        setIsEditingPrompt(false);
    }, [currentPrompt, currentAdditionalInstructions]);

    const handleSave = () => {
        onSave(prompt, additionalInstructions);
        onClose();
    };

    const handleReset = () => {
        // Reset to default prompt loaded from JSON
        setPrompt(defaultPrompt);
        setAdditionalInstructions('');
        setIsEditingPrompt(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">Customize AI Prompt</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <XIcon />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="main-prompt" className="block text-sm font-medium text-gray-700">
                                    Main AI Prompt
                                </label>
                                <label className="flex items-center text-sm text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={isEditingPrompt}
                                        onChange={(e) => setIsEditingPrompt(e.target.checked)}
                                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    Edit default prompt
                                </label>
                            </div>
                            <textarea
                                id="main-prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={!isEditingPrompt}
                                className={`w-full h-64 px-3 py-2 border rounded-md shadow-sm font-mono text-sm transition-colors ${
                                    isEditingPrompt 
                                        ? 'border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                                        : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                                }`}
                                placeholder="Enter the main AI prompt instructions..."
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                This is the core prompt that instructs the AI how to identify and label placeholders.
                                {!isEditingPrompt && <span className="text-amber-600"> Check the box above to edit the default prompt.</span>}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="additional-instructions" className="block text-sm font-medium text-gray-700 mb-2">
                                Additional Instructions (Optional)
                            </label>
                            <textarea
                                id="additional-instructions"
                                value={additionalInstructions}
                                onChange={(e) => setAdditionalInstructions(e.target.value)}
                                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Add any specific instructions for this document..."
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Add document-specific instructions, like "Focus on dates" or "Use specific variable names for contracts".
                            </p>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-md">
                            <h3 className="text-sm font-medium text-blue-900 mb-2">Tips for Custom Instructions:</h3>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• Be specific about the type of document (contract, letter, form, etc.)</li>
                                <li>• Mention any specific variable naming conventions you need</li>
                                <li>• Indicate if you want to focus on particular types of placeholders</li>
                                <li>• Include examples of the format you want for specific fields</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Reset to Default
                    </button>
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};