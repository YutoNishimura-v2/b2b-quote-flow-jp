# B2B Quote Flow JP 引き継ぎレポート

Last updated: 2026-06-14

## 0. この文書の目的

この文書は、これまでの試行錯誤、プロダクト判断、実装状態、Shopify検証状況、現在のブロッカー、次にやるべきことを、第三者がそのまま引き継げるように一枚に集約したハンドオフです。

結論から言うと、現在の本命は以下です。

```text
B2B Quote Flow JP

Shopify Plusや本格B2B導入前のB2Cストアに、
商品ページ上の「法人見積依頼」入口を追加する軽量Shopifyアプリ。
```

現在の最重要タスクは、ローカルUI改善ではありません。

```text
実Shopify開発ストアのDawn商品ページで、
Theme App Extension blockとして法人見積ボタンを表示し、
モーダルを開き、
商品/variant/shop contextを引き継ぎ、
見積依頼をPOSTし、
管理側でNEW quoteとして確認すること。
```

## 1. これまでの背景

最初は個人向けのアフィリエイト/比較サイト案から開始した。

初期の方向性:

- 買取/フリマ/下取りなどを比較するサイト。
- 商品別SEOページ。
- 計算機。
- 法務/方針ページ。
- sitemap/robots/404。
- 収益はアフィリエイト想定。

しかし、ユーザーからかなり強い辛口フィードバックがあった。

主な指摘:

- 「うりねこ比較室」などのキャラクター/かわいさ訴求はいらない。
- 文字が多すぎる。
- 秒で理解できるUI/UXでないと使わない。
- 「状態と手間」「自分の時間単価」など、ユーザーに意味不明な概念を押し付けている。
- アフィリエイトサイトとして見たとき、誰が使うのか分からない。
- コーディングよりアイデアにこだわるべき。
- 使用するユーザー目線で、直感的に使いたいか/使わないかを重視すべき。
- 汚いサービス、胡散臭いサービスは使わない。

このフィードバックにより、単なるSEO/比較サイトよりも、より明確な有料課題を持つShopifyアプリ案へ方向転換した。

## 2. 現在の本命プロダクト

### Product name

```text
B2B Quote Flow JP
```

### 立ち位置

このアプリはShopify B2Bそのものの代替ではない。

本格B2B導入前のB2Cストアに、法人見積の入口と管理導線を追加する軽量アプリである。

### 対象ユーザー

日本のShopifyマーチャント。

特に以下のような店舗:

- 業務用品を扱う。
- まとめ買い・法人購入・学校/店舗/施設向け販売がある。
- 商品ページでそのまま購入しづらい法人案件がある。
- 「見積ください」「請求書払いできますか」「10個以上買いたい」などの問い合わせがメール/電話/フォームに散らばっている。
- Shopify Plusや本格B2B機能までは重い。

### 提供価値

商品ページ上に「法人見積を依頼」ボタンを出し、購入前の法人見積相談を店舗側の管理画面へ集約する。

最低限の流れ:

```text
Dawn商品ページ
  ↓
法人見積を依頼
  ↓
モーダル
  ↓
会社名/担当者/メール/数量/備考
  ↓
商品/variant/shop context付きでPOST
  ↓
管理画面にNEW quote
```

### 競合/標準機能との比較

Shopify B2B:

- 会社単位の価格、支払い、配送、権限など本格B2B機能。
- かなり重い。
- Shopify Plus前提の文脈も強い。

Draft Orders:

- 電話/メール/対面販売や卸価格、請求書送信に使えるShopify標準機能。
- ただし、商品ページ上の法人見積入口や依頼管理フローそのものではない。

B2B Quote Flow JP:

- 商品ページ上の見積依頼入口。
- 依頼管理。
- 見積PDF/Draft Order橋渡し。
- B2Cストアが軽く法人見積対応を始めるためのアプリ。

## 3. 現在の評価

過去にローカルデモの完成度だけを見て `91/100` と評価したが、これは過大評価として取り下げ済み。

現在の正しい評価:

```text
68/100
```

理由:

- ローカルデモとしては価値が見える。
- しかし、Shopifyアプリとしてはまだ実ストア上の動作証明が不足している。
- Theme App ExtensionがDawn上で実際に動く証拠がまだない。
- App Proxy、OAuth/session、DB、Billing、Draft Order、本番PDFは未完成。

重要な方針:

