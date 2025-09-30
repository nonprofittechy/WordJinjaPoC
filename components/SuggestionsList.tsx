import React from 'react';
import { Suggestion, SuggestionStatus } from '../types';
import { SuggestionItem } from './SuggestionItem';

interface SuggestionsListProps {
    suggestions: Suggestion[];
    onUpdate: (suggestion: Suggestion) => void;
    onAcceptAll: () => void;
}

export const SuggestionsList: React.FC<SuggestionsListProps> = ({ suggestions, onUpdate, onAcceptAll }) => {
    const hasPending = suggestions.some(s => s.status === SuggestionStatus.Pending);
    
    return (
        <div className="bg-gray-800 rounded-lg p-4 flex-grow overflow-y-auto flex flex-col gap-3 max-h-[60vh]">
             <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold text-white">AI Suggestions</h2>
                {hasPending && (
                    <button 
                        onClick={onAcceptAll}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition-colors"
                    >
                        Accept All
                    </button>
                )}
            </div>
            {suggestions.map(suggestion => (
                <SuggestionItem key={suggestion.id} suggestion={suggestion} onUpdate={onUpdate} />
            ))}
        </div>
    );
};