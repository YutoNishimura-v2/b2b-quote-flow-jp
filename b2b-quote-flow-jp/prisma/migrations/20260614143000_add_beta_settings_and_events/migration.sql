CREATE TABLE "ShopSettings" (
  "shop" TEXT NOT NULL PRIMARY KEY,
  "notificationEmail" TEXT,
  "quoteEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "QuoteEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "quoteRequestId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "QuoteEvent_shop_createdAt_idx" ON "QuoteEvent"("shop", "createdAt");
CREATE INDEX "QuoteEvent_quoteRequestId_createdAt_idx" ON "QuoteEvent"("quoteRequestId", "createdAt");
