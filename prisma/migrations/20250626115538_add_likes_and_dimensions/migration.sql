-- CreateTable
CREATE TABLE "Dimension" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimensionOnArchive" (
    "dimensionId" INTEGER NOT NULL,
    "archiveId" TEXT NOT NULL,
    "quizCount" INTEGER NOT NULL,

    CONSTRAINT "DimensionOnArchive_pkey" PRIMARY KEY ("archiveId","dimensionId")
);

-- CreateTable
CREATE TABLE "OwnerLikesArchive" (
    "ownerId" INTEGER NOT NULL,
    "archiveId" TEXT NOT NULL,

    CONSTRAINT "OwnerLikesArchive_pkey" PRIMARY KEY ("archiveId","ownerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dimension_name_key" ON "Dimension"("name");

-- AddForeignKey
ALTER TABLE "DimensionOnArchive" ADD CONSTRAINT "DimensionOnArchive_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionOnArchive" ADD CONSTRAINT "DimensionOnArchive_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLikesArchive" ADD CONSTRAINT "OwnerLikesArchive_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLikesArchive" ADD CONSTRAINT "OwnerLikesArchive_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
