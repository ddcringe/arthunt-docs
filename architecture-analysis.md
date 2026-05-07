# ARTHUNT — Архитектурный анализ (System Design Review)

> Дата: Апрель 2026  
> Статус: MVP (v1.0, запуск 01.07.2026)  
> Стек: Go/Gin · PostgreSQL · MongoDB · Elasticsearch · RabbitMQ

---

## 1. Требования

### Функциональные (MVP)

| Домен | Ключевые требования |
|-------|---------------------|
| Auth | Регистрация email+password, OAuth (VK/Google/Яндекс), JWT, подтверждение email |
| Специалисты | Профиль, портфолио (≥3 работ), теги, ценовой диапазон |
| Клиенты | Создание проектов, поиск специалистов, прямые приглашения |
| Матчинг | Отклики (1 на проект/специалист), приглашения (1 на клиент/специалист/проект) |
| Поиск | Полнотекстовый + тег-фильтры (стиль, жанр, техника, настроение, цвет, формат) |
| Модерация | Очередь проверки портфолио и проектов, блокировка пользователей |
| Поддержка | Тикет-система, уведомления по email |

### Нефункциональные

| Требование | Целевое значение | Приоритет |
|------------|-----------------|-----------|
| Поиск | < 2 сек при 100 конкурентных запросах | Высокий |
| Доступность | 99.9% uptime | Высокий |
| Безопасность | Хешированные пароли, авторизация всех эндпоинтов | Высокий |
| Соответствие | ФЗ-152 (персональные данные) | Высокий |
| Масштабируемость | Горизонтальное масштабирование | Высокий |
| Наблюдаемость | Логирование событий, алерты на отказы | Средний |
| UX | 95% новых пользователей завершают ключевые действия без инструкций | Средний |

### Оценка нагрузки (3 мес после запуска)

```
MAU: ~650 пользователей (500 специалистов + 150 клиентов)
Проекты: ~45 в месяц (30% клиентов × 150)
Отклики: ~300 в месяц (~6-7 на проект)
Поисковые запросы: ~2 000 в месяц (консервативно)
Медиафайлы: ~6 000 файлов в портфолио (500 спец. × 12 работ)

RPS (пик): ~5-10 req/s — это низкая нагрузка для MVP
```

> **Вывод:** Для MVP нагрузка незначительна. Архитектурные решения нужно оценивать с позиции **операционной сложности**, а не масштабируемости.

---

## 2. Текущая архитектура (описание)

```
                    ┌─────────────────────────────────────────┐
                    │            Клиент (Browser)              │
                    └──────────────────┬──────────────────────┘
                                       │ HTTPS
                    ┌──────────────────▼──────────────────────┐
                    │           Nginx (API Gateway)            │
                    │   TLS termination · Rate limit · Proxy   │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │         Go / Gin (Monolith API)          │
                    │  auth · specialists · projects · search  │
                    │  responses · invitations · moderation    │
                    └──────┬───────┬────────┬──────┬──────────┘
                           │       │        │      │
               ┌───────────▼─┐  ┌──▼───┐  ┌▼─────┴──┐  ┌──────────────┐
               │ PostgreSQL  │  │Mongo │  │  Elastic │  │  RabbitMQ    │
               │  основные   │  │ DB   │  │  Search  │  │ async tasks  │
               │  сущности   │  │      │  │  индекс  │  │ email/notifs │
               └─────────────┘  └──────┘  └──────────┘  └──────────────┘

           ❌ Отсутствует: Object Storage (S3/MinIO), Redis, CDN
```

---

## 3. Анализ ключевых решений

### 3.1 Go + Gin

**Плюсы:**
- Высокая конкурентность из коробки (goroutines)
- Быстрая компиляция и статическая типизация
- Gin — production-ready, хорошая документация
- Отличный выбор для REST API

**Минусы / Риски:**
- Небольшая команда (1 backend dev) — Go требует аккуратности с error handling
- Отсутствует встроенный ORM (нужен GORM, sqlx или squirrel)

**Оценка:** ✅ Хорошее решение, соответствует требованиям.

---

### 3.2 PostgreSQL + MongoDB (двойная БД) ⚠️

