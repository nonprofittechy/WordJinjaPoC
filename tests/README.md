# Tests

This directory contains all test files for the WordJinjaPoC application.

## Test Files

### Core Functionality Tests

- **`test-full-pipeline.js`** - Complete end-to-end test of the document processing pipeline
- **`test-docx-processing.js`** - Tests DOCX file reading, processing, and manipulation
- **`test-docx-export.js`** - Tests HTML to DOCX conversion functionality

### Prompt System Tests

- **`test-prompts-config.js`** - Tests prompt configuration loading and validation
- **`test-sample-prompt.js`** - Tests prompt rendering with sample data
- **`test-client-prompts.js`** - Tests client-side prompt utilities

### Text Processing Tests

- **`test-jinja2-highlighting.js`** - Tests Jinja2 syntax highlighting functionality
- **`test-space-preservation.js`** - Tests that spaces and formatting are preserved during text replacement

## Running Tests

Use the npm scripts defined in `package.json`:

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:prompts          # Prompt configuration tests
npm run test:docx             # DOCX processing tests
npm run test:highlighting     # Jinja2 highlighting tests
npm run test:client-prompts   # Client-side prompt utilities

# Run individual tests
npm run test:prompt-sample    # Sample prompt rendering
```

## Test Output

Test files may generate `.docx` output files for verification. These are automatically ignored by git and stored in this directory.
