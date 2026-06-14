import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import type { ReactNode } from "react";

import { getQuoteStats } from "../models/quoteRequest.server";
import { getShopSettings } from "../models/shopSettings.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [settings, stats] = await Promise.all([
    getShopSettings(session.shop),
    getQuoteStats(session.shop),
  ]);

  return { shop: session.shop, settings, stats };
};

function CheckItem({
  done,
  children,
}: {
  done: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      {done ? "完了" : "未完了"}: {children}
    </li>
  );
}

export default function BetaChecklist() {
  const { shop, settings, stats } = useLoaderData<typeof loader>();

  return (
    <s-page heading="無料βチェックリスト">
      <s-stack direction="block" gap="base">
        <Link to="/app">一覧へ戻る</Link>
        <s-section heading="β利用前チェック">
          <s-stack direction="block" gap="base">
            <s-paragraph>Shop: {shop}</s-paragraph>
            <ul>
              <CheckItem done={Boolean(settings.notificationEmail)}>
                通知先メールを設定する
              </CheckItem>
              <CheckItem done={settings.quoteEmailNotificationsEnabled}>
                見積依頼メール通知を有効にする
              </CheckItem>
              <CheckItem done={stats.total > 0}>
                商品ページからテストquoteを1件送る
              </CheckItem>
              <CheckItem done={stats.draftOrderCreated > 0}>
                quote detailからDraft Orderを1件作成する
              </CheckItem>
              <CheckItem done={false}>
                Shopify Admin &gt; 注文管理 &gt; 下書きでDraft Order実体を確認する
              </CheckItem>
              <CheckItem done={false}>
                Protected Customer Dataの用途説明を本番前に再確認する
              </CheckItem>
            </ul>
            <p>
              <Link to="/app/settings">通知設定を開く</Link>
            </p>
          </s-stack>
        </s-section>
        <s-section heading="βで確認すること">
          <ul>
            <li>商品ページにボタンを置けるか</li>
            <li>見積依頼が1件以上送られるか</li>
            <li>merchant notificationが届くか</li>
            <li>Adminでquote確認されるか</li>
            <li>Draft Orderが作成されるか</li>
            <li>3日以内に2回目以降の利用があるか</li>
          </ul>
        </s-section>
        <s-section heading="まだβでやらないこと">
          <ul>
            <li>Billing</li>
            <li>App Store listing</li>
            <li>PDF生成</li>
            <li>invoice送信</li>
            <li>Draft Order complete</li>
          </ul>
        </s-section>
      </s-stack>
    </s-page>
  );
}
