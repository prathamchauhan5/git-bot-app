-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "RuleExecution" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "ruleId" TEXT,
    "event" "EventType" NOT NULL,
    "target" TEXT NOT NULL,
    "targetUrl" TEXT,
    "actionType" "ActionType" NOT NULL,
    "actionValue" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleExecution_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
