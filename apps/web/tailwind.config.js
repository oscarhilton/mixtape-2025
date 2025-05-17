/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media', // or 'class' if you prefer manual toggling
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/shared-ui/src/**/*.{js,ts,jsx,tsx}', // Path to your shared UI components
  ],
  theme: {
    extend: {
      colors: {
        // Spotify-esque color palette (placeholders, we can refine)
        'spotify-dark': '#121212',        // Very dark background
        'spotify-light-dark': '#181818', // Slightly lighter dark for cards/modules
        'spotify-gray': '#282828',        // Medium dark gray for elements
        'spotify-light-gray': '#B3B3B3',  // Text color for dark mode
        'spotify-green': '#1DB954',       // Spotify's brand green
        // Ableton-esque accents (optional, can be more muted or functional)
        'ableton-blue': '#00A0E0',
        'ableton-orange': '#FF7F00',
      },
      fontFamily: {
        // Assuming you're using Geist font as per your layout.tsx
        // These are already set up with CSS variables, so Tailwind can pick them up
        // if you use `font-sans` or `font-mono` in your classes.
        // You can also explicitly map them here if desired:
        // sans: ['var(--font-geist-sans)', 'sans-serif'],
        // mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [
    // require('@tailwindcss/forms'), // If you need styled form elements
    // require('@tailwindcss/typography'), // If you have prose/markdown content
  ],
}; 