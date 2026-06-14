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

type DraftOrderCreateError = {
  type:
    | "validation"
    | "protected_customer_data"
    | "graphql_user_error"
    | "graphql_error"
    | "api_error";
  message: string;
  field?: string;
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
      errors: DraftOrderCreateError[];
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

function truncate(value: string, maxLength = 500) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function describeGraphqlException(error: unknown): Promise<DraftOrderCreateError[]> {
  if (error instanceof Response) {
    const responseText = await error.clone().text().catch(() => "");

    return [
      {
        type: error.status === 401 || error.status === 403 ? "graphql_error" : "api_error",
        message: `Shopify Admin GraphQL returned HTTP ${error.status} ${error.statusText}${
          responseText ? `: ${truncate(responseText)}` : ""
        }`,
      },
    ];
  }

  if (error instanceof Error) {
    return [
      {
        type: "api_error",
        message: truncate(error.message || error.name),
      },
    ];
  }

  return [
    {
      type: "api_error",
      message: `Unknown Shopify Admin GraphQL error: ${typeof error}`,
    },
  ];
}

export async function createDraftOrderForQuote(
  adminGraphql: AdminGraphqlClient,
  quote: QuoteRequest,
): Promise<DraftOrderCreateResult> {
  const variantGid = normalizeProductVariantGid(quote.variantId);

  if (!variantGid) {
    return {
      ok: false,
      errors: [
        {
          type: "validation",
          message: "variantId must be a numeric ID or ProductVariant GID",
          field: "variantId",
        },
      ],
    };
  }

  if (!Number.isInteger(quote.quantity) || quote.quantity < 1) {
    return {
      ok: false,
      errors: [
        {
          type: "validation",
          message: "quantity must be an integer greater than or equal to 1",
          field: "quantity",
        },
      ],
    };
  }

  let response: Response;

  try {
    response = await adminGraphql(DRAFT_ORDER_CREATE_MUTATION, {
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
  } catch (error) {
    return {
      ok: false,
      errors: await describeGraphqlException(error),
    };
  }

  const responseClone = response.clone();
  let body: DraftOrderCreateResponse;

  try {
    body = (await response.json()) as DraftOrderCreateResponse;
  } catch {
    const responseText = await responseClone.text().catch(() => "");

    return {
      ok: false,
      errors: [
        {
          type: "api_error",
          message: `Shopify Admin GraphQL response was not JSON. HTTP ${response.status} ${response.statusText}${
            responseText ? `: ${truncate(responseText)}` : ""
          }`,
        },
      ],
    };
  }

  if (body.errors?.length) {
    return {
      ok: false,
      errors: body.errors.map((error) => ({
        type: "graphql_error",
        message: error.message,
      })),
    };
  }

  const payload = body.data?.draftOrderCreate;
  const userErrors = payload?.userErrors || [];

  if (userErrors.length > 0) {
    return {
      ok: false,
      errors: userErrors.map((error) => ({
        type: "graphql_user_error",
        message: error.message,
        field: error.field?.join("."),
      })),
    };
  }

  if (!payload?.draftOrder) {
    return {
      ok: false,
      errors: [
        {
          type: "api_error",
          message: "Shopify did not return a draft order",
        },
      ],
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
