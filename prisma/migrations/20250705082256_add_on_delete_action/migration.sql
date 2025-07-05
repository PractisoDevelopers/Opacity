-- DropForeignKey
ALTER TABLE "Archive" DROP CONSTRAINT "Archive_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "DimensionOnArchive" DROP CONSTRAINT "DimensionOnArchive_archiveId_fkey";

-- DropForeignKey
ALTER TABLE "DimensionOnArchive" DROP CONSTRAINT "DimensionOnArchive_dimensionId_fkey";

-- DropForeignKey
ALTER TABLE "OwnerLikesArchive" DROP CONSTRAINT "OwnerLikesArchive_archiveId_fkey";

-- DropForeignKey
ALTER TABLE "OwnerLikesArchive" DROP CONSTRAINT "OwnerLikesArchive_ownerId_fkey";

-- AddForeignKey
ALTER TABLE "Archive" ADD CONSTRAINT "Archive_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionOnArchive" ADD CONSTRAINT "DimensionOnArchive_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionOnArchive" ADD CONSTRAINT "DimensionOnArchive_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLikesArchive" ADD CONSTRAINT "OwnerLikesArchive_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLikesArchive" ADD CONSTRAINT "OwnerLikesArchive_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
