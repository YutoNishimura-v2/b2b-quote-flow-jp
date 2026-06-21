import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  Badge,
  Card,
  MetricCard,
  StatusBadge,
  cardGridStyle,
  eventTypeLabel,
  formatDateTime,
  isToday,
  mutedTextStyle,
  pageStackStyle,
  tableStyle,
  tableWrapStyle,
  tdStyle,
  thStyle,
} from "../components/productUi";
import {
  getQuoteStats,
  listQuoteRequests,
} from "../models/quoteRequest.server";
import { listQuoteEvents } from "../models/quoteEvent.server";
import { getShopSettings } from "../models/shopSettings.server";
import { authenticate } from "../shopify.server";

const STATUS_FILTERS = ["ALL", "NEW", "REVIEWING", "QUOTE_CREATED"] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status") || "ALL";
  const statusFilter = STATUS_FILTERS.includes(
    requestedStatus as (typeof STATUS_FILTERS)[number],
  )
    ? requestedStatus
    : "ALL";
  const [quotes, stats, settings, events] = await Promise.all([
    listQuoteRequests(session.shop),
    getQuoteStats(session.shop),
    getShopSettings(session.shop),
    listQuoteEvents(session.shop, 10),
  ]);
  const filteredQuotes =
    statusFilter === "ALL"
      ? quotes
      : quotes.filter((quote) => quote.status === statusFilter);
  const todayQuoteCount = quotes.filter((quote) => isToday(quote.createdAt)).length;
  const quoteCreatedCount = quotes.filter(
    (quote) => quote.status === "QUOTE_CREATED",
  ).length;

  return {
    shop: session.shop,
    quotes: filteredQuotes,
    stats,
    settings,
    events,
    statusFilter,
    todayQuoteCount,
    quoteCreatedCount,
  };
};

