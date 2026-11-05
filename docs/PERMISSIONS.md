# Roles and permissions

A role is a set of `module:action` permissions. The modules are dashboard, crm,
service_desk, contracts, quotes, invoices, projects, time_tracking, reports,
settings, integrations and webhooks. The actions are view, create, edit,
delete, export and manage, and `manage` counts as all of them.

## Three places it is enforced

1. **The API** is the one that matters. Every route declares a module and
   whether it reads or writes, and the action required is taken from the HTTP
   method: POST needs create, DELETE needs delete, PATCH and PUT need edit, GET
   needs view. A route that only says "write" used to accept create, edit and
   delete alike, which let somebody who could create also delete.
2. **The sidebar** hides a section when the person has nothing in that module.
   Every entry must name a module; an entry without one is hidden rather than
   shown, so a new section cannot be forgotten into being visible to everybody.
   Integrations had no module and was on every technician's sidebar.
3. **Buttons** are hidden with `<Can module="crm" action="create">`. Offering a
   button that answers Forbidden is worse than not offering it. This is for
   clarity, never for safety: the API is what stops the action.

## Routes two kinds of people need

Queues, ticket statuses and billing rates are configured by an administrator
and read by an agent filling in a ticket. Those routes name both modules,
`'settings,service_desk'`, and any one of them is enough. Without this a
technician could not see the queues to move a ticket into one.

An agent can see and use every queue, including those they are not a member of.
Membership decides whose tickets you see, not which queues you may file into.

## The built-in roles

| Role | In short |
|---|---|
| Administrator | Everything |
| Manager | Everything except managing settings, webhooks and integrations |
| Technician | Service desk, time entries, project tasks; reads CRM and contracts |
| Sales | CRM and quotes in full, reads invoices and contracts |
| Finance | Invoices in full, contract edits, reads CRM and quotes |
| Viewer | Read-only, excluding settings, webhooks and integrations |

Roles are editable under Settings, Roles. The built-in ones are templates for
a new tenant, not a ceiling.
