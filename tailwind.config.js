// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lato', 'sans-serif'],
        cinzel: ['Cinzel', 'serif'],
      },
      colors: {
        // Langsung pakai nilai hex/warna dari theme-sanc di index.css
        'bg-primary': '#111827',     // Sebelumnya var(--bg-primary)
        'bg-secondary': '#1f2937',   // Sebelumnya var(--bg-secondary)
        'bg-tertiary': '#000000',     // Sebelumnya var(--bg-tertiary)
        'text-primary': '#f9fafb',   // Sebelumnya var(--text-primary)
        'text-secondary': '#d1d5db', // Sebelumnya var(--text-secondary)
        'accent-primary': '#f59e0b', // Sebelumnya var(--accent-primary)
        'accent-secondary': '#d97706',// Sebelumnya var(--accent-secondary)
        'border-primary': '#4b5563', // Sebelumnya var(--border-primary)
      },
      keyframes: {
         'fade-in': { /* ...definisi keyframe kamu... */ },
         'fade-in-fast': { /* ...definisi keyframe kamu... */ },
         'pulse-fast': { /* ...definisi keyframe kamu... */ },
      },
      animation: {
         'fade-in': 'fade-in 0.3s ease-out forwards',
         'fade-in-fast': 'fade-in-fast 0.2s ease-out forwards',
         'pulse-fast': 'pulse-fast 1.4s infinite ease-in-out both',
      }
    },
  },
  plugins: [],
}