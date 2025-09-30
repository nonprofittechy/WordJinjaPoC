import React, { useState } from 'react';

interface CreateLabelModalProps {
    isOpen: boolean;
    selectedText: string;
    onClose: () => void;
    onCreate: (original: string, replacement: string, context: string) => void;
}

export const CreateLabelModal: React.FC<CreateLabelModalProps> = ({ 
    isOpen, 
    selectedText, 
    onClose, 
    onCreate 
}) => {
    const [replacement, setReplacement] = useState('');
    const [context, setContext] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (replacement.trim() && selectedText.trim()) {
            onCreate(selectedText, replacement.trim(), context.trim() || `...${selectedText}...`);
            setReplacement('');
            setContext('');
            onClose();
        }
    };

    const handleClose = () => {
        setReplacement('');
        setContext('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Create Custom Label</h3>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Selected Text:
                        </label>
                        <div className="bg-gray-700 p-3 rounded-md text-red-400 font-mono text-sm border">
                            "{selectedText}"
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <label htmlFor="replacement" className="block text-sm font-medium text-gray-300 mb-2">
                            Jinja2 Label: <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            id="replacement"
                            value={replacement}
                            onChange={(e) => setReplacement(e.target.value)}
                            placeholder="e.g., {{ client_name }} or {{ signature_date }}"
                            className="w-full bg-gray-700 text-green-300 font-mono text-sm p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            autoFocus
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Use Docassemble conventions like: users[0].name.full(), signature_date, etc.
                        </p>
                    </div>
                    
                    <div className="mb-6">
                        <label htmlFor="context" className="block text-sm font-medium text-gray-300 mb-2">
                            Context (optional):
                        </label>
                        <input
                            type="text"
                            id="context"
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="Surrounding text for context"
                            className="w-full bg-gray-700 text-gray-300 text-sm p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                    
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!replacement.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors"
                        >
                            Create Label
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};