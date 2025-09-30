#!/bin/bash

# WordJinja PoC Deployment Script for Fly.io

echo "🚀 Deploying WordJinja PoC to Fly.io..."

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl is not installed. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if user is logged in
if ! flyctl auth whoami &> /dev/null; then
    echo "❌ You're not logged in to Fly.io. Please run:"
    echo "   flyctl auth login"
    exit 1
fi

# Get GEMINI_API_KEY from .env.local
if [ -f ".env.local" ]; then
    export GEMINI_API_KEY=$(grep GEMINI_API_KEY .env.local | cut -d '=' -f2)
    echo "✅ Using GEMINI_API_KEY from .env.local"
fi

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ GEMINI_API_KEY not found in .env.local or environment variables."
    echo "   Please make sure .env.local contains: GEMINI_API_KEY=your_api_key_here"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create app if it doesn't exist
echo "📦 Creating/updating Fly.io app in suffolk-lit-lab organization..."
if ! flyctl apps list --org suffolk-lit-lab | grep -q "wordjinja-poc"; then
    echo "Creating new app: wordjinja-poc in suffolk-lit-lab"
    flyctl apps create wordjinja-poc --org suffolk-lit-lab
else
    echo "App wordjinja-poc already exists in suffolk-lit-lab"
fi

# Set secrets
echo "🔐 Setting up secrets..."
flyctl secrets set GEMINI_API_KEY="$GEMINI_API_KEY" -a wordjinja-poc

# Deploy the application
echo "🚀 Deploying application..."
flyctl deploy -a wordjinja-poc

echo "✅ Deployment complete!"
echo "🌐 Your app should be available at: https://wordjinja-poc.fly.dev"

# Open the app
echo "🔗 Opening app in browser..."
flyctl open -a wordjinja-poc