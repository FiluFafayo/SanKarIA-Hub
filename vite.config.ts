import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), ''); // process.cwd() lebih standar
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // === UBAH BAGIAN DEFINE INI ===
      define: {
        // Kita map VITE_... dari env ke process.env... yang akan dibaca App.tsx
        'process.env.GEMINI_API_KEYS': JSON.stringify(env.VITE_GEMINI_API_KEYS || ''), // Beri default string kosong
        'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
        // Hapus define API_KEY lama jika tidak dipakai lagi
        // 'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      // === AKHIR BAGIAN DEFINE ===
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});