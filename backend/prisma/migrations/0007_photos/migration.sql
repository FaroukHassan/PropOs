
-- CreateTable
CREATE TABLE "UnitPhoto" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spaceId" TEXT,
    "data" BYTEA NOT NULL,
    "thumb" BYTEA NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/jpeg',
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "cover" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitPhoto_unitId_sort_idx" ON "UnitPhoto"("unitId", "sort");

-- CreateIndex
CREATE INDEX "UnitPhoto_spaceId_idx" ON "UnitPhoto"("spaceId");

-- AddForeignKey
ALTER TABLE "UnitPhoto" ADD CONSTRAINT "UnitPhoto_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitPhoto" ADD CONSTRAINT "UnitPhoto_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitPhoto" ADD CONSTRAINT "UnitPhoto_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

