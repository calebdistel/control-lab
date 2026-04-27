import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://controllab.frc498.com',
  integrations: [mdx(), react()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      langs: ['java', 'javascript', 'bash', 'json'],
    },
  },
});
