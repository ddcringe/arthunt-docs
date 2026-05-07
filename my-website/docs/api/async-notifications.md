---
title: AsyncAPI — Уведомления
sidebar_position: 2
description: Асинхронный контракт email-уведомлений через RabbitMQ
---

# AsyncAPI — Email Notifications

> **Версия:** 1.0.0 (AsyncAPI 3.0.0)  
> **Брокер:** RabbitMQ 3.13 (AMQP 0-9-1)  
> **Producer:** Go/Gin монолит (arthunt-api)  
> **Consumer:** Go-воркер notification-service

## Покрываемые сценарии

| ID | Сценарий | Получатель |
|----|----------|------------|
| AH-MVP-007 | Специалист отправил отклик на проект | Заказчик получает письмо "Новый отклик на ваш проект" |
| AH-MVP-006 | Заказчик отправил приглашение специалисту | Специалист получает письмо "Вас пригласили в проект" |

## Архитектура очередей

```
arthunt-api (Producer)
      │
      │  publish
      ▼
Exchange: arthunt.notifications (topic, durable)
      │
      ├─── routing key: notifications.email.response.created
      │         │
      └─── routing key: notifications.email.invitation.created
                │
                ▼
      Queue: email.notifications (durable)
                │
                │  consume (manual-ack)
                ▼
      notification-service (Worker)
                │
                ├── [success] → отправить email → ack
                │
                └── [fail × 3] → nack (no requeue)
                          │
                          ▼
                  DLQ: email.notifications.dlq
```

:::info DLQ мониторинг
Сообщения попадают в DLQ после 3 неуспешных попыток. Мониторится Prometheus-алертом: `rabbitmq_queue_messages{queue="email.notifications.dlq"} > 0`
:::

## Конфигурация RabbitMQ

```yaml
server: rabbitmq.arthunt.ru:5672
vhost: /arthunt
protocol: amqp
version: 0-9-1
```

## Канал: responseCreated

**Routing key:** `notifications.email.response.created`

Публикуется после успешной записи отклика специалиста в PostgreSQL.

### Структура сообщения

```json
{
  "envelope": {
    "eventId": "7f1a0c62-5b1b-4d1a-9f1c-44cf2df5a111",
    "eventType": "response.created",
    "schemaVersion": 1,
    "occurredAt": "2026-07-15T10:21:44Z",
    "producer": "arthunt-api",
    "traceId": "0af7651916cd43dd8448eb211c80319c"
  },
  "data": {
    "responseId": "3a2c0fb6-1d2e-4c0a-9a6b-8c5d7e0a12d4",
    "projectId": "1b64a0f4-0a1c-4d4e-8f90-0c7a1b2c3d4e",
    "projectTitle": "Редизайн лендинга для студии керамики",
    "recipient": {
      "userId": "0c0e2d2a-5c71-4a3f-8a2f-7e9c1b3d4a55",
      "email": "anna.client@example.com",
      "displayName": "Анна Клиент"
    },
    "actor": {
      "userId": "9f4e8b7a-2c9f-4f1e-b5c3-6d2e1f0a8b77",
      "displayName": "Михаил Дизайнер"
    },
    "proposedPrice": 45000,
    "proposedCurrency": "RUB",
    "proposedDeadlineDays": 14,
    "deepLink": "https://arthunt.ru/projects/.../responses"
  }
}
```

### Схема полей `data`

| Поле | Тип | Обязательное | Описание |
|------|-----|:---:|---------|
| `responseId` | uuid | ✅ | ID отклика |
| `projectId` | uuid | ✅ | ID проекта |
| `projectTitle` | string | ✅ | Название проекта |
| `recipient` | object | ✅ | Заказчик — владелец проекта |
| `actor` | object | ✅ | Специалист, отправивший отклик |
| `proposedPrice` | integer | ❌ | Предложенная цена (если указана) |
| `proposedCurrency` | enum | ❌ | Валюта (`RUB`) |
| `proposedDeadlineDays` | integer | ❌ | Предложенный срок в днях |
| `deepLink` | uri | ✅ | Ссылка на отклик в кабинете заказчика |

## Канал: invitationCreated

**Routing key:** `notifications.email.invitation.created`

Публикуется после успешной записи приглашения в PostgreSQL.

### Структура сообщения

```json
{
  "envelope": {
    "eventId": "2e9d1b4a-7f3c-48aa-a0e4-1b2c9de0f3c2",
    "eventType": "invitation.created",
    "schemaVersion": 1,
    "occurredAt": "2026-07-15T12:03:07Z",
    "producer": "arthunt-api",
    "traceId": "1bf7651916cd43dd8448eb211c80319c"
  },
  "data": {
    "invitationId": "b8a9e1f2-3c4d-4e5f-60a7-18b9c0d1e2f3",
    "projectId": "1b64a0f4-0a1c-4d4e-8f90-0c7a1b2c3d4e",
    "projectTitle": "Редизайн лендинга для студии керамики",
    "recipient": {
      "userId": "9f4e8b7a-2c9f-4f1e-b5c3-6d2e1f0a8b77",
      "email": "mikhail.designer@example.com",
      "displayName": "Михаил Дизайнер"
    },
    "actor": {
      "userId": "0c0e2d2a-5c71-4a3f-8a2f-7e9c1b3d4a55",
      "displayName": "Анна Клиент"
    },
    "message": "Добрый день! Ваш стиль идеально подходит под наш проект.",
    "deepLink": "https://arthunt.ru/invitations/b8a9e1f2-..."
  }
}
```

### Схема полей `data`

| Поле | Тип | Обязательное | Описание |
|------|-----|:---:|---------|
| `invitationId` | uuid | ✅ | ID приглашения |
| `projectId` | uuid | ❌ | ID проекта (null — без привязки) |
| `projectTitle` | string | ❌ | Название проекта |
| `recipient` | object | ✅ | Специалист, получающий приглашение |
| `actor` | object | ✅ | Заказчик, отправивший приглашение |
| `message` | string | ❌ | Сопроводительное сообщение (до 2000 символов) |
| `deepLink` | uri | ✅ | Ссылка на приглашение в кабинете специалиста |

## Общий конверт (Envelope)

Все сообщения содержат конверт для версионирования и трассировки:

```json
{
  "eventId": "uuid",         // ключ идемпотентности
  "eventType": "string",     // response.created | invitation.created
  "schemaVersion": 1,        // версия схемы payload
  "occurredAt": "ISO-8601",  // момент события (UTC)
  "producer": "string",      // имя сервиса-источника
  "traceId": "string"        // OpenTelemetry trace id (опционально)
}
```

:::tip Идемпотентность
Consumer должен использовать `eventId` как ключ идемпотентности — хранить уже обработанные события в Redis чтобы не отправлять дублирующие письма.
:::

## Retry стратегия

```
Попытка 1 → fail → wait 5s
Попытка 2 → fail → wait 30s
Попытка 3 → fail → nack (no requeue) → DLQ
```
