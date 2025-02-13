# Requires elevation
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# Import IIS module
Import-Module WebAdministration

# Set deployment path
$deployPath = "D:\Deployments\hyper-app"
if (!(Test-Path $deployPath)) {
    throw "Deployment directory does not exist. Please run setup-directories.ps1 first."
}

Write-Host "Configuring IIS..." -ForegroundColor Cyan

try {
    # Create application pool
    $appPoolName = "hyper-app-pool"
    if (!(Test-Path "IIS:\AppPools\$appPoolName")) {
        Write-Host "Creating application pool: $appPoolName"
        New-WebAppPool -Name $appPoolName
        Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name "managedRuntimeVersion" -Value ""
        Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name "enable32BitAppOnWin64" -Value $false
        Write-Host "Application pool created successfully"
    } else {
        Write-Host "Application pool already exists: $appPoolName"
    }

    # Ensure Default Web Site exists
    if (!(Test-Path "IIS:\Sites\Default Web Site")) {
        Write-Host "Creating Default Web Site..."
        New-Website -Name "Default Web Site" -Port 80 -PhysicalPath "$env:SystemDrive\inetpub\wwwroot"
        Write-Host "Default Web Site created"
    }

    # Remove existing application if it exists
    if (Test-Path "IIS:\Sites\Default Web Site\hypercms") {
        Write-Host "Removing existing application..."
        Remove-WebApplication -Name "hypercms" -Site "Default Web Site"
    }

    # Create application under Default Web Site
    Write-Host "Creating application: hypercms"
    New-WebApplication -Name "hypercms" `
                      -Site "Default Web Site" `
                      -PhysicalPath $deployPath `
                      -ApplicationPool $appPoolName `
                      -Force

    # Set application pool identity permissions
    Write-Host "Setting application pool permissions..."
    $acl = Get-Acl $deployPath
    $appPoolSid = (Get-IISAppPool -Name $appPoolName).WorkerProcessIdentity
    $permission = "$appPoolSid","Modify","ContainerInherit,ObjectInherit","None","Allow"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
    $acl.SetAccessRule($accessRule)
    $acl | Set-Acl $deployPath

    # Install URL Rewrite Module if not present
    if (!(Get-Module -ListAvailable -Name "IISAdministration")) {
        Write-Host "Installing URL Rewrite Module..."
        Install-WindowsFeature Web-Url-Auth
    }

    Write-Host "`nIIS configuration completed successfully" -ForegroundColor Green
    Write-Host "Application URL: http://13.233.98.23/hypercms"
}
catch {
    Write-Host "`nError configuring IIS: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
