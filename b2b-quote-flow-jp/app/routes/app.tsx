import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

type SafeAuthError = {
  type: string;
  message?: string;
  status?: number;
  statusText?: string;
};

function describeCaughtError(error: unknown): SafeAuthError {
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
  } catch (error) {
    if (shouldRethrowShopifyResponse(error)) {
      throw error;
    }

    const safeError = describeCaughtError(error);

    console.error("b2b_quote_app_loader_auth_error", {
      route: "app",
      phase: "loader",
      method: request.method,
      error: safeError,
    });

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      authError: safeError,
    };
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", authError: null };
};

export default function App() {
  const { apiKey, authError } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <nav style={{ display: "none" }}>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/additional">Additional page</s-link>
      </nav>
      {authError ? (
        <s-section heading="Admin認証エラー">
          <s-paragraph>
            [auth] Shopify Admin認証でBad Requestが発生しました。app devの再起動、権限更新、再インストール状態を確認してください。
          </s-paragraph>
          <s-paragraph>
            [{authError.type}]
            {authError.status ? ` ${authError.status}` : ""}{" "}
            {authError.statusText || authError.message || ""}
          </s-paragraph>
        </s-section>
      ) : null}
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
