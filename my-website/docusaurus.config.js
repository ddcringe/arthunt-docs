// @ts-check
const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'ArtHunt Docs',
  tagline: 'Техническая документация платформы ArtHunt',
  favicon: 'img/favicon.ico',

  url: 'https://ddcringe.github.io',
  baseUrl: '/arthunt-docs/',

  organizationName: 'ddcringe',
  projectName: 'arthunt-docs',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ru',
    locales: ['ru'],
  },

  presets: [
    [
      'classic',
      ({
        docs: {
          sidebarPath: './sidebars.js',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    ({
      navbar: {
        title: 'ArtHunt Docs',
        logo: {
          alt: 'ArtHunt Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Документация',
          },
          {
            href: 'https://github.com/ddcringe/arthunt-docs',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Документация',
            items: [
              { label: 'Введение', to: '/docs/intro' },
              { label: 'Архитектура', to: '/docs/architecture/overview' },
              { label: 'API', to: '/docs/api/overview' },
            ],
          },
          {
            title: 'Проект',
            items: [
              { label: 'GitHub', href: 'https://github.com/ddcringe/arthunt-docs' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} ArtHunt. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'yaml', 'sql', 'json'],
      },
    }),
};

module.exports = config;
