import type { QuoteRequest } from "@prisma/client";
import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";

import { normalizeProductVariantGid } from "./quoteRequest.server";

type DraftOrderCreateResponse = {
  errors?: Array<{
    message: string;
  }>;
  data?: {
    draftOrderCreate?: {
      draftOrder?: {
        id: string;
        name: string;
        createdAt: string;
      } | null;
      userErrors: Array<{
        field?: string[] | null;
        message: string;
      }>;
    };
  };
};

export type DraftOrderCreateResult =
  | {
      ok: true;
      draftOrder: {
        id: string;
        name: string;
        adminUrl: string;
        createdAt: Date;
      };
    }
  | {
      ok: false;
      errors: string[];
    };

const DRAFT_ORDER_CREATE_MUTATION = `#graphql
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        createdAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function draftOrderAdminUrl(shop: string, draftOrderId: string) {
  const draftOrderNumericId = draftOrderId.split("/").pop();
  const shopHandle = shop.replace(/\.myshopify\.com$/, "");

  if (!draftOrderNumericId || !shopHandle) {
    return "";
  }

  return `https://admin.shopify.com/store/${shopHandle}/draft_orders/${draftOrderNumericId}`;
}

function draftOrderNote(quote: QuoteRequest) {
  return [
    "B2B Quote Flow JP",
    `Quote Request ID: ${quote.id}`,
    `Company: ${quote.companyName}`,
    `Contact: ${quote.contactName}`,
    `Invoice payment requested: ${quote.wantsInvoicePayment ? "yes" : "no"}`,
    `Approval PDF requested: ${quote.needsApprovalPdf ? "yes" : "no"}`,
    quote.customerNote ? `Customer note: ${quote.customerNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createDraftOrderForQuote(
  adminGraphql: AdminGraphqlClient,
  quote: QuoteRequest,
): Promise<DraftOrderCreateResult> {
  const variantGid = normalizeProductVariantGid(quote.variantId);

  if (!variantGid) {
    return {
      ok: false,
      errors: ["variantId must be a numeric ID or ProductVariant GID"],
    };
  }

  if (!Number.isInteger(quote.quantity) || quote.quantity < 1) {
    return {
      ok: false,
      errors: ["quantity must be an integer greater than or equal to 1"],
    };
  }

  const response = await adminGraphql(DRAFT_ORDER_CREATE_MUTATION, {
    variables: {
      input: {
        email: quote.email,
        note: draftOrderNote(quote),
        tags: ["b2b-quote-flow-jp", `quote-request:${quote.id}`],
        lineItems: [
          {
            variantId: variantGid,
            quantity: quote.quantity,
          },
        ],
        customAttributes: [
          { key: "Quote Request ID", value: quote.id },
          { key: "Company", value: quote.companyName },
          { key: "Contact", value: quote.contactName },
          { key: "Wants invoice payment", value: quote.wantsInvoicePayment ? "yes" : "no" },
          { key: "Needs approval PDF", value: quote.needsApprovalPdf ? "yes" : "no" },
          { key: "Customer note", value: quote.customerNote || "" },
        ],
      },
    },
  });

  const body = (await response.json()) as DraftOrderCreateResponse;

  if (body.errors?.length) {
    return {
      ok: false,
      errors: body.errors.map((error) => error.message),
    };
  }

  const payload = body.data?.draftOrderCreate;
  const userErrors = payload?.userErrors || [];

  if (userErrors.length > 0) {
    return {
      ok: false,
      errors: userErrors.map((error) => error.message),
    };
  }

  if (!payload?.draftOrder) {
    return {
      ok: false,
      errors: ["Shopify did not return a draft order"],
    };
  }

  return {
    ok: true,
    draftOrder: {
      id: payload.draftOrder.id,
      name: payload.draftOrder.name,
      adminUrl: draftOrderAdminUrl(quote.shop, payload.draftOrder.id),
      createdAt: new Date(payload.draftOrder.createdAt),
    },
  };
}
