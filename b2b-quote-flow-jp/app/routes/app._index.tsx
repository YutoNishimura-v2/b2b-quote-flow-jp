import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { listQuoteRequests } from "../models/quoteRequest.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const quotes = await listQuoteRequests(session.shop);

  return { shop: session.shop, quotes };
};

export default function Index() {
  const { shop, quotes } = useLoaderData<typeof loader>();

  return (
    <s-page heading="B2B Quote Flow JP">
      <s-section heading="NEW quote requests">
        <s-stack direction="block" gap="base">
          <s-paragraph>Shop: {shop}</s-paragraph>
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
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
