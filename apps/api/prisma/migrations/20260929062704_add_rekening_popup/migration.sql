-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" VARCHAR(120) NOT NULL,
    "accountNumber" VARCHAR(40) NOT NULL,
    "accountHolder" VARCHAR(160) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "popup_infos" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popup_infos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_accounts_isPublic_idx" ON "bank_accounts"("isPublic");

-- CreateIndex
CREATE INDEX "popup_infos_isActive_order_idx" ON "popup_infos"("isActive", "order");
