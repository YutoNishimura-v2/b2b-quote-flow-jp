# B2B Quote Flow JP Product UI Polish

Last updated: 2026-06-21

## UI改善方針

B2B Quote Flow JPを「ボタン一個の検証アプリ」ではなく、無料βでShopifyマーチャントに見せられる業務アプリとして見える状態へ整えた。

今回の範囲はUI/UX polishに限定した。Billing、App Store listing、本番deploy、PDF生成、invoice送信、Draft Order complete、複数担当者、Slack通知、高度な分析、AI機能は追加していない。

優先したこと:

- Shopify Adminに馴染むカードベースの画面構成。
- quoteの状態が一目で分かるstatus badge。
- 見積対応の流れが分かる導線。
- 開発ログっぽい文言を減らした自然な日本語コピー。
- Storefront modalの信頼感と入力しやすさ。
- 既存のDawn quote proofとDraft Order proofを壊さないこと。

## 変更した画面

### Admin home / dashboard

`/app` を無料β向けのダッシュボードへ変更した。

- アプリ説明、対象shop、通知状態を表示。
- 今日の見積依頼、NEW、QUOTE_CREATED、Draft Order連携数をカードで表示。
- 次にやるべきセットアップを表示。
- quote listにstatus filterを追加。
- Recent eventsを業務履歴として読みやすく表示。

### Quote list

見積一覧を業務画面として整理した。

- status badgeを追加。
- 会社/担当者、メール、商品/variant、数量、Draft Order作成状態、作成日時、詳細CTAを表示。
- `All`、`NEW`、`REVIEWING`、`QUOTE_CREATED` の最小フィルタを追加。
- 空状態の説明を追加。

### Quote detail

`/app/quotes/:id` を法人見積対応画面として再構成した。

- Headerに会社名、status badge、受付日時を表示。
- Customer card、Request card、Internal workflow card、Draft Order card、Events cardへ分割。
- Draft Order未作成/作成済みの状態表示を明確化。
- 二重作成防止の説明を業務向けコピーへ変更。
- 開発用のAdmin認証確認ボタンは開発環境だけ小さく表示。

### Settings

`/app/settings` を製品設定画面として整理した。

- 通知ON/OFFと通知先メールを中心に配置。
- 通知プロバイダ未設定時は、通知がskippedとして記録されることを説明。
- Resend/Webhookに必要な環境変数を表示。
- Storefront表示の推奨コピーを記載。
- Protected Customer Dataの短い説明を追加。

### Beta checklist

`/app/beta` をβ導入チェックリストとして整理した。

- 商品ページへのApp Block設置。
- テスト見積送信。
- 通知設定。
- quote detail確認。
- Draft Order作成。
- Shopify Adminの下書き注文確認。
- 本番運用前に必要な項目を明示。

### Storefront modal

商品ページ上の見積依頼モーダルを整えた。

- モーダルタイトルと説明文を追加。
- ラベル、placeholder、required表示を改善。
- 成功/エラー表示を見やすく変更。
- Dawnに馴染む余白、角丸、入力欄、モバイル表示へ調整。
- Theme App Extension blockにmodal title / description設定を追加。

## Before / Afterの意図

Before:

- Admin homeは検証用の数値とテーブルに近かった。
- quote detailは保存データを並べた表示で、営業対応画面としてのまとまりが弱かった。
- Settings/Beta checklistは開発メモに近く、マーチャントに渡すには説明が不足していた。
- Storefront modalは最低限のフォームで、B2B購入者向けの安心感が弱かった。

After:

- マーチャントが「今見るべき依頼」「次に設定すること」「Draft Orderへ進む状態」を判断しやすくした。
- quote detailを顧客、依頼内容、内部対応、Draft Order、イベント履歴に分割した。
- 通知未設定や本番前の注意を、過度に技術的にならないコピーで説明した。
- Storefrontでは、依頼後に担当者から連絡が来ることが伝わるコピーにした。

## まだ未完成のUI

- Admin全体のナビゲーションは最小限。
- quote listの検索、ページネーション、並び替えは未実装。
- Storefrontのmodal title / descriptionはTheme Editor側設定で、Admin settingsからは編集しない。
- notification providerの疎通テストUIは未実装。
- Draft Order実体のline item / note / custom attributes確認は人間の手動QAが必要。

## 次のUI改善候補

1. quote listの検索と簡易ソート。
2. status変更後の画面状態更新をより分かりやすくする。
3. notification provider疎通確認ボタン。
4. Theme App Extension blockの表示条件説明。
5. β向けの短いオンボーディング文面。

## βで確認すべき観点

- Shopify Admin内で自然な業務アプリに見えるか。
- 見積依頼のNEWからDraft Order作成まで迷わず進めるか。
- status/internal noteが営業対応の最小メモとして使えるか。
- 通知未設定時の説明が誤解なく伝わるか。
- Storefront modalが購入者にとって自然で、商品ページの見た目を壊さないか。
- Draft Order作成済みquoteで二重作成できないことが伝わるか。
