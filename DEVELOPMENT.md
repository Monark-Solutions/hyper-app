# Development Setup Guide

This guide explains how to set up and run the Next.js application on your development PC.

## Local Development Setup

1. First, install the required dependencies:
   ```bash
   npm install
   ```

2. Create a development build:
   ```bash
   npm run build
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000/hypercms`

## Testing Production Build Locally

To test the production build locally:

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000/hypercms`

## Files to Modify for Development

You only need to modify these files for development:

1. `next.config.ts` - Already configured with:
   ```typescript
   basePath: '/hypercms',
   assetPrefix: '/hypercms'
   ```

2. Any source files in:
   - app/
   - components/
   - lib/
   - utils/
   - types/

## Development vs Production

- Development Mode: Uses `npm run dev` with hot-reloading
- Production Mode: Uses `npm start` after `npm run build`

The deployment scripts (setup-directories.ps1, deploy-iis.ps1, etc.) are only for the production server deployment, not for local development.

## Development Workflow

1. Make changes to the source code
2. Test using `npm run dev`
3. When ready to deploy:
   - Commit your changes
   - Copy the updated files to the production server
   - Run the deployment scripts on the production server

Remember: The deployment scripts (*.ps1) are only for the Windows Server deployment. You don't need to run these on your development PC.
