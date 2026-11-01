# Contracts

## Pre-pay hours

A pre-pay contract is sold as a block of hours. Work draws the balance down.

### One off or monthly

| | |
|---|---|
| **One off** | A single block, billed once. Used up and that is that, unless you top it up |
| **Monthly** | A fresh block every month, billed every month |

Blocks are bought in whole units, so you can sell two blocks of ten hours at
250 an hour and the form shows the sum as you type:

> 2 x 10h at £250.00/hr = **20h for £5,000.00**

Leave the price blank and it is worked out as blocks times hours times rate.
Type a price and yours is used, so a discounted block is still possible.

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

| Overage rate | What happens |
|---|---|
| Set | Hours beyond the block are charged at that rate, and the time entry is marked as an overhour |
| Blank | Hours beyond the block are not chargeable, and the note says so |

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
