-- Remove radius column from CompanyLocation table
-- Since we're now using a fixed 40-meter radius for all locations

ALTER TABLE "CompanyLocation" DROP COLUMN "radius";
