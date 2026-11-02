# Contracts

## Pre-pay hours

A pre-pay contract is sold as a block of hours. Work draws the balance down.

### One off or monthly

| | |
|---|---|
| **One off** | A single block, billed once. Used up and that is that, unless you top it up |
| **Monthly** | A fresh block every month, billed every month |

A block is a number of hours at a rate:

> **Hours** (per block) 10 **x** **Hourly rate** £250.00 **=** **Price** £2,500.00

The price is worked out, never typed, so the three can never disagree. The
contract holds 10 hours and work deducts from those 10 hours. The 2,500 is what
the block sold for, never a quantity of anything.

Editing the hours or the rate recalculates the price, on the server as well as
in the form, so an edit cannot leave a stale figure behind.

### Carry over

Only applies to monthly contracts, since a one-off block has no next period.

- **Off**: anything unused at the end of the month is lost.
- **On**: unused hours move into the next month as their own block, worth
  nothing new because the customer has already paid for them.
- **Most hours that may carry**: a cap. Leave it blank for no limit.

The hours that came from a previous month are marked as carried over, so you can
always see what was bought and what was rolled.

### Automatic top-up

Raise another block, chargeable, once the balance runs low.

| | |
|---|---|
| **Top up when below** | Remaining hours that trigger it |
| **Hours to add** | The size of the block raised |

A top-up happens at the moment time is logged, so the balance never silently
goes negative while nobody is looking. It is also checked by the scheduled job.

### Going over the block

Hours past the block are always chargeable.

| Overage rate | What happens |
|---|---|
| Set | Hours beyond the block are charged at that rate |
| Blank | Hours beyond the block are charged at the normal time and materials rate for the work |

Either way the time entry is marked as an overhour, so it is clear on the
invoice which hours came out of the block and which did not.

### How hours are drawn down

Oldest block first, so hours bought first are used first, and carried hours go
before this month's. A single time entry can span several blocks.

### The alert threshold

A percentage of hours used, 80 by default. Past it the balance is flagged as
low.

## Scheduled job

`POST /api/contracts/process-blocks`

Raises this month's block on every monthly pre-pay contract and tops up any
contract that has fallen below its threshold.

Safe to run as often as you like: a contract that already has this month's block
is skipped, and a top-up only happens when the balance is genuinely low. Point a
daily scheduled job at it.

```json
{
  "contractsChecked": 12,
  "blocksCreated": [{ "contract": "Acme Monthly", "hours": 10, "amount": 2500 }],
  "topUps": []
}
```

## Blocks over the API

`GET /api/contracts/{id}/hour-blocks` returns every block and the balance.

`POST /api/contracts/{id}/hour-blocks` raises one by hand:

```json
{ "hours": 10, "hourlyRate": 250, "source": "one_off" }
```

`source` is `one_off` or `top_up`. The rate falls back to the contract's.

## Editing a contract

Edit on the contract row opens the same form it was created with, including the
block settings. Changing them does not touch blocks already raised: it changes
what happens next month, or at the next top-up.

## On a ticket

A ticket on a pre-pay contract shows the block in the sidebar: hours used, hours
remaining, and a bar that turns amber then red as it fills. A monthly contract
whose block has not been raised yet says so rather than showing nothing.

The billing preview on the time entry changes to match the contract, because
showing a charge for work already paid for would be wrong:

| Contract | Preview says |
|---|---|
| Pre-pay, within the block | **Deducted from pre-pay** |
| Pre-pay, over the block, overage rate set | The charge for the hours over |
| Pre-pay, over the block, no overage rate | Nothing, and that the hours are not chargeable |
| Managed service | **Covered by the managed service** |
| Anything else | The billed amount at the rate |

The contract name links through to the contract itself, but only for someone
with `contracts:view`. Everyone else sees the name without a link: a technician
can see which contract a ticket sits on without seeing the rates and margin on
it.

## No products and services

A pre-pay contract has no Products and Services section. It is priced entirely
by its blocks: hours times rate.

This is not only tidiness. On every other contract type the net total of the
line items **becomes** the contract value, so a line added to a pre-pay
contract would overwrite the block price and bill the wrong figure. The server
refuses to do that regardless of what is sent, so the API cannot be used to get
around it either.

## One off does not recur

| Block type | Billing |
|---|---|
| **One off** | Billed once, from Ready for Invoicing, and again only when another block is added or topped up |
| **Monthly** | Recurring. A block is raised every month and each one is billed |

A one-off block contract never creates a recurring invoice, the "create the
recurring invoice now" option is not offered for it, and the recurring job
skips it. Choosing Monthly is what makes a block arrangement recurring.

## Seeing the blocks

A pre-pay contract lists every block it has: when it was added, how it came
about (the opening block, a monthly one, a top-up or hours carried over), the
hours, the rate, what it cost, how much has been used, and whether it has been
invoiced.

Each unbilled block can be edited, and removed if nothing has been drawn from
it. A block that has been invoiced is locked: changing what was billed after
the fact would put the invoice and the contract out of step.

A block cannot be reduced below the hours already used from it.

Topping up adds a block rather than quietly raising the total, so the history
of what the customer bought stays readable.

## Invoicing a block

A pre-pay contract bills its **blocks**, never the labour. The labour is what
the block already paid for.

Invoicing from Ready for Invoicing produces a line per unbilled block:

| Description | Qty | Unit price | Total |
|---|---|---|---|
| Pre-pay block - March 2026 - 10 hours at £250.00 per hour | 10 | 250.00 | 2,500.00 |

Below it, the work the block absorbed, at zero:

| Description | Qty | Unit price | Total |
|---|---|---|---|
| #1042 Mail flow broken - 2h on 14/03/2026 - deducted from pre-pay | 2 | 0.00 | 0.00 |

So the customer sees the hours they bought, what they paid, and exactly what
the hours went on, without being charged twice.

Blocks are marked billed the moment they are invoiced, so the same hours can
never go on a second invoice. Generating again bills only the blocks added
since, and refuses outright when every block has already been invoiced:

> Every block on this contract has already been invoiced.

This matters when you top a contract up. Adding 10 hours to a contract whose
first 10 were already billed produces an invoice for the new 10, not for the
running total of 20. A monthly contract becomes due again the moment next month's
block is raised.

Labour on a block contract, and anything logged at a non-billable rate, is
excluded from unbilled time entirely. Neither can reach an invoice as a charge.

## Deleting

A record that real work points at cannot be deleted. Deleting a contract that
invoices and time entries reference would either orphan them or quietly unlink
them and change what the customer gets billed.

The refusal says what is holding it:

> This contract is used by 3 invoices, 12 time entries and 4 tickets, so it
> cannot be deleted. Deactivate it instead if you want it out of the way.

The same rule covers contacts, products, opportunities and projects. Clear the
dependent records first, or set the record inactive and leave the history
intact, which is almost always the better answer.
