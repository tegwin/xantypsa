import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { ROLE_TEMPLATES } from '@/lib/permissions';
import { ensureSystemCompanies } from '@/lib/systemCompanies';
import { emailDomain } from '@/lib/emailRouting';

export async function POST(request: Request) {
  try {
    const { name, email, password, company } = await request.json();

    if (!name || !email || !password || !company) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    // Create slug from company name
    const slug = company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      return NextResponse.json({ error: 'Company name already taken' }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);

    // Create tenant, roles, and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: { name: company, slug },
      });

      // 2. Create default roles
      const roles = await Promise.all(
        Object.values(ROLE_TEMPLATES).map((template) =>
          tx.role.create({
            data: {
              tenantId: tenant.id,
              name: template.name,
              slug: template.slug,
              description: template.description,
              permissions: template.permissions as any,
              isSystem: template.isSystem,
            },
          })
        )
      );

      const adminRole = roles.find((r) => r.slug === 'admin')!;

      // 3. Create user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          passwordHash,
        },
      });

      // 4. Link user to tenant as admin/owner
      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: adminRole.id,
          isOwner: true,
        },
      });

      // 5. Create default ticket queue
      await tx.ticketQueue.create({
        data: {
          tenantId: tenant.id,
          name: 'General',
          description: 'Default ticket queue',
          isDefault: true,
        },
      });

      // 6. Create default SLA profile
      await tx.sLAProfile.create({
        data: {
          tenantId: tenant.id,
          name: 'Standard SLA',
          description: 'Default SLA profile',
          isDefault: true,
        },
      });

      // 7. The two companies every install needs: this MSP's own record, and
      // the catch-all that unmatched incoming email is filed against.
      // The signup email's domain seeds the MSP's own domain list, so their
      // internal mail routes to themselves rather than the catch-all.
      await ensureSystemCompanies(
        tx as any,
        tenant.id,
        company,
        emailDomain(email.toLowerCase())
      );

      return { user, tenant };
    });

    return NextResponse.json(
      { message: 'Account created successfully', tenantSlug: result.tenant.slug },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? error.message : 'Registration failed' },
      { status: 500 }
    );
  }
}
