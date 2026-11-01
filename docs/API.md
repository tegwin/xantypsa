# API

Every feature in Xanty PSA is reachable over HTTP. The web interface uses the
same endpoints you do, so there is nothing the UI can do that the API cannot.

A complete list of routes is in [API-INDEX.md](API-INDEX.md), generated from the
source so it cannot drift.

## Conventions

| | |
|---|---|
| Base URL | `https://your-instance/api` |
| Format | JSON in, JSON out |
| Authentication | Session cookie, or an API key |
| Tenancy | Every request is scoped to the caller's tenant |

### Authentication

Browser requests carry the signed session cookie. Machine clients send an API
key created under Integrations, API Keys:

```
Authorization: Bearer <api-key>
```

### Tenancy

You never pass a tenant id. It comes from the session or the API key, and every
query is filtered by it in the server. An id belonging to another tenant returns
404, not 403, so the API does not confirm that the record exists.

### Permissions

Each route declares a module and a level, shown in the index. `read` maps to
`<module>:view` and `write` to `<module>:edit`. A caller without the permission
gets 403.

### Errors

```json
{ "error": "Hourly rate is required" }
```

| Status | Meaning |
|---|---|
| 400 | The request is missing something or is contradictory |
| 401 | Not signed in, or the API key is wrong |
| 403 | Signed in, but without the permission the route needs |
| 404 | No such record in your tenant |
| 500 | A fault on our side |

### Lists

List endpoints accept `page`, `limit`, `search`, `sortBy` and `sortDir`, and
return:

```json
{ "items": [], "total": 0, "page": 1, "limit": 50 }
```

---

## Service desk

### Ticket notes

`POST /api/tickets/{id}/notes`

Adds a note, logs time, changes status, or any combination. A note is either
public, meaning the customer sees it in the portal, or private.

```json
{
  "content": "Replaced the failed drive and restored from backup.",
  "isInternal": false,
  "emailCustomer": true,
  "timeMinutes": 45,
  "billingRateId": "clx...",
  "billable": true,
  "isOOH": false,
  "newStatus": "resolved"
}
```

| Field | Type | Notes |
|---|---|---|
| `content` | string | The note body |
| `isInternal` | boolean | `true` keeps it private. Default `false` |
| `emailCustomer` | boolean | Emails the note to the ticket contact. Ignored on a private note |
| `timeMinutes` | number | Raw minutes. Minimum and rounding from the billing rate are applied |
| `billingRateId` | string | Falls back to the tenant default |
| `newStatus` | string | A status slug |

Response `201`:

```json
{
  "note": { "id": "clx..." },
  "timeEntry": { "id": "clx...", "hours": 0.75, "billedAmount": 112.5 },
  "statusChanged": true,
  "emailed": true
}
```

`emailed` is `false` with an `emailError` when the note saved but the email did
not go out. The note is never lost because the email failed.

`PATCH /api/tickets/{id}/notes`

Changes an existing note between public and private.

```json
{ "noteId": "clx...", "isInternal": true }
```

System notes are the audit trail and cannot be changed: `400`.

### Tickets

`PATCH /api/tickets/{id}` accepts `title`, `description`, `priority`, `type`,
`category`, `companyId`, `contactId`, `assignedToId`, `contractId`,
`opportunityId`, `dueDate` and `status`.

Setting a status that is flagged as closed stamps `closedAt`, whatever the
status is called. There can be as many closed statuses as you like.

`GET /api/tickets` filters on `companyId`, `opportunityId`, `status`, `type`,
`assigneeId`, `projectId`, `dateFrom` and `dateTo`.

### Service desk settings

`GET` and `PATCH /api/settings/service-desk`

```json
{
  "billingMode": "anytime",
  "timerEnabled": true,
  "timerOnlyOnTimeEntry": false,
  "timerOnlyOnPublicNotes": false
}
```

The timer runs whenever a ticket is open. Each `timerOnly*` option narrows that:
set both and it runs only while the time entry panel is open and the note being
written is public.

### Ticket statuses

`GET`, `POST /api/ticket-statuses`, `PATCH`, `DELETE /api/ticket-statuses/{id}`

`isClosed` marks the ticket closed and drops it out of the default views. Any
number of statuses may set it.

---

## Billing

### Billing rates

`GET`, `POST /api/billing-rates`, `PATCH`, `DELETE /api/billing-rates/{id}`

```json
{
  "name": "Standard",
  "code": "STD",
  "rate": 140,
  "costRate": 40,
  "minimumMinutes": 15,
  "roundingMinutes": 15,
  "oohMultiplier": 1.5,
  "isDefault": true
}
```

