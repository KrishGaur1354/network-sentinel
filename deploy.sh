#!/bin/bash

# Network Sentinel Plugin Deployment Script
# This script deploys the plugin to your Steam Deck via SSH

# Configuration
DECK_HOST="deck@steamdeck"
PLUGIN_NAME="network-sentinel"
PLUGIN_VERSION="1.0.0"

echo "🚀 Deploying Network Sentinel Plugin to Steam Deck..."

# Build the plugin
echo "📦 Building plugin..."
pnpm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Create deployment directory
echo "📁 Creating deployment directory..."
mkdir -p out/$PLUGIN_NAME

# Copy required files
echo "📋 Copying plugin files..."
cp -r dist out/$PLUGIN_NAME/
cp package.json out/$PLUGIN_NAME/
cp plugin.json out/$PLUGIN_NAME/
cp main.py out/$PLUGIN_NAME/
cp requirements.txt out/$PLUGIN_NAME/
cp README.md out/$PLUGIN_NAME/
cp LICENSE out/$PLUGIN_NAME/

# Create plugin zip
echo "🗜️ Creating plugin package..."
cd out
zip -r ${PLUGIN_NAME}-${PLUGIN_VERSION}.zip $PLUGIN_NAME/
cd ..

echo "✅ Plugin package created: out/${PLUGIN_NAME}-${PLUGIN_VERSION}.zip"

# Deploy to Steam Deck (optional - uncomment if you want automatic deployment)
# echo "🚀 Deploying to Steam Deck..."
# scp out/${PLUGIN_NAME}-${PLUGIN_VERSION}.zip $DECK_HOST:/tmp/
# ssh $DECK_HOST "cd /tmp && unzip -o ${PLUGIN_NAME}-${PLUGIN_VERSION}.zip && sudo cp -r $PLUGIN_NAME /home/deck/homebrew/plugins/"

echo "🎉 Deployment complete!"
echo "📦 Plugin package: out/${PLUGIN_NAME}-${PLUGIN_VERSION}.zip"
echo "📋 To install manually:"
echo "   1. Copy the zip file to your Steam Deck"
echo "   2. Install via Decky Loader plugin store or manual installation"
echo "   3. Enable the plugin in Decky Loader settings"
