import prisma from "../db.server";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_METADATA_LENGTH = 4000;

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function safeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return "";

  try {
    return truncate(JSON.stringify(metadata), MAX_METADATA_LENGTH);
  } catch {
    return "";
  }
}

export function createQuoteEvent(input: {
  shop: string;
  quoteRequestId?: string | null;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.quoteEvent.create({
    data: {
      shop: input.shop,
      quoteRequestId: input.quoteRequestId || null,
      type: input.type,
      message: truncate(input.message, MAX_MESSAGE_LENGTH),
      metadata: safeMetadata(input.metadata),
    },
  });
}

export function listQuoteEvents(shop: string, take = 20) {
  return prisma.quoteEvent.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function recordQuoteEvent(input: {
  shop: string;
  quoteRequestId?: string | null;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await createQuoteEvent(input);
  } catch (error) {
    console.error("b2b_quote_event_record_error", {
      shop: input.shop,
      quoteRequestId: input.quoteRequestId,
      type: input.type,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
