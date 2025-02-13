# Requires elevation
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# Base deployment directory
$deploymentBase = "C:\inetpub\wwwroot"
$appName = "app"
$deployPath = Join-Path $deploymentBase $appName
$sourceDir = $PSScriptRoot # Current directory where script is running

Write-Host "Creating deployment directory structure..." -ForegroundColor Cyan

try {
    # Create main deployment directory
    if (!(Test-Path $deploymentBase)) {
        New-Item -ItemType Directory -Path $deploymentBase -Force
        Write-Host "Created base deployment directory: $deploymentBase"
    }

    # Create application-specific directory
    if (!(Test-Path $deployPath)) {
        New-Item -ItemType Directory -Path $deployPath -Force
        Write-Host "Created application directory: $deployPath"
    }

    # Create subdirectories
    $subdirs = @(
        "logs/app",
        "logs/iis",
        "logs/pm2",
        "backup",
        "scripts",
        ".next",
        "public",
        "node_modules"
    )

    foreach ($dir in $subdirs) {
        $path = Join-Path $deployPath $dir
        if (!(Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force
            Write-Host "Created directory: $path"
        }
    }

    # Copy source files
    Write-Host "`nCopying application files..."
    
    # Copy all files except node_modules and .next
    Get-ChildItem -Path $sourceDir -Exclude "node_modules",".next" | ForEach-Object {
        if ($_.PSIsContainer) {
            # For directories, use robocopy for better performance and error handling
            $targetPath = Join-Path $deployPath $_.Name
            robocopy $_.FullName $targetPath /E /XD "node_modules" ".next"
            if ($LASTEXITCODE -lt 8) { Write-Host "Copied directory: $($_.Name)" }
        } else {
            # For individual files
            Copy-Item $_.FullName -Destination $deployPath -Force
            Write-Host "Copied file: $($_.Name)"
        }
    }

    # Set permissions
    $acl = Get-Acl $deployPath
    $permission = "IIS AppPool\DefaultAppPool","Modify","ContainerInherit,ObjectInherit","None","Allow"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
    $acl.SetAccessRule($accessRule)
    $acl | Set-Acl $deployPath
    Write-Host "`nSet permissions on deployment directory"

    Write-Host "`nDeployment directory structure created successfully at: $deployPath" -ForegroundColor Green
    Write-Host "Source files copied from: $sourceDir" -ForegroundColor Green
}
catch {
    Write-Host "`nError creating deployment directory structure: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
