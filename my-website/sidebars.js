/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: '🏠 Введение',
    },
    {
      type: 'category',
      label: '🏗️ Архитектура',
      items: [
        'architecture/overview',
        'architecture/components',
      ],
    },
    {
      type: 'category',
      label: '🗄️ Модель данных',
      items: [
        'db/data-model',
      ],
    },
    {
      type: 'category',
      label: '📡 API',
      items: [
        'api/overview',
        'api/async-notifications',
      ],
    },
    {
      type: 'category',
      label: '👤 Пользовательские сценарии',
      items: [
        'scenarios/specialist-flow',
        'scenarios/client-flow',
      ],
    },
    {
      type: 'category',
      label: '📈 Платформа',
      items: [
        'platform/strategy',
      ],
    },
  ],
};

module.exports = sidebars;
