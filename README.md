This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

- npm run build
- Copy .next, components, lib, public, types, utils, package.json, package-lock.json, server.js and service.js files on the production server
- go to the production folder and run following commands;
  - npm install
  - npm install node-windows
  - Check File and Directory Permissions
    -   Ensure Node.js has permissions to read/write files and create directories in the project directory:

    -   Right-click your project folder (C:\Users\Administrator\Documents\hyper-app).
    -   Go to Properties > Security.
    -   Ensure your user (Administrator) and the system account have Full Control.
  - Install service by executing node service.js
  - Check the service running or not
  - type http://localhost:3000
