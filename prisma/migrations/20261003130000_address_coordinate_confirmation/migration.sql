ALTER TABLE "ClientAddress" ADD COLUMN "coordinatesConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Cleaner" ADD COLUMN "homeCoordinatesConfirmed" BOOLEAN NOT NULL DEFAULT false;