```text
ローカルデモをShopifyアプリ完成と誤認しない。
```

## 4. 旧ローカルNext.jsデモの状態

現在アクセス可能な旧作業ディレクトリ:

```text
C:\Users\yuton\Documents\アフィ
```

これはShopify CLI生成の正式app shellではない。

Next.jsローカルデモとして以下が実装済み。

### 旧ローカルデモの主要機能

- `/b2b-quote` demo page。
- 商品ページ風の法人見積ボタン。
- quote request form。
- 商品情報引き継ぎ。
- API-backed quote request creation。
- in-memory repository。
- admin-style quote list/detail。
- status update/internal memo。
- customer-facing payment terms/delivery note/quote note。
- quote document preview/print。
- pricing section。
- quote event log。
- merchant notification/customer receipt email preview。
- merchant settings panel。
- settings API。
- button text/target tags/store info/admin email/email ON/OFF。
- storefront product context contract。
- App Proxy style storefront endpoint。
- Theme App Extension風 scaffold。
- extension block/JS/CSS/locales。
- local extension preview route。
- modal submit success state。
- App Proxy signature helper。
- embedded app session token helper。
- billing placeholder。
- plan limit placeholder。

### 旧ローカルデモの重要ファイル

```text
src/lib/b2bQuote.ts
src/lib/b2bQuoteStore.ts
src/lib/shopifyContext.ts
src/lib/billing.ts
src/components/B2BQuoteDemo.tsx
src/app/api/b2b-quote/storefront/route.ts
src/app/api/b2b-quote/requests/route.ts
src/app/api/b2b-quote/requests/[id]/route.ts
src/app/api/b2b-quote/settings/route.ts
src/app/b2b-quote/page.tsx
src/app/b2b-quote/extension-preview/page.tsx
extensions/b2b-quote/blocks/b2b-quote-button.liquid
extensions/b2b-quote/assets/b2b-quote-button.js
extensions/b2b-quote/assets/b2b-quote-button.css
extensions/b2b-quote/locales/ja.default.json
extensions/b2b-quote/locales/en.default.json
```

### 旧ローカルデモのテスト/検証

旧Next.js repoでは以下が通っている。

```text
tsc --noEmit: passed
eslint . --max-warnings=0: passed
vitest run: passed, 12 files / 59 tests
next build: passed
```

ただし、これはShopify実ストア証明ではない。

## 5. 旧ローカルデモから移植するもの/捨てるもの

正式なShopify CLI app shellへ移すときの方針:

```text
旧Next.jsデモを無理やりShopify CLI構造へ変換しない。
Shopify CLIで作成した正式shellに、必要最小限だけ移植する。
```

### Reuse

再利用候補:

- `extensions/b2b-quote/blocks/b2b-quote-button.liquid`
- `extensions/b2b-quote/assets/b2b-quote-button.js`
- `extensions/b2b-quote/assets/b2b-quote-button.css`
- `extensions/b2b-quote/locales/*.json`
- `src/lib/b2bQuote.ts` の validation / data model / helper。
- `src/lib/shopifyContext.ts` の App Proxy signature/session token helper。

### Rewrite

Shopify CLI React Router app shell側で書き直すもの:

- storefront API endpoint。
- quote request POST endpoint。
- admin list/detail route。
- settings route。
- in-memory store。
- billing placeholder。
- embedded admin UI。

### Discard

今回の実ストアproofでは捨てる/持ち込まないもの:

- 旧`B2BQuoteDemo.tsx`全体。
- `/b2b-quote/extension-preview`。
- dev用 `?shop=` fallback を本番扱いすること。
- pricing/marketing UI。
- PDF品質改善。
- Draft Order実装。
- Billing実装。
- App Store Listing改善。

## 6. 現在の正式Shopify app shell状況

ユーザー側でShopify CLIによる正式React Router app shell作成は完了している。

現在の場所:

```text
/workspaces/b2b-quote-flow-jp/b2b-quote-flow-jp
```

現在の状態:

- `shopify app dev` は起動済み。
- dev store: `b2b-quote-flow-test.myshopify.com`
- App: `b2b-quote-flow-jp`
- 初期テンプレートの "Congrats on creating a new Shopify app" 画面がブラウザで表示できた。
- `/auth/login?shop=b2b-quote-flow-test.myshopify.com` を直接開くとShopify app homeが表示された。

したがって、最低限以下は通っている判断:

