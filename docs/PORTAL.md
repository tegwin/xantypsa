# Client portal

Your customers get a portal of their own: raise tickets, follow progress, and
see quotes and invoices.

## How people sign in

By emailed link. There is no password.

Each sign-in sends a single-use link that expires shortly after it is issued.
Requesting a new one retires any link already outstanding, so a forwarded old
email stops working immediately.

This is deliberate. A portal that nobody signs into for months is exactly where
a weak, reused password sits waiting, and a password nobody has cannot be
phished, reused or leaked.

## Giving somebody access

Two switches, both of which must be on:

1. **The company** has its portal switched on, with a portal address.
2. **The contact** has portal access, on their Portal tab.

A contact needs an email address before access can be given, since there is
nowhere to send a link otherwise.

## The contact's Portal tab

| | |
|---|---|
| **Portal access** | Whether this person may sign in |
| **How they sign in** | Explains the emailed link, and shows when they last signed in |
| **Send welcome email** | An introduction to the portal, carrying a sign-in link |
| **Send sign-in link** | A fresh link, for somebody who cannot get in |
| **Impersonate** | Opens the portal as that person, in a new tab |

## Impersonating

Opens the portal exactly as that contact sees it, which answers the usual "it
looks wrong on my end" call without asking them to screenshot anything.

Guard rails:

- Staff only, and only with permission to manage CRM or settings.
- Recorded against your name before any access is granted.
- Somebody already being impersonated cannot start a portal preview, because the
  audit trail would then name the wrong person.
