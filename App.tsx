import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { DocumentPreview } from './components/DocumentPreview';
import { SuggestionsList } from './components/SuggestionsList';
import { Loader } from './components/Loader';
import { CreateLabelModal } from './components/CreateLabelModal';
import { CustomizePromptModal } from './components/CustomizePromptModal';
import { SettingsIcon } from './components/icons/SettingsIcon'
import RefreshIcon from './components/icons/RefreshIcon'
import { generateJinjaLabels } from './services/geminiService';
import { docxProcessor } from './services/docxProcessor';
import { getDefaultSystemPrompt } from './utils/promptClientUtils.js';
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
    const [isPromptModalOpen, setIsPromptModalOpen] = useState<boolean>(false);
    const [customPrompt, setCustomPrompt] = useState<string>('');
    const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
    const [promptLoading, setPromptLoading] = useState<boolean>(true);

    // Initialize default prompt on component mount
    useEffect(() => {
        const loadDefaultPrompt = async () => {
            setPromptLoading(true);
            try {
                const systemPrompt = await getDefaultSystemPrompt();
                if (systemPrompt) {
                    setCustomPrompt(systemPrompt);
                } else {
                    // Fallback to hardcoded prompt if JSON loading fails
                    const fallbackPrompt = `You are an expert legal tech assistant. Your task is to process a text document and identify placeholders, turning it into a Jinja2 template. You will return a JSON structure that specifies the modifications.

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
the recipient of a letter, etc.`;
                    setCustomPrompt(fallbackPrompt);
                }
            } catch (error) {
                console.error('Failed to load default prompt from JSON:', error);
                // Use fallback prompt
                const fallbackPrompt = `You are an expert legal tech assistant. Your task is to process a text document and identify placeholders, turning it into a Jinja2 template. You will return a JSON structure that specifies the modifications.

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
the recipient of a letter, etc.`;
                setCustomPrompt(fallbackPrompt);
            } finally {
                setPromptLoading(false);
            }
        };

        loadDefaultPrompt();
    }, []);

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
            
            const aiSuggestions = await generateJinjaLabels(textResult.value, customPrompt, additionalInstructions);
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

        const activeSuggestions = suggestions.filter(s => s.status !== SuggestionStatus.Rejected);

        if (activeSuggestions.length === 0) {
            setModifiedHtml(originalHtml);
            return;
        }

        // Simple approach: replace first occurrence of each suggestion, allowing duplicates
        let modifiedHtml = originalHtml;

        // Sort by length (longest first) to avoid partial replacements
        const sortedSuggestions = activeSuggestions.sort((a, b) => b.original.length - a.original.length);
        
        sortedSuggestions.forEach(suggestion => {
            const className = suggestion.status === SuggestionStatus.Accepted ? 'suggestion-highlight' : 'suggestion-pending-highlight';
            const highlightedReplacement = `<span class="${className}">${suggestion.replacement}</span>`;
            
            // Escape regex special characters for safe replacement
            const escapedOriginal = suggestion.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedOriginal);
            
            // Replace first occurrence of this original text
            if (regex.test(modifiedHtml)) {
                modifiedHtml = modifiedHtml.replace(regex, highlightedReplacement);
            }
        });

        setModifiedHtml(modifiedHtml);
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

    const handleCustomizePrompt = useCallback(() => {
        setIsPromptModalOpen(true);
    }, []);

    const handlePromptSave = useCallback((newPrompt: string, newAdditionalInstructions: string) => {
        setCustomPrompt(newPrompt);
        setAdditionalInstructions(newAdditionalInstructions);
        console.log('Prompt updated:', { promptLength: newPrompt.length, hasAdditionalInstructions: !!newAdditionalInstructions });
    }, []);

    const handleRegenerateSuggestions = useCallback(async () => {
        if (!file || !originalHtml) {
            setError('No document loaded. Please upload a DOCX file first.');
            return;
        }

        try {
            setIsLoading(true);
            setError('');
            setLoadingMessage('Re-generating AI suggestions with custom prompt...');

            // Extract text from the original HTML again
            const textResult = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            console.log('Re-generating with text length:', textResult.value.length);
            
            const aiSuggestions = await generateJinjaLabels(textResult.value, customPrompt, additionalInstructions);
            console.log('Received new AI suggestions:', {
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

            setSuggestions(suggestionsWithIds);
            setLoadingMessage('');

        } catch (err) {
            console.error('Error regenerating suggestions:', err);
            setError(err instanceof Error ? `Failed to regenerate suggestions: ${err.message}` : 'Failed to regenerate suggestions.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [file, originalHtml, customPrompt, additionalInstructions]);

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
                    {/* AI Prompt Configuration Section - Always Visible */}
                    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-300">AI Prompt Configuration</h3>
                            <button
                                onClick={handleCustomizePrompt}
                                disabled={promptLoading}
                                className="px-3 py-1 text-xs font-medium bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-300 hover:text-white disabled:text-gray-500 border border-gray-600 hover:border-gray-500 disabled:border-gray-700 rounded transition-all duration-200"
                            >
                                <SettingsIcon className="w-3 h-3 inline mr-1" />
                                Customize
                            </button>
                        </div>
                        <div className="text-xs text-gray-400">
                            {promptLoading ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-2"></div>
                                    Loading prompt configuration...
                                </div>
                            ) : (
                                <>
                                    <div className="mb-2">
                                        <span className="font-medium">Prompt:</span>{' '}
                                        {customPrompt.length > 100 
                                            ? `${customPrompt.substring(0, 100)}...` 
                                            : customPrompt || 'Default prompt loaded'
                                        }
                                    </div>
                                    {additionalInstructions && (
                                        <div>
                                            <span className="font-medium">Additional Instructions:</span>{' '}
                                            {additionalInstructions.length > 50 
                                                ? `${additionalInstructions.substring(0, 50)}...` 
                                                : additionalInstructions
                                            }
                                        </div>
                                    )}
                                    {!additionalInstructions && (
                                        <div className="text-gray-500">
                                            No additional instructions set
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <FileUpload onFileSelect={processDocument} disabled={isLoading} />
                    {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-md">{error}</div>}
                    {isLoading ? (
                        <Loader message={loadingMessage} />
                    ) : (
                        <>
                            {hasSuggestions ? (
                                <>
                                    <div className="flex justify-end gap-1 mb-4">
                                        <button
                                            onClick={handleRegenerateSuggestions}
                                            disabled={isLoading}
                                            title={isLoading ? 'Regenerating suggestions...' : 'Regenerate suggestions with current prompt'}
                                            className="p-2 bg-gray-700/50 hover:bg-gray-600 disabled:bg-gray-800/50 disabled:cursor-not-allowed text-gray-400 hover:text-white disabled:text-gray-500 border border-gray-600 hover:border-gray-500 disabled:border-gray-700 rounded transition-all duration-200"
                                        >
                                            <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
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
                    {!originalHtml && !isLoading ? (
                        <div className="flex flex-col items-center justify-center h-96 text-gray-400 p-8">
                            <div className="text-6xl mb-6">📄</div>
                            <h3 className="text-xl font-medium mb-4 text-gray-300">Ready to Convert Your Document</h3>
                            <div className="text-center space-y-2 max-w-md">
                                <p>Upload a DOCX file to automatically identify placeholders and convert them to Jinja2 template variables.</p>
                                <p className="text-sm">You can customize the AI prompt settings above before uploading your document.</p>
                            </div>
                        </div>
                    ) : (
                        <DocumentPreview 
                            htmlContent={modifiedHtml || originalHtml} 
                            hasContent={!!(originalHtml)}
                            onTextSelected={handleTextSelection}
                        />
                    )}
                </div>
            </main>
            
            <CreateLabelModal
                isOpen={isModalOpen}
                selectedText={selectedText}
                onClose={handleCloseModal}
                onCreate={handleCreateLabel}
            />
            
            <CustomizePromptModal
                isOpen={isPromptModalOpen}
                onClose={() => setIsPromptModalOpen(false)}
                onSave={handlePromptSave}
                currentPrompt={customPrompt}
                currentAdditionalInstructions={additionalInstructions}
            />
        </div>
    );
};

export default App;