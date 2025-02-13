# Requires elevation
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# Set deployment path
$deployPath = "C:\inetpub\wwwroot\app"
if (!(Test-Path $deployPath)) {
    throw "Deployment directory does not exist. Please run setup-directories.ps1 first."
}

Write-Host "Setting up PM2 and building application..." -ForegroundColor Cyan

try {
    # Install PM2 globally if not already installed
    if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Write-Host "Installing PM2 globally..."
        npm install -g pm2
        Write-Host "PM2 installed successfully"
    } else {
        Write-Host "PM2 is already installed"
    }

    # Navigate to deployment directory
    Set-Location $deployPath
    Write-Host "Changed to deployment directory: $deployPath"

    # Clean install dependencies
    Write-Host "`nInstalling production dependencies..."
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    npm install --production
    if ($LASTEXITCODE -ne 0) { throw "Failed to install dependencies" }
    Write-Host "Dependencies installed successfully"

    # Build the application
    Write-Host "`nBuilding the application..."
    Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Failed to build the application" }
    Write-Host "Application built successfully"

    # Configure and start PM2
    Write-Host "`nConfiguring PM2..."
    
    # Stop existing process if running
    pm2 delete app 2>$null
    
    # Start application with PM2
    Write-Host "Starting application with PM2..."
    $env:NODE_ENV = "production"
    pm2 start server.js --name "app" --env production
    if ($LASTEXITCODE -ne 0) { throw "Failed to start application with PM2" }

    # Save PM2 process list
    Write-Host "Saving PM2 process list..."
    pm2 save
    if ($LASTEXITCODE -ne 0) { throw "Failed to save PM2 process list" }

    # Setup PM2 to start on system boot
    Write-Host "Setting up PM2 startup..."
    pm2 startup
    if ($LASTEXITCODE -ne 0) { throw "Failed to setup PM2 startup" }

    Write-Host "`nPM2 setup completed successfully" -ForegroundColor Green
    Write-Host "To monitor the application:"
    Write-Host "1. View status: pm2 status"
    Write-Host "2. View logs: pm2 logs hyper-app"
    Write-Host "3. Monitor: pm2 monit"
}
catch {
    Write-Host "`nError during PM2 setup: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
