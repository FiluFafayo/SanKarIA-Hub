/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{src,components,views}/**/*.{js,ts,jsx,tsx}", // Sesuaikan path jika perlu
  ],
  theme: {
    extend: {
        fontFamily: {
            sans: ['Lato', 'sans-serif'],
            cinzel: ['Cinzel', 'serif'],
        },
        colors: {
            'bg-primary': 'var(--bg-primary)',
            'bg-secondary': 'var(--bg-secondary)',
            'bg-tertiary': 'var(--bg-tertiary)',
            'text-primary': 'var(--text-primary)',
            'text-secondary': 'var(--text-secondary)',
            'accent-primary': 'var(--accent-primary)',
            'accent-secondary': 'var(--accent-secondary)',
            'border-primary': 'var(--border-primary)',
        },
        keyframes: {
           'fade-in': {
              'from': { opacity: '0', transform: 'scale(0.98)' },
              'to': { opacity: '1', transform: 'scale(1)' },
            },
           'fade-in-fast': {
              'from': { opacity: '0' },
              'to': { opacity: '1' },
            },
           'pulse-fast': {
              '0%, 80%, 100%': { transform: 'scale(0)' },
              '40%': { transform: 'scale(1.0)' },
            },
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