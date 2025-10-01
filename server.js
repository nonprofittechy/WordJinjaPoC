import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import fs from 'fs';

// Load environment variables from .env file
config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompts configuration
let promptsConfig = null;
try {
    const promptsPath = path.join(__dirname, 'prompts.json');
    const promptsData = fs.readFileSync(promptsPath, 'utf8');
    promptsConfig = JSON.parse(promptsData);
    console.log('Prompts configuration loaded successfully');
} catch (error) {
    console.error('Error loading prompts configuration:', error);
}

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini AI once at startup for better performance
const API_KEY = process.env.GEMINI_API_KEY;
let geminiAI = null;

if (API_KEY) {
    geminiAI = new GoogleGenAI({ apiKey: API_KEY });
    console.log('Gemini AI initialized successfully');
} else {
    console.error('GEMINI_API_KEY environment variable not set');
}

// Middleware - optimize for speed
app.use(express.json({ limit: '10mb' }));

// Add compression for faster responses
import compression from 'compression';
app.use(compression());

// Serve static files with proper caching
app.use(express.static('dist', {
    maxAge: '1d', // Cache static assets for 1 day
    etag: true
}));

// API endpoint for Gemini
app.post('/api/generate-labels', async (req, res) => {
    try {
        const { documentText, customPrompt, additionalInstructions } = req.body;
        
        if (!documentText) {
            return res.status(400).json({ error: 'Document text is required' });
        }

        if (!geminiAI) {
            console.error('Gemini AI not initialized - API key missing');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        console.log('Processing document text, length:', documentText.length);
        const startTime = Date.now();

        // Get the default prompt from configuration
        let roleDescription = customPrompt;
        let responseSchema = null;
        let modelConfig = {
            temperature: 0.3,
            responseMimeType: "application/json"
        };

        if (!customPrompt && promptsConfig) {
            // Use the default prompt from prompts.json
            const defaultPromptConfig = promptsConfig.prompts.find(p => p.id === 'default');
            if (defaultPromptConfig) {
                const systemMessage = defaultPromptConfig.prompt.find(p => p.role === 'system');
                if (systemMessage) {
                    roleDescription = systemMessage.content;
                }
                responseSchema = defaultPromptConfig.responseSchema;
                
                // Merge model configuration
                if (defaultPromptConfig.config) {
                    modelConfig = { ...modelConfig, ...defaultPromptConfig.config };
                }
            }
        }

        // Fallback to a basic prompt if configuration is missing
        if (!roleDescription) {
            roleDescription = `You are an expert legal tech assistant. Analyze the document and identify placeholders that should be replaced with Jinja2 variables. Return a JSON object with a "results" array containing objects with "context", "original", and "replacement" fields.`;
        }

        // Add additional instructions if provided
        if (additionalInstructions && additionalInstructions.trim()) {
            roleDescription += `\n\n## Additional Instructions:\n${additionalInstructions.trim()}`;
        }

        console.log('Using custom prompt:', !!customPrompt);
        console.log('Additional instructions provided:', !!additionalInstructions);

        // Default response schema if not provided in config
        if (!responseSchema) {
            responseSchema = {
                type: "object",
                properties: {
                    results: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                context: {
                                    type: "string",
                                    description: "A snippet of text surrounding the placeholder to provide context."
                                },
                                original: {
                                    type: "string",
                                    description: "The exact placeholder text to be replaced."
                                },
                                replacement: {
                                    type: "string",
                                    description: "The suggested Jinja2 variable label."
                                }
                            },
                            required: ["context", "original", "replacement"]
                        }
                    }
                },
                required: ["results"]
            };
        }

        const response = await geminiAI.models.generateContent({
            model: modelConfig.model || "gemini-2.5-flash",
            contents: documentText,
            config: {
                systemInstruction: roleDescription,
                responseMimeType: modelConfig.responseMimeType || "application/json",
                responseSchema: responseSchema,
                temperature: modelConfig.temperature || 0.3,
            },
        });

        const apiTime = Date.now() - startTime;
        console.log(`Gemini API call took ${apiTime}ms`);

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        
        if (parsedJson && parsedJson.results && Array.isArray(parsedJson.results)) {
            // Only filter out truly empty suggestions - let the DOCX processor handle the rest intelligently
            const filteredResults = parsedJson.results.filter(suggestion => {
                // Only skip completely empty suggestions
                if (!suggestion.original || suggestion.original.length === 0) {
                    console.log(`Filtering out empty suggestion`);
                    return false;
                }
                
                return true;
            });
            
            const totalTime = Date.now() - startTime;
            console.log(`Successfully generated ${parsedJson.results.length} suggestions, ${filteredResults.length} after filtering (total time: ${totalTime}ms)`);
            res.json({ results: filteredResults });
        } else {
            console.error('Invalid response format from Gemini');
            res.status(500).json({ error: 'Invalid response from AI service' });
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ 
            error: 'Failed to process document. Please try again.',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// API endpoint to get prompts configuration
app.get('/api/prompts/config', (req, res) => {
    try {
        if (!promptsConfig) {
            return res.status(500).json({
                error: 'Prompts configuration not loaded',
                details: 'The prompts.json file could not be loaded at server startup'
            });
        }
        
        res.json(promptsConfig);
    } catch (error) {
        console.error('Error serving prompts config:', error);
        res.status(500).json({
            error: 'Failed to serve prompts configuration',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`API endpoint: /api/generate-labels`);
});