/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens via CSS variables
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'accent-primary': 'var(--accent-primary)',
        'accent-secondary': 'var(--accent-secondary)',
        'border-primary': 'var(--border-primary)',
      },
    },
  },
  safelist: [
    // Gradients and overlays commonly used across views
    {
      pattern: /bg-(gray|amber|yellow|purple|violet|blue|green|red|indigo|cyan)-(50|100|200|300|400|500|600|700|800|900)(\/\d+)?/,
      variants: ['hover', 'md', 'lg'],
    },
    { pattern: /(from|to|via)-(black|white|gray|amber|purple|violet)-(\d+)(\/\d+)?/ },
    { pattern: /(backdrop-blur|shadow|rounded|border|opacity|grid|flex|items-center|justify|text-\w+)/ },
  ],
  plugins: [],
};