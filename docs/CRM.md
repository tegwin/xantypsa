# CRM

## Companies, contacts and prospects

A prospect and a customer are the same record with a different type, so nothing
is copied or re-keyed when one becomes the other.

- **Companies** lists customers, vendors and partners.
- **Prospects**, under Companies, lists only companies of type prospect, with
  their open opportunities and total pipeline value.
- **Contacts**, also under Companies, lists people across every company.

Converting a prospect is one click on the Prospects list, or a tick box when you
mark an opportunity as won. Either way its contacts, tickets and opportunities
carry over untouched.

## Sales pipeline

Stages are yours to define, under Settings, CRM. Each has:

| | |
|---|---|
| Name and colour | How it reads on the board and in the funnel |
| Outcome | Open, won or lost. Won and lost take the deal out of the funnel |
| Probability | Applied to a deal when it enters the stage |
| Order | The order on the board and in the funnel |
| Default | The stage a new opportunity starts in |

A stage cannot be both won and lost. Deleting a stage that deals are sitting in
deactivates it instead, so nothing is stranded.

Out of the box: Lead, Qualified, Proposal, Negotiation, Won, Lost.

### Moving deals

Drag a card between columns on the Opportunities board. The card stays where you
drop it while the change saves, and goes back with an error if it fails.

You can also change the stage from the notes panel on the deal, which records
the move as a note.

## Opportunities

The deal page carries:

- **Edit** for the title, value, probability, stage, source, company, contact,
  owner and expected close date
- **Notes and activity**, including stage changes as system notes
- **Linked tickets**, so delivery work traces back to the deal that sold it
- **Linked quotes**, raised against the deal
- **Won and Lost**, which record a reason when you have defined any

### Required fields

Everything on an opportunity is optional by default, because a new deal often
starts as little more than a name and forcing a close date on day one just
produces a made up one.

Under Settings, CRM you can insist on any of: value (which must then be more
than zero), probability, source, expected close date, company and contact.
A required field is marked with a star in the form.

You can also insist on a reason when a deal is marked won or lost. Define the
reasons first, or there will be nothing to choose.

The rules are enforced when the record is saved, not only in the form, so they
hold for the API and for anything driving it. Clearing a required field on an
existing deal is refused in the same way as never setting it.

### Win and loss reasons

Optional, defined under Settings, CRM. Define none and the field never appears.
Define some and they are offered when you close a deal, and reported on in the
funnel so you can see why work is being lost.

Deleting a reason that closed deals cite deactivates it, so history stays
readable.

## Funnel reporting

Reports, Sales Pipeline shows deals by stage, with:

- Count and value per stage, widest first
- Weighted value, the value multiplied by the probability
- Won and lost totals, and the win rate
- Why deals closed, where reasons are recorded

Won and lost stages are deliberately reported beside the funnel rather than
inside it. Counting closed deals as pipeline overstates what is still in play.
