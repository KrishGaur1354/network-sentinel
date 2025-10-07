# Network Sentinel Plugin Deployment Script for Windows
# This script deploys the plugin to your Steam Deck via SSH

# Configuration
$DECK_HOST = "deck@steamdeck"
$PLUGIN_NAME = "network-sentinel"
$PLUGIN_VERSION = "1.0.0"

Write-Host "Deploying Network Sentinel Plugin to Steam Deck..." -ForegroundColor Green

# Build the plugin
Write-Host "Building plugin..." -ForegroundColor Yellow
pnpm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Create deployment directory
Write-Host "Creating deployment directory..." -ForegroundColor Yellow
if (Test-Path "out") {
    Remove-Item -Recurse -Force "out"
}
New-Item -ItemType Directory -Path "out\$PLUGIN_NAME" -Force | Out-Null

# Copy required files
Write-Host "Copying plugin files..." -ForegroundColor Yellow
Copy-Item -Recurse "dist" "out\$PLUGIN_NAME\"
Copy-Item "package.json" "out\$PLUGIN_NAME\"
Copy-Item "plugin.json" "out\$PLUGIN_NAME\"
Copy-Item "main.py" "out\$PLUGIN_NAME\"
Copy-Item "requirements.txt" "out\$PLUGIN_NAME\"
Copy-Item "README.md" "out\$PLUGIN_NAME\"
Copy-Item "LICENSE" "out\$PLUGIN_NAME\"

# Create plugin zip
Write-Host "Creating plugin package..." -ForegroundColor Yellow
Set-Location "out"
Compress-Archive -Path "$PLUGIN_NAME" -DestinationPath "$PLUGIN_NAME-$PLUGIN_VERSION.zip" -Force
Set-Location ".."

Write-Host "Plugin package created: out\$PLUGIN_NAME-$PLUGIN_VERSION.zip" -ForegroundColor Green

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Plugin package: out\$PLUGIN_NAME-$PLUGIN_VERSION.zip" -ForegroundColor Cyan
Write-Host "To install manually:" -ForegroundColor Cyan
Write-Host "1. Copy the zip file to your Steam Deck" -ForegroundColor White
Write-Host "2. Install via Decky Loader plugin store or manual installation" -ForegroundColor White
Write-Host "3. Enable the plugin in Decky Loader settings" -ForegroundColor White