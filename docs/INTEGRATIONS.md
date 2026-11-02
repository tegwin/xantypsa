# Integrations

## PSA integrations

Halo, Autotask and ConnectWise. Each authenticates differently, so the dialog
asks for exactly what that vendor needs rather than four generic boxes.

| PSA | Needs |
|---|---|
| **HaloPSA** | Halo URL, client ID, client secret |
| **Datto Autotask** | API zone URL, API integration code, API user name, API secret |
| **ConnectWise Manage** | Site URL, company ID, public key, private key, client ID |

Autotask uses three static headers rather than a bearer token, which is the
usual reason an Autotask integration appears to do nothing. Halo signs in with
OAuth client credentials and gets a short-lived token per request.

### Saving and testing

An integration **cannot be saved with required fields empty**. It used to be
possible, and the result was worse than having no integration at all: the card
said it was connected and nothing worked.

**Test Connection** asks the vendor something real, using what is on screen so
you can check before saving:

| PSA | What is asked |
|---|---|
| Halo | Sign in, then list one client |
| Autotask | Query one company |
| ConnectWise | Read system info |

Anything other than success reports the status the vendor returned, so a wrong
URL reads differently from wrong credentials.

### Reading companies, contacts and tickets

```
GET /api/integrations/{type}/psa?entity=companies
GET /api/integrations/{type}/psa?entity=contacts
GET /api/integrations/{type}/psa?entity=tickets
```

Returns up to 200 records, normalised to the same shape whichever PSA they came
from:

```json
{ "entity": "companies", "count": 2, "items": [{ "externalId": "41", "name": "Acme Ltd", "detail": "ops@acme.test" }] }
```

Deliberately read-only. It shows what is in the other system so you can decide
what to bring across; it does not write to your PSA.

## RMM integrations

NinjaOne and Datto RMM pull devices in. Test Connection there fetches the
device list, which is the only call that proves the credentials work.
