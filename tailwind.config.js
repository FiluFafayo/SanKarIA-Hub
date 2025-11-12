// File: tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palet Grimoire (Dark Fantasy)
        void: "#0f0e13",       // Background paling gelap
        surface: "#1a1921",    // Warna dasar panel
        parchment: "#e3d5ca",  // Warna kertas/teks utama
        gold: "#d4af37",       // Aksen penting/Legendary
        blood: "#8a0303",      // HP / Danger
        mana: "#2d3a8c",       // MP / Magic
        stamina: "#1f6e38",    // Action Points
        wood: "#4a3c31",       // UI Borders
        faded: "#6c6b75",      // Teks tidak aktif
      },
      fontFamily: {
        // Wajib import di index.css nanti
        pixel: ['"Press Start 2P"', 'cursive'], // Untuk Header/Angka penting
        retro: ['"VT323"', 'monospace'],         // Untuk Teks/Narasi (lebih mudah dibaca)
      },
      boxShadow: {
        // RAHASIA PIXEL ART: Border tajam tanpa blur
        'pixel-sm': '1px 1px 0px 0px #0f0e13',
        'pixel-md': '2px 2px 0px 0px #0f0e13',
        'pixel-inset': 'inset 2px 2px 0px 0px rgba(0,0,0,0.5)',
        'pixel-glow': '0 0 10px rgba(212, 175, 55, 0.3)',
      },
    },
  },
  plugins: [],
}