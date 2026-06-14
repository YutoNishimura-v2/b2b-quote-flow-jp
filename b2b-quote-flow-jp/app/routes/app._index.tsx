import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  getQuoteStats,
  listQuoteRequests,
} from "../models/quoteRequest.server";
import { listQuoteEvents } from "../models/quoteEvent.server";
import { getShopSettings } from "../models/shopSettings.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [quotes, stats, settings, events] = await Promise.all([
    listQuoteRequests(session.shop),
    getQuoteStats(session.shop),
    getShopSettings(session.shop),
    listQuoteEvents(session.shop, 10),
  ]);

  return { shop: session.shop, quotes, stats, settings, events };
};

export default function Index() {
  const { shop, quotes, stats, settings, events } = useLoaderData<typeof loader>();

  return (
    <s-page heading="B2B Quote Flow JP">
      <s-section heading="無料β readiness">
        <s-stack direction="block" gap="base">
          <s-paragraph>Shop: {shop}</s-paragraph>
          <s-paragraph>
            Quotes: {stats.total} / NEW: {stats.newCount} / Draft Orders:{" "}
            {stats.draftOrderCreated}
          </s-paragraph>
          <s-paragraph>
            通知:{" "}
            {settings.quoteEmailNotificationsEnabled &&
            settings.notificationEmail
              ? `有効 (${settings.notificationEmail})`
              : "未設定"}
          </s-paragraph>
          <p>
            <Link to="/app/settings">β設定を開く</Link>{" "}
            <Link to="/app/beta">βチェックリストを開く</Link>
          </p>
        </s-stack>
      </s-section>
      <s-section heading="NEW quote requests">
        <s-stack direction="block" gap="base">
          {quotes.length === 0 ? (
            <s-paragraph>
              Dawnの商品ページから法人見積依頼を送信すると、ここにNEW quoteとして表示されます。
            </s-paragraph>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Status</th>
                  <th align="left">Company</th>
                  <th align="left">Contact</th>
                  <th align="left">Email</th>
                  <th align="left">Product</th>
                  <th align="right">Qty</th>
                  <th align="left">Created</th>
                  <th align="left">Detail</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.status}</td>
                    <td>{quote.companyName}</td>
                    <td>{quote.contactName}</td>
                    <td>{quote.email}</td>
                    <td>
                      {quote.productTitle}
                      {quote.variantTitle ? ` / ${quote.variantTitle}` : ""}
                    </td>
                    <td align="right">{quote.quantity}</td>
                    <td>{new Date(quote.createdAt).toLocaleString("ja-JP")}</td>
                    <td>
                      <Link to={`/app/quotes/${quote.id}`}>開く</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </s-stack>
      </s-section>
      <s-section heading="Recent events">
        <s-stack direction="block" gap="base">
          {events.length === 0 ? (
            <s-paragraph>まだイベントはありません。</s-paragraph>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Type</th>
                  <th align="left">Message</th>
                  <th align="left">Created</th>
                  <th align="left">Quote</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.type}</td>
                    <td>{event.message}</td>
                    <td>{new Date(event.createdAt).toLocaleString("ja-JP")}</td>
                    <td>
                      {event.quoteRequestId ? (
                        <Link to={`/app/quotes/${event.quoteRequestId}`}>
                          開く
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
