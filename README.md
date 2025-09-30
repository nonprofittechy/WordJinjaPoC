<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DOCX Jinja2 Labeler

An AI-powered tool to automatically identify placeholders in DOCX files and replace them with Jinja2 labels, allowing for review, editing, and re-exporting while preserving the original document formatting.

## Features

- 🤖 **AI-Powered Analysis**: Uses Google's Gemini AI to identify placeholders in Word documents
- 📄 **Format Preservation**: Maintains original DOCX formatting, styles, tables, and images
- ✏️ **Manual Labeling**: Select text in the preview to create custom labels for content AI missed
- 🔍 **Interactive Preview**: Review and edit suggestions before applying them
- 📋 **Docassemble Integration**: Follows Docassemble naming conventions for legal document automation

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your Gemini API key:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local and add your API key
   ```
   Get your API key from https://aistudio.google.com/app/apikey

3. Run the development server:
   ```bash
   npm run dev
   ```

## Deploy to Fly.io

**Prerequisites:** 
- [Fly.io account](https://fly.io) 
- [flyctl CLI installed](https://fly.io/docs/hands-on/install-flyctl/)
- Gemini API key

### Quick Deployment

1. Set your API key as an environment variable:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```

2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

### Manual Deployment

1. Login to Fly.io:
   ```bash
   flyctl auth login
   ```

2. Create the app:
   ```bash
   flyctl apps create wordjinja-poc
   ```

3. Set the API key as a secret:
   ```bash
   flyctl secrets set GEMINI_API_KEY=your_api_key_here -a wordjinja-poc
   ```

4. Deploy:
   ```bash
   flyctl deploy -a wordjinja-poc
   ```

## Usage

1. **Upload**: Drop a DOCX file into the upload area
2. **Review**: The AI will suggest Jinja2 labels for placeholders it finds
3. **Edit**: Accept, reject, or modify the suggestions
4. **Add Manual Labels**: Select any text in the preview to create custom labels
5. **Download**: Get your modified DOCX with all accepted labels applied

## Configuration

The app uses environment variables for configuration:

- `GEMINI_API_KEY`: Your Google AI Studio API key (required)

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **AI**: Google Gemini 2.5 Flash
- **Document Processing**: Mammoth.js, JSZip
- **Styling**: Tailwind CSS
- **Deployment**: Fly.io with Docker
