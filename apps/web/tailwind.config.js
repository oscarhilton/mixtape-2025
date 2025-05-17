/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/shared-ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Colors and fontFamily are now defined in globals.css via @theme
    },
  },
  plugins: [
    // require('@tailwindcss/forms'), // If you need styled form elements
    // require('@tailwindcss/typography'), // If you have prose/markdown content
  ],
}; 