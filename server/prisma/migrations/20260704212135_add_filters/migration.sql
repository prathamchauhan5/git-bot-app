/*
  Warnings:

  - You are about to drop the column `conditionType` on the `Rule` table. All the data in the column will be lost.
  - You are about to drop the column `conditionValue` on the `Rule` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FilterField" AS ENUM ('TITLE', 'AUTHOR', 'BRANCH');

-- CreateEnum
CREATE TYPE "FilterOperator" AS ENUM ('CONTAINS', 'EQUALS', 'STARTS_WITH', 'ENDS_WITH');

-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'SEND_SLACK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'PULL_REQUEST_OPENED';
ALTER TYPE "EventType" ADD VALUE 'PUSH';

-- AlterTable
ALTER TABLE "Rule" DROP COLUMN "conditionType",
DROP COLUMN "conditionValue",
ADD COLUMN     "filterField" "FilterField",
ADD COLUMN     "filterOperator" "FilterOperator",
ADD COLUMN     "filterValue" TEXT;
