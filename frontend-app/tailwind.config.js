/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Futuristic Dark Blue Theme
        primary: {
          50: '#0a0e1a',
          100: '#0f1629',
          200: '#1a2440',
          300: '#253356',
          400: '#30426d',
          500: '#3b5284',
          600: '#4663a0',
          700: '#5c7ccd',
          800: '#8da4db',
          900: '#c5d2f0',
        },
        cyber: {
          50: '#040d1a',
          100: '#0a1629',
          200: '#0f1f38',
          300: '#152947',
          400: '#1b3356',
          500: '#213d65',
          600: '#2a4d7d',
          700: '#346095',
          800: '#4876b8',
          900: '#6b96d4',
        },
        neon: {
          blue: '#00d4ff',
          cyan: '#00ffff',
          purple: '#a855f7',
          pink: '#ec4899',
          green: '#00ff88',
          amber: '#fbbf24',
        },
        dark: {
          bg: '#030712',
          surface: '#0f172a',
          elevated: '#1e293b',
          border: '#334155',
          text: {
            primary: '#f8fafc',
            secondary: '#cbd5e1',
            muted: '#64748b',
          }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-cyber': 'linear-gradient(135deg, #0a0e1a 0%, #1a2440 50%, #213d65 100%)',
        'gradient-neon': 'linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)',
        'gradient-panel': 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(0, 212, 255, 0.3)',
        'neon-purple': '0 0 20px rgba(168, 85, 247, 0.3)',
        'cyber': '0 4px 20px rgba(0, 212, 255, 0.1)',
        'panel': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'inner-panel': 'inset 0 1px 2px rgba(0, 212, 255, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(0, 212, 255, 0.4)' },
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'tech': ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
}