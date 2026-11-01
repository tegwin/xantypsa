# Profitability

Profit is revenue less **every** cost: the burden rate of the engineers who did
the work, plus the wholesale cost of anything resold on a contract.

## Burden rate

The burden rate is what an hour of an engineer's time costs you. Set it per
person under Settings, Users, on the engineer's record.

It is a property of their membership of the tenant, so the same person can cost
a different amount to each MSP they work for.

The cost is **snapshotted onto the time entry** when the time is logged, not
computed later. When you change someone's rate, last quarter's profitability
does not silently change with it.

Where no burden rate is set, the rate card's cost rate is used; failing that the
cost is zero and the report says so rather than quietly overstating profit.

## Time and materials

Revenue is what the time was billed at. Cost is the burden.

> One hour charged at 140 by an engineer whose burden is 40:
> **140 - 40 = 100 profit**, a 71.4% margin.

Non-billable work is excluded from revenue but its burden still counts, so free
work shows up as the loss it is instead of disappearing.

## Contracts

> A 400 a month contract, three hours logged by an engineer on 40, and 100 a
> month of resold Microsoft 365:
> **400 - 120 labour - 100 services = 180 profit**, a 45% margin.

### Break even

How many hours a contract absorbs before it stops making money:

```
(revenue - serviceCost) / burdenPerHour
```

> 400 revenue, 100 of services, 40 an hour:
> **(400 - 100) / 40 = 7.5 hours**

Past that the contract is losing money. Where the burden is unknown the report
says so rather than implying the headroom is infinite.

The burden used is the contract's own, worked out from the time actually logged
against it. A contract with no time yet falls back to the business-wide average
so the figure is still usable.

## Non-billable work

A billing rate marked non-billable is always zero, and work logged at it:

- is not charged as time and materials
- does **not** draw down a block of prepaid hours
- is **not** recorded as covered by a managed service contract

That last point is the one that matters. Writing off an hour should not quietly
consume an hour the customer has already paid for.

A non-billable rate cannot be the default, because every new time entry would
then be free.

## Reading the report

Reports, Profitability, with an optional date range:

| | |
|---|---|
| Revenue | Net of tax |
| All costs | Burden plus resold services |
| Profit | Revenue less all costs |
| Margin | Profit as a percentage of revenue |

A warning appears where time was logged by someone with no burden rate, because
the profit shown is then too high.
