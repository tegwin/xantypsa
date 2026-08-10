export const WEBHOOK_EVENTS = [
  'company.created', 'company.updated', 'company.deleted',
  'contact.created', 'contact.updated', 'contact.deleted',
  'opportunity.created', 'opportunity.updated', 'opportunity.deleted',
  'quote.created', 'quote.updated', 'quote.status_changed',
  'ticket.created', 'ticket.updated', 'ticket.status_changed',
  'invoice.created', 'invoice.paid',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];
