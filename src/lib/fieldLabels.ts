// ============================================================
// Default field label maps for each entity type
// These can be overridden per-tenant via the field-labels API
// ============================================================

export const DEFAULT_LABELS: Record<string, Record<string, string>> = {
  company: {
    name: 'Company Name',
    address1: 'Address Line 1',
    address2: 'Address Line 2',
    address3: 'Address Line 3',
    postcode: 'Postcode',
    city: 'City',
    state: 'State / County',
    country: 'Country',
    phone: 'Phone',
    email: 'Email',
    website: 'Website',
    industry: 'Industry',
    type: 'Type',
    size: 'Company Size',
    taxId: 'Tax ID',
    notes: 'Notes',
  },
  contact: {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    mobile: 'Mobile',
    jobTitle: 'Job Title',
    department: 'Department',
  },
  site: {
    name: 'Site Name',
    address1: 'Address Line 1',
    address2: 'Address Line 2',
    address3: 'Address Line 3',
    postcode: 'Postcode',
    city: 'City',
    state: 'State / County',
    country: 'Country',
    phone: 'Phone',
    email: 'Email',
  },
};
