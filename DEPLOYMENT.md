# Deployment Guide for Hyper App

This guide explains how to deploy the Next.js application on Windows Server 2019 with IIS and PM2.

## Prerequisites

1. Windows Server 2019
2. IIS installed with the following features:
   - Web Server (IIS)
   - URL Rewrite Module
   - Application Request Routing
3. Node.js (version 18.17 or later)
4. IISNode installed and configured
5. Administrative privileges

## Deployment Files

The deployment process uses several PowerShell scripts:

1. `setup-directories.ps1`
   - Creates deployment directory structure at D:\Deployments\hyper-app
   - Copies application files to deployment directory
   - Sets up logging directories
   - Configures permissions

2. `deploy-iis.ps1`
   - Creates IIS application pool
   - Configures application under Default Web Site
   - Sets up URL rewrite rules
   - Configures IIS settings

3. `setup-pm2.ps1`
   - Installs PM2 globally
   - Installs production dependencies
   - Builds the Next.js application
   - Configures PM2 process management

4. `deploy-all.ps1`
   - Main orchestration script
   - Runs all deployment steps in sequence
   - Provides deployment summary and next steps

## Deployment Steps

1. Copy all deployment files to the Windows Server:
   - All PowerShell scripts (*.ps1)
   - Application source files
   - Configuration files (web.config, next.config.ts)

2. Open PowerShell as Administrator

3. Navigate to the directory containing the deployment scripts

4. Run the deployment script:
   ```powershell
   .\deploy-all.ps1
   ```

The deployment process will:
1. Create and populate the deployment directory
2. Configure IIS and application pool
3. Install dependencies and build the application
4. Set up PM2 process management
5. Configure SSL with Let's Encrypt

## Directory Structure

After deployment, the following directory structure will be created:

```
D:\Deployments\hyper-app\
├── .next/               # Next.js build output
├── app/                 # Application source
├── components/          # React components
├── lib/                 # Library files
├── public/             # Static files
├── types/              # TypeScript types
├── utils/              # Utility functions
├── logs/
│   ├── app/            # Application logs
│   ├── iis/            # IIS logs
│   └── pm2/            # PM2 logs
├── node_modules/       # Dependencies
├── package.json        # Project configuration
├── next.config.ts      # Next.js configuration
└── web.config          # IIS configuration
```

## Monitoring

1. PM2 Process Management:
   ```powershell
   # View process status
   pm2 status

   # View logs
   pm2 logs hyper-app

   # Monitor resources
   pm2 monit
   ```

2. Application Logs:
   - Application logs: D:\Deployments\hyper-app\logs\app
   - IIS logs: D:\Deployments\hyper-app\logs\iis
   - PM2 logs: D:\Deployments\hyper-app\logs\pm2

## URLs

The application will be accessible at:
- https://13.233.98.23/hypercms (primary URL)
- http://13.233.98.23/hypercms (redirects to HTTPS)

## Troubleshooting

### Common Issues

1. Permission Errors
   - Verify application pool identity has necessary permissions
   - Check folder permissions on deployment directory
   - Ensure IIS_IUSRS has appropriate access

2. Build Failures
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review build logs in deployment directory

3. IIS Configuration
   - Verify URL Rewrite Module is installed
   - Check application pool settings
   - Review web.config for correct paths

4. PM2 Issues
   - Verify PM2 is installed globally
   - Check PM2 logs for startup errors
   - Verify Node.js path is correct

### Logs Location

- Application Logs: D:\Deployments\hyper-app\logs\app
- IIS Logs: D:\Deployments\hyper-app\logs\iis
- PM2 Logs: D:\Deployments\hyper-app\logs\pm2
- Build Logs: Check console output during deployment

### Recovery Steps

1. If deployment fails:
   ```powershell
   # Stop PM2 processes
   pm2 delete hyper-app

   # Remove IIS application
   Remove-WebApplication -Name "hypercms" -Site "Default Web Site"

   # Try deployment again
   .\deploy-all.ps1
   ```

2. For permission issues:
   ```powershell
   # Reset IIS
   iisreset

   # Verify application pool identity
   Get-IISAppPool -Name "hyper-app-pool"
   ```

## Support

For additional support:
1. Check Windows Event Viewer for system-level errors
2. Review IIS logs for request handling issues
3. Check PM2 logs for application runtime errors
4. Verify Node.js and npm versions match requirements
