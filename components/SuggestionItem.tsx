import React, { useState, useEffect } from 'react';
import { Suggestion, SuggestionStatus } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { EditIcon } from './icons/EditIcon';


interface SuggestionItemProps {
    suggestion: Suggestion;
    onUpdate: (suggestion: Suggestion) => void;
}

export const SuggestionItem: React.FC<SuggestionItemProps> = ({ suggestion, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedReplacement, setEditedReplacement] = useState(suggestion.replacement);

    useEffect(() => {
        setEditedReplacement(suggestion.replacement);
    }, [suggestion.replacement]);
    
    const handleAccept = () => {
        if (isEditing) {
            onUpdate({ ...suggestion, replacement: editedReplacement, status: SuggestionStatus.Accepted });
            setIsEditing(false);
        } else {
            onUpdate({ ...suggestion, status: SuggestionStatus.Accepted });
        }
    };

    const handleReject = () => {
        onUpdate({ ...suggestion, status: SuggestionStatus.Rejected });
        setIsEditing(false);
    };

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
    };

    const isPending = suggestion.status === SuggestionStatus.Pending;
    const isAccepted = suggestion.status === SuggestionStatus.Accepted;
    const isRejected = suggestion.status === SuggestionStatus.Rejected;

    const getBorderColor = () => {
        if (isAccepted) return 'border-green-500';
        if (isRejected) return 'border-red-500';
        return 'border-gray-700';
    };

    return (
        <div className={`bg-gray-900/50 p-3 rounded-lg border ${getBorderColor()} transition-all duration-200 ${isRejected ? 'opacity-50' : ''}`}>
            <p className="text-xs text-gray-400 italic mb-2 truncate">"...{suggestion.context}..."</p>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-red-400 text-sm line-through flex-shrink-0">{suggestion.original}</span>
                    <span className="text-gray-400 text-sm">→</span>
                    {isEditing ? (
                        <input
                            type="text"
                            value={editedReplacement}
                            onChange={(e) => setEditedReplacement(e.target.value)}
                            className="bg-gray-700 text-green-300 font-mono text-sm p-1 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            autoFocus
                        />
                    ) : (
                        <span className="text-green-300 font-mono text-sm bg-gray-700 px-2 py-1 rounded-md break-all">{suggestion.replacement}</span>
                    )}
                </div>
                {!isRejected && (
                    <div className="flex items-center justify-end gap-2 mt-2">
                        {isPending && (
                            <>
                                <button onClick={handleEditToggle} className="p-1 text-gray-400 hover:text-white"><EditIcon className="w-4 h-4" /></button>
                                <button onClick={handleReject} className="p-1 text-red-400 hover:text-red-300"><XIcon className="w-5 h-5" /></button>
                            </>
                        )}
                        <button 
                            onClick={handleAccept} 
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${isAccepted ? 'bg-green-800 text-green-200 cursor-default' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                        >
                            <div className="flex items-center gap-1">
                                <CheckIcon className="w-4 h-4"/>
                                <span>{isEditing ? 'Save & Accept' : (isAccepted ? 'Accepted' : 'Accept')}</span>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};