import crypto from "node:crypto";

import prisma from "../db.server";

export type QuoteStatus =
  | "NEW"
  | "REVIEWING"
  | "QUOTE_CREATED"
  | "SENT"
  | "WON"
  | "LOST";

export const QUOTE_STATUSES: QuoteStatus[] = [
  "NEW",
  "REVIEWING",
  "QUOTE_CREATED",
  "SENT",
  "WON",
  "LOST",
];

export type QuoteRequestInput = {
  shop?: unknown;
  companyName?: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  productId?: unknown;
  variantId?: unknown;
  productTitle?: unknown;
  variantTitle?: unknown;
  productUrl?: unknown;
  quantity?: unknown;
  wantsInvoicePayment?: unknown;
  needsApprovalPdf?: unknown;
  customerNote?: unknown;
};

const MAX_TEXT_LENGTH = 500;
const MAX_NOTE_LENGTH = 2000;
const DRAFT_ORDER_SAVE_FAILURE_NOTE = "[draft_order_save_error]";

function text(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function normalizeShop(value: unknown) {
  const shop = text(value, 255).toLowerCase();
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) ? shop : "";
}

function normalizeQuantity(value: unknown) {
  const quantity =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(quantity)) {
    return 0;
  }

  return Math.min(Math.max(quantity, 1), 99999);
}

function normalizeProductUrl(value: unknown) {
  const productUrl = text(value, 1000);

  if (!productUrl) {
    return "";
  }

  try {
    const url = new URL(productUrl);
    return url.protocol === "http:" || url.protocol === "https:"
      ? productUrl
      : "";
  } catch {
    return "";
  }
}

export function normalizeProductVariantGid(variantId: string) {
  const normalized = variantId.trim();

  if (/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(normalized)) {
    return normalized;
  }

  if (/^\d+$/.test(normalized)) {
    return `gid://shopify/ProductVariant/${normalized}`;
  }

  return "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeQuoteStatus(value: unknown) {
  const status = text(value, 50);
  return QUOTE_STATUSES.includes(status as QuoteStatus)
    ? (status as QuoteStatus)
    : "";
}

export function verifyAppProxySignature(url: URL) {
  const signature = url.searchParams.get("signature");
  const secret = process.env.SHOPIFY_API_SECRET || "";

  if (!signature || !secret) {
    return false;
  }

  const params = new URLSearchParams(url.search);
  params.delete("signature");

  const message = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function validateQuoteRequestInput(
  input: QuoteRequestInput,
  trustedShop?: string,
) {
  const shop = normalizeShop(trustedShop || input.shop);
  const companyName = text(input.companyName);
  const contactName = text(input.contactName);
  const email = text(input.email, 255);
  const productId = text(input.productId);
  const variantId = text(input.variantId);
  const productTitle = text(input.productTitle);
  const variantTitle = text(input.variantTitle);
  const productUrl = normalizeProductUrl(input.productUrl);
  const quantity = normalizeQuantity(input.quantity);
  const errors: Record<string, string> = {};

  if (!shop) errors.shop = "shop is required";
  if (!companyName) errors.companyName = "companyName is required";
  if (!contactName) errors.contactName = "contactName is required";
  if (!isValidEmail(email)) errors.email = "valid email is required";
  if (!productId) errors.productId = "productId is required";
  if (!variantId) errors.variantId = "variantId is required";
  if (!productTitle) errors.productTitle = "productTitle is required";
  if (quantity < 1) errors.quantity = "quantity must be at least 1";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: {
      shop,
      companyName,
      contactName,
      email,
      phone: text(input.phone, 100) || null,
      productId,
      variantId,
      productTitle,
      variantTitle,
      productUrl,
      quantity,
      wantsInvoicePayment: booleanValue(input.wantsInvoicePayment),
      needsApprovalPdf: booleanValue(input.needsApprovalPdf),
      customerNote: text(input.customerNote, MAX_NOTE_LENGTH),
    },
  };
}

export async function createQuoteRequest(input: QuoteRequestInput, shop: string) {
  const validation = validateQuoteRequestInput(input, shop);

  if (!validation.ok) {
    return { ...validation, ok: false as const };
  }

  const quote = await prisma.quoteRequest.create({
    data: {
      ...validation.data,
      status: "NEW",
      internalNote: "",
    },
  });

  return { ...validation, ok: true as const, quote };
}

export function listQuoteRequests(shop: string) {
  return prisma.quoteRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getQuoteStats(shop: string) {
  const [total, newCount, draftOrderCreated] = await Promise.all([
    prisma.quoteRequest.count({ where: { shop } }),
    prisma.quoteRequest.count({ where: { shop, status: "NEW" } }),
    prisma.quoteRequest.count({
      where: {
        shop,
        draftOrderId: { not: null },
      },
    }),
  ]);

  return { total, newCount, draftOrderCreated };
}

export function getQuoteRequest(shop: string, id: string) {
  return prisma.quoteRequest.findFirst({
    where: { id, shop },
  });
}

export async function updateQuoteStatusAndInternalNote(
  shop: string,
  quoteRequestId: string,
  input: {
    status?: unknown;
    internalNote?: unknown;
  },
) {
  const status = normalizeQuoteStatus(input.status);
  const internalNote = text(input.internalNote, MAX_NOTE_LENGTH);
  const errors: Record<string, string> = {};

  if (!status) {
    errors.status = "有効なstatusを選択してください。";
  }

  const quote = await getQuoteRequest(shop, quoteRequestId);

  if (!quote) {
    errors.quote = "見積依頼が見つかりません。";
  }

  if (quote?.draftOrderId && status === "NEW") {
    errors.status =
      "Draft Order作成済みのquoteはNEWへ戻せません。SENT/WON/LOSTなどを選択してください。";
  }

  if (quote && !quote.draftOrderId && status === "QUOTE_CREATED") {
    errors.status =
      "Draft Order未作成のquoteはQUOTE_CREATEDへ変更できません。先にDraft Orderを作成してください。";
  }

  if (Object.keys(errors).length > 0 || !quote) {
    return { ok: false as const, errors, quote };
  }

  const updatedQuote = await prisma.quoteRequest.update({
    where: { id: quoteRequestId, shop },
    data: {
      status,
      internalNote,
    },
  });

  return { ok: true as const, quote: updatedQuote, previousQuote: quote };
}

export async function claimQuoteDraftOrderCreation(shop: string, quoteRequestId: string) {
  const result = await prisma.quoteRequest.updateMany({
    where: {
      id: quoteRequestId,
      shop,
      draftOrderId: null,
      status: "NEW",
    },
    data: {
      status: "REVIEWING",
    },
  });

  return result.count === 1;
}

export function resetQuoteDraftOrderCreation(shop: string, quoteRequestId: string) {
  return prisma.quoteRequest.updateMany({
    where: {
      id: quoteRequestId,
      shop,
      draftOrderId: null,
      status: "REVIEWING",
    },
    data: {
      status: "NEW",
    },
  });
}

export function markQuoteDraftOrderSaveFailure(
  shop: string,
  quoteRequestId: string,
  draftOrderId: string,
) {
  return prisma.quoteRequest.updateMany({
    where: {
      id: quoteRequestId,
      shop,
      draftOrderId: null,
      status: "REVIEWING",
    },
    data: {
      internalNote: `${DRAFT_ORDER_SAVE_FAILURE_NOTE} draftOrderId=${draftOrderId}`,
    },
  });
}

export function hasDraftOrderSaveFailureMarker(internalNote: string) {
  return internalNote.includes(DRAFT_ORDER_SAVE_FAILURE_NOTE);
}

export function saveQuoteDraftOrder(
  shop: string,
  quoteRequestId: string,
  draftOrder: {
    id: string;
    name: string;
    adminUrl: string;
    createdAt: Date;
  },
) {
  return prisma.quoteRequest.update({
    where: { id: quoteRequestId, shop },
    data: {
      status: "QUOTE_CREATED",
      draftOrderId: draftOrder.id,
      draftOrderName: draftOrder.name,
      draftOrderAdminUrl: draftOrder.adminUrl,
      draftOrderCreatedAt: draftOrder.createdAt,
    },
  });
}
