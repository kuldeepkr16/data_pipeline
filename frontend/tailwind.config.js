/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-space': '#050505',
        'card-bg': '#111111',
        'star-glow': '#646cff',
      },
    },
  },
  plugins: [],
};