```text
Shopify app shell / OAuth / dev store接続
```

### Known issue

初期テンプレートのShop domainフォーム経由ではBad Requestが出た。

扱い:

```text
Theme App Extension proofのブロッカーにしない。
App Store提出前にはroot login/install flow修正対象として残す。
```

## 7. 現在のCodex作業環境からのブロッカー

このレポート作成時点のCodex環境からは、正式app shellのディレクトリにアクセスできなかった。

確認結果:

- `/workspaces/b2b-quote-flow-jp/b2b-quote-flow-jp` はPowerShell側では `C:\workspaces\...` と解釈され、存在しない。
- `wsl` コマンドはあるが、Linux distro未導入扱い。
- `\\wsl$` / `\\wsl.localhost` も見えない。
- Codex app terminal sessionも未接続。
- GitHub pluginは利用可能だが、接続済みGitHub Appからアクセスできるrepoが0件。
- `b2b-quote-flow-jp` repo検索も0件。

つまり、現在のCodexスレッドからは正式Shopify app shellを直接編集できない。

次に必要なこと:

```text
Codexが /workspaces/b2b-quote-flow-jp/b2b-quote-flow-jp を見える状態にする。
または、対象repoをGitHub Appに許可する。
または、作業対象をこのCodexから見える場所に置く。
```

## 8. 今回実装すべき最小スコープ

正式Shopify CLI app shell上に実装する。

実装対象:

1. Theme App Extension block
2. button JS/CSS
3. quote request modal/form
4. quote request API endpoint
5. minimal admin list/detail
6. QuoteRequest data model
7. basic validation
8. quote saved as NEW

今回やらないこと:

- PDF品質改善
- Draft Order実装
- Billing実装
- App Store Listing
- 本番メール送信
- 価格表改善
- UIの過剰改善
- AI機能

## 9. 完了条件

Dawnの商品ページ上で以下が通ること。

```text
法人見積ボタン表示
  ↓
モーダル表示
  ↓
商品/variant/shop context引き継ぎ
  ↓
見積依頼POST
  ↓
管理側でNEW quote確認
```

具体的なチェック:

- Dawnの商品ページにTheme App Extension blockを配置できる。
- `法人見積を依頼` ボタンが表示される。
- ボタンからモーダルが開く。
- モーダルに商品名/variant/product URLが引き継がれる。
- 会社名、担当者名、メール、数量、備考を入力できる。
- 請求書払い相談checkboxがある。
- 稟議用PDF希望checkboxがある。
- POSTでquote requestが保存される。
- admin app homeでNEW quote一覧が見られる。
- shopごとにquoteが分離される。
- 他shopのquoteが見えない。

## 10. データモデル

`QuoteRequest`:

```ts
type QuoteStatus =
  | "NEW"
  | "REVIEWING"
  | "QUOTE_CREATED"
  | "SENT"
  | "WON"
  | "LOST";

type QuoteRequest = {
  id: string;
  shop: string;
  status: QuoteStatus;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  productUrl: string;
  quantity: number;
  wantsInvoicePayment: boolean;
  needsApprovalPdf: boolean;
  customerNote: string;
  internalNote: string;
  createdAt: string;
  updatedAt: string;
};
```

Storefront form fields:

- 会社名
- 担当者名
- メールアドレス
- 数量
- 備考
- 請求書払い相談 checkbox
- 稟議用PDF希望 checkbox

## 11. セキュリティ/安全要件

必須:

- shopごとにデータ分離する。
- 他shopのquote requestが見えないようにする。
- ユーザー入力はescapeする。
- ログに個人情報を出しすぎない。
- secretや `.env` の中身を出力しない。

注意:

- storefront POSTはApp Proxy経由が理想。
- 開発中に仮endpointで通す場合でも、最終的にはshop contextの信頼境界を明確にする。
- admin list/detailはShopify sessionから取得したshopで絞る。

## 12. Theme App Extension実装イメージ

必要なextension:

```text
extensions/b2b-quote
  shopify.extension.toml
  blocks/b2b-quote-button.liquid
  assets/b2b-quote-button.js
  assets/b2b-quote-button.css
  locales/ja.default.json
```

Liquid blockで持たせるcontext:

```text
data-shop
data-product-id
data-variant-id
data-product-title
data-variant-title
data-product-url
data-product-tags
data-submit-endpoint-path
```

注意点:

