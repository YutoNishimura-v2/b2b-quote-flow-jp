import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { createDraftOrderForQuote } from "../models/draftOrder.server";
import {
  claimQuoteDraftOrderCreation,
  getQuoteRequest,
  resetQuoteDraftOrderCreation,
  saveQuoteDraftOrder,
} from "../models/quoteRequest.server";
import { authenticate } from "../shopify.server";

type ActionData =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      errors: string[];
    };

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const quote = await getQuoteRequest(session.shop, params.id || "");

  if (!quote) {
    throw new Response("Not found", { status: 404 });
  }

  return { quote };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const quote = await getQuoteRequest(session.shop, params.id || "");

  if (!quote) {
    throw new Response("Not found", { status: 404 });
  }

  if (quote.draftOrderId) {
    return {
      ok: true,
      message: "Draft Orderは既に作成済みです。",
    } satisfies ActionData;
  }

  if (quote.status !== "NEW") {
    return {
      ok: false,
      errors: ["Draft OrderはNEW statusのquoteからのみ作成できます。画面を再読み込みして状態を確認してください。"],
    } satisfies ActionData;
  }

  const claimed = await claimQuoteDraftOrderCreation(session.shop, quote.id);

  if (!claimed) {
    return {
      ok: false,
      errors: ["Draft Orderは既に作成済み、または作成処理中です。画面を再読み込みして状態を確認してください。"],
    } satisfies ActionData;
  }

  try {
    const result = await createDraftOrderForQuote(admin.graphql, quote);

    if (!result.ok) {
      await resetQuoteDraftOrderCreation(session.shop, quote.id);

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
        errors: ["Draft Orderは作成された可能性がありますが、quoteへの保存に失敗しました。Shopify AdminのDraftsを確認してから再試行してください。"],
      } satisfies ActionData;
    }

    return {
      ok: true,
      message: "Draft Orderを作成しました。",
    } satisfies ActionData;
  } catch (error) {
    await resetQuoteDraftOrderCreation(session.shop, quote.id);

    console.error("b2b_quote_draft_order_create_error", {
      shop: session.shop,
      quoteRequestId: quote.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      ok: false,
      errors: ["Draft Orderを作成できませんでした。Shopify Admin APIの権限と入力内容を確認してください。"],
    } satisfies ActionData;
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
                <s-paragraph key={error}>{error}</s-paragraph>
              ))}
            </div>
          ) : null}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
