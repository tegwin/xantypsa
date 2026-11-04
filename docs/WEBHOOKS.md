# Webhooks

Xanty PSA posts to your endpoint when something changes, so you do not have to
poll. Configure them under Integrations, Webhooks, or through `/api/webhooks`.

## Delivery

Each delivery is a `POST` with a JSON body and these headers:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Webhook-Event` | The event name, for example `ticket.created` |
| `X-Webhook-Timestamp` | ISO 8601, when the delivery was made |
| `X-Webhook-Signature` | HMAC SHA-256 of the raw body, hex encoded. Only sent when the webhook has a secret |

Any custom headers set on the webhook are merged in, so you can add an
`Authorization` header the receiving system expects.

Deliveries are attempted in parallel and recorded. Failures are visible under
Integrations, Webhooks, with the status code and response body.

## Verifying the signature

Compute the HMAC over the **raw request body**, before any JSON parsing.
Reserialising the body changes the bytes and the signature will not match.

```js
import crypto from 'node:crypto';

function verify(rawBody, signatureHeader, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Constant time, so a wrong signature cannot be found by timing the compare.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signatureHeader || '', 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

Reject anything that fails, and reject a timestamp more than a few minutes old
so an intercepted delivery cannot be replayed later.

## Events

| Event | Fires when |
|---|---|
| `company.created` | A company is added |
| `company.updated` | A company is changed |
| `company.deleted` | A company is removed |
| `contact.created` | A contact is added |
| `contact.updated` | A contact is changed |
| `contact.deleted` | A contact is removed |
| `opportunity.created` | A deal is raised |
| `opportunity.updated` | A deal changes, including its stage |
| `opportunity.deleted` | A deal is removed |
| `quote.created` | A quote is raised |
| `quote.updated` | A quote is changed |
| `quote.status_changed` | A quote is sent, accepted or rejected |
| `ticket.created` | A ticket is raised |
| `ticket.updated` | A ticket is changed |
| `ticket.status_changed` | A ticket moves status, including to a closed one |
| `invoice.created` | An invoice is raised |
| `invoice.paid` | An invoice is settled |

## Responding

Return `2xx` quickly. Do the work afterwards rather than holding the connection
open: a slow endpoint is recorded as a failure.

Treat deliveries as at-least-once. The same event can arrive twice, so make your
handler idempotent on the record id.

## Inbound payment webhooks

Outbound webhooks tell another system what happened here. A payment webhook is
the opposite: a payment provider calls Xanty PSA when money arrives, and the
matching invoice is marked paid without anybody rekeying it.

Create one under **Settings, Payment Webhooks**. Each endpoint has its own URL
and its own secret. Only a SHA-256 digest of the secret is stored, so the
secret is shown once, when the endpoint is created, and cannot be retrieved
afterwards. Lose it and you delete the endpoint and make another.

### The request

```
POST https://app.xanty.net/api/webhooks/payments/<publicId>
Content-Type: application/json
X-Webhook-Secret: <the secret shown when you created the endpoint>
```

```json
{
  "invoiceNumber": "INV-00009",
  "amount": 2500.00,
  "reference": "ch_3AbCdEf",
  "paidAt": "2026-11-04T10:00:00Z",
  "method": "card"
}
```

| Field | Required | Notes |
|---|---|---|
| `invoiceNumber` | one of the two | The invoice reference as shown in the app. |
| `invoiceId` | one of the two | The internal id, if the provider stores it. |
| `amount` | yes | A positive number, in the invoice's currency. |
| `reference` | no, but advised | The provider's own payment id. Used to ignore retries. |
| `paidAt` | no | ISO 8601. Defaults to the time the call arrives. |
| `method` | no | Defaults to the endpoint's provider. |

### The response

`200` and the invoice's new state:

```json
{ "ok": true, "invoiceNumber": "INV-00009", "status": "partial",
  "amountPaid": 2500, "amountDue": 3500 }
```

A payment short of the total sets the invoice to `partial`; one that clears it
sets `paid` and stamps `paidAt`.

A repeat of a `reference` already recorded against that invoice answers
`{ "ok": true, "duplicate": true }` and changes nothing, so a provider that
retries cannot pay an invoice twice.

### Failures

| Status | Meaning |
|---|---|
| `401` | Unknown endpoint, endpoint switched off, or wrong secret. Deliberately the same answer for all three. |
| `400` | Body was not JSON, no invoice reference given, or the amount was not a positive number. |
| `404` | No invoice with that number or id belongs to this tenant. |
| `500` | The payment could not be recorded. Safe to retry. |

An endpoint only ever reaches invoices belonging to the tenant it was created
in, so one customer's webhook can never settle another customer's invoice.

### Troubleshooting

Every call is logged whether it succeeded or not, with the reason it was
rejected. The last ten are listed under each endpoint on the settings page.
