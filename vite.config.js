import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  optimizeDeps: {
    // Pre-bundle React first to guarantee a single instance across all modules.
    // Without this, Firebase + Vite HMR can cause duplicate React instances
    // which breaks useState (TypeError: Cannot read properties of null).
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/analytics',
    ],
  },
  server: {
    host: true, // Exposes the server on local network (0.0.0.0) so it can be accessed via IP address from mobile/other devices
    // Prevent full-page HMR restarts from leaving dangling Firestore listeners
    hmr: {
      overlay: true,
    },
  },
});