- `product.selected_or_first_available_variant` を使う場合、Dawn上でvariant切り替え後に `variantId` が更新されるか確認が必要。
- 初回proofでは選択中variantの動的追従まで完璧にしなくてもよいが、検証項目として必ず記録する。

## 13. API/Route実装イメージ

正式React Router app shellの構造に合わせること。

最低限必要:

- storefront quote POST endpoint
- admin quote list route
- quote detail or inline detail route

保存先:

- 最初は開発用の単純なDB/Prisma/SQLite等、生成テンプレートに合うものを優先。
- もしDB設定が重い場合は、proof用に一時storeでもよいが、shop分離を必ず実装し、demo-onlyであることを明記する。

admin画面:

- 旧テンプレートのCongrats画面を置き換える。
- 過剰なUI改善はしない。
- NEW quote一覧が見えることを優先。

最低限の表示:

- status
- companyName
- contactName
- email
- productTitle
- variantTitle
- quantity
- createdAt

## 14. DawnにApp Blockを置く人間向け手順

実装完了後、dev storeで確認する手順:

1. `shopify app dev` を起動したままにする。
2. Shopify adminで `b2b-quote-flow-test.myshopify.com` を開く。
3. Online Store > Themes を開く。
4. Dawn themeのCustomizeを開く。
5. 商品テンプレートを開く。
6. 商品情報セクション内でAdd blockを押す。
7. AppsまたはApp blocksから `法人見積ボタン` / `B2B Quote` を選ぶ。
8. Buy buttons付近に配置する。
9. 保存する。
10. 実商品ページを開く。
11. `法人見積を依頼` ボタンが表示されるか確認する。
12. ボタンを押してモーダルが開くか確認する。
13. 会社名/担当者名/メール/数量/備考を入力して送信する。
14. アプリ管理画面に戻り、NEW quoteが表示されるか確認する。

## 15. 商品ページで確認する項目

DOM/context:

- `data-shop` が `b2b-quote-flow-test.myshopify.com` または permanent domain と一致。
- `data-product-id` が空でない。
- `data-variant-id` が空でない。
- `data-product-title` が商品名と一致。
- `data-variant-title` が選択variantと一致。
- `data-product-url` が商品URLになっている。
- `data-product-tags` が取れている。

UI:

- ボタンがBuy buttons付近に表示される。
- モーダルが開く。
- モーダルが画面外にはみ出さない。
- mobileで横スクロールが出ない。

POST:

- Network tabでsubmit endpointにPOSTされる。
- payloadにshop/product/variant/customer fieldsが含まれる。
- responseがsuccess。
- admin側にNEW quoteが出る。

## 16. うまくいかない場合の切り分け

失敗したら、最初に一つの主原因へ分類する。

| 分類 | 症状 | 見るもの |
| --- | --- | --- |
| CLI structure | extension生成/起動が失敗 | CLI出力、app config |
| Theme Extension | blockがtheme editorに出ない | extension config、CLIログ、theme editor |
| App Proxy | storefront requestが404/401 | App Proxy設定、Network URL、server log |
| OAuth/session | admin画面でshopが取れない | session/authログ、redirect |
| environment | npm/CLI/store/tunnelがない | command version、env状態 |
| API endpoint | modalは開くがPOST失敗 | status code、payload、route |
| theme CSS/JS conflict | 表示崩れ/クリック不可 | console、DOM、CSS、z-index |

## 17. App Proxy方針

推奨開発設定:

```text
Prefix: apps
Subpath: b2b-quote
Theme block app_proxy_url: /apps/b2b-quote
Visibility endpoint path: /api/b2b-quote/storefront
Submit endpoint path: /api/b2b-quote/requests
```

想定URL:

```text
/apps/b2b-quote/api/b2b-quote/storefront
/apps/b2b-quote/api/b2b-quote/requests
```

ただしReact Router app shell側のroute構造に合わせ、実際のpathは調整してよい。

重要なのは以下:

- storefrontから同一ドメインで到達できる。
- shop contextが取れる。
- POSTが保存まで通る。
- 最終的にApp Proxy signature検証できる形へ進める。

## 18. Draft Order/PDFの判断

今回やらない。

現時点の判断:

```text
まずDawn上のTheme App Extension proof。
その後、Draft Order連携の小スパイク。
PDF品質改善はその後。
```

理由:

