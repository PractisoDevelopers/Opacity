/*
  Warnings:

  - Added the required column `updateTime` to the `Archive` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Archive" ADD COLUMN     "updateTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "uploadTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Archive_updateTime_idx" ON "Archive" USING BRIN ("updateTime");

-- CreateIndex
CREATE INDEX "Archive_uploadTime_idx" ON "Archive" USING BRIN ("uploadTime");
