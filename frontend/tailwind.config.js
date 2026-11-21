/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Theme Aware Colors (via CSS variables)
        main: 'var(--bg-main)',
        surface: 'var(--bg-surface)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        primary: 'var(--primary)',
        'card-bg': 'var(--card-bg)',
        'border-theme': 'var(--border-color)',
        'nav-bg': 'var(--nav-bg)',
        
        // ── Sage Palette
        sage: {
          50:  '#f0f4f1',
          100: '#dde8df',
          200: '#cad2c5',
          300: '#a8bfaa',
          400: '#84a98c',
          500: '#52796f',
          600: '#354f52',
          700: '#2f4550',
          800: '#263d44',
          900: '#1e2f35',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'sage-gradient': 'linear-gradient(135deg, #354f52 0%, #52796f 50%, #84a98c 100%)',
        'dark-gradient': 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
        'sage-glow': '0 0 20px rgba(132, 169, 140, 0.3)',
        'sage-glow-sm': '0 0 10px rgba(132, 169, 140, 0.25)',
        'sage-glow-lg': '0 0 40px rgba(132, 169, 140, 0.4)',
      },
      borderColor: {
        glass: 'rgba(255, 255, 255, 0.12)',
        'glass-sage': 'rgba(132, 169, 140, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.4s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
