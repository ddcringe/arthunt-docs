# ArtHunt Docs

Техническая документация платформы [ArtHunt] — маркетплейс творческих специалистов.

##  Сайт

**GitHub Pages:** https://ddcringe.github.io/arthunt-docs/

##  Структура

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD — автодеплой на GitHub Pages
├── my-website/
│   ├── docs/                 # Markdown-документация
│   │   ├── intro.md          # Карточка сервиса
│   │   ├── architecture/     # Архитектурный анализ
│   │   ├── api/              # REST API + AsyncAPI
│   │   ├── db/               # Модель данных PostgreSQL
│   │   ├── scenarios/        # Пользовательские сценарии
│   │   └── platform/         # Стратегия платформы
│   ├── static/               # Статические файлы
│   ├── src/                  # React компоненты
│   ├── docusaurus.config.js  # Основной конфиг
│   ├── sidebars.js           # Навигация
│   └── package.json
└── README.md
```

##  Локальный запуск

```bash
cd my-website
npm install
npm run start
```

Откроется браузер на `http://localhost:3000/arthunt-docs/`

##  Деплой

Деплой происходит автоматически при пуше в ветку `main` через GitHub Actions.

Вручную:
```bash
cd my-website
npm run build
```

##  Разделы документации

| Раздел | Описание |
|--------|----------|
| Введение | Карточка сервиса, обзор |
| Архитектура | Компоненты системы, стек, архитектурный анализ |
| Модель данных | Схема PostgreSQL: таблицы, связи, индексы |
| API Reference | REST API (OpenAPI) + AsyncAPI уведомления |
| Сценарии | Пользовательские пути специалиста и заказчика |
| Стратегия | Монетизация, аудитория, платформизация |