**Текущее описание:** PostgreSQL — структурированные данные, MongoDB — полуструктурированные.

**Проблема: нет чёткого разделения ответственности.**

Глядя на схему данных в OpenAPI:

| Сущность | Где должна жить | Почему |
|----------|-----------------|--------|
| users | PostgreSQL | Строгие связи, транзакции (auth) |
| specialist_profiles | PostgreSQL | Связан с users, нужны JOIN-ы |
| projects | PostgreSQL | Статусные машины, транзакции |
| responses | PostgreSQL | Бизнес-правила (1 на проект), транзакции |
| invitations | PostgreSQL | Уникальность, constraint-ы |
| portfolio_items | PostgreSQL + Object Storage | Метаданные в PG, файлы в S3 |
| tags (справочник) | PostgreSQL | Нормализованный справочник |
| support_tickets | PostgreSQL | Связи, статусы |

> **Вывод: MongoDB в текущей архитектуре практически не нужен для MVP.**
>
> Все данные имеют чёткую реляционную структуру. Использование MongoDB параллельно с PostgreSQL создаёт **операционную сложность без пользы** — два хранилища, два бэкапа, два набора навыков, риски согласованности данных.

**Рекомендация:** Убрать MongoDB из MVP. Если в будущем появятся действительно полуструктурированные данные (например, конфигурации тегов или пользовательские метрики), рассмотреть JSONB-поля в PostgreSQL — это практически решает 95% задач MongoDB.

---

### 3.3 Elasticsearch ✅

**Правильное решение.** Теговая фильтрация — ключевое конкурентное преимущество платформы. Elasticsearch позволяет:
- Полнотекстовый поиск по описанию специалистов и проектов
- Фасетную фильтрацию по тегам (style, genre, technique, mood...)
- Нечёткий поиск и синонимы
- Сортировку по релевантности

**Что нужно проработать:**

```
Индекс специалистов (specialist_index):
{
  "id": "uuid",
  "name": "text (analyzed)",
  "specialization": "keyword",
  "bio": "text (analyzed)",
  "city": "keyword",
  "tags": ["keyword array"],
  "price_min": "integer",
  "price_max": "integer",
  "rating": "float",
  "portfolio_count": "integer",
  "is_visible": "boolean"  ← только с ≥3 работами и модерацией
}

Индекс проектов (project_index):
{
  "id": "uuid",
  "title": "text (analyzed)",
  "description": "text (analyzed)",
  "tags": ["keyword array"],
  "budget_min": "integer",
  "budget_max": "integer",
  "status": "keyword",
  "published_at": "date"
}
```

**Риск: двойная запись (PostgreSQL + Elasticsearch).**  
Нужна стратегия синхронизации. Рекомендуется паттерн **Outbox + RabbitMQ**: запись сначала в PG, затем событие в очередь, консьюмер обновляет ES-индекс. Это обеспечивает eventual consistency без сильного связывания.

---

### 3.4 RabbitMQ ✅

**Правильное решение** для:
- Отправки email-уведомлений
- Обновления Elasticsearch-индекса после модерации
- Логирования аналитики

**Что нужно проработать:**

```
Очереди:
  arthunt.notifications  → email delivery
  arthunt.search.index   → ES sync (добавление/обновление/удаление)
  arthunt.moderation     → уведомления модераторам

Dead Letter Queue (DLQ):
  arthunt.dlq → упавшие сообщения для ретрая/анализа

Retry strategy:
  3 попытки → exponential backoff → DLQ
```

---

### 3.5 Nginx ✅

Правильный выбор для:
- TLS termination
- Rate limiting (защита от DDoS/abuse)
- Reverse proxy к Go-серверу
- Отдача статики (если не CDN)

---

## 4. Критические пробелы (чего не хватает)

### 4.1 ❌ Object Storage (S3 / MinIO)

Портфолио — это изображения, видео, PDF. В текущей архитектуре нет хранилища для медиафайлов.

**Проблема:** Хранить файлы на диске сервера = нельзя горизонтально масштабировать, нет CDN, нет резервирования.

**Решение:**