A non-billable rate is a different thing:

```json
{ "name": "Non-Billable", "code": "NON", "isNonBillable": true }
```

When `isNonBillable` is true the server forces `rate`, `costRate`,
`minimumMinutes` and `roundingMinutes` to zero, `oohMultiplier` to 1 and
`isDefault` to false, whatever you send. Work logged at the rate is never
charged, and never draws down a prepaid block or a managed service contract.

---

## CRM

### Pipeline stages

`GET`, `POST /api/pipeline-stages`, `PATCH`, `DELETE /api/pipeline-stages/{id}`

```json
{
  "name": "Negotiation",
  "color": "#f59e0b",
  "probability": 75,
  "isWon": false,
  "isLost": false,
  "isDefault": false,
  "sortOrder": 4
}
```

`isWon` and `isLost` are mutually exclusive: sending both is a `400`. Deleting a
stage that opportunities are sitting in deactivates it instead and says so:

```json
{ "deactivated": true, "message": "3 opportunities are in this stage, so it has been deactivated rather than deleted." }
```

### Win and loss reasons

`GET`, `POST /api/win-loss-reasons`, `PATCH`, `DELETE /api/win-loss-reasons/{id}`

```json
{ "name": "Chose a competitor", "type": "loss" }
```

`type` is `win` or `loss`. `GET` accepts `?type=loss`. Reasons are optional: a
tenant that defines none never sees the field. Deleting one that closed
opportunities cite deactivates it instead.

### Opportunities

`PATCH /api/opportunities/{id}` accepts `title`, `value`, `probability`,
`stage`, `source`, `notes`, `companyId`, `contactId`, `ownerId`,
`expectedClose`, `closedAt`, `lostReason` and `reasonId`.

`GET /api/opportunities/{id}` returns the deal with its company, contact, owner,
quotes, linked tickets, win or loss reason and notes.

### Opportunity notes

`GET`, `POST /api/opportunities/{id}/notes`

Add a note, move the deal on, or both:

```json
{
  "content": "Agreed scope on the call.",
  "stage": "negotiation",
  "reasonId": null
}
```

A stage change writes a system note, so a deal's history reads in one place.
Moving to a stage flagged won sets probability to 100 and stamps `closedAt`;
lost sets it to 0 and stamps `closedAt`; any other stage takes that stage's
default probability and clears `closedAt`.

### Prospects

A prospect is a company with `type: "prospect"`. Convert one by changing the
type, which keeps every contact, ticket and opportunity attached:

```
PATCH /api/companies/{id}   { "type": "customer" }
```

---

## Reports

### Profitability

`GET /api/reports/profitability?from=2026-01-01&to=2026-03-31`

Revenue less every cost: the burden rate of the engineers who did the work, plus
the wholesale cost of services resold on a contract.

```json
{
  "timeAndMaterials": {
    "revenue": 140, "labourCost": 40, "profit": 100,
    "marginPercent": 71.43, "hours": 1,
    "averageRate": 140, "averageBurden": 40,
    "incompleteCosting": false
  },
  "contracts": [
    {
      "id": "clx...", "name": "Managed IT", "revenue": 400,
      "labourCost": 120, "serviceCost": 100, "profit": 180,
      "burdenPerHour": 40, "breakEvenHours": 7.5
    }
  ],
  "totals": { "revenue": 540, "totalCost": 260, "profit": 280, "marginPercent": 51.85 }
}
```

`breakEvenHours` is `(revenue - serviceCost) / burdenPerHour`: the hours a
contract absorbs before it stops making money. It is `null` when no burden rate
is known, rather than implying the headroom is infinite.

`incompleteCosting` is `true` when some time was logged by an engineer with no
burden rate set, which means the profit shown is overstated.

### Sales pipeline

`GET /api/reports/pipeline?from=&to=`

```json
{
  "funnel": [{ "slug": "lead", "name": "Lead", "count": 12, "value": 48000, "weightedValue": 4800 }],
  "totals": {
    "openCount": 20, "openValue": 90000, "weightedValue": 28000,
    "wonCount": 6, "wonValue": 42000, "lostCount": 4, "lostValue": 15000,
    "winRatePercent": 60
  },
  "reasons": [{ "id": "clx...", "name": "Price", "type": "loss", "count": 3 }]
}
```

Won and lost stages are reported separately from the funnel: counting closed
deals as pipeline overstates what is still in play.

---

## Webhooks

Outbound webhooks are configured under Integrations, Webhooks, and managed
through `/api/webhooks`. Each delivery is signed; the signature and the event
payloads are documented in [WEBHOOKS.md](WEBHOOKS.md).
