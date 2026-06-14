import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";

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
    <s-page heading="β設定">
      <s-stack direction="block" gap="base">
        <Link to="/app">一覧へ戻る</Link>
        <s-section heading="通知設定">
          <s-stack direction="block" gap="base">
            <s-paragraph>Shop: {shop}</s-paragraph>
            <s-paragraph>
              見積依頼が保存されたとき、通知先メールへmerchant notificationを送ります。
            </s-paragraph>
            {!hasEmailProvider ? (
              <s-paragraph>
                メール送信プロバイダが未設定です。保存はできますが、通知はイベントログにskippedとして残ります。
              </s-paragraph>
            ) : null}
            <Form method="post">
              <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
                <label>
                  通知先メール
                  <input
                    name="notificationEmail"
                    type="email"
                    defaultValue={currentSettings.notificationEmail || ""}
                    placeholder="sales@example.com"
                    style={{ display: "block", marginTop: 4, width: "100%" }}
                  />
                </label>
                <label>
                  <input
                    name="quoteEmailNotificationsEnabled"
                    type="checkbox"
                    defaultChecked={
                      currentSettings.quoteEmailNotificationsEnabled
                    }
                  />{" "}
                  見積依頼のメール通知を有効にする
                </label>
                <button type="submit">設定を保存</button>
              </div>
            </Form>
            {actionData?.ok ? (
              <s-paragraph>設定を保存しました。</s-paragraph>
            ) : null}
            {Object.keys(actionErrors).length > 0 ? (
              <div>
                {Object.entries(actionErrors).map(([field, message]) => (
                  <s-paragraph key={field}>
                    [{field}] {message}
                  </s-paragraph>
                ))}
              </div>
            ) : null}
          </s-stack>
        </s-section>
        <s-section heading="Theme設定">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              見積ボタン文言はTheme App Extension blockの`Button label`で変更します。
            </s-paragraph>
            <s-paragraph>
              βテストでは、まず「法人見積を依頼」または「まとめ買い見積を依頼」で反応を確認してください。
            </s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="データ利用説明">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Draft Order作成では、顧客メールとDraft Order関連データを扱います。Protected Customer Data設定と説明文は本番前に必ず再確認してください。
            </s-paragraph>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
