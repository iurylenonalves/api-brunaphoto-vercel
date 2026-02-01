import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seeding...');

  // 1. Booking Fee
  // This is not exactly a package, but a base product.
  // However, here we are registering the complete PACKAGES.
  // The £50 Booking Fee is global, but the system needs to know
  // which packages exist to calculate the "Remaining Balance".

  const packages = [
    {
      name: 'Family Session (Bronze)',
      description: '1 hour session, 10 digital images',
      totalPrice: 150.00,
      depositPrice: 50.00,
      stripeProductId: 'prod_bronze_placeholder'
    },
    {
      name: 'Family Session (Silver)',
      description: '2 hour session, 20 digital images',
      totalPrice: 300.00,
      depositPrice: 50.00,
      stripeProductId: 'prod_silver_placeholder'
    },
    {
      name: 'Family Session (Gold)',
      description: '3 hour session, all digital images + album',
      totalPrice: 450.00,
      depositPrice: 50.00,
      stripeProductId: 'prod_gold_placeholder'
    },
    {
      name: 'Newborn Session',
      description: 'Studio session, up to 4 hours',
      totalPrice: 350.00,
      depositPrice: 50.00,
      stripeProductId: 'prod_newborn_placeholder'
    }
  ];

  for (const pkg of packages) {
    const existing = await prisma.package.findFirst({
      where: { name: pkg.name }
    });

    if (!existing) {
      await prisma.package.create({
        data: pkg
      });
      console.log(`✅ Created package: ${pkg.name}`);
    } else {
      console.log(`ℹ️ Package already exists: ${pkg.name}`);
    }
  }

  console.log('🌱 Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
