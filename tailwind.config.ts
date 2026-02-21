import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        fg: 'hsl(var(--fg))',
        card: 'hsl(var(--card))',
        muted: 'hsl(var(--muted))',
        border: 'hsl(var(--border))',
        accent: 'hsl(var(--accent))'
      }
    }
  },
  plugins: []
};

export default config;
