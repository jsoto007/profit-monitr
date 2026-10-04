-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMPTZ(3),
ADD COLUMN     "paidAt" TIMESTAMPTZ(3),
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'native';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "websiteVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "rows" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "rejected" INTEGER NOT NULL,
    "unattributed" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Import_venueId_createdAt_idx" ON "Import"("venueId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_venueId_paidAt_idx" ON "Booking"("venueId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_venueId_provider_externalId_key" ON "Booking"("venueId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_venueId_externalId_key" ON "Event"("venueId", "externalId");

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

