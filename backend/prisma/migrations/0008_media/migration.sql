-- Videos next to photos for the marketing library
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO');

ALTER TABLE "UnitPhoto" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "kind" "MediaKind" NOT NULL DEFAULT 'PHOTO',
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "url" TEXT,
ALTER COLUMN "data" DROP NOT NULL,
ALTER COLUMN "thumb" DROP NOT NULL;
