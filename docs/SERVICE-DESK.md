# Service desk

## Public and private notes

The choice sits in the action bar at the top of a ticket, not buried in the
form. Pick **Public Note** or **Private Note** and the composer follows: the
placeholder, the tint on the time entry panel and the save button all change to
match.

- A **public** note is visible to the customer in the portal, and can be emailed
  to them with the tick box on the composer.
- A **private** note never leaves the system.

Every note in the timeline is labelled Public or Private, and either can be
switched afterwards with the link on the note. System notes are the audit trail
and cannot be changed.

If an email fails to send, the note is still saved. You get a separate warning
so a failed send is never mistaken for a lost note.

## Email threading

Every email the system sends about a ticket carries its number in the subject,
as `[#123]`, and the same reference again in the footer:

    Ticket reference: [#123] - please keep this in your reply.

A reply is matched back to its ticket in that order:

1. The **subject**, which also accepts `[Ticket #123]`, `TKT-123`,
   `Ticket-123`, `Ticket 123` and a bare `#123`, with or without any number of
   `Re:` and `Fw:` prefixes.
2. The **body**, if the subject was rewritten or the tag taken out. Only the
   explicit forms count here, never a bare `#123`, so an invoice or PO number
   in a quoted signature cannot hijack a reply.

Each candidate number is checked against your own tickets and the first that
exists wins. If nothing matches, or the ticket it names has been deleted, the
email becomes a new ticket rather than being dropped.

The subject tag is added by the system, not by the template, so editing an
email template cannot break threading.

## The timer

A work timer runs on each ticket, in the action bar and again in the time entry
panel. It keeps running when you leave the ticket and across a page reload,
because it is stored against the ticket rather than the page.

Time is entered in **hours**, not minutes: 8 rather than 480. Quick picks cover
0.25 up to 8 hours. The field tracks the clock while it runs. Type a figure or pick a quick
value and it stops tracking and leaves your number alone.

Under Settings, Service Desk, Timer:

| Option | Effect |
|---|---|
| Show the timer on tickets | Off hides it everywhere |
| Only run while the time entry panel is open | Paused on the ticket until you open Add Time |
| Only run while writing a public note | Switching to a private note pauses it |

With both narrowing options off, the timer simply runs the whole time a ticket
is open.

## Statuses

Statuses are defined under Settings, Service Desk. Any status flagged **Treat as
closed** closes the ticket and drops it from the default views, so you can have
Closed, Cancelled, Duplicate and anything else you need, all behaving the same.

Nothing in the product compares against a status literally called "closed".

## Editing a ticket

Edit Ticket in the action bar opens the title, description, company, contact,
contract, priority, type, category and due date. Changing the company reloads
the contact and contract lists, since both belong to it.

## References

Every record quotes the same way: a prefix, a separator and a zero-padded
number.

| Record | Default |
|---|---|
| Ticket | `TKT-00042` |
| Quote | `QTE-00042` |
| Invoice | `INV-00042` |
| Contract | `CON-00042` |
| Project | `PRJ-00042` |
| Opportunity | `OPP-00042` |

Under Settings, Service Desk, Ticket reference you can set the ticket prefix to
whatever you use, for example `SON`, giving `SON-00042`. The separator and the
number of digits are shared across every record type, so the system stays
uniform rather than each area reading differently.

Changing a prefix changes how everything displays at once. Nothing is
renumbered: the underlying number never moves.

### Starting the numbering somewhere else

**Start numbering at** lets an MSP carry on the numbering from the PSA it is
leaving. The next ticket takes whichever is higher: the start you set, or one
above the highest already used. Existing tickets are never renumbered.

### Where the reference appears

Detail pages read the same way throughout: the record's own name as the
heading, its reference underneath. A ticket shows its subject with
`SON-00042` below it, exactly as a quote shows its title with `QTE-00002`.

## Queues, membership and transfers

### Who sees what

A queue with nobody in it is visible to everyone. Adding the first agent makes
it private. This matters: making empty queues private would have hidden every
existing ticket the moment the feature arrived.

In full, a ticket is visible when any of these holds:

- you are an administrator (`service_desk:manage`, or a super admin)
- the ticket is in no queue
- the ticket is in a queue that has no members
- you are a member of the queue it is in
- the ticket is assigned to you, wherever it sits

The last rule means handing somebody a ticket never also hides it from them.
The same filter guards the ticket list and a single ticket, so a ticket kept
off your list cannot be opened by going straight to its URL.

### Managing agents on a queue

Settings, Service Desk, Queues, then edit a queue: the **Agents** tab lists
every agent with a tick box. Changes save immediately, not on Save, because
membership is its own record rather than a field on the queue.

The same thing from the other side: Settings, Users, open somebody, **Queues**
tab, which lists every queue and whether they are in it.

### Transferring a ticket

**Transfer** sits at the top of a ticket. It moves the ticket to another queue
and sets the engineer, or leaves it as None so the queue picks it up. Every
transfer writes an internal note saying where it went and why, because a
transfer that leaves no trace is how a ticket quietly becomes nobody's problem.

### API

| Method | Route | Does |
|---|---|---|
| GET | `/api/ticket-queues` | Queues, with members and `isOpenToEveryone` |
| POST | `/api/ticket-queues` | Create a queue |
| PATCH | `/api/ticket-queues/{id}` | Rename, set default, activate or deactivate |
| DELETE | `/api/ticket-queues/{id}` | Delete, refused while tickets are in it |
| GET | `/api/ticket-queues/{id}/members` | Who works the queue |
| POST | `/api/ticket-queues/{id}/members` | Add an agent, body `{ userId }` |
| DELETE | `/api/ticket-queues/{id}/members?userId=` | Remove an agent |
| GET | `/api/users/{id}/queues` | Every queue, flagged with `isMember` |
| POST | `/api/users/{id}/queues` | Put them in a queue, body `{ queueId }` |
| DELETE | `/api/users/{id}/queues?queueId=` | Take them out |
| POST | `/api/tickets/{id}/transfer` | `{ queueId, assignedToId, note }`; null for either means none |

Ticket listing also accepts `?queueId=` to filter, or `?queueId=none` for
tickets in no queue at all.