export default function Index() {
  const {
    shop,
    quotes,
    stats,
    settings,
    events,
    statusFilter,
    todayQuoteCount,
    quoteCreatedCount,
  } = useLoaderData<typeof loader>();
  const notificationsReady = Boolean(
    settings.quoteEmailNotificationsEnabled && settings.notificationEmail,
  );
  const setupItems = [
    {
      label: "商品ページにApp Blockを置く",
      done: stats.total > 0,
      help: "テスト見積が届いていれば、Storefront導線は確認済みです。",
    },
    {
      label: "通知先メールを設定",
      done: Boolean(settings.notificationEmail),
      help: settings.notificationEmail || "営業担当が確認できるメールを設定します。",
    },
    {
      label: "テスト見積を送る",
      done: stats.total > 0,
      help: "Dawnの商品ページから1件送信して保存を確認します。",
    },
    {
      label: "Draft Orderを作る",
      done: stats.draftOrderCreated > 0,
      help: "quote detailから下書き注文へ接続できるか確認します。",
    },
  ];

  return (
    <s-page heading="B2B Quote Flow JP">
      <div style={pageStackStyle}>
        <Card
          title="法人見積対応ダッシュボード"
          action={
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Link to="/app/settings">設定</Link>
              <Link to="/app/beta">βチェックリスト</Link>
            </div>
          }
        >
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
              商品ページから届いた法人・まとめ買いの見積依頼を確認し、必要に応じてShopifyの下書き注文へつなげます。
            </p>
            <p style={mutedTextStyle}>対象ショップ: {shop}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Badge tone={notificationsReady ? "success" : "reviewing"}>
                通知 {notificationsReady ? "有効" : "未設定"}
              </Badge>
              <Badge tone="neutral">無料β確認中</Badge>
            </div>
          </div>
        </Card>

        <div style={cardGridStyle}>
          <MetricCard
            label="今日の見積依頼"
            value={todayQuoteCount}
            helpText="日次の反応確認に使います。"
          />
          <MetricCard
            label="NEW"
            value={stats.newCount}
            helpText="まだ対応開始していない依頼です。"
          />
          <MetricCard
            label="下書き注文作成済み"
            value={quoteCreatedCount}
            helpText="QUOTE_CREATED のquote数です。"
          />
          <MetricCard
            label="Draft Order連携"
            value={stats.draftOrderCreated}
            helpText="Shopify下書き注文へ接続済みの件数です。"
          />
        </div>

        <Card title="次にやるべきセットアップ">
          <div style={{ display: "grid", gap: 12 }}>
            {setupItems.map((item) => (
              <div
                key={item.label}
                style={{
                  alignItems: "flex-start",
                  borderBottom: "1px solid #f1f1f1",
                  display: "grid",
                  gap: 6,
                  gridTemplateColumns: "auto 1fr",
                  paddingBottom: 10,
                }}
              >
                <Badge tone={item.done ? "success" : "reviewing"}>
                  {item.done ? "完了" : "未確認"}
                </Badge>
                <div>
                  <p style={{ fontWeight: 700, margin: 0 }}>{item.label}</p>
                  <p style={{ ...mutedTextStyle, marginTop: 2 }}>{item.help}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="見積依頼一覧"
          action={<Link to="/app">すべて表示</Link>}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STATUS_FILTERS.map((status) => (
                <Link
                  key={status}
                  to={status === "ALL" ? "/app" : `/app?status=${status}`}
                  style={{
                    border:
                      statusFilter === status
                        ? "1px solid #202223"
                        : "1px solid #c9cccf",
                    borderRadius: 999,
                    color: "#202223",
                    fontSize: 13,
                    fontWeight: 650,
                    padding: "7px 11px",
                    textDecoration: "none",
                  }}
                >
                  {status === "ALL" ? "All" : status}
                </Link>
              ))}
            </div>
            <div style={tableWrapStyle}>
              {quotes.length === 0 ? (
                <div style={{ padding: "24px 0" }}>
                  <p style={{ fontWeight: 700, margin: 0 }}>
                    表示できる見積依頼はまだありません。
                  </p>
                  <p style={{ ...mutedTextStyle, marginTop: 6 }}>
                    商品ページに法人見積ボタンを設置し、テスト見積を送信すると一覧に表示されます。
                  </p>
                </div>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>会社/担当者</th>
                      <th style={thStyle}>メール</th>
                      <th style={thStyle}>商品</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>数量</th>
                      <th style={thStyle}>Draft Order</th>
                      <th style={thStyle}>作成日時</th>
                      <th style={thStyle}>詳細</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => (
                      <tr key={quote.id}>
                        <td style={tdStyle}>
                          <StatusBadge status={quote.status} />
                        </td>
                        <td style={tdStyle}>
                          <strong>{quote.companyName}</strong>
                          <br />
                          <span style={mutedTextStyle}>{quote.contactName}</span>
                        </td>
                        <td style={tdStyle}>{quote.email}</td>
                        <td style={tdStyle}>
                          {quote.productTitle}
                          {quote.variantTitle &&
                          quote.variantTitle !== "Default Title" ? (
                            <span style={mutedTextStyle}>
                              <br />
                              {quote.variantTitle}
                            </span>
                          ) : null}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {quote.quantity}
                        </td>
                        <td style={tdStyle}>
                          {quote.draftOrderId ? (
                            <Badge tone="success">作成済み</Badge>
                          ) : (
                            <Badge tone="neutral">未作成</Badge>
                          )}
                        </td>
                        <td style={tdStyle}>{formatDateTime(quote.createdAt)}</td>
                        <td style={tdStyle}>
                          <Link to={`/app/quotes/${quote.id}`}>対応する</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Card>

        <Card title="Recent events">
          {events.length === 0 ? (
            <p style={mutedTextStyle}>
              見積依頼や通知、下書き注文作成などの操作履歴がここに表示されます。
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {events.length === 0 ? (
                <p style={mutedTextStyle}>まだイベントはありません。</p>
              ) : (
                events.map((event) => (
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
                      {event.quoteRequestId ? (
                        <Link to={`/app/quotes/${event.quoteRequestId}`}>
                          quoteを開く
                        </Link>
                      ) : null}
                    </div>
                    <p style={{ margin: 0 }}>{event.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
