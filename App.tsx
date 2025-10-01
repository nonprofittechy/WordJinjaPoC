import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { DocumentPreview } from './components/DocumentPreview';
import { SuggestionsList } from './components/SuggestionsList';
import { Loader } from './components/Loader';
import { CreateLabelModal } from './components/CreateLabelModal';
import { generateJinjaLabels } from './services/geminiService';
import { docxProcessor } from './services/docxProcessor';
import { Suggestion, SuggestionStatus } from './types';
import mammoth from 'mammoth';

const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [originalHtml, setOriginalHtml] = useState<string>('');
    const [modifiedHtml, setModifiedHtml] = useState<string>('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [error, setError] = useState<string>('');
    const [selectedText, setSelectedText] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const resetState = () => {
        setFile(null);
        setIsLoading(false);
        setLoadingMessage('');
        setOriginalHtml('');
        setModifiedHtml('');
        setSuggestions([]);
        setError('');
        setSelectedText('');
        setIsModalOpen(false);
    };
    
    const processDocument = useCallback(async (selectedFile: File) => {
        if (!selectedFile) return;
        
        resetState();
        setFile(selectedFile);
        setIsLoading(true);
        setError('');

        try {
            setLoadingMessage('Reading document...');
            const arrayBuffer = await selectedFile.arrayBuffer();
            
            const mammothResult = await mammoth.convertToHtml({ arrayBuffer });
            setOriginalHtml(mammothResult.value);

            setLoadingMessage('Extracting text for analysis...');
            const textResult = await mammoth.extractRawText({ arrayBuffer });

            setLoadingMessage('Generating AI suggestions...');
            console.log('Calling generateJinjaLabels with text length:', textResult.value.length);
            
            const aiSuggestions = await generateJinjaLabels(textResult.value);
            console.log('Received AI suggestions:', {
                count: aiSuggestions?.length || 0,
                suggestions: aiSuggestions
            });

            const suggestionsWithIds: Suggestion[] = aiSuggestions.map(s => ({
                id: crypto.randomUUID(),
                context: s.context,
                original: s.original,
                replacement: s.replacement,
                status: SuggestionStatus.Pending,
            }));

            console.log('Setting suggestions with IDs:', suggestionsWithIds);
            setSuggestions(suggestionsWithIds);

        } catch (err) {
            console.error('Error in processDocument:', err);
            console.error('Error details:', {
                message: err instanceof Error ? err.message : 'Unknown error',
                stack: err instanceof Error ? err.stack : 'No stack trace'
            });
            setError(err instanceof Error ? `An error occurred: ${err.message}` : 'An unknown error occurred.');
        } finally {
            console.log('processDocument finally block - setting loading to false');
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, []);

    useEffect(() => {
        if (!originalHtml) {
            setModifiedHtml('');
            return;
        }

        const replacements = new Map<string, string>();
        const activeSuggestions = suggestions.filter(s => s.status !== SuggestionStatus.Rejected);

        activeSuggestions.forEach(s => {
            const className = s.status === SuggestionStatus.Accepted ? 'suggestion-highlight' : 'suggestion-pending-highlight';
            const highlightedReplacement = `<span class="${className}">${s.replacement}</span>`;
            replacements.set(s.original, highlightedReplacement);
        });

        if (replacements.size === 0) {
            setModifiedHtml(originalHtml);
            return;
        }

        const originals = Array.from(replacements.keys());
        const escapedOriginals = originals.map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(escapedOriginals.join('|'), 'g');
        
        const newHtml = originalHtml.replace(regex, (matched) => replacements.get(matched) || matched);

        setModifiedHtml(newHtml);
    }, [suggestions, originalHtml]);


    const handleSuggestionUpdate = (updatedSuggestion: Suggestion) => {
        setSuggestions(currentSuggestions => 
            currentSuggestions.map(s => s.id === updatedSuggestion.id ? updatedSuggestion : s)
        );
    };

    const handleAcceptAll = useCallback(() => {
        setSuggestions(currentSuggestions =>
            currentSuggestions.map(s =>
                s.status === SuggestionStatus.Pending ? { ...s, status: SuggestionStatus.Accepted } : s
            )
        );
    }, []);

    const handleTextSelection = useCallback((text: string) => {
        // Check if this text is already in suggestions
        const existingSuggestion = suggestions.find(s => s.original === text);
        if (existingSuggestion) {
            // Text is already a suggestion, don't create another one
            return;
        }
        
        setSelectedText(text);
        setIsModalOpen(true);
    }, [suggestions]);

    const handleCreateLabel = useCallback((original: string, replacement: string, context: string) => {
        const newSuggestion: Suggestion = {
            id: crypto.randomUUID(),
            context: context,
            original: original,
            replacement: replacement,
            status: SuggestionStatus.Pending,
        };

        setSuggestions(currentSuggestions => [...currentSuggestions, newSuggestion]);
        
        // Clear the text selection
        if (window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedText('');
        
        // Clear the text selection
        if (window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
    }, []);

    const handleDownload = async () => {
        if (!file || !originalHtml) {
            setError('No document loaded. Please upload a DOCX file first.');
            return;
        }

        const acceptedSuggestions = suggestions.filter(s => s.status === SuggestionStatus.Accepted);
        if (acceptedSuggestions.length === 0) {
            alert("No suggestions have been accepted. The downloaded file will be identical to the original.");
        }

        const filename = `${file.name.replace(/\.docx$/, '')}-labeled.docx`;
        
        try {
            console.log('Starting DOCX processing with original file preservation...');
            console.log('Original file:', file.name, 'Size:', file.size);
            console.log('Accepted suggestions:', acceptedSuggestions.length);
            
            // Use the new DOCX processor that preserves formatting
            const modifiedDocx = await docxProcessor.processOriginalDocx(file, acceptedSuggestions);
            
            console.log('Modified DOCX created, size:', modifiedDocx.size);
            
            // Download the modified DOCX
            const link = document.createElement('a');
            const url = URL.createObjectURL(modifiedDocx);
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the URL object
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log('Download triggered successfully');
            
            // Clear any previous errors
            setError('');
            
        } catch (e) {
            console.error('DOCX processing failed:', e);
            console.error('Error details:', {
                message: e instanceof Error ? e.message : 'Unknown error',
                stack: e instanceof Error ? e.stack : 'No stack trace',
                type: typeof e
            });
            
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            let userFriendlyMessage = 'Could not process the original DOCX file. ';
            
            if (errorMessage.includes('invalid XML structure')) {
                userFriendlyMessage += 'The selected text spans across formatting boundaries. Try selecting smaller, continuous text portions or use the AI-suggested labels instead.';
            } else if (errorMessage.includes('document.xml')) {
                userFriendlyMessage += 'The DOCX file structure is not supported or may be corrupted.';
            } else if (errorMessage.includes('ZIP') || errorMessage.includes('zip')) {
                userFriendlyMessage += 'Could not read the DOCX file format. Please ensure it is a valid Word document.';
            } else if (errorMessage.includes('processing')) {
                userFriendlyMessage += 'Error applying text replacements to the document.';
            } else {
                userFriendlyMessage += `Error: ${errorMessage}`;
            }
            
            setError(userFriendlyMessage);
        }
    };
    
    const hasSuggestions = suggestions.length > 0;
    const hasAcceptedSuggestions = suggestions.some(s => s.status === SuggestionStatus.Accepted);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col">
            <Header />
            <main className="flex-grow p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
                    <FileUpload onFileSelect={processDocument} disabled={isLoading} />
                    {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-md">{error}</div>}
                    {isLoading ? (
                        <Loader message={loadingMessage} />
                    ) : (
                        <>
                            {/* Debug info */}
                            <div className="bg-gray-700 p-2 rounded text-xs text-gray-300">
                                Debug: {suggestions.length} suggestions loaded, hasSuggestions: {hasSuggestions.toString()}
                            </div>
                            
                            {hasSuggestions ? (
                                <>
                                    <SuggestionsList suggestions={suggestions} onUpdate={handleSuggestionUpdate} onAcceptAll={handleAcceptAll} />
                                    <button
                                        onClick={handleDownload}
                                        disabled={!hasAcceptedSuggestions}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                                    >
                                        Download Modified DOCX
                                    </button>
                                </>
                            ) : (
                                originalHtml && (
                                    <div className="bg-gray-700 p-4 rounded text-gray-300 text-center">
                                        Document loaded but no suggestions generated.
                                        <br />
                                        <small>Try selecting text in the preview to create manual labels.</small>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>
                <div className="lg:col-span-8 xl:col-span-9 bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
                    <DocumentPreview 
                        htmlContent={modifiedHtml || originalHtml} 
                        hasContent={!!(originalHtml)}
                        onTextSelected={handleTextSelection}
                    />
                </div>
            </main>
            
            <CreateLabelModal
                isOpen={isModalOpen}
                selectedText={selectedText}
                onClose={handleCloseModal}
                onCreate={handleCreateLabel}
            />
        </div>
    );
};

export default App;