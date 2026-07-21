/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.jsx', './components/**/*.{js,jsx}', './pages/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cricket: '#34d399',
        ink: '#050816',
        panel: '#0d1424',
        shell: '#10192d'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(52, 211, 153, 0.16), 0 18px 44px rgba(0, 0, 0, 0.38)'
      }
    }
  },
  plugins: []
};
