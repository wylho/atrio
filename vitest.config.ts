import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  // O plugin compila os .svelte, para testar os componentes de verdade.
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    // Os testes rodam em português (o jsdom diz inglês); os de inglês trocam e voltam.
    setupFiles: ['tests/setup.ts'],
  },
})