```
┌──────────┐   presigned URL   ┌─────────────┐   upload   ┌──────────────┐
│ Frontend │ ──────────────→  │  Go API     │            │  S3/MinIO    │
│          │ ←────────────── │  (генерирует│ ─────────→ │  (хранилище  │
│          │   upload URL     │   URL)      │            │  файлов)     │
└──────────┘                  └─────────────┘            └──────────────┘
                                                                 │
                                                         ┌───────▼──────┐
                                                         │   CDN        │
                                                         │ (раздача     │
                                                         │  контента)   │
                                                         └──────────────┘
```

Для MVP: **MinIO** (self-hosted, бесплатно, S3-совместим) или **Yandex Object Storage** / **VK Cloud S3**.

---

### 4.2 ❌ Кеширующий слой (Redis)

Нет кеша для:
- Публичных страниц специалистов (горячие профили)
- Списков тегов (справочник меняется редко)
- JWT черный список (для logout/revoke)
- Rate limiting (Nginx может, но Redis даёт больше гибкости)
- Сессии OAuth

**Рекомендация:** Redis (managed) — добавить в архитектуру на старте.

```
Что кешировать:
  GET /specialists/{id}     → TTL 5 мин (сброс при PATCH)
  GET /tags                 → TTL 1 час
  Результаты /specialists?  → TTL 2 мин
  JWT revocation list       → TTL = время жизни токена
```

---

### 4.3 ❌ Стратегия API-версионирования

OpenAPI показывает версию 1.0.0, но пути `/auth/...`, `/specialists/...` без префикса `/v1/`.

**Проблема:** После запуска сложно вносить breaking changes.

**Рекомендация:** Использовать `/api/v1/` с первого дня.

---

### 4.4 ❌ Rate Limiting на уровне API

В спецификации нет rate limiting. Критично для:
- Защиты от brute-force на `/auth/login`
- Ограничения отправки откликов/приглашений
- Защиты от скрапинга портфолио

**Рекомендация:**
```
/auth/login       → 5 req/min per IP
/auth/register    → 3 req/min per IP  
/responses (POST) → 20 req/hour per user
/invitations      → 50 req/day per user
```

---

### 4.5 ❌ Monitoring & Observability

Упомянуто как NFR, но не описана реализация.

**Минимальный стек:**
```
Логи:    Zap (structured logging) → stdout → Loki / ELK
Метрики: Prometheus (Go client) → Grafana
Трейсы:  OpenTelemetry (при необходимости в v2)
Алерты:  Grafana Alerting / PagerDuty
```

**Ключевые метрики для дашборда:**
- Latency p50/p95/p99 на ключевых эндпоинтах
- Error rate (4xx, 5xx)
- DB connection pool utilization
- RabbitMQ queue depth
- ES query time

---

## 5. Обновлённая схема архитектуры

```
                    ┌─────────────────────────────────────────────────┐
                    │               Клиент (Browser)                   │
                    └──────────────────────┬──────────────────────────┘
                                           │ HTTPS
                    ┌──────────────────────▼──────────────────────────┐
                    │         CDN (Yandex/VK Cloud / Cloudflare)       │
                    │              статика, медиафайлы                 │
                    └────────────┬─────────────────┬───────────────────┘
                                 │ API requests     │ media
                    ┌────────────▼────────────┐   ┌▼─────────────────┐
                    │    Nginx (API Gateway)   │   │ Object Storage   │
                    │ TLS · RateLimit · Proxy  │   │   S3 / MinIO     │
                    └────────────┬────────────┘   └──────────────────┘
                                 │
                    ┌────────────▼────────────────────────────────────┐
                    │            Go / Gin (Monolith API)               │
                    │  auth · specialists · projects · search          │
                    │  responses · invitations · moderation · support  │
                    └───┬──────────┬──────────┬──────────┬────────────┘
                        │          │          │          │
             ┌──────────▼──┐  ┌───▼──┐  ┌───▼──────┐  ┌▼─────────────┐
             │ PostgreSQL  │  │Redis │  │Elasticsrc│  │  RabbitMQ    │
             │ Основная БД │  │Cache │  │  Search  │  │   Очереди    │
             │ (все данные │  │+JWT  │  │  Индекс  │  │ email/index/ │
             │  MVP)       │  │BList │  │          │  │ notifs       │
             └─────────────┘  └──────┘  └──────────┘  └──────┬───────┘
                                                              │
                                                   ┌──────────▼───────┐
                                                   │ Worker (Go)      │
                                                   │ email, ES sync,  │
                                                   │ analytics        │
                                                   └──────────────────┘

             ┌─────────────────────────────────────────────────────────┐
             │         Observability Stack                              │
             │   Prometheus + Grafana · Loki (logs) · Alerts           │
             └─────────────────────────────────────────────────────────┘
```

