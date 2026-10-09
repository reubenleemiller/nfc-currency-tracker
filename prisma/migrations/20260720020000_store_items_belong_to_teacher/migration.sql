ALTER TABLE "StoreItem" ADD COLUMN "teacherId" TEXT;
UPDATE "StoreItem" SET "teacherId" = "Classroom"."teacherId" FROM "Classroom" WHERE "StoreItem"."classroomId" = "Classroom"."id";
ALTER TABLE "StoreItem" ALTER COLUMN "teacherId" SET NOT NULL;
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE;
DROP INDEX "StoreItem_classroomId_active_sortOrder_idx";
DROP INDEX "StoreItem_classroomId_sortOrder_key";
WITH ordered_items AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "teacherId" ORDER BY "sortOrder", "id") AS "nextSortOrder"
  FROM "StoreItem"
)
UPDATE "StoreItem" SET "sortOrder" = ordered_items."nextSortOrder" FROM ordered_items WHERE "StoreItem"."id" = ordered_items."id";
CREATE INDEX "StoreItem_teacherId_active_sortOrder_idx" ON "StoreItem" ("teacherId", "active", "sortOrder");
CREATE UNIQUE INDEX "StoreItem_teacherId_sortOrder_key" ON "StoreItem" ("teacherId", "sortOrder");
ALTER TABLE "StoreItem" DROP COLUMN "classroomId";