- PDFを磨いてもShopify app installabilityは証明されない。
- Draft OrderはShopify-nativeで有料プラン理由を強める。
- ただしDraft OrderはOAuth/Admin API/scopesが必要なので、app shellとadmin contextが動いてから。

PDF-only MVPの弱点:

- quote後の受注処理が手作業。
- Shopify-native感が弱い。
- form builder + print pageに見えるリスク。
- Proプラン差別化が弱い。

Draft Orderを後回しにする場合の安全な説明文:

```text
B2B Quote Flow JPは、商品ページから法人見積依頼を受け付け、管理画面で依頼を確認し、見積PDF作成を支援するアプリです。
初期版では注文作成や決済処理は自動化しません。店舗が入力した見積条件をもとに、法人顧客との商談・稟議対応を整理できます。
```

避ける文言:

```text
下書き注文を自動作成できます
請求書を送信できます
掛け払いに対応します
インボイス制度に対応します
```

## 19. 既存ドキュメント一覧

旧Next.js repo内の重要ドキュメント:

```text
docs/B2B_QUOTE_APP_STATE.md
docs/B2B_QUOTE_LOOP_LOG.md
docs/B2B_QUOTE_DEV_STORE_VERIFICATION.md
docs/B2B_QUOTE_SHOPIFY_PROOF_REPORT.md
docs/B2B_QUOTE_SHOPIFY_APP_SHELL_MIGRATION.md
docs/B2B_QUOTE_PRODUCT_SPEC.md
docs/B2B_QUOTE_DECISIONS.md
docs/B2B_QUOTE_SUPPORT_RISKS.md
docs/B2B_QUOTE_APP_STORE_LISTING.md
docs/B2B_QUOTE_THEME_EXTENSION_HANDOFF.md
docs/B2B_QUOTE_SHOPIFY_INSTALL_PATH.md
```

この文書は、それらを第三者向けに一枚へ圧縮したもの。

## 20. 次の担当者が最初にやること

最初に、正式Shopify app shellの場所へ入る。

```bash
cd /workspaces/b2b-quote-flow-jp/b2b-quote-flow-jp
```

確認する。

```bash
pwd
ls
find . -maxdepth 3 -type f | sort | head -200
cat package.json
```

Shopify app devが起動しているか確認する。

```bash
shopify app dev
```

次に、Theme App Extensionがあるか確認する。

```bash
find extensions -maxdepth 4 -type f | sort
```

なければ生成する。

```bash
shopify app generate extension
```

Theme App Extension/app blockを選ぶ。

その後、以下を実装する。

1. QuoteRequest model。
2. shop別保存。
3. storefront POST endpoint。
4. admin NEW quote list。
5. Theme App Extension block。
6. button JS/CSS/modal。
7. Dawn配置。
8. submit success確認。

## 21. 完了後に必ず出す報告

次回レポートには必ず以下を含める。

1. 変更ファイル一覧。
2. 実行したコマンド。
3. テスト結果。
4. DawnにApp Blockを置くための人間向け手順。
5. 商品ページで確認する項目。
6. うまくいかない場合の切り分け。
7. Shopify CLI app shellを作ったか。
8. 既存Next.js demoから何を移植したか。
9. Dawn上で動いたか。
10. App Proxyが動いたか。
11. npm/package manager環境の矛盾が解消したか。
12. 次にPDFへ進むべきか、Draft Orderスパイクへ進むべきか。

## 22. 現在の最終判断

現在の判断:

```text
B2B Quote Flow JPは本命として続行。
ただし、まだShopifyアプリ完成ではない。
現在の正しい評価は68/100。
次の一点だけを証明する。

Dawnの商品ページで法人見積ボタン → モーダル → 商品context → POST → NEW quote。
```

この証明が通れば、次はDraft Order連携の小スパイクへ進む。

この証明が通らなければ、失敗分類に従って原因を一つずつ潰す。

## 23. 次回再開用の一文

```text
/workspaces/b2b-quote-flow-jp/b2b-quote-flow-jp のShopify CLI React Router app shell上で、B2B Quote Flow JPの最小機能としてTheme App Extension block、button JS/CSS/modal、quote POST endpoint、shop別NEW quote保存、minimal admin listを実装し、Dawn商品ページでボタン表示からNEW quote確認まで検証してください。Bad Requestのroot loginフォーム問題はKnown issueとして記録し、今回のTheme Extension proofのブロッカーにしないでください。
```
