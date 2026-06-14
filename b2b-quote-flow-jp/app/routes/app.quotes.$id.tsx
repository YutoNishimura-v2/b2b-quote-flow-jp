import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { getQuoteRequest } from "../models/quoteRequest.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const quote = await getQuoteRequest(session.shop, params.id || "");

  if (!quote) {
    throw new Response("Not found", { status: 404 });
  }

  return { quote };
};

export default function QuoteDetail() {
  const { quote } = useLoaderData<typeof loader>();

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
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
