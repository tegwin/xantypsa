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
