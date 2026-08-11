const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // A fixed default password in a public repository is a standing invitation:
  // anyone who deploys and forgets to change it is wide open. Take it from the
  // environment, and otherwise generate one and print it once.
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@admin.com').toLowerCase();
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password =
    process.env.SEED_ADMIN_PASSWORD || require('crypto').randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);

  // Find or create tenant
  let tenant = await prisma.tenant.findFirst();
  
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'VibeCRM', slug: 'vibecrm' },
    });
    console.log('Created tenant:', tenant.name);
  }

  // Find or create admin role
  let adminRole = await prisma.role.findFirst({
    where: { tenantId: tenant.id, slug: 'admin' },
  });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'Administrator',
        slug: 'admin',
        description: 'Full access',
        permissions: [
          'dashboard:view','dashboard:create','dashboard:edit','dashboard:delete','dashboard:export','dashboard:manage',
          'crm:view','crm:create','crm:edit','crm:delete','crm:export','crm:manage',
          'service_desk:view','service_desk:create','service_desk:edit','service_desk:delete','service_desk:export','service_desk:manage',
          'contracts:view','contracts:create','contracts:edit','contracts:delete','contracts:export','contracts:manage',
          'quotes:view','quotes:create','quotes:edit','quotes:delete','quotes:export','quotes:manage',
          'invoices:view','invoices:create','invoices:edit','invoices:delete','invoices:export','invoices:manage',
          'projects:view','projects:create','projects:edit','projects:delete','projects:export','projects:manage',
          'time_tracking:view','time_tracking:create','time_tracking:edit','time_tracking:delete','time_tracking:export','time_tracking:manage',
          'reports:view','reports:create','reports:edit','reports:delete','reports:export','reports:manage',
          'settings:view','settings:create','settings:edit','settings:delete','settings:export','settings:manage',
          'integrations:view','integrations:create','integrations:edit','integrations:delete','integrations:export','integrations:manage',
          'webhooks:view','webhooks:create','webhooks:edit','webhooks:delete','webhooks:export','webhooks:manage',
        ],
        isSystem: true,
      },
    });
    console.log('Created admin role');
  }

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      name: 'Admin User',
      passwordHash,
    },
  });
  console.log('User ready:', user.email);

  // Link to tenant
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { roleId: adminRole.id },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: adminRole.id,
      isOwner: true,
    },
  });

  // Create default billing rates
  const existingRates = await prisma.billingRate.count({ where: { tenantId: tenant.id } });
  if (existingRates === 0) {
    await prisma.billingRate.createMany({
      data: [
        { tenantId: tenant.id, name: 'Standard', code: 'STD', rate: 100, costRate: 50, minimumMinutes: 15, roundingMinutes: 15, oohMultiplier: 1.0, isDefault: true, sortOrder: 0 },
        { tenantId: tenant.id, name: 'Premium', code: 'PREM', rate: 150, costRate: 75, minimumMinutes: 15, roundingMinutes: 15, oohMultiplier: 1.5, isDefault: false, sortOrder: 1 },
        { tenantId: tenant.id, name: 'Out of Hours', code: 'OOH', rate: 150, costRate: 75, minimumMinutes: 30, roundingMinutes: 30, oohMultiplier: 1.0, isDefault: false, sortOrder: 2 },
      ],
    });
    console.log('Created default billing rates');
  }

  // Create default ticket queue
  const existingQueues = await prisma.ticketQueue.count({ where: { tenantId: tenant.id } });
  if (existingQueues === 0) {
    await prisma.ticketQueue.createMany({
      data: [
        { tenantId: tenant.id, name: 'First Line', description: 'Initial triage and basic support', isDefault: true, sortOrder: 0 },
        { tenantId: tenant.id, name: 'Second Line', description: 'Escalated technical issues', isDefault: false, sortOrder: 1 },
        { tenantId: tenant.id, name: 'Projects', description: 'Project-related tickets', isDefault: false, sortOrder: 2 },
      ],
    });
    console.log('Created default ticket queues');
  }

  // Create default ticket statuses
  const existingStatuses = await prisma.ticketStatus.count({ where: { tenantId: tenant.id } });
  if (existingStatuses === 0) {
    await prisma.ticketStatus.createMany({
      data: [
        { tenantId: tenant.id, name: 'New', slug: 'new', color: '#3b82f6', isClosed: false, isDefault: true, isSystem: true, sortOrder: 0 },
        { tenantId: tenant.id, name: 'Open', slug: 'open', color: '#22c55e', isClosed: false, isDefault: false, isSystem: false, sortOrder: 1 },
        { tenantId: tenant.id, name: 'Pending', slug: 'pending', color: '#f59e0b', isClosed: false, isDefault: false, isSystem: false, sortOrder: 2 },
        { tenantId: tenant.id, name: 'Waiting on Client', slug: 'waiting', color: '#f97316', isClosed: false, isDefault: false, isSystem: false, sortOrder: 3 },
        { tenantId: tenant.id, name: 'Resolved', slug: 'resolved', color: '#14b8a6', isClosed: false, isDefault: false, isSystem: false, sortOrder: 4 },
        { tenantId: tenant.id, name: 'Closed', slug: 'closed', color: '#94a3b8', isClosed: true, isDefault: false, isSystem: true, sortOrder: 5 },
      ],
    });
    console.log('Created default ticket statuses');
  }

  // Create sample custom fields
  const existingFields = await prisma.customField.count({ where: { tenantId: tenant.id } });
  if (existingFields === 0) {
    await prisma.customField.createMany({
      data: [
        { tenantId: tenant.id, entityType: 'company', name: 'Account Manager', fieldKey: 'account_manager', fieldType: 'text', sortOrder: 0 },
        { tenantId: tenant.id, entityType: 'company', name: 'Contract Value', fieldKey: 'contract_value', fieldType: 'number', sortOrder: 1 },
        { tenantId: tenant.id, entityType: 'company', name: 'Renewal Date', fieldKey: 'renewal_date', fieldType: 'date', sortOrder: 2 },
        { tenantId: tenant.id, entityType: 'company', name: 'Support Tier', fieldKey: 'support_tier', fieldType: 'select', options: ['Bronze', 'Silver', 'Gold', 'Platinum'], sortOrder: 3 },
        { tenantId: tenant.id, entityType: 'contact', name: 'LinkedIn', fieldKey: 'linkedin', fieldType: 'url', sortOrder: 0 },
        { tenantId: tenant.id, entityType: 'contact', name: 'Preferred Contact Method', fieldKey: 'preferred_contact', fieldType: 'select', options: ['Email', 'Phone', 'Teams', 'Slack'], sortOrder: 1 },
      ],
    });
    console.log('Created sample custom fields');
  }

  // Every install gets its own company record and a catch-all for email that
  // matches no known contact or client domain. Both are isSystem and the API
  // refuses to delete them.
  const ownCompany = await prisma.company.findFirst({ where: { tenantId: tenant.id, name: tenant.name } });
  if (!ownCompany) {
    await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: tenant.name,
        type: 'internal',
        isSystem: true,
        notes: 'Your own organisation. Used for internal tickets and time.',
      },
    });
  } else if (!ownCompany.isSystem) {
    await prisma.company.update({ where: { id: ownCompany.id }, data: { isSystem: true } });
  }

  const existingCatchAll = await prisma.company.findFirst({ where: { tenantId: tenant.id, isCatchAll: true } });
  if (!existingCatchAll) {
    await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'Unassigned (Catch-All)',
        type: 'customer',
        isSystem: true,
        isCatchAll: true,
        notes: 'Email from an unrecognised sender is filed here so it is never lost.',
      },
    });
    console.log('Created catch-all company');
  }

  // Create a sample company with sites
  const existingCompanies = await prisma.company.count({ where: { tenantId: tenant.id } });
  if (existingCompanies === 0) {
    const sampleCompany = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'Acme Corporation',
        type: 'customer',
        email: 'info@acme.com',
        phone: '+44 20 7946 0958',
        website: 'https://acme.com',
        address1: '123 Business Park',
        address2: 'Suite 400',
        city: 'London',
        postcode: 'EC1A 1BB',
        country: 'United Kingdom',
        industry: 'Technology',
        size: '51-200',
        sites: {
          create: [
            {
              tenantId: tenant.id,
              name: 'Head Office',
              isDefault: true,
              address1: '123 Business Park',
              address2: 'Suite 400',
              city: 'London',
              postcode: 'EC1A 1BB',
              country: 'United Kingdom',
              phone: '+44 20 7946 0958',
              email: 'london@acme.com',
            },
            {
              tenantId: tenant.id,
              name: 'Manchester Office',
              isDefault: false,
              address1: '45 Innovation Way',
              city: 'Manchester',
              postcode: 'M1 2AB',
              country: 'United Kingdom',
              phone: '+44 161 496 0958',
              email: 'manchester@acme.com',
            },
          ],
        },
      },
    });
    console.log('Created sample company:', sampleCompany.name);
  }

  console.log('\n✅ Ready to sign in:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  if (generated) {
    console.log('\n   ⚠  Generated password — shown once. Copy it now, or set');
    console.log('      SEED_ADMIN_PASSWORD to choose your own.\n');
  } else {
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
