import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  ShouldRevalidateFunctionArgs,
} from "react-router";
import {
  Link,
  useLoaderData,
  useRouteError,
} from "react-router";
import { useState } from "react";

import {
  Badge,
  Card,
  Field,
  Notice,
  QuoteFlag,
  StatusBadge,
  cardGridStyle,
  compactGridStyle,
  eventTypeLabel,
  fieldLabelStyle,
  formatDateTime,
  inputStyle,
  mutedTextStyle,
  pageStackStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "../components/productUi";
import { createDraftOrderForQuote } from "../models/draftOrder.server";
import {
  claimQuoteDraftOrderCreation,
  getQuoteRequest,
  markQuoteDraftOrderSaveFailure,
  normalizeProductVariantGid,
  resetQuoteDraftOrderCreation,
  saveQuoteDraftOrder,
  updateQuoteStatusAndInternalNote,
} from "../models/quoteRequest.server";
import {
  listQuoteEventsForQuote,
  recordQuoteEvent,
} from "../models/quoteEvent.server";
import { authenticate } from "../shopify.server";

const DRAFT_ORDER_SAVE_FAILURE_NOTE = "[draft_order_save_error]";
const QUOTE_STATUS_OPTIONS = [
  "NEW",
  "REVIEWING",
  "QUOTE_CREATED",
  "SENT",
  "WON",
  "LOST",
];

type ActionErrorType =
  | "auth"
  | "validation"
  | "protected_customer_data"
  | "scope"
  | "graphql_user_error"
  | "graphql_error"
  | "api_error"
  | "state"
  | "save_error";

type ActionData =
  | {
      ok: true;
      message: string;
      details?: Array<{
        label: string;
        value: string;
      }>;
    }
  | {
      ok: false;
      errors: Array<{
        type: ActionErrorType;
        message: string;
        field?: string;
      }>;
    };

type SafeError = {
  type: string;
  message?: string;
  status?: number;
  statusText?: string;
};

type LoaderData =
  | {
      quote: NonNullable<Awaited<ReturnType<typeof getQuoteRequest>>>;
      quoteEvents: Awaited<ReturnType<typeof listQuoteEventsForQuote>>;
      loaderError: null;
      showAdminAuthDebug: boolean;
    }
  | {
      quote: null;
      quoteEvents: [];
      loaderError: {
        message: string;
        error: SafeError;
      };
      showAdminAuthDebug: boolean;
    };

function describeCaughtError(error: unknown): SafeError {
  if (error instanceof Response) {
    return {
      type: "Response",
      status: error.status,
      statusText: error.statusText,
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
    };
  }

  return { type: typeof error };
}

function shouldRethrowShopifyResponse(error: unknown) {
  return error instanceof Response && error.status >= 300 && error.status < 400;
}

function hasDraftOrderSaveFailureMarker(internalNote: string) {
  return internalNote.includes(DRAFT_ORDER_SAVE_FAILURE_NOTE);
}

function actionFailure(
  type: ActionErrorType,
  message: string,
  field?: string,
): ActionData {
  return {
    ok: false,
    errors: [{ type, message, field }],
  };
}

function jsonAction(data: ActionData) {
  return Response.json(data, { status: 200 });
}

function jsonActionFailure(
  type: ActionErrorType,
  message: string,
  field?: string,
) {
    return jsonAction(actionFailure(type, message, field));
}

function jsonActionSuccess(
  message: string,
  details?: Array<{ label: string; value: string }>,
) {
  return jsonAction({ ok: true, message, details });
}

function draftOrderActionDetails(
  draftOrder: {
    id: string;
    name?: string | null;
    adminUrl?: string | null;
  },
  quoteStatus = "QUOTE_CREATED",
) {
  return [
    { label: "Quote status", value: quoteStatus },
    { label: "Draft Order ID", value: draftOrder.id },
    { label: "Draft Order Name", value: draftOrder.name || "-" },
    { label: "管理画面リンク", value: draftOrder.adminUrl || "-" },
  ];
}

function logDraftOrderAction(
  event: string,
  details: Record<string, unknown>,
) {
  console.info(`b2b_quote_draft_order_${event}`, details);
}

function isScopeLikeError(message: string) {
  return /access|permission|scope|draft order|draft_orders/i.test(message);
}

function isProtectedCustomerDataError(message: string) {
  return /protected customer data|not approved to access the .* object|not approved to use/i.test(message);
}

async function resetDraftOrderClaim(shop: string, quoteRequestId: string) {
  try {
    await resetQuoteDraftOrderCreation(shop, quoteRequestId);
  } catch (error) {
    console.error("b2b_quote_draft_order_reset_error", {
      shop,
      quoteRequestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const quoteRequestId = params.id || "";

  console.info("b2b_quote_detail_loader_start", {
    route: "app.quotes.$id",
    phase: "loader",
    quoteRequestId,
    method: request.method,
  });

  try {
    const { session } = await authenticate.admin(request);

    console.info("b2b_quote_detail_loader_authenticated", {
      route: "app.quotes.$id",
      phase: "loader",
      shop: session.shop,
      quoteRequestId,
    });

    const quote = await getQuoteRequest(session.shop, quoteRequestId);

    if (!quote) {
      return {
        quote: null,
        quoteEvents: [],
        showAdminAuthDebug: process.env.NODE_ENV !== "production",
        loaderError: {
          message: "見積依頼が見つかりません。一覧へ戻って再度開いてください。",
          error: { type: "NotFound", status: 404, statusText: "Not Found" },
        },
      } satisfies LoaderData;
    }

    console.info("b2b_quote_detail_loader_quote_loaded", {
      route: "app.quotes.$id",
      phase: "loader",
      shop: session.shop,
      quoteRequestId: quote.id,
      status: quote.status,
      hasDraftOrderId: Boolean(quote.draftOrderId),
    });

    const quoteEvents = await listQuoteEventsForQuote(session.shop, quote.id, 12);

    return {
      quote,
      quoteEvents,
      loaderError: null,
      showAdminAuthDebug: process.env.NODE_ENV !== "production",
    } satisfies LoaderData;
  } catch (error) {
    if (shouldRethrowShopifyResponse(error)) {
      throw error;
    }

    const safeError = describeCaughtError(error);

    console.error("b2b_quote_detail_loader_error", {
      route: "app.quotes.$id",
      phase: "loader",
      quoteRequestId,
      error: safeError,
    });

    return {
      quote: null,
      quoteEvents: [],
      showAdminAuthDebug: process.env.NODE_ENV !== "production",
      loaderError: {
        message:
          safeError.status === 400
            ? "Shopify Admin認証またはリクエスト処理でBad Requestが発生しました。アプリを再読み込みし、権限更新/再インストール状態を確認してください。"
            : "見積依頼詳細を表示できませんでした。画面を再読み込みするか、一覧へ戻って再度開いてください。",
        error: safeError,
      },
    } satisfies LoaderData;
  }
};

export const shouldRevalidate = ({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) => {
  const intent = String(formData?.get("intent") || "");

  if (
    intent === "create-draft-order" ||
    intent === "debug-admin-auth" ||
    intent === "update-quote"
  ) {
    return false;
  }

  return defaultShouldRevalidate;
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  let formData: FormData;

  try {
    formData = await request.clone().formData();
  } catch (error) {
    console.error("b2b_quote_draft_order_form_error", {
      route: "app.quotes.$id",
      phase: "action",
      quoteRequestId: params.id || "",
      method: request.method,
      error: describeCaughtError(error),
    });

    return jsonActionFailure(
      "validation",
      "操作内容を読み取れませんでした。画面を再読み込みして再試行してください。",
    );
  }

  const intent = String(formData.get("intent") || "");

  console.info("b2b_quote_draft_order_action_start", {
    route: "app.quotes.$id",
    phase: "action",
    quoteRequestId: params.id || "",
    method: request.method,
    intent,
  });

  let auth: Awaited<ReturnType<typeof authenticate.admin>>;

  try {
    logDraftOrderAction("before_auth", {
      route: "app.quotes.$id",
      phase: "action",
      quoteRequestId: params.id || "",
      intent,
    });

    auth = await authenticate.admin(request);
  } catch (error) {
    if (shouldRethrowShopifyResponse(error)) {
      throw error;
    }

    const safeError = describeCaughtError(error);

    console.error("b2b_quote_draft_order_auth_error", {
      route: "app.quotes.$id",
      phase: "action",
      quoteRequestId: params.id || "",
      intent,
      error: safeError,
    });

    return jsonActionFailure(
      "auth",
      `Shopify Admin認証に失敗しました。アプリを再読み込みし、権限更新または再インストールが必要か確認してください。${safeError.status ? ` (${safeError.status} ${safeError.statusText || ""})` : ""}`,
    );
  }

  const { admin, session } = auth;

  logDraftOrderAction("after_auth", {
    route: "app.quotes.$id",
    phase: "action",
    shop: session.shop,
    quoteRequestId: params.id || "",
    intent,
  });

  if (intent === "debug-admin-auth") {
    if (process.env.NODE_ENV === "production") {
      return jsonActionFailure(
        "validation",
        "Admin認証診断は開発環境専用です。本番では表示・実行しません。",
      );
    }

    try {
      logDraftOrderAction("debug_before_graphql", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: params.id || "",
        intent,
      });

      const response = await admin.graphql(`#graphql
        query AdminAuthDebug {
          shop {
            name
            myshopifyDomain
          }
        }
      `);
      const body = (await response.json()) as {
        data?: {
          shop?: {
            name?: string;
            myshopifyDomain?: string;
          };
        };
        errors?: Array<{ message: string }>;
      };

      if (body.errors?.length) {
        return jsonAction({
          ok: false,
          errors: body.errors.map((error) => ({
            type: isScopeLikeError(error.message) ? "scope" : "graphql_error",
            message: error.message,
            field: undefined,
          })),
        });
      }

      return jsonActionSuccess("[debug] Admin auth OK", [
        { label: "shop", value: session.shop },
        { label: "sessionScopes", value: session.scope || "-" },
        {
          label: "myshopifyDomain",
          value: body.data?.shop?.myshopifyDomain || "-",
        },
      ]);
    } catch (error) {
      if (shouldRethrowShopifyResponse(error)) {
        throw error;
      }

      const safeError = describeCaughtError(error);

      console.error("b2b_quote_draft_order_debug_auth_error", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: params.id || "",
        intent,
        error: safeError,
      });

      return jsonActionFailure(
        safeError.status === 401 || safeError.status === 403 ? "scope" : "auth",
        `[auth] Admin auth failed${safeError.status ? ` (${safeError.status} ${safeError.statusText || ""})` : ""}${safeError.message ? `: ${safeError.message}` : ""}`,
      );
    }
  }

  let quote: Awaited<ReturnType<typeof getQuoteRequest>>;

  try {
    logDraftOrderAction("before_quote_lookup", {
      route: "app.quotes.$id",
      phase: "action",
      shop: session.shop,
      quoteRequestId: params.id || "",
      intent,
    });

    quote = await getQuoteRequest(session.shop, params.id || "");
  } catch (error) {
    console.error("b2b_quote_draft_order_quote_lookup_error", {
      route: "app.quotes.$id",
      phase: "action",
      shop: session.shop,
      quoteRequestId: params.id || "",
      intent,
      error: describeCaughtError(error),
    });

    return jsonActionFailure(
      "state",
      "見積依頼の取得に失敗しました。画面を再読み込みして再試行してください。",
    );
  }

  if (!quote) {
    logDraftOrderAction("quote_lookup_result", {
      route: "app.quotes.$id",
      phase: "action",
      shop: session.shop,
      quoteRequestId: params.id || "",
      intent,
      quoteFound: false,
    });

    return jsonActionFailure(
      "state",
      "見積依頼が見つかりません。shopまたはquote IDを確認してください。",
    );
  }

  const normalizedVariantId = normalizeProductVariantGid(quote.variantId);
  const hasSaveFailureMarker = hasDraftOrderSaveFailureMarker(quote.internalNote);

  logDraftOrderAction("action_received", {
    route: "app.quotes.$id",
    phase: "action",
    shop: session.shop,
    quoteRequestId: quote.id,
    intent,
    quoteStatus: quote.status,
    hasDraftOrderId: Boolean(quote.draftOrderId),
    variantIdIsGid: Boolean(normalizedVariantId),
    quantity: quote.quantity,
  });

  if (intent === "update-quote") {
    const result = await updateQuoteStatusAndInternalNote(
      session.shop,
      quote.id,
      {
        status: formData.get("status"),
        internalNote: formData.get("internalNote"),
      },
    );

    if (!result.ok) {
      const firstError = Object.entries(result.errors)[0];

      return jsonActionFailure(
        "validation",
        firstError?.[1] || "quoteの更新に失敗しました。",
        firstError?.[0],
      );
    }

    await recordQuoteEvent({
      shop: session.shop,
      quoteRequestId: quote.id,
      type: "quote_updated",
      message: `Quote status updated from ${result.previousQuote.status} to ${result.quote.status}.`,
      metadata: {
        previousStatus: result.previousQuote.status,
        status: result.quote.status,
        internalNoteChanged:
          result.previousQuote.internalNote !== result.quote.internalNote,
      },
    });

    return jsonActionSuccess("quoteのstatus/internal noteを更新しました。", [
      { label: "Quote status", value: result.quote.status },
      { label: "Internal note", value: result.quote.internalNote || "-" },
    ]);
  }

  if (intent !== "create-draft-order") {
    return jsonActionFailure("validation", "不明な操作です。画面を再読み込みして再試行してください。");
  }

  if (quote.draftOrderId) {
    return jsonActionSuccess(
      "Draft Orderは既に作成済みです。",
      draftOrderActionDetails({
        id: quote.draftOrderId,
        name: quote.draftOrderName,
        adminUrl: quote.draftOrderAdminUrl,
      }, quote.status),
    );
  }

  if (
    quote.status === "REVIEWING" &&
    !quote.draftOrderId &&
    hasSaveFailureMarker
  ) {
    return jsonActionFailure(
      "save_error",
      "前回、Draft Order作成後にquoteへの保存だけ失敗した可能性があります。二重作成を避けるため、Shopify Admin > Orders > Draftsを確認してください。",
    );
  }

  if (
    quote.status !== "NEW" &&
    !(quote.status === "REVIEWING" && !quote.draftOrderId)
  ) {
    return jsonActionFailure(
      "state",
      "Draft OrderはNEW statusのquoteからのみ作成できます。画面を再読み込みして状態を確認してください。",
    );
  }

  let claimed = false;

  if (quote.status === "REVIEWING" && !quote.draftOrderId) {
    claimed = true;
    logDraftOrderAction("claim_result", {
      route: "app.quotes.$id",
      phase: "action",
      shop: session.shop,
      quoteRequestId: quote.id,
      intent,
      quoteStatus: quote.status,
      hasDraftOrderId: false,
      claimed,
      retryingReviewingQuote: true,
    });
  } else {
    try {
      logDraftOrderAction("before_claim", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: quote.id,
        intent,
        quoteStatus: quote.status,
        hasDraftOrderId: Boolean(quote.draftOrderId),
      });

      claimed = await claimQuoteDraftOrderCreation(session.shop, quote.id);

      logDraftOrderAction("claim_result", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: quote.id,
        intent,
        quoteStatus: quote.status,
        hasDraftOrderId: Boolean(quote.draftOrderId),
        claimed,
      });
    } catch (error) {
      console.error("b2b_quote_draft_order_claim_error", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: quote.id,
        intent,
        quoteStatus: quote.status,
        hasDraftOrderId: Boolean(quote.draftOrderId),
        error: describeCaughtError(error),
      });

      return jsonActionFailure(
        "state",
        "Draft Order作成の開始状態を保存できませんでした。画面を再読み込みして再試行してください。",
      );
    }
  }

  if (!claimed) {
    return jsonActionFailure(
      "state",
      "Draft Orderは既に作成済み、または作成処理中です。画面を再読み込みして状態を確認してください。",
    );
  }

  try {
    logDraftOrderAction("before_graphql", {
      route: "app.quotes.$id",
      phase: "action",
      shop: session.shop,
      quoteRequestId: quote.id,
      quoteStatus: quote.status,
      hasDraftOrderId: false,
      variantIdIsGid: Boolean(normalizedVariantId),
      quantity: quote.quantity,
    });

    const result = await createDraftOrderForQuote(admin.graphql, quote);

    if (!result.ok) {
      await resetDraftOrderClaim(session.shop, quote.id);

      const actionErrors = result.errors.map((error) => ({
        ...error,
        type:
          error.type === "protected_customer_data" ||
          isProtectedCustomerDataError(error.message)
            ? ("protected_customer_data" as const)
            : isScopeLikeError(error.message)
            ? ("scope" as const)
            : error.type,
      }));
      const graphqlUserErrorCount = result.errors.filter(
        (error) => error.type === "graphql_user_error",
      ).length;
      const graphqlErrorCount = result.errors.filter(
        (error) => error.type === "graphql_error",
      ).length;

      logDraftOrderAction("graphql_failed", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: quote.id,
        quoteStatus: quote.status,
        hasDraftOrderId: false,
        variantIdIsGid: Boolean(normalizedVariantId),
        quantity: quote.quantity,
        graphqlUserErrorCount,
        graphqlErrorCount,
        errors: result.errors.map((error) => ({
          type: error.type,
          field: error.field,
          message: error.message,
        })),
      });

      return jsonAction({
        ok: false,
        errors: actionErrors,
      });
    }

    try {
      logDraftOrderAction("before_db_save", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: quote.id,
        draftOrderId: result.draftOrder.id,
      });

      await saveQuoteDraftOrder(session.shop, quote.id, result.draftOrder);
      await recordQuoteEvent({
        shop: session.shop,
        quoteRequestId: quote.id,
        type: "draft_order_created",
        message: `Draft Order ${result.draftOrder.name} created.`,
        metadata: {
          draftOrderId: result.draftOrder.id,
          draftOrderName: result.draftOrder.name,
          draftOrderAdminUrl: result.draftOrder.adminUrl,
        },
      });
    } catch (error) {
      console.error("b2b_quote_draft_order_save_error", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: quote.id,
        draftOrderId: result.draftOrder.id,
        error: describeCaughtError(error),
      });

      await markQuoteDraftOrderSaveFailure(
        session.shop,
        quote.id,
        result.draftOrder.id,
      );

      return jsonAction({
        ok: false,
        errors: [
          {
            type: "save_error",
            message:
              "Draft Orderは作成された可能性がありますが、quoteへの保存に失敗しました。Shopify AdminのDraftsを確認してから再試行してください。",
          },
        ],
      });
    }

    logDraftOrderAction("success", {
      route: "app.quotes.$id",
      phase: "action",
      shop: session.shop,
      quoteRequestId: quote.id,
      draftOrderId: result.draftOrder.id,
      draftOrderName: result.draftOrder.name,
    });

    return jsonActionSuccess(
      "Draft Orderを作成しました。",
      draftOrderActionDetails(result.draftOrder),
    );
  } catch (error) {
    await resetDraftOrderClaim(session.shop, quote.id);

    console.error("b2b_quote_draft_order_create_error", {
      route: "app.quotes.$id",
      phase: "action",
      shop: session.shop,
      quoteRequestId: quote.id,
      quoteStatus: quote.status,
      hasDraftOrderId: false,
      variantIdIsGid: Boolean(normalizedVariantId),
      quantity: quote.quantity,
      error: describeCaughtError(error),
    });

    return jsonActionFailure(
      "api_error",
      "Draft Orderを作成できませんでした。Shopify Admin APIの権限更新、variant、数量、ネットワーク状態を確認してください。",
    );
  }
};

