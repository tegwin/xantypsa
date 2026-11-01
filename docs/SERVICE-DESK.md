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

The minutes field tracks the clock while it runs. Type a figure or pick a quick
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
