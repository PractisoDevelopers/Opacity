-- Fill with default
UPDATE "Client" SET name = 'Unknown Host' WHERE name IS NULL;
-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "name" SET NOT NULL;
