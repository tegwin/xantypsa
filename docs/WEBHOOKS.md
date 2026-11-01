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
