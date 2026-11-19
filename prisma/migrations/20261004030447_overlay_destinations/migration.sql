-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "destination" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "bookingProvider" TEXT NOT NULL DEFAULT 'native',
ADD COLUMN     "bookingUrl" TEXT NOT NULL DEFAULT '';
