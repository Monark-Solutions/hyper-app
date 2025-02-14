const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'Digital Signage CMS', // Name of the service
  description: 'Digital Signage CMS as a Windows service.',
  script: path.join(__dirname, 'server.js'), // Point to your custom server.js
  wait: 1,
  grow: 0.5,
});

svc.on('install', () => {
  console.log('Service installed successfully!');
  svc.start();
});

svc.install();
