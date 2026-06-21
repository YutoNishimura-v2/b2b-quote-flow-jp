import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import type { ReactNode } from "react";

import {
  Badge,
  Card,
  Notice,
  mutedTextStyle,
  pageStackStyle,
} from "../components/productUi";
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
    <div
      style={{
        alignItems: "flex-start",
        borderBottom: "1px solid #f1f1f1",
        display: "grid",
        gap: 8,
        gridTemplateColumns: "auto 1fr",
        padding: "0 0 12px",
      }}
    >
      <Badge tone={done ? "success" : "reviewing"}>
        {done ? "完了" : "未確認"}
      </Badge>
      <div>{children}</div>
    </div>
  );
}

export default function BetaChecklist() {
  const { shop, settings, stats } = useLoaderData<typeof loader>();

  return (
    <s-page heading="無料βチェックリスト">
      <div style={pageStackStyle}>
        <Link to="/app">一覧へ戻る</Link>

        <Card title="β導入チェック">
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0 }}>
              B2B Quote Flow JPを無料βとして店舗で確認するためのチェックリストです。見積受付から下書き注文作成までの流れを、実際のShopify Adminで確認します。
            </p>
            <p style={mutedTextStyle}>対象ショップ: {shop}</p>
          </div>
        </Card>

        <Card title="β利用前チェック">
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <CheckItem done={stats.total > 0}>
                商品ページに法人見積ボタンを設置する
                <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                  Theme Editorで商品ページにApp Blockを配置します。
                </p>
              </CheckItem>
              <CheckItem done={stats.total > 0}>
                商品ページからテスト見積を送信する
                <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                  会社名、担当者、メール、数量、備考を入力して保存を確認します。
                </p>
              </CheckItem>
              <CheckItem done={Boolean(settings.notificationEmail)}>
                通知先メールを設定する
                <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                  見積依頼を確認する営業担当または共有メールを指定します。
                </p>
              </CheckItem>
              <CheckItem done={settings.quoteEmailNotificationsEnabled}>
                見積依頼メール通知を有効にする
                <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                  プロバイダ未設定時は通知イベントがskippedとして残ります。
                </p>
              </CheckItem>
              <CheckItem done={stats.draftOrderCreated > 0}>
                quote detailで依頼内容を確認する
                <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                  顧客情報、商品、数量、希望条件、内部メモを確認します。
                </p>
              </CheckItem>
              <CheckItem done={stats.draftOrderCreated > 0}>
                quote detailからDraft Orderを作成する
                <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                  Shopifyの下書き注文へ商品、数量、顧客メールが引き継がれることを確認します。
                </p>
              </CheckItem>
              <CheckItem done={false}>
                Shopify Admin &gt; 注文管理 &gt; 下書き注文を確認する
                <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                  作成された下書き注文のline item、note、custom attributesを人間が確認します。
                </p>
              </CheckItem>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link to="/app">見積一覧を開く</Link>
              <Link to="/app/settings">通知設定を開く</Link>
            </div>
          </div>
        </Card>

        <Card title="βで確認すること">
          <ul style={{ lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
            <li>商品ページにボタンを置けるか</li>
            <li>見積依頼が1件以上送られるか</li>
            <li>通知が届く、またはskippedとして記録されるか</li>
            <li>Adminで依頼内容を確認できるか</li>
            <li>Draft Orderを作成できるか</li>
            <li>3日以内に2回目以降の利用があるか</li>
          </ul>
        </Card>

        <Card title="本番運用前に必要なこと">
          <Notice tone="info">
            無料βでは業務仮説と導線を確認します。本番販売可能な状態としては扱いません。
          </Notice>
          <ul style={{ lineHeight: 1.8, marginBottom: 0, paddingLeft: 20 }}>
            <li>App Proxy signature検証の厳密化</li>
            <li>本番DBへの移行方針決定</li>
            <li>通知プロバイダの本番設定</li>
            <li>Protected Customer Data説明の整理</li>
          </ul>
        </Card>
      </div>
    </s-page>
  );
}
