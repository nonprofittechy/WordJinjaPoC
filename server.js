import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        const { documentText } = req.body;
        
        if (!documentText) {
            return res.status(400).json({ error: 'Document text is required' });
        }

        if (!geminiAI) {
            console.error('Gemini AI not initialized - API key missing');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        console.log('Processing document text, length:', documentText.length);
        const startTime = Date.now();

        const roleDescription = `
You are an expert legal tech assistant. Your task is to process a text document and identify placeholders, turning it into a Jinja2 template. You will return a JSON structure that specifies the modifications.

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
the recipient of a letter, etc.
`;

        const responseSchema = {
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

        const response = await geminiAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: documentText,
            config: {
                systemInstruction: roleDescription,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.3,
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

// Serve the React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`API endpoint: /api/generate-labels`);
});