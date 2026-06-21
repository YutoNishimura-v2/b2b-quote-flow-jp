import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";

import {
  Badge,
  Card,
  Field,
  Notice,
  inputStyle,
  mutedTextStyle,
  pageStackStyle,
  primaryButtonStyle,
} from "../components/productUi";
import {
  getShopSettings,
  updateShopSettings,
} from "../models/shopSettings.server";
import { recordQuoteEvent } from "../models/quoteEvent.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);

  return {
    shop: session.shop,
    settings,
    hasEmailProvider: Boolean(
      process.env.RESEND_API_KEY ||
        process.env.B2B_QUOTE_NOTIFICATION_WEBHOOK_URL,
    ),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const result = await updateShopSettings(session.shop, {
    notificationEmail: formData.get("notificationEmail"),
    quoteEmailNotificationsEnabled: formData.get(
      "quoteEmailNotificationsEnabled",
    ),
  });

  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors,
    };
  }

  await recordQuoteEvent({
    shop: session.shop,
    type: "settings_updated",
    message: "Notification settings updated.",
    metadata: {
      notificationEmailConfigured: Boolean(result.settings.notificationEmail),
      quoteEmailNotificationsEnabled:
        result.settings.quoteEmailNotificationsEnabled,
    },
  });

  return { ok: true, settings: result.settings };
};

export default function Settings() {
  const { shop, settings, hasEmailProvider } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const savedSettings =
    actionData && "settings" in actionData ? actionData.settings : null;
  const currentSettings = savedSettings || settings;
  const actionErrors: Record<string, string> =
    actionData && "errors" in actionData && actionData.errors
      ? actionData.errors
      : {};

  return (
    <s-page heading="設定">
      <div style={pageStackStyle}>
        <Link to="/app">一覧へ戻る</Link>

        <Card title="B2B Quote Flow JP 設定">
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0 }}>
              無料βで見積依頼を取りこぼさないための最小設定です。通知先とStorefront表示を確認してから、テスト見積を送信してください。
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Badge tone="neutral">Shop: {shop}</Badge>
              <Badge tone={hasEmailProvider ? "success" : "reviewing"}>
                通知プロバイダ {hasEmailProvider ? "設定済み" : "未設定"}
              </Badge>
            </div>
          </div>
        </Card>

        <Card title="通知設定">
          <div style={{ display: "grid", gap: 14, maxWidth: 680 }}>
            <p style={mutedTextStyle}>
              見積依頼が保存されたとき、通知先メールへmerchant notificationを送信します。
            </p>
            {!hasEmailProvider ? (
              <Notice tone="info">
                メール送信プロバイダが未設定です。設定は保存できますが、通知は送信されず、イベントログにskippedとして記録されます。
              </Notice>
            ) : null}
            <Form method="post">
              <div style={{ display: "grid", gap: 14 }}>
                <label>
                  <span style={{ display: "block", fontWeight: 700 }}>
                    通知先メール
                  </span>
                  <input
                    name="notificationEmail"
                    type="email"
                    defaultValue={currentSettings.notificationEmail || ""}
                    placeholder="sales@example.com"
                    style={{ ...inputStyle, display: "block", marginTop: 6 }}
                  />
                  <span style={{ ...mutedTextStyle, display: "block", marginTop: 4 }}>
                    見積依頼を最初に確認する担当者または共有メールを指定します。
                  </span>
                </label>
                <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                  <input
                    name="quoteEmailNotificationsEnabled"
                    type="checkbox"
                    defaultChecked={
                      currentSettings.quoteEmailNotificationsEnabled
                    }
                  />{" "}
                  見積依頼のメール通知を有効にする
                </label>
                <div>
                  <button type="submit" style={primaryButtonStyle}>
                    設定を保存
                  </button>
                </div>
              </div>
            </Form>
            {actionData?.ok ? (
              <Notice tone="success">設定を保存しました。</Notice>
            ) : null}
            {Object.keys(actionErrors).length > 0 ? (
              <Notice tone="critical">
                {Object.entries(actionErrors).map(([field, message]) => (
                  <p key={field} style={{ margin: "0 0 6px" }}>
                    [{field}] {message}
                  </p>
                ))}
              </Notice>
            ) : null}
          </div>
        </Card>

        <Card title="通知プロバイダ">
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0 }}>
              β配信でメール通知を実際に送る場合は、環境変数でResendまたは通知Webhookを設定します。
            </p>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <Field label="Resend">
                `RESEND_API_KEY` と `B2B_QUOTE_NOTIFICATION_FROM`
              </Field>
              <Field label="Webhook">
                `B2B_QUOTE_NOTIFICATION_WEBHOOK_URL`
              </Field>
            </div>
            <p style={mutedTextStyle}>
              どちらも未設定の場合、quoteは保存され、通知イベントはskippedとして残ります。
            </p>
          </div>
        </Card>

        <Card title="Storefront表示">
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0 }}>
              見積ボタンの文言は、Theme Editorで商品ページに配置したB2B Quote Flow JP App Blockから変更します。
            </p>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <Field label="推奨ボタン文言">法人見積を依頼</Field>
              <Field label="推奨モーダルタイトル">
                法人・まとめ買いの見積依頼
              </Field>
            </div>
            <p style={mutedTextStyle}>
              βテストでは、まず標準コピーのまま反応を確認し、業種に合わせて「まとめ買い見積を依頼」などへ調整してください。
            </p>
          </div>
        </Card>

        <Card title="Protected Customer Data">
          <p style={{ margin: 0 }}>
            Draft Order作成では顧客メールと下書き注文関連データを扱います。本番運用前に、Partner DashboardのProtected Customer Data設定と利用説明が一致していることを確認してください。
          </p>
        </Card>
      </div>
    </s-page>
  );
}
