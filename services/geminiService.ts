import { GoogleGenAI, Type } from "@google/genai";
import { AISuggestion } from '../types';

const roleDescription = `
You are an expert legal tech assistant. Your task is to process a text document and identify placeholders, turning it into a Jinja2 template. You will return a JSON structure that specifies the modifications.

## Instructions:
1.  **Analyze**: Read the document text and identify any placeholder text (e.g., "John Smith", "________", "[Client's Name]").
2.  **Label**: Replace these placeholders with appropriate Jinja2 variable names based on the provided conventions.
3.  **Contextualize**: For each replacement, provide a snippet of the surrounding text (the "context") to ensure the replacement is unique and understandable. The original placeholder must be part of the context.
4.  **Format**: Return the result as a JSON object containing a single key "results", which is an array of suggestion objects. Each object must have "context", "original" (the exact text to be replaced), and "replacement" (the new Jinja2 label).

## Example:
### Input Text:
"This agreement is between John Doe and Jane Smith. The property is located at 123 Main St. The date is ________."

### Expected JSON Output:
{
  "results": [
    {
      "context": "This agreement is between John Doe and Jane Smith.",
      "original": "John Doe",
      "replacement": "{{ parties[0].name.full() }}"
    },
    {
      "context": "and Jane Smith. The property is",
      "original": "Jane Smith",
      "replacement": "{{ parties[1].name.full() }}"
    },
    {
      "context": "The property is located at 123 Main St.",
      "original": "123 Main St",
      "replacement": "{{ property_address.on_one_line() }}"
    },
    {
      "context": "The date is ________.",
      "original": "________",
      "replacement": "{{ signature_date }}"
    }
  ]
}

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
    type: Type.OBJECT,
    properties: {
        results: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    context: {
                        type: Type.STRING,
                        description: "A snippet of text surrounding the placeholder to provide context."
                    },
                    original: {
                        type: Type.STRING,
                        description: "The exact placeholder text to be replaced."
                    },
                    replacement: {
                        type: Type.STRING,
                        description: "The suggested Jinja2 variable label."
                    }
                },
                required: ["context", "original", "replacement"]
            }
        }
    },
    required: ["results"]
};

export const generateJinjaLabels = async (documentText: string): Promise<AISuggestion[]> => {
    try {
        const API_KEY = process.env.API_KEY;
        if (!API_KEY) {
            throw new Error("API_KEY environment variable not set.");
        }
        const ai = new GoogleGenAI({ apiKey: API_KEY });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: documentText,
            config: {
                systemInstruction: roleDescription,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.3,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        
        if (parsedJson && parsedJson.results && Array.isArray(parsedJson.results)) {
            return parsedJson.results as AISuggestion[];
        }

        return [];

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get suggestions from the AI. Check your API key and network connection.");
    }
};