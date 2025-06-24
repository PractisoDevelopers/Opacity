-- AlterTable
ALTER TABLE "Archive" ADD COLUMN     "updateTime" TIMESTAMP(3),
ADD COLUMN     "uploadTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Fill-in
UPDATE "Archive" SET "updateTime" = CURRENT_TIMESTAMP WHERE "updateTime" IS NULL;

-- Add constraint
ALTER TABLE "Archive" ALTER COLUMN "updateTime" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Archive_updateTime_idx" ON "Archive" USING BRIN ("updateTime");

-- CreateIndex
CREATE INDEX "Archive_uploadTime_idx" ON "Archive" USING BRIN ("uploadTime");
