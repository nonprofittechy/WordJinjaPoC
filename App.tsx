import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { DocumentPreview } from './components/DocumentPreview';
import { SuggestionsList } from './components/SuggestionsList';
import { Loader } from './components/Loader';
import { generateJinjaLabels } from './services/geminiService';
import { createRTFDocument } from './services/exportService';
import { createDocxWithDocxLibrary } from './services/docxService';
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

    const resetState = () => {
        setFile(null);
        setIsLoading(false);
        setLoadingMessage('');
        setOriginalHtml('');
        setModifiedHtml('');
        setSuggestions([]);
        setError('');
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
            const aiSuggestions = await generateJinjaLabels(textResult.value);

            const suggestionsWithIds: Suggestion[] = aiSuggestions.map(s => ({
                id: crypto.randomUUID(),
                context: s.context,
                original: s.original,
                replacement: s.replacement,
                status: SuggestionStatus.Pending,
            }));

            setSuggestions(suggestionsWithIds);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? `An error occurred: ${err.message}` : 'An unknown error occurred.');
        } finally {
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

    const handleDownload = async () => {
        if (!originalHtml) return;

        const acceptedSuggestions = suggestions.filter(s => s.status === SuggestionStatus.Accepted);
        if (acceptedSuggestions.length === 0) {
            alert("No suggestions have been accepted. The downloaded file will be identical to the original.");
        }
        
        const replacements = new Map<string, string>();
        acceptedSuggestions.forEach(s => {
            replacements.set(s.original, s.replacement);
        });
        
        let downloadHtml = originalHtml;
        if (replacements.size > 0) {
            const originals = Array.from(replacements.keys());
            const escapedOriginals = originals.map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const regex = new RegExp(escapedOriginals.join('|'), 'g');
            downloadHtml = originalHtml.replace(regex, (matched) => replacements.get(matched) || matched);
        }

        const filename = file ? `${file.name.replace(/\.docx$/, '')}-labeled.docx` : 'labeled-document.docx';
        
        const content = `
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="UTF-8">
            <title>Document</title>
            </head>
            <body>
                ${downloadHtml}
            </body>
            </html>
        `;

        try {
            console.log('Starting document export...');
            console.log('Content length:', content.length);
            
            // First, try the html-to-docx approach
            try {
                console.log('Attempting html-to-docx conversion...');
                
                // Try multiple import approaches
                let HTMLtoDOCX;
                try {
                    const module = await import('html-to-docx');
                    HTMLtoDOCX = module.default;
                    console.log('Default import successful:', typeof HTMLtoDOCX);
                } catch (importError) {
                    console.log('Default import failed, trying alternatives:', importError);
                    const module = await import('html-to-docx');
                    HTMLtoDOCX = module.HTMLtoDOCX || module;
                    console.log('Alternative import:', typeof HTMLtoDOCX);
                }
                
                if (!HTMLtoDOCX || typeof HTMLtoDOCX !== 'function') {
                    throw new Error(`HTMLtoDOCX is not a function: ${typeof HTMLtoDOCX}`);
                }
                
                // Try with options to ensure better compatibility
                const options = {
                    table: { row: { cantSplit: true } },
                    footer: true,
                    pageNumber: true,
                };
                
                const blob = await HTMLtoDOCX(content, null, options);
                console.log('DOCX blob created successfully:', blob.size, 'bytes', blob.type);

                if (!blob || blob.size === 0) {
                    throw new Error('Generated blob is empty or invalid');
                }

                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up the URL object
                setTimeout(() => URL.revokeObjectURL(url), 100);
                
                console.log('DOCX download triggered successfully');
                
            } catch (docxError) {
                console.warn('html-to-docx conversion failed, trying docx library:', docxError);
                
                try {
                    // Try using the docx library as second option
                    await createDocxWithDocxLibrary(downloadHtml, filename);
                    console.log('DOCX export with docx library successful');
                } catch (docxLibError) {
                    console.warn('docx library also failed, falling back to RTF:', docxLibError);
                    
                    // Final fallback to RTF export
                    const rtfFilename = filename.replace('.docx', '.rtf');
                    const success = createRTFDocument(downloadHtml, rtfFilename);
                    
                    if (success) {
                        console.log('RTF export successful');
                        setError('DOCX export failed, but RTF file was created instead. RTF files can be opened in Word.');
                    } else {
                        throw new Error('All export methods failed');
                    }
                }
            }

        } catch (e) {
            console.error('All export methods failed:', e);
            console.error('Error details:', {
                message: e instanceof Error ? e.message : 'Unknown error',
                stack: e instanceof Error ? e.stack : 'No stack trace',
                type: typeof e
            });
            
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            let userFriendlyMessage = 'Could not generate document file. ';
            
            if (errorMessage.includes('import')) {
                userFriendlyMessage += 'There was an issue loading the export library. Please try refreshing the page.';
            } else if (errorMessage.includes('blob') || errorMessage.includes('empty')) {
                userFriendlyMessage += 'The document could not be properly created. Please check if there are any accepted suggestions.';
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                userFriendlyMessage += 'Network error. Please check your internet connection and try again.';
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
                         hasSuggestions && (
                            <>
                                <SuggestionsList suggestions={suggestions} onUpdate={handleSuggestionUpdate} onAcceptAll={handleAcceptAll} />
                                <button
                                    onClick={handleDownload}
                                    disabled={!hasAcceptedSuggestions}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                                >
                                    Download Labeled DOCX
                                </button>
                            </>
                        )
                    )}
                </div>
                <div className="lg:col-span-8 xl:col-span-9 bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
                    <DocumentPreview htmlContent={modifiedHtml || originalHtml} hasContent={!!(originalHtml)} />
                </div>
            </main>
        </div>
    );
};

export default App;