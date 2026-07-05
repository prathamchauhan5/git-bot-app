-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('ISSUE_OPENED');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('TITLE_CONTAINS');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('ADD_LABEL');

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "event" "EventType" NOT NULL,
    "conditionType" "ConditionType" NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "actionValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rule_repositoryId_key" ON "Rule"("repositoryId");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
