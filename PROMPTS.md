# Prompts Configuration

This project uses a promptfoo-compatible JSON structure for managing AI prompts, making it easier to test, iterate, and version prompts.

## Files

- `prompts.json` - Main configuration file containing prompts and test cases
- `utils/promptUtils.js` - Utility functions for working with prompts
- `test-prompts-config.js` - Validation script for prompts configuration
- `test-sample-prompt.js` - Test script with sample document data

## Configuration Structure

The `prompts.json` file follows this structure:

```json
{
  "description": "Project description",
  "prompts": [
    {
      "id": "unique-prompt-id",
      "label": "Human readable label",
      "config": {
        "model": "gemini-2.5-flash",
        "temperature": 0.3,
        "responseMimeType": "application/json"
      },
      "prompt": [
        {
          "role": "system",
          "content": "System prompt content..."
        },
        {
          "role": "user", 
          "content": "{{documentText}}"
        }
      ],
      "responseSchema": {
        "type": "object",
        "properties": {
          // JSON schema for expected response
        }
      }
    }
  ],
  "tests": [
    {
      "description": "Test case description",
      "vars": {
        "documentText": "Sample document content..."
      },
      "assert": [
        {
          "type": "contains-json",
          "value": {
            // Expected response structure
          }
        }
      ]
    }
  ]
}
```

## Prompt Variables

Prompts can use variable substitution with `{{variableName}}` syntax. Common variables:

- `{{documentText}}` - The document content to analyze
- Custom variables can be defined in test cases

## Testing

### Validate Configuration
```bash
npm run test:prompts
```

This validates:
- JSON structure is correct
- All required fields are present
- Prompt structure follows expected format
- Response schemas are properly defined

### Test with Sample Data
```bash
npm run test:prompt-sample
```

This shows:
- How prompts are rendered with sample data
- Expected response structure
- Available test cases

### Manual Testing

1. Start the development server: `npm run dev`
2. Upload a document at http://localhost:5176/
3. Check browser network tab for `/api/generate-labels` requests
4. Compare responses with expected schema

## Adding New Prompts

1. Add a new prompt object to the `prompts` array in `prompts.json`
2. Give it a unique `id`
3. Define the system and user messages
4. Specify the response schema
5. Add test cases to validate behavior
6. Run `npm run test:prompts` to validate

## Best Practices

- Use descriptive IDs and labels
- Include comprehensive system instructions
- Define strict response schemas
- Add multiple test cases covering edge cases
- Keep temperature low (0.1-0.3) for consistent results
- Version control all prompt changes
- Test prompts with real documents before deploying

## Integration with promptfoo

This structure is compatible with promptfoo for advanced testing:

```bash
# Install promptfoo (if desired)
npm install -g promptfoo

# Run tests with promptfoo
promptfoo eval prompts.json
```