/*
  Warnings:

  - You are about to drop the column `nis` on the `students` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "students_nis_key";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "nis";
