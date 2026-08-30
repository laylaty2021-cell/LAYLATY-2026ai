import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// blueprint §17 EVENT AUTOMATION: the exact 90/60/45/30/14/7/1-day wedding
// timeline from the platform blueprint. EventsService.create() reads these
// rows by event_type and instantiates event_tasks offset against the
// chosen event_date — without this seed, event automation is a no-op.
const WEDDING_TASK_TEMPLATES = [
  { daysBeforeEvent: 90, title: 'Start Planning', category: 'planning' },
  { daysBeforeEvent: 60, title: 'Book Hall', category: 'hall' },
  { daysBeforeEvent: 45, title: 'Book Photography', category: 'photography' },
  { daysBeforeEvent: 30, title: 'Send Invitations', category: 'invitations' },
  { daysBeforeEvent: 14, title: 'Confirm Services', category: 'confirmation' },
  { daysBeforeEvent: 7, title: 'Final Checklist', category: 'checklist' },
  { daysBeforeEvent: 1, title: 'Event Reminder', category: 'reminder' },
];

const CATEGORIES: { name: string; slug: string; appliesTo: 'product' | 'service' | 'booking' }[] = [
  { name: 'Wedding Halls', slug: 'wedding-halls', appliesTo: 'booking' },
  { name: 'Flowers', slug: 'flowers', appliesTo: 'product' },
  { name: 'Photography', slug: 'photography', appliesTo: 'service' },
  { name: 'Beauty', slug: 'beauty', appliesTo: 'service' },
  { name: 'Transportation', slug: 'transportation', appliesTo: 'booking' },
  { name: 'Catering', slug: 'catering', appliesTo: 'product' },
  { name: 'Invitations & Gifts', slug: 'invitations-gifts', appliesTo: 'product' },
];

// blueprint §19: super_admin has full access; support can view orders and
// bookings but never touch financial settings.
const ADMIN_PERMISSIONS = [
  'users.suspend',
  'organizations.approve',
  'stores.suspend',
  'orders.view',
  'bookings.view',
  'payments.refund',
  'settings.financial.manage',
];

async function main() {
  await prisma.eventTaskTemplate.deleteMany({ where: { eventType: 'wedding' } });
  await prisma.eventTaskTemplate.createMany({
    data: WEDDING_TASK_TEMPLATES.map((t) => ({ ...t, eventType: 'wedding' })),
  });
  console.log(`Seeded ${WEDDING_TASK_TEMPLATES.length} wedding task templates`);

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: { name: category.name, appliesTo: category.appliesTo },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories`);

  const permissionRecords = await Promise.all(
    ADMIN_PERMISSIONS.map((key) =>
      prisma.adminPermission.upsert({ where: { key }, create: { key }, update: {} }),
    ),
  );

  const superAdminRole = await prisma.adminRole.upsert({
    where: { key: 'super_admin' },
    create: { key: 'super_admin', name: 'Super Admin' },
    update: {},
  });
  const supportRole = await prisma.adminRole.upsert({
    where: { key: 'support' },
    create: { key: 'support', name: 'Support' },
    update: {},
  });

  await prisma.adminRolePermission.deleteMany({
    where: { roleId: { in: [superAdminRole.id, supportRole.id] } },
  });
  await prisma.adminRolePermission.createMany({
    data: permissionRecords.map((p) => ({ roleId: superAdminRole.id, permissionId: p.id })),
  });
  const supportPermissionKeys = new Set(['orders.view', 'bookings.view']);
  await prisma.adminRolePermission.createMany({
    data: permissionRecords
      .filter((p) => supportPermissionKeys.has(p.key))
      .map((p) => ({ roleId: supportRole.id, permissionId: p.id })),
  });
  console.log('Seeded admin roles/permissions (super_admin, support)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