---

## 6. Дизайн данных

### PostgreSQL — схема (упрощённо)

```sql
-- Пользователи
users (id, email, password_hash, role, name, avatar_url, is_confirmed, is_blocked, created_at)

-- Профиль специалиста
specialist_profiles (
  id, user_id FK, specialization, city, bio,
  price_min, price_max,
  portfolio_count, reviews_count, avg_rating, completed_count,
  is_moderated, created_at
)

-- Теги (справочник)
tags (id, name, category)

-- M2M: специалист ↔ теги
specialist_tags (specialist_id FK, tag_id FK)

-- Работы портфолио
portfolio_items (
  id, specialist_id FK, title, description,
  moderation_status, created_at
)
portfolio_media (id, portfolio_item_id FK, media_url, order)
portfolio_item_tags (portfolio_item_id FK, tag_id FK)

-- Проекты
projects (
  id, client_id FK, title, description,
  status, budget_min, budget_max, deadline_days,
  max_responses, responses_count,
  moderation_status, created_at, published_at
)
project_deliverables (id, project_id FK, text)
project_tags (project_id FK, tag_id FK)

-- Отклики
responses (
  id, project_id FK, specialist_id FK,
  cover_letter, proposed_price, proposed_deadline_days,
  status, created_at
)
response_portfolio_items (response_id FK, portfolio_item_id FK)

-- Приглашения
invitations (
  id, project_id FK, client_id FK, specialist_id FK,
  message, status, rejection_reason, created_at
)

-- Тикеты поддержки
support_tickets (id, user_id FK, topic, status, created_at)
support_messages (id, ticket_id FK, author_id FK, text, created_at)

-- Email-подтверждение / токены
email_tokens (id, user_id FK, token, expires_at, used)
```

### Elasticsearch — индексы

```json
// Индекс: specialists
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text", "analyzer": "russian" },
      "specialization": { "type": "keyword" },
      "bio": { "type": "text", "analyzer": "russian" },
      "city": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "price_min": { "type": "integer" },
      "price_max": { "type": "integer" },
      "avg_rating": { "type": "float" },
      "portfolio_count": { "type": "integer" },
      "is_visible": { "type": "boolean" }
    }
  }
}

// Индекс: projects
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "title": { "type": "text", "analyzer": "russian" },
      "description": { "type": "text", "analyzer": "russian" },
      "tags": { "type": "keyword" },
      "budget_min": { "type": "integer" },
      "budget_max": { "type": "integer" },
      "status": { "type": "keyword" },
      "published_at": { "type": "date" }
    }
  }
}
```

---

## 7. Стратегия синхронизации Elasticsearch

**Паттерн Outbox:**

```
1. API сохраняет изменение в PostgreSQL (транзакция)
2. В той же транзакции записывает событие в таблицу outbox_events
3. Worker читает outbox_events и публикует в RabbitMQ
4. ES-консьюмер обновляет индекс
5. Помечает событие как обработанное

outbox_events (id, aggregate_type, aggregate_id, event_type, payload JSONB, processed_at)

Триггеры для индексации:
- specialist_profiles: PATCH /specialists/me
- portfolio_items: POST/DELETE (после модерации)
- projects: POST (после модерации), PATCH status
```

---

## 8. API-эндпоинты — рекомендованные улучшения

### Текущие (OpenAPI 1.0.0)

Базовый путь: `/specialists`, `/projects`, etc.

### Рекомендуемые изменения

