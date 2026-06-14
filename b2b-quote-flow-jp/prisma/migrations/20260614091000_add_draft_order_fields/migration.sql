-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN "draftOrderId" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "draftOrderName" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "draftOrderAdminUrl" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "draftOrderCreatedAt" DATETIME;
