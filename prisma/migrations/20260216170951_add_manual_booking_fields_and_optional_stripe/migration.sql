-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "clientIp" TEXT,
ADD COLUMN     "clientUserAgent" TEXT,
ADD COLUMN     "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ALTER COLUMN "stripeSessionId" DROP NOT NULL;
