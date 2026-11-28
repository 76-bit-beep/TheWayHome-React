import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { lodgingSchema } from './src/seo/structuredData.js'
import { seoConfig } from './src/seo/config.js'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'thewayhome-crawl-files',
      apply: 'build',
      generateBundle() {
        const isLive = mode === seoConfig.launchMode
        const siteUrl = `${seoConfig.productionUrl}/`

        const robots = [
          'User-agent: *',
          'Allow: /',
          ...(isLive
            ? [`Sitemap: ${siteUrl}sitemap.xml`]
            : []),
          '',
        ].join('\n')

        this.emitFile({
          type: 'asset',
          fileName: 'robots.txt',
          source: robots,
        })

        if (isLive) {
          const sitemap = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            '  <url>',
            `    <loc>${siteUrl}</loc>`,
            '  </url>',
            '</urlset>',
            '',
          ].join('\n')

          this.emitFile({
            type: 'asset',
            fileName: 'sitemap.xml',
            source: sitemap,
          })
        }
      },
    },
    {
      name: 'thewayhome-admin-seo',
      enforce: 'post',
      apply: 'build',
      generateBundle(_options, bundle) {
        const homepage = bundle['index.html']

        if (!homepage || homepage.type !== 'asset') {
          this.error('Homepage HTML not found')
        }

        const adminHtml = String(homepage.source)
          .replace(
            /<title>[\s\S]*?<\/title>/i,
            '<title>Admin Login | The Way Home</title>'
          )
          .replace(
            /<meta\b[^>]*(?:name="description"|name="author"|property="og:[^"]+"|name="robots")[^>]*>/gi,
            ''
          )
          .replace(
            /<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,
            ''
          )
          .replace(
            /<link\b[^>]*rel="canonical"[^>]*>/gi,
            ''
          )
          .replace(
            '</head>',
            `  <meta name="robots" content="${seoConfig.adminRobots}">\n  </head>`
          )

        this.emitFile({
          type: 'asset',
          fileName: 'admin/index.html',
          source: adminHtml,
        })
      },
    },
    {
      name: 'thewayhome-seo',
      transformIndexHtml() {
        const canonicalTags = mode === seoConfig.launchMode
          ? [
              {
                tag: 'link',
                attrs: {
                  rel: 'canonical',
                  href: `${seoConfig.productionUrl}/`,
                },
                injectTo: 'head',
              },
              {
                tag: 'meta',
                attrs: {
                  property: 'og:url',
                  content: `${seoConfig.productionUrl}/`,
                },
                injectTo: 'head',
              },
            ]
          : []
        return [
          ...canonicalTags,
          ...(mode === seoConfig.launchMode
            ? [
                {
                  tag: 'meta',
                  attrs: {
                    property: 'og:image',
                    content: `${seoConfig.productionUrl}/images/homepage/home_01.jpg`,
                  },
                  injectTo: 'head',
                },
                ...Object.entries({
                  'og:image:alt': 'Entrance to The Way Home self-catering accommodation in Vredenburg',
                  'og:image:type': 'image/jpeg',
                  'og:image:width': '315',
                  'og:image:height': '180',
                }).map(([property, content]) => ({
                  tag: 'meta',
                  attrs: { property, content },
                  injectTo: 'head',
                })),
              ]
            : []),
          {
            tag: 'script',
            attrs: {
              type: 'application/ld+json',
            },
            children: JSON.stringify(lodgingSchema),
            injectTo: 'head',
          },
          {
            tag: 'meta',
            attrs: {
              name: 'robots',
              content: seoConfig.getRobots(mode),
            },
            injectTo: 'head',
          },
        ]
      },
    },
  ],
  base: mode === 'github' ? '/TheWayHome-React/' : '/',
}))