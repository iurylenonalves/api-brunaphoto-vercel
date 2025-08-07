import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Optimize for serverless environments
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Initialize connection and handle graceful shutdown
try {
  console.log('Initializing Prisma client...');
  prisma.$connect()
    .then(() => {
      console.log('Database connection established successfully');
    })
    .catch((err: any) => {
      console.error('Failed to connect to database:', err);
    });
} catch (error: any) {
  console.error('Error initializing Prisma:', error);
}

// Add connection management for serverless
if (process.env.NODE_ENV === "production") {
  // Gracefully disconnect on process termination in serverless
  process.on('beforeExit', async () => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('Error disconnecting Prisma:', error);
    }
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;