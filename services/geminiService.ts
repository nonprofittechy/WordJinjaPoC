import { AISuggestion } from '../types';

export const generateJinjaLabels = async (
    documentText: string, 
    customPrompt?: string, 
    additionalInstructions?: string
): Promise<AISuggestion[]> => {
    try {
        console.log('Calling backend API to generate labels...');
        
        const response = await fetch('/api/generate-labels', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                documentText, 
                customPrompt,
                additionalInstructions
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Backend API error:', response.status, errorData);
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Backend API success:', data.results?.length || 0, 'suggestions received');
        
        if (data && data.results && Array.isArray(data.results)) {
            return data.results as AISuggestion[];
        }

        console.error('Invalid response format from backend:', data);
        throw new Error('Invalid response format from server');

    } catch (error) {
        console.error("Error calling backend API:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to get suggestions from the AI. Please try again.");
    }
};