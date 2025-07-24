import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
});

try {
  console.log('Initializing Prisma client...');
  prisma.$connect()
    .then(() => {
      console.log('Database connection established successfully');
    })
    .catch(err => {
      console.error('Failed to connect to database:', err);
    });
} catch (error) {
  console.error('Error initializing Prisma:', error);
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;