import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  // The mobile app runs as a single-page app bundled inside the Android / iOS project
  ssr: false,
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // Address of the Paystack payment service (payments/ folder, deployed on Netlify),
      // e.g. https://service-dictionary-pay.netlify.app. Can also be set with
      // NUXT_PUBLIC_PAYMENTS_API when building. Empty = payments switched off.
      paymentsApi: 'https://service-dictionary-pay.netlify.app',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    head: {
      title: 'Service Dictionary',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f5f2ea', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#161616', media: '(prefers-color-scheme: dark)' },
        { name: 'description', content: 'Service Dictionary: terms, abbreviations and prowords.' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
