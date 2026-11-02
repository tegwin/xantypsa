# Client portal

Your customers get a portal of their own: raise tickets, follow progress, and
see quotes and invoices.

## What a client sees

The portal opens on a page of tiles, and only the areas their role allows are
there at all. An area somebody cannot reach is absent, not shown and refused.

| Tile | Shows |
|---|---|
| Raise a ticket | Report an issue or ask for something |
| Tickets | Their own, or the whole company's |
| Projects | Progress, tasks and a timeline, read only |
| Quotes | Their quotations, read only |
| Invoices | Their invoices, read only |

Clients who buy blocks of time see **prepaid hours remaining** across the top,
with a bar per contract.

### Projects and the timeline

A project shows its description, how many tasks are done, and a Gantt chart
drawn from the task dates: in progress in the client's accent colour, done in
green, overdue in red, with a line marking today. Milestones are listed under
it.

## Contact roles

Set up under Settings, Client Portal. A role decides what a contact sees, with
one deliberately coarse scope per area:

| Scope | Means |
|---|---|
| Nothing | The area does not appear |
| Their own | Records where they are the contact |
| The whole company | Everything their company has |

Plus: whether they can raise tickets, whether they can reply, and whether they
see prepaid hours.

**Raising on a colleague's behalf** is allowed when somebody can both raise
tickets and see the whole company's: they can follow what they reported
afterwards, so it makes sense. The colleague must be at the same company,
checked on the server rather than trusted from the request.

Everything except tickets is read only. A client never edits a quote, a project
or an invoice.

A contact with no role gets whichever role is marked default. With no default
either, they see only their own tickets: the narrowest useful access, because
widening it should be a decision somebody made, never something that happened
by omission.

Deleting a role that people are on deactivates it instead, since deleting it
would silently widen or narrow what they can see.

## Branding

Each client's portal carries their own logo, accent colour and welcome
heading, set on the company's Portal tab, so it looks like theirs rather than
yours.

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
