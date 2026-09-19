# VibePSA roadmap

Build order. Later items depend on earlier ones.

| # | Feature | Notes | Status |
|---|---------|-------|--------|
| 1 | **Settings restructure** | Group every settings page by type. Everything below adds pages here, so do it first. | todo |
| 2 | **Ticket Types** | Per-type field sets, layouts, ITIL types (Incident / Request / Problem / Change). Schema-heavy; unblocks SLA + Actions. | todo |
| 3 | **SLA management** | Response/resolution targets per priority + type, business hours, breach tracking. | todo |
| 4 | **Timer clock** | Start/stop on a ticket → time entry. Toggle in settings. Small. | todo |
| 5 | **Actions engine** | Halo-style: an action on any entity that runs steps (set field, email, webhook, note). Needs 2. | todo |
| 6 | **Email parser** | Port the Python parser. Keyword rules → route/classify inbound mail. Extends existing emailRouting. | todo |
| 7 | **Security section** | 2FA (built), SSO Microsoft/Google, password policy, session management. | todo |
| 8 | **Reporting + dashboard** | Editable widgets, AI builds them from a prompt. Needs the AI tool surface (built). | todo |
| 9 | **Stock / Sales orders / Purchase orders** | New module. Products exist; needs stock levels, SO, PO, receipts. | todo |
| 10 | **Integration module** | Runbook-style flows between VibePSA and external systems. Biggest; do last. | todo |

## Open questions
- Actions: visual builder or JSON/YAML definition?
- Widgets: fixed chart types or AI-generated SQL + chart spec?
- Stock: does it need serial/asset tracking, or just quantities?
