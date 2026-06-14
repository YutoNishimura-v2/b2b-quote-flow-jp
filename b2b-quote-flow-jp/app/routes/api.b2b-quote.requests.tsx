import type { ActionFunctionArgs } from "react-router";

import {
  createQuoteRequest,
  type QuoteRequestInput,
  verifyAppProxySignature,
} from "../models/quoteRequest.server";
import { sendMerchantQuoteNotification } from "../models/merchantNotification.server";
import { recordQuoteEvent } from "../models/quoteEvent.server";
import { getShopSettings } from "../models/shopSettings.server";

type ErrorStatus = 400 | 401 | 404 | 405 | 500;

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(status: ErrorStatus, error: string) {
  return jsonResponse({ ok: false, error }, status);
}

function logPostReached(request: Request, url: URL) {
  console.info("b2b_quote_request_post_received", {
    path: url.pathname,
    method: request.method,
    contentType: request.headers.get("content-type") || "",
    contentLength: request.headers.get("content-length") || "",
    hasAppProxySignature: url.searchParams.has("signature"),
  });
}

function logPostResult(
  url: URL,
  status: number,
  result: "success" | "error",
  details: Record<string, unknown> = {},
) {
  console.info("b2b_quote_request_post_result", {
    path: url.pathname,
    status,
    result,
    ...details,
  });
}

async function readQuoteRequestInput(request: Request, contentType: string) {
  if (contentType.includes("application/json")) {
    return (await request.json()) as QuoteRequestInput;
  }

  return Object.fromEntries(await request.formData()) as QuoteRequestInput;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") || "";
  const hasSignature = url.searchParams.has("signature");
  const hasValidSignature = verifyAppProxySignature(url);

  logPostReached(request, url);

  if (hasSignature && !hasValidSignature) {
    logPostResult(url, 401, "error", { reason: "invalid_app_proxy_signature" });
    return errorResponse(401, "Invalid app proxy signature");
  }

  const signedShop = hasValidSignature ? url.searchParams.get("shop") || "" : "";

  let input: QuoteRequestInput;

  try {
    input = await readQuoteRequestInput(request, contentType);
  } catch {
    logPostResult(url, 400, "error", { reason: "invalid_request_body" });
    return errorResponse(400, "Invalid request body");
  }

  try {
    const result = await createQuoteRequest(input, signedShop || String(input.shop || ""));

    if (!result.ok) {
      logPostResult(url, 400, "error", {
        reason: "validation_failed",
        fields: Object.keys(result.errors),
      });

      return errorResponse(400, "Validation failed");
    }

    logPostResult(url, 200, "success", {
      quoteRequestId: result.quote.id,
    });

    await recordQuoteEvent({
      shop: result.quote.shop,
      quoteRequestId: result.quote.id,
      type: "quote_created",
      message: `Quote request created for ${result.quote.companyName}.`,
      metadata: {
        productTitle: result.quote.productTitle,
        variantTitle: result.quote.variantTitle,
        quantity: result.quote.quantity,
      },
    });

    try {
      const settings = await getShopSettings(result.quote.shop);
      const notificationResult = await sendMerchantQuoteNotification(
        result.quote,
        settings,
      );

      await recordQuoteEvent({
        shop: result.quote.shop,
        quoteRequestId: result.quote.id,
        type: notificationResult.ok
          ? "merchant_notification_sent"
          : notificationResult.skipped
          ? "merchant_notification_skipped"
          : "merchant_notification_failed",
        message: notificationResult.message,
        metadata: {
          recipientConfigured: Boolean(settings.notificationEmail),
          notificationEnabled: settings.quoteEmailNotificationsEnabled,
          provider: "provider" in notificationResult
            ? notificationResult.provider
            : undefined,
          reason: "reason" in notificationResult
            ? notificationResult.reason
            : undefined,
        },
      });
    } catch (error) {
      console.error("b2b_quote_merchant_notification_unhandled_error", {
        shop: result.quote.shop,
        quoteRequestId: result.quote.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      await recordQuoteEvent({
        shop: result.quote.shop,
        quoteRequestId: result.quote.id,
        type: "merchant_notification_failed",
        message: "Merchant notification failed before delivery attempt completed.",
      });
    }

    return jsonResponse({
      ok: true,
      quoteRequestId: result.quote.id,
    });
  } catch (error) {
    console.error("b2b_quote_request_post_unhandled_error", {
      path: url.pathname,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return errorResponse(500, "Internal server error");
  }
};

export const loader = async () =>
  errorResponse(405, "Method not allowed");
