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

import { createDraftOrderForQuote } from "../models/draftOrder.server";
import {
  claimQuoteDraftOrderCreation,
  getQuoteRequest,
  markQuoteDraftOrderSaveFailure,
  normalizeProductVariantGid,
  resetQuoteDraftOrderCreation,
  saveQuoteDraftOrder,
} from "../models/quoteRequest.server";
import { authenticate } from "../shopify.server";

const DRAFT_ORDER_SAVE_FAILURE_NOTE = "[draft_order_save_error]";

type ActionErrorType =
  | "auth"
  | "validation"
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
      loaderError: null;
    }
  | {
      quote: null;
      loaderError: {
        message: string;
        error: SafeError;
      };
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

function logDraftOrderAction(
  event: string,
  details: Record<string, unknown>,
) {
  console.info(`b2b_quote_draft_order_${event}`, details);
}

function isScopeLikeError(message: string) {
  return /access|permission|scope|draft order|draft_orders/i.test(message);
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

    return { quote, loaderError: null } satisfies LoaderData;
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

  if (intent === "create-draft-order" || intent === "debug-admin-auth") {
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

  if (intent !== "create-draft-order") {
    return jsonActionFailure("validation", "不明な操作です。画面を再読み込みして再試行してください。");
  }

  if (quote.draftOrderId) {
    return jsonActionSuccess("Draft Orderは既に作成済みです。");
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
          error.type === "graphql_error" && isScopeLikeError(error.message)
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

    return jsonActionSuccess("Draft Orderを作成しました。");
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
  const { quote, loaderError } = useLoaderData<typeof loader>();
  const [actionData, setActionData] = useState<ActionData | null>(null);
  const [submittingIntent, setSubmittingIntent] = useState<string | null>(null);

  async function submitAction(intent: "create-draft-order" | "debug-admin-auth") {
    setSubmittingIntent(intent);
    setActionData(null);

    const formData = new FormData();
    formData.set("intent", intent);

    try {
      const response = await fetch(window.location.href, {
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
        <s-link href="/app">一覧へ戻る</s-link>
        <s-section heading="エラー">
          <s-stack direction="block" gap="base">
            <s-paragraph>{loaderError?.message || "見積依頼詳細を表示できませんでした。"}</s-paragraph>
            {loaderError ? (
              <s-paragraph>
                [{loaderError.error.type}]
                {loaderError.error.status ? ` ${loaderError.error.status}` : ""}{" "}
                {loaderError.error.statusText || loaderError.error.message || ""}
              </s-paragraph>
            ) : null}
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="見積依頼詳細">
      <s-link href="/app">一覧へ戻る</s-link>
      <s-section heading={quote.companyName}>
        <s-stack direction="block" gap="base">
          <s-paragraph>ステータス: {quote.status}</s-paragraph>
          <s-paragraph>担当者: {quote.contactName}</s-paragraph>
          <s-paragraph>メール: {quote.email}</s-paragraph>
          <s-paragraph>商品: {quote.productTitle}</s-paragraph>
          <s-paragraph>バリアント: {quote.variantTitle || "-"}</s-paragraph>
          <s-paragraph>数量: {quote.quantity}</s-paragraph>
          <s-paragraph>
            請求書払い相談: {quote.wantsInvoicePayment ? "あり" : "なし"}
          </s-paragraph>
          <s-paragraph>
            稟議用PDF希望: {quote.needsApprovalPdf ? "あり" : "なし"}
          </s-paragraph>
          <s-paragraph>備考: {quote.customerNote || "-"}</s-paragraph>
          {quote.productUrl ? (
            <Link to={quote.productUrl} target="_blank" rel="noreferrer">
              商品ページを開く
            </Link>
          ) : null}
          {quote.draftOrderId ? (
            <div>
              <s-paragraph>Draft Order作成済み</s-paragraph>
              <s-paragraph>ID: {quote.draftOrderId}</s-paragraph>
              <s-paragraph>Name: {quote.draftOrderName || "-"}</s-paragraph>
              {quote.draftOrderCreatedAt ? (
                <s-paragraph>
                  作成日時: {new Date(quote.draftOrderCreatedAt).toLocaleString("ja-JP")}
                </s-paragraph>
              ) : null}
              {quote.draftOrderAdminUrl ? (
                <a href={quote.draftOrderAdminUrl} target="_blank" rel="noreferrer">
                  Shopify AdminでDraft Orderを開く
                </a>
              ) : null}
            </div>
          ) : (
            <>
              {quote.status === "NEW" ||
              (quote.status === "REVIEWING" &&
                !quote.draftOrderId &&
                !hasDraftOrderSaveFailureMarker(quote.internalNote)) ? (
                <div>
                  <button
                    type="button"
                    disabled={Boolean(submittingIntent)}
                    onClick={() => submitAction("create-draft-order")}
                  >
                    {submittingIntent === "create-draft-order"
                      ? "作成中..."
                      : "Draft Orderを作成"}
                  </button>
                </div>
              ) : (
                <s-paragraph>
                  {quote.status === "REVIEWING" && !quote.draftOrderId
                    ? "前回のDraft Order作成後に保存だけ失敗した可能性があります。Shopify AdminのDraftsを確認してください。"
                    : "Draft Order作成はNEW statusのquoteで実行できます。"}
                </s-paragraph>
              )}
            </>
          )}
          <div>
            <button
              type="button"
              disabled={Boolean(submittingIntent)}
              onClick={() => submitAction("debug-admin-auth")}
            >
              {submittingIntent === "debug-admin-auth"
                ? "確認中..."
                : "Admin認証だけ確認"}
            </button>
          </div>
          {actionData?.ok ? (
            <div>
              <s-paragraph>{actionData.message}</s-paragraph>
              {actionData.details?.map((detail) => (
                <s-paragraph key={`${detail.label}:${detail.value}`}>
                  {detail.label}: {detail.value}
                </s-paragraph>
              ))}
            </div>
          ) : null}
          {actionData && !actionData.ok ? (
            <div>
              {actionData.errors.map((error) => (
                <s-paragraph key={`${error.type}:${error.field || ""}:${error.message}`}>
                  [{error.type}]
                  {error.field ? ` ${error.field}:` : ""} {error.message}
                </s-paragraph>
              ))}
            </div>
          ) : null}
        </s-stack>
      </s-section>
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
      <s-link href="/app">一覧へ戻る</s-link>
      <s-section heading="エラー">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            見積依頼詳細を表示できませんでした。画面を再読み込みするか、一覧へ戻って再度開いてください。
          </s-paragraph>
          <s-paragraph>{message}</s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}
