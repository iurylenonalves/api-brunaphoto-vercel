import { PrismaClient } from "@prisma/client";

export async function testPrismaConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
  
  try {
    console.log('Attempting database connection...');
    console.log('DATABASE_URL environment variable exists:', !!process.env.DATABASE_URL);
    
    // Log the connection string (masked for security)
    if (process.env.DATABASE_URL) {
      const maskedUrl = process.env.DATABASE_URL.replace(
        /(postgresql:\/\/[^:]+:)([^@]+)(@.+)/,
        '$1*****$3'
      );
      console.log('Using connection string (masked):', maskedUrl);
    }
    
    // Connect to the database
    await prisma.$connect();
    console.log('Database connection successful');
    
    // Perform a simple query to test the connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Query test result:', result);
    
    return { success: true };
  } catch (error) {
    console.error('Database connection error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return { 
      success: false, 
      error: errorMessage, 
      stack: errorStack 
    };
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testPrismaConnection();
}