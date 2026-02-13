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
      namePt: 'Ensaio Família (Bronze)',
      description: '1 hour session, 10 digital images',
      descriptionPt: '1 hora de ensaio, 10 fotos digitais',
      totalPrice: 150.00,
      depositPrice: 50.00,
      stripeProductId: 'prod_bronze_placeholder'
    },
    {
      name: 'Family Session (Silver)',
      namePt: 'Ensaio Família (Prata)',
      description: '2 hour session, 20 digital images',
      descriptionPt: '2 horas de ensaio, 20 fotos digitais',
      totalPrice: 300.00,
      depositPrice: 50.00,
      stripeProductId: 'prod_silver_placeholder'
    },
    {
      name: 'Family Session (Gold)',
      namePt: 'Ensaio Família (Ouro)',
      description: '3 hour session, all digital images + album',
      descriptionPt: '3 horas de ensaio, todas fotos digitais + álbum',
      totalPrice: 450.00,
      depositPrice: 50.00,
      stripeProductId: 'prod_gold_placeholder'
    },
    {
      name: 'Newborn Session',
      namePt: 'Ensaio Newborn',
      description: 'Studio session, up to 4 hours',
      descriptionPt: 'Ensaio em estúdio, até 4 horas',
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
        // Update to include translations
        await prisma.package.update({
            where: { id: existing.id },
            data: {
                namePt: pkg.namePt,
                descriptionPt: pkg.descriptionPt
            }
        });
        console.log(`🔄 Updated package: ${pkg.name}`);
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