```
Добавить версионирование: /api/v1/...

Недостающие эндпоинты:
  POST /api/v1/auth/refresh          - обновление JWT
  POST /api/v1/auth/logout           - revoke токена
  POST /api/v1/media/upload          - presigned URL для загрузки файлов
  GET  /api/v1/specialists/me        - профиль текущего специалиста
  GET  /api/v1/projects/my           - проекты текущего клиента
  POST /api/v1/moderation/portfolio  - одобрить/отклонить работу
  POST /api/v1/moderation/projects   - одобрить/отклонить проект

Отсутствует в спецификации:
  - Эндпоинт обновления пароля
  - Эндпоинт удаления аккаунта
  - Эндпоинт поддержки (создание тикета)
```

---

## 9. Компромиссный анализ (Trade-offs)

| Решение | Плюсы | Минусы | Рекомендация |
|---------|-------|--------|--------------|
| Монолит (Go) | Просто, быстро, 1 репозиторий | Сложнее масштабировать части | ✅ Правильно для MVP |
| PostgreSQL | ACID, JOIN-ы, надёжность | Вертикальное масштабирование | ✅ Достаточно для MVP |
| MongoDB | Гибкость схемы | Лишняя сложность, нет ACID | ❌ Убрать из MVP |
| Elasticsearch | Мощный поиск | Eventual consistency, сложность | ✅ Необходим для фичи тегов |
| RabbitMQ | Надёжные очереди | Ещё один сервис для поддержки | ✅ Оправдан |
| Нет Redis | Проще | Нет кеша, нет JWT revoke | ⚠️ Добавить |
| Нет S3 | Проще начать | Серьёзная проблема с медиа | ❌ Критично добавить |
| Нет CDN | Проще | Медленная раздача медиа | ⚠️ Добавить вместе с S3 |

---

## 10. Приоритизированный список доработок

### 🔴 Критично (до запуска MVP)

1. **Добавить Object Storage** — MinIO (self-hosted) или Yandex Object Storage. Без него нельзя хранить медиа портфолио.
2. **Убрать MongoDB** — заменить на PostgreSQL+JSONB там, где нужна гибкость схемы. Снизит операционную нагрузку.
3. **Добавить Redis** — JWT blacklist (logout), кеш тегов и публичных профилей.
4. **Реализовать стратегию ES-синхронизации** — Outbox + RabbitMQ consumer, иначе поиск будет показывать устаревшие данные.
5. **Rate limiting на auth-эндпоинты** — защита от брутфорса.

### 🟡 Важно (первые 2 недели после запуска)

6. **Версионирование API** — добавить `/api/v1/` префикс с самого начала.
7. **Observability** — Prometheus + Grafana + алерты. Без мониторинга MVP будет "слепым".
8. **Отсутствующие эндпоинты** — `/auth/refresh`, `/media/upload`, `/auth/logout`.
9. **Настроить DLQ в RabbitMQ** — защита от потери сообщений.

### 🟢 Для v2.0

10. **CDN** — раздача медиа через CDN при росте трафика.
11. **Полнотекстовый поиск на русском** — настройка `russian` analyzer в ES с морфологией.
12. **Вынесение воркера в отдельный сервис** — когда монолит начнёт давить.

---

## 11. Итоговая оценка архитектуры

```
Компонент               Оценка   Комментарий
─────────────────────── ──────── ─────────────────────────────────────────
Go + Gin                ✅ 9/10  Отличный выбор
PostgreSQL              ✅ 9/10  Достаточно для всего MVP
MongoDB                 ❌ 2/10  Не нужен, лишняя сложность
Elasticsearch           ✅ 8/10  Правильно, нужна ES-синхронизация
RabbitMQ                ✅ 7/10  Нужна DLQ стратегия
Nginx                   ✅ 8/10  OK
Object Storage          ❌ 0/10  ОТСУТСТВУЕТ — критично
Redis                   ❌ 0/10  ОТСУТСТВУЕТ — нужен
Monitoring              ⚠️ 3/10  Упомянут, не реализован
API Versioning          ⚠️ 4/10  Нет в текущей спецификации

ИТОГОВАЯ ЗРЕЛОСТЬ MVP:  ~6/10  — Хорошая основа, есть конкретные пробелы
```

---

*Документ сгенерирован в рамках System Design Review проекта ARTHUNT*
