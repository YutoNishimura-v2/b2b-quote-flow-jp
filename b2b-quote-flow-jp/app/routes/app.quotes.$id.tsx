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
  normalizeProductVariantGid,
  resetQuoteDraftOrderCreation,
  saveQuoteDraftOrder,
} from "../models/quoteRequest.server";
import { authenticate } from "../shopify.server";

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
  const { session } = await authenticate.admin(request);
  const quote = await getQuoteRequest(session.shop, params.id || "");

  if (!quote) {
    throw new Response("Not found", { status: 404 });
  }

  return { quote };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  let auth: Awaited<ReturnType<typeof authenticate.admin>>;

  try {
    auth = await authenticate.admin(request);
  } catch (error) {
    if (
      error instanceof Response &&
      error.status >= 300 &&
      error.status < 400
    ) {
      throw error;
    }

    console.error("b2b_quote_draft_order_auth_error", {
      quoteRequestId: params.id || "",
      error:
        error instanceof Response
          ? `Response ${error.status}`
          : error instanceof Error
            ? error.message
            : "Unknown error",
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
      shop: session.shop,
      quoteRequestId: params.id || "",
      error: error instanceof Error ? error.message : "Unknown error",
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

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const normalizedVariantId = normalizeProductVariantGid(quote.variantId);

  logDraftOrderAction("action_received", {
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

  if (quote.status !== "NEW") {
    return actionFailure(
      "state",
      "Draft OrderはNEW statusのquoteからのみ作成できます。画面を再読み込みして状態を確認してください。",
    );
  }

  let claimed = false;

  try {
    claimed = await claimQuoteDraftOrderCreation(session.shop, quote.id);
  } catch (error) {
    console.error("b2b_quote_draft_order_claim_error", {
      shop: session.shop,
      quoteRequestId: quote.id,
      quoteStatus: quote.status,
      hasDraftOrderId: Boolean(quote.draftOrderId),
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return actionFailure(
      "state",
      "Draft Order作成の開始状態を保存できませんでした。画面を再読み込みして再試行してください。",
    );
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
        shop: session.shop,
        quoteRequestId: quote.id,
        draftOrderId: result.draftOrder.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

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
      shop: session.shop,
      quoteRequestId: quote.id,
      quoteStatus: quote.status,
      hasDraftOrderId: false,
      variantIdIsGid: Boolean(normalizedVariantId),
      quantity: quote.quantity,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return actionFailure(
      "api_error",
      "Draft Orderを作成できませんでした。Shopify Admin APIの権限更新、variant、数量、ネットワーク状態を確認してください。",
    );
  }
};

export default function QuoteDetail() {
  const { quote } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
              {quote.status === "NEW" ? (
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
                  Draft Order作成はNEW statusのquoteで実行できます。
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