export default function QuoteDetail() {
  const { quote, quoteEvents, loaderError, showAdminAuthDebug } =
    useLoaderData<typeof loader>();
  const [actionData, setActionData] = useState<ActionData | null>(null);
  const [submittingIntent, setSubmittingIntent] = useState<string | null>(null);
  const [quoteStatus, setQuoteStatus] = useState(quote?.status || "NEW");
  const [internalNote, setInternalNote] = useState(quote?.internalNote || "");
  const actionDraftOrderCreated =
    actionData?.ok &&
    actionData.details?.some((detail) => detail.label === "Draft Order ID");
  const actionStatus =
    actionData?.ok &&
    actionData.details?.find((detail) => detail.label === "Quote status")
      ?.value;
  const displayedStatus =
    typeof actionStatus === "string" ? actionStatus : quote?.status || "NEW";
  const actionDraftOrderId =
    actionData?.ok &&
    actionData.details?.find((detail) => detail.label === "Draft Order ID")
      ?.value;
  const actionDraftOrderName =
    actionData?.ok &&
    actionData.details?.find((detail) => detail.label === "Draft Order Name")
      ?.value;
  const actionDraftOrderUrl =
    actionData?.ok &&
    actionData.details?.find((detail) => detail.label === "管理画面リンク")
      ?.value;

  async function submitAction(
    intent: "create-draft-order" | "debug-admin-auth" | "update-quote",
  ) {
    setSubmittingIntent(intent);
    setActionData(null);

    const formData = new FormData();
    formData.set("intent", intent);

    if (intent === "update-quote") {
      formData.set("status", quoteStatus);
      formData.set("internalNote", internalNote);
    }

    try {
      const actionUrl = new URL(
        `${window.location.pathname.replace(/\/$/, "")}/draft-order`,
        window.location.origin,
      );
      actionUrl.search = window.location.search;

      const response = await fetch(actionUrl.toString(), {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "X-B2B-Quote-Action": "1",
        },
      });
      const responseText = await response.text();

      if (!responseText.trim()) {
        setActionData({
          ok: false,
          errors: [
            {
              type: "api_error",
              message: `空のレスポンスです。HTTP ${response.status} ${response.statusText}`,
            },
          ],
        });
        return;
      }

      try {
        setActionData(JSON.parse(responseText) as ActionData);
      } catch {
        setActionData({
          ok: false,
          errors: [
            {
              type: "api_error",
              message: `JSONとして読めないレスポンスです。HTTP ${response.status} ${response.statusText}: ${responseText.slice(0, 500)}`,
            },
          ],
        });
      }
    } catch (error) {
      setActionData({
        ok: false,
        errors: [
          {
            type: "api_error",
            message:
              error instanceof Error
                ? `fetchに失敗しました: ${error.message}`
                : "fetchに失敗しました。",
          },
        ],
      });
    } finally {
      setSubmittingIntent(null);
    }
  }

  if (loaderError || !quote) {
    return (
      <s-page heading="見積依頼詳細">
        <div style={pageStackStyle}>
          <Link to="/app">一覧へ戻る</Link>
          <Card title="見積依頼を表示できません">
            <p style={{ margin: 0 }}>
              {loaderError?.message || "見積依頼詳細を表示できませんでした。"}
            </p>
            {loaderError ? (
              <p style={{ ...mutedTextStyle, marginTop: 8 }}>
                [{loaderError.error.type}]
                {loaderError.error.status ? ` ${loaderError.error.status}` : ""}{" "}
                {loaderError.error.statusText || loaderError.error.message || ""}
              </p>
            ) : null}
          </Card>
        </div>
      </s-page>
    );
  }

  return (
    <s-page heading={quote.companyName}>
      <div style={pageStackStyle}>
        <Link to="/app">一覧へ戻る</Link>

        <Card>
          <div
            style={{
              alignItems: "flex-start",
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "space-between",
            }}
          >
            <div>
              <p style={fieldLabelStyle}>法人見積対応</p>
              <h1 style={{ fontSize: 24, lineHeight: 1.25, margin: "4px 0" }}>
                {quote.companyName}
              </h1>
              <p style={mutedTextStyle}>
                受付日時: {formatDateTime(quote.createdAt)}
              </p>
            </div>
            <StatusBadge status={displayedStatus} />
          </div>
        </Card>

        <div style={cardGridStyle}>
          <Card title="顧客情報">
            <div style={compactGridStyle}>
              <Field label="会社名">{quote.companyName}</Field>
              <Field label="担当者">{quote.contactName}</Field>
              <Field label="メール">
                <a href={`mailto:${quote.email}`}>{quote.email}</a>
              </Field>
              <Field label="電話番号">{quote.phone || "-"}</Field>
            </div>
          </Card>

          <Card title="見積依頼内容">
            <div style={{ display: "grid", gap: 14 }}>
              <div style={compactGridStyle}>
                <Field label="商品">{quote.productTitle}</Field>
                <Field label="バリアント">{quote.variantTitle || "-"}</Field>
                <Field label="数量">{quote.quantity}</Field>
                <Field label="商品ページ">
                  {quote.productUrl ? (
                    <a href={quote.productUrl} target="_blank" rel="noreferrer">
                      商品ページを開く
                    </a>
                  ) : (
                    "-"
                  )}
                </Field>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <QuoteFlag active={quote.wantsInvoicePayment}>
                  請求書払い相談
                </QuoteFlag>
                <QuoteFlag active={quote.needsApprovalPdf}>
                  社内稟議用見積書
                </QuoteFlag>
              </div>
              <Field label="顧客メモ">
                {quote.customerNote ? quote.customerNote : "メモはありません。"}
              </Field>
            </div>
          </Card>
        </div>

        <Card title="内部対応">
          <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
            <label>
              <span style={fieldLabelStyle}>対応ステータス</span>
              <select
                value={quoteStatus}
                onChange={(event) => setQuoteStatus(event.currentTarget.value)}
                disabled={Boolean(submittingIntent)}
                style={{ ...inputStyle, display: "block", marginTop: 6 }}
              >
                {QUOTE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={fieldLabelStyle}>内部メモ</span>
              <textarea
                value={internalNote}
                onChange={(event) => setInternalNote(event.currentTarget.value)}
                disabled={Boolean(submittingIntent)}
                rows={4}
                style={{ ...inputStyle, display: "block", marginTop: 6 }}
                placeholder="営業対応メモ、確認事項、次アクションなど"
              />
            </label>
            <button
              type="button"
              disabled={Boolean(submittingIntent)}
              onClick={() => submitAction("update-quote")}
              style={secondaryButtonStyle}
            >
              {submittingIntent === "update-quote"
                ? "更新中..."
                : "対応状況を保存"}
            </button>
          </div>
        </Card>

        <Card title="Draft Order">
          {quote.draftOrderId ? (
            <div
              aria-label="Draft Order作成状態"
              style={{ display: "grid", gap: 12 }}
            >
              <Notice tone="success">
                <strong>下書き注文は作成済みです。</strong>
                <br />
                二重作成を防ぐため、このquoteでは作成ボタンを表示しません。
              </Notice>
              <div style={compactGridStyle}>
                <Field label="Quote status">
                  <StatusBadge status={quote.status} />
                </Field>
                <Field label="Draft Order name">
                  {quote.draftOrderName || "-"}
                </Field>
                <Field label="Draft Order ID">{quote.draftOrderId}</Field>
              </div>
              {quote.draftOrderCreatedAt ? (
                <Field label="作成日時">
                  {formatDateTime(quote.draftOrderCreatedAt)}
                </Field>
              ) : null}
              {quote.draftOrderAdminUrl ? (
                <a href={quote.draftOrderAdminUrl} target="_blank" rel="noreferrer">
                  Shopify Adminで下書き注文を開く
                </a>
              ) : null}
            </div>
          ) : (
            <>
              {actionDraftOrderCreated ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <Notice tone="success">
                    <strong>下書き注文を作成しました。</strong>
                    <br />
                    二重作成防止のため、この画面では再作成ボタンを表示しません。
                  </Notice>
                  <div style={compactGridStyle}>
                    <Field label="Draft Order name">
                      {actionDraftOrderName || "-"}
                    </Field>
                    <Field label="Draft Order ID">
                      {actionDraftOrderId || "-"}
                    </Field>
                    <Field label="Quote status">
                      <StatusBadge status="QUOTE_CREATED" />
                    </Field>
                  </div>
                  {actionDraftOrderUrl &&
                  actionDraftOrderUrl.startsWith("https://") ? (
                    <a href={actionDraftOrderUrl} target="_blank" rel="noreferrer">
                      Shopify Adminで下書き注文を開く
                    </a>
                  ) : null}
                </div>
              ) : quote.status === "NEW" ||
                (quote.status === "REVIEWING" &&
                  !quote.draftOrderId &&
                  !hasDraftOrderSaveFailureMarker(quote.internalNote)) ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <p style={{ margin: 0 }}>
                    商品、数量、顧客メール、依頼内容をShopifyの下書き注文へ引き継ぎます。
                  </p>
                  <button
                    type="button"
                    disabled={Boolean(submittingIntent)}
                    onClick={() => submitAction("create-draft-order")}
                    style={primaryButtonStyle}
                  >
                    {submittingIntent === "create-draft-order"
                      ? "作成中..."
                      : "Draft Orderを作成"}
                  </button>
                </div>
              ) : (
                <Notice tone="neutral">
                  {quote.status === "REVIEWING" && !quote.draftOrderId
                    ? "前回のDraft Order作成後に保存だけ失敗した可能性があります。Shopify Adminの下書き注文を確認してください。"
                    : "Draft Order作成はNEW statusのquoteで実行できます。"}
                </Notice>
              )}
            </>
          )}
        </Card>

        <Card title="Events">
          {quoteEvents.length === 0 ? (
            <p style={mutedTextStyle}>このquoteのイベントはまだありません。</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {quoteEvents.map((event) => (
                <div
                  key={event.id}
                  style={{
                    borderBottom: "1px solid #f1f1f1",
                    display: "grid",
                    gap: 4,
                    paddingBottom: 10,
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <Badge tone="info">{eventTypeLabel(event.type)}</Badge>
                    <span style={mutedTextStyle}>
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>{event.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="操作結果">
          {showAdminAuthDebug ? (
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                disabled={Boolean(submittingIntent)}
                onClick={() => submitAction("debug-admin-auth")}
                style={{ ...secondaryButtonStyle, fontSize: 12, minHeight: 32 }}
              >
                {submittingIntent === "debug-admin-auth"
                  ? "確認中..."
                  : "Admin認証だけ確認"}
              </button>
            </div>
          ) : null}
          {actionData?.ok ? (
            <Notice tone="success">
              <p style={{ margin: 0 }}>{actionData.message}</p>
              {actionData.details?.map((detail) => (
                <p
                  key={`${detail.label}:${detail.value}`}
                  style={{ margin: "6px 0 0" }}
                >
                  {detail.label}:{" "}
                  {detail.label === "管理画面リンク" &&
                  detail.value.startsWith("https://") ? (
                    <a href={detail.value} target="_blank" rel="noreferrer">
                      Shopify Adminで下書き注文を開く
                    </a>
                  ) : (
                    detail.value
                  )}
                </p>
              ))}
            </Notice>
          ) : null}
          {actionData && !actionData.ok ? (
            <Notice tone="critical">
              {actionData.errors.map((error) => (
                <p
                  key={`${error.type}:${error.field || ""}:${error.message}`}
                  style={{ margin: "0 0 6px" }}
                >
                  [{error.type}]
                  {error.field ? ` ${error.field}:` : ""} {error.message}
                </p>
              ))}
            </Notice>
          ) : null}
          {!actionData ? (
            <p style={mutedTextStyle}>
              status更新やDraft Order作成の結果がここに表示されます。開発環境では小さな認証確認ボタンも表示されます。
            </p>
          ) : null}
        </Card>
      </div>
    </s-page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : error instanceof Response
        ? `Response ${error.status}`
        : "Unknown error";

  console.error("b2b_quote_detail_route_error", { message });

  return (
    <s-page heading="見積依頼詳細">
      <div style={pageStackStyle}>
        <Link to="/app">一覧へ戻る</Link>
        <Card title="エラー">
          <p>
            見積依頼詳細を表示できませんでした。画面を再読み込みするか、一覧へ戻って再度開いてください。
          </p>
          <p style={mutedTextStyle}>{message}</p>
        </Card>
      </div>
    </s-page>
  );
}
