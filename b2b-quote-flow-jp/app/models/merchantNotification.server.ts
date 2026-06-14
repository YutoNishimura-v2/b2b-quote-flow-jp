import type { QuoteRequest, ShopSettings } from "@prisma/client";

type MerchantNotificationResult =
  | {
      ok: true;
      provider: "resend" | "webhook";
      message: string;
    }
  | {
      ok: false;
      skipped: true;
      reason: "disabled" | "missing_recipient" | "missing_provider";
      message: string;
    }
  | {
      ok: false;
      skipped?: false;
      provider: "resend" | "webhook";
      message: string;
    };

function productLine(quote: QuoteRequest) {
  return quote.variantTitle && quote.variantTitle !== "Default Title"
    ? `${quote.productTitle} / ${quote.variantTitle}`
    : quote.productTitle;
}

function quoteNotificationText(quote: QuoteRequest) {
  return [
    "B2B Quote Flow JPに新しい見積依頼が届きました。",
    "",
    `会社名: ${quote.companyName}`,
    `担当者: ${quote.contactName}`,
    `メール: ${quote.email}`,
    `商品: ${productLine(quote)}`,
    `数量: ${quote.quantity}`,
    `請求書払い相談: ${quote.wantsInvoicePayment ? "あり" : "なし"}`,
    `稟議PDF希望: ${quote.needsApprovalPdf ? "あり" : "なし"}`,
    quote.customerNote ? `備考: ${quote.customerNote}` : "",
    "",
    "Shopify Admin appのquote detailで内容を確認してください。",
  ]
    .filter(Boolean)
    .join("\n");
}

function notificationPayload(quote: QuoteRequest, to: string) {
  return {
    to,
    subject: `新しい法人見積依頼: ${quote.companyName}`,
    text: quoteNotificationText(quote),
    quote: {
      id: quote.id,
      shop: quote.shop,
      companyName: quote.companyName,
      contactName: quote.contactName,
      email: quote.email,
      productTitle: quote.productTitle,
      variantTitle: quote.variantTitle,
      quantity: quote.quantity,
      wantsInvoicePayment: quote.wantsInvoicePayment,
      needsApprovalPdf: quote.needsApprovalPdf,
      createdAt: quote.createdAt.toISOString(),
    },
  };
}

async function sendViaResend(payload: ReturnType<typeof notificationPayload>) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.B2B_QUOTE_NOTIFICATION_FROM;

  if (!apiKey || !from) {
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    return {
      ok: false as const,
      provider: "resend" as const,
      message: `Resend notification failed: HTTP ${response.status} ${response.statusText}${
        responseText ? ` ${responseText.slice(0, 300)}` : ""
      }`,
    };
  }

  return {
    ok: true as const,
    provider: "resend" as const,
    message: "Merchant email notification sent via Resend.",
  };
}

async function sendViaWebhook(payload: ReturnType<typeof notificationPayload>) {
  const webhookUrl = process.env.B2B_QUOTE_NOTIFICATION_WEBHOOK_URL;

  if (!webhookUrl) {
    return null;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    return {
      ok: false as const,
      provider: "webhook" as const,
      message: `Notification webhook failed: HTTP ${response.status} ${response.statusText}${
        responseText ? ` ${responseText.slice(0, 300)}` : ""
      }`,
    };
  }

  return {
    ok: true as const,
    provider: "webhook" as const,
    message: "Merchant email notification sent via webhook.",
  };
}

export async function sendMerchantQuoteNotification(
  quote: QuoteRequest,
  settings: ShopSettings,
): Promise<MerchantNotificationResult> {
  if (!settings.quoteEmailNotificationsEnabled) {
    return {
      ok: false,
      skipped: true,
      reason: "disabled",
      message: "Merchant email notification is disabled.",
    };
  }

  if (!settings.notificationEmail) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_recipient",
      message: "Merchant email notification recipient is not configured.",
    };
  }

  const payload = notificationPayload(quote, settings.notificationEmail);

  try {
    const resendResult = await sendViaResend(payload);
    if (resendResult) return resendResult;

    const webhookResult = await sendViaWebhook(payload);
    if (webhookResult) return webhookResult;
  } catch (error) {
    return {
      ok: false,
      provider: process.env.RESEND_API_KEY ? "resend" : "webhook",
      message:
        error instanceof Error
          ? error.message
          : "Merchant email notification failed.",
    };
  }

  console.info("b2b_quote_merchant_notification_preview", payload);

  return {
    ok: false,
    skipped: true,
    reason: "missing_provider",
    message:
      "Merchant email provider is not configured. Configure Resend or a notification webhook for beta delivery.",
  };
}
