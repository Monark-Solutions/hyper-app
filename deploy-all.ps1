# Requires elevation
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

function Write-Step {
    param($Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Success {
    param($Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Error {
    param($Message)
    Write-Host $Message -ForegroundColor Red
}

Write-Host "Starting deployment process for Hyper App..." -ForegroundColor Green
Write-Host "Deployment target: http://13.233.98.23/app`n"

$startTime = Get-Date

try {
    # 1. Create and populate deployment directory
    Write-Step "Step 1/4: Creating deployment directory structure"
    & .\setup-directories.ps1
    if ($LASTEXITCODE -ne 0) { 
        throw "Directory setup failed. Please check the error messages above."
    }
    Write-Success "Directory setup completed successfully"

    # 2. Configure IIS
    Write-Step "Step 2/4: Configuring IIS"
    & .\deploy-iis.ps1
    if ($LASTEXITCODE -ne 0) { 
        throw "IIS configuration failed. Please check the error messages above."
    }
    Write-Success "IIS configuration completed successfully"

    # 3. Setup PM2 and build application
    Write-Step "Step 3/4: Setting up PM2 and building application"
    & .\setup-pm2.ps1
    if ($LASTEXITCODE -ne 0) { 
        throw "PM2 setup failed. Please check the error messages above."
    }
    Write-Success "PM2 setup and application build completed successfully"

    # 4. Configure SSL
    Write-Step "Step 4/4: Configuring SSL"
    & .\setup-ssl.ps1
    if ($LASTEXITCODE -ne 0) { 
        throw "SSL setup failed. Please check the error messages above."
    }
    Write-Success "SSL configuration completed successfully"

    $endTime = Get-Date
    $duration = $endTime - $startTime

    Write-Host "`n=== Deployment Summary ===" -ForegroundColor Green
    Write-Host "Deployment completed successfully!"
    Write-Host "Total deployment time: $($duration.Minutes) minutes and $($duration.Seconds) seconds"
    Write-Host "`nApplication URLs:"
    Write-Host "- http://13.233.98.23/app (redirects to HTTPS)" -ForegroundColor Yellow
    Write-Host "- https://13.233.98.23/app" -ForegroundColor Yellow
    
    Write-Host "`nMonitoring Information:"
    Write-Host "1. PM2 Status: pm2 status"
    Write-Host "2. PM2 Logs: pm2 logs hyper-app"
    Write-Host "3. Application Logs: C:\inetpub\wwwroot\app\logs\app"
    Write-Host "4. IIS Logs: C:\inetpub\wwwroot\app\logs\iis"

    Write-Host "`nNext Steps:"
    Write-Host "1. Verify the application is accessible at the URLs above"
    Write-Host "2. Check the logs for any warnings or errors"
    Write-Host "3. Monitor the application performance using PM2"
}
catch {
    Write-Error "`nDeployment failed: $($_.Exception.Message)"
    Write-Host "`nTroubleshooting steps:"
    Write-Host "1. Check the error messages above"
    Write-Host "2. Verify all prerequisites are installed"
    Write-Host "3. Check the logs in C:\inetpub\wwwroot\app\logs"
    Write-Host "4. Ensure you have administrative privileges"
    exit 1
}
