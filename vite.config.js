import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('localhost+1-key.pem'),
      cert: fs.readFileSync('localhost+1.pem'),
    },
    host: '0.0.0.0', // Allow access from any network device
    port: 3000,
  },
  plugins: [react()],
});
