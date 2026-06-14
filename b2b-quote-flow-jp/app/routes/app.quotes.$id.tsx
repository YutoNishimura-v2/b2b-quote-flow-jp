import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "react-router";

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
  | "graphql_user_error"
  | "graphql_error"
  | "api_error"
  | "state"
  | "save_error";

type ActionData =
  | {
      ok: true;
      message: string;
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

function logDraftOrderAction(
  event: string,
  details: Record<string, unknown>,
) {
  console.info(`b2b_quote_draft_order_${event}`, details);
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

    return actionFailure(
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
    auth = await authenticate.admin(request);
  } catch (error) {
    if (shouldRethrowShopifyResponse(error)) {
      throw error;
    }

    console.error("b2b_quote_draft_order_auth_error", {
      route: "app.quotes.$id",
      phase: "action",
      quoteRequestId: params.id || "",
      intent,
      error: describeCaughtError(error),
    });

    return actionFailure(
      "auth",
      "Shopify Admin認証に失敗しました。アプリを再読み込みし、権限更新または再インストールが必要か確認してください。",
    );
  }

  const { admin, session } = auth;
  let quote: Awaited<ReturnType<typeof getQuoteRequest>>;

  try {
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

    return actionFailure(
      "state",
      "見積依頼の取得に失敗しました。画面を再読み込みして再試行してください。",
    );
  }

  if (!quote) {
    return actionFailure(
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
    return actionFailure("validation", "不明な操作です。画面を再読み込みして再試行してください。");
  }

  if (quote.draftOrderId) {
    return {
      ok: true,
      message: "Draft Orderは既に作成済みです。",
    } satisfies ActionData;
  }

  if (
    quote.status === "REVIEWING" &&
    !quote.draftOrderId &&
    hasSaveFailureMarker
  ) {
    return actionFailure(
      "save_error",
      "前回、Draft Order作成後にquoteへの保存だけ失敗した可能性があります。二重作成を避けるため、Shopify Admin > Orders > Draftsを確認してください。",
    );
  }

  if (
    quote.status !== "NEW" &&
    !(quote.status === "REVIEWING" && !quote.draftOrderId)
  ) {
    return actionFailure(
      "state",
      "Draft OrderはNEW statusのquoteからのみ作成できます。画面を再読み込みして状態を確認してください。",
    );
  }

  let claimed = false;

  if (quote.status === "REVIEWING" && !quote.draftOrderId) {
    claimed = true;
  } else {
    try {
      claimed = await claimQuoteDraftOrderCreation(session.shop, quote.id);
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

      return actionFailure(
        "state",
        "Draft Order作成の開始状態を保存できませんでした。画面を再読み込みして再試行してください。",
      );
    }
  }

  if (!claimed) {
    return actionFailure(
      "state",
      "Draft Orderは既に作成済み、または作成処理中です。画面を再読み込みして状態を確認してください。",
    );
  }

  try {
    const result = await createDraftOrderForQuote(admin.graphql, quote);

    if (!result.ok) {
      await resetDraftOrderClaim(session.shop, quote.id);

      logDraftOrderAction("graphql_failed", {
        route: "app.quotes.$id",
        phase: "action",
        shop: session.shop,
        quoteRequestId: quote.id,
        quoteStatus: quote.status,
        hasDraftOrderId: false,
        variantIdIsGid: Boolean(normalizedVariantId),
        quantity: quote.quantity,
        errors: result.errors.map((error) => ({
          type: error.type,
          field: error.field,
          message: error.message,
        })),
      });

      return {
        ok: false,
        errors: result.errors,
      } satisfies ActionData;
    }

    try {
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

      return {
        ok: false,
        errors: [
          {
            type: "save_error",
            message:
              "Draft Orderは作成された可能性がありますが、quoteへの保存に失敗しました。Shopify AdminのDraftsを確認してから再試行してください。",
          },
        ],
      } satisfies ActionData;
    }

    return {
      ok: true,
      message: "Draft Orderを作成しました。",
    } satisfies ActionData;
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

    return actionFailure(
      "api_error",
      "Draft Orderを作成できませんでした。Shopify Admin APIの権限更新、variant、数量、ネットワーク状態を確認してください。",
    );
  }
};

export default function QuoteDetail() {
  const { quote, loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="create-draft-order"
                  />
                  <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "作成中..." : "Draft Orderを作成"}
                  </button>
                </Form>
              ) : (
                <s-paragraph>
                  {quote.status === "REVIEWING" && !quote.draftOrderId
                    ? "前回のDraft Order作成後に保存だけ失敗した可能性があります。Shopify AdminのDraftsを確認してください。"
                    : "Draft Order作成はNEW statusのquoteで実行できます。"}
                </s-paragraph>
              )}
            </>
          )}
          {actionData?.ok ? (
            <s-paragraph>{actionData.message}</s-paragraph>
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
