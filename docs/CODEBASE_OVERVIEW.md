# B2B Quote Flow JP Codebase Overview

Last updated: 2026-06-14

## 1. アプリ全体の目的

B2B Quote Flow JPは、Shopify storefrontの商品ページから法人向け見積依頼を受け付け、Shopify Admin内で依頼を確認し、必要に応じてShopify Draft Orderへ接続するためのShopify app。

現時点の価値は、Dawnの商品ページに配置したTheme App Extension blockから見積依頼を保存し、Admin appでquoteを確認し、そのquoteからDraft Orderを作成できることをdev storeで証明できた点にある。

まだproduction-readyではない。App Store公開、Billing、本番DB、本番deploy、PDF、invoice送信、Draft Order completeは未着手または未完成。

## 2. 現在できること

- Dawnの商品ページに法人見積ボタンを表示できる。
- ボタンからモーダルを開ける。
- 会社名、担当者名、メール、数量、備考、請求書払い相談、稟議用PDF希望を入力できる。
- Theme App ExtensionのJSからApp Proxy pathへquote requestをPOSTできる。
- `QuoteRequest`としてSQLite dev DBへ保存できる。
- Shopify Admin appのquote listで保存済みquoteを確認できる。
- quote detailで依頼内容を確認できる。
- quote detailからShopify Admin GraphQL APIの`draftOrderCreate`を呼び、Draft Orderを作成できる。
- Draft Order作成後、quoteのstatusを`QUOTE_CREATED`へ更新できる。
- Draft Order ID、Name、管理画面リンクをquote detailに表示できる。
- `draftOrderId`保存済みquoteでは再作成ボタンを表示せず、二重作成を防ぐUIになっている。
- `Admin認証だけ確認`診断ボタンはdev-only化されている。

成功済みproofの詳細は以下を参照する。

- `docs/B2B_QUOTE_DAWN_PROOF_SUCCESS.md`
- `docs/B2B_QUOTE_DRAFT_ORDER_SUCCESS.md`

## 3. 主要ディレクトリ構成

```text
.
├── docs/
│   ├── B2B_QUOTE_DAWN_PROOF_SUCCESS.md
│   ├── B2B_QUOTE_DRAFT_ORDER_SUCCESS.md
│   ├── B2B_QUOTE_DRAFT_ORDER_SPIKE.md
│   └── CODEBASE_OVERVIEW.md
└── b2b-quote-flow-jp/
    ├── app/
    │   ├── models/
    │   ├── routes/
    │   ├── db.server.ts
    │   └── shopify.server.ts
    ├── extensions/
    │   └── b2b-quote-button/
    ├── prisma/
    │   ├── migrations/
    │   └── schema.prisma
    ├── package.json
    ├── shopify.app.toml
    └── vite.config.ts
```

`b2b-quote-flow-jp/`がShopify CLI React Router app本体。トップレベルの`docs/`は開発記録と引き継ぎ資料。

## 4. Theme App Extensionの役割

Theme App Extensionは、storefrontの商品ページに法人見積ボタンとモーダルを出す入口。

主なファイル:

- `b2b-quote-flow-jp/extensions/b2b-quote-button/blocks/b2b-quote-button.liquid`
- `b2b-quote-flow-jp/extensions/b2b-quote-button/assets/b2b-quote-button.js`
- `b2b-quote-flow-jp/extensions/b2b-quote-button/assets/b2b-quote-button.css`
- `b2b-quote-flow-jp/extensions/b2b-quote-button/shopify.extension.toml`

Liquid blockは商品情報を`data-*`属性として出す。

- shop permanent domain
- product ID
- current variant ID
- product title
- variant title
- product URL
- submit endpoint path

JSは以下を行う。

1. `[data-b2b-quote-root]`を探して初期化する。
2. ボタン押下でモーダルを開く。
3. 商品ページのcart add formから現在のvariant IDを読み直す。
4. フォーム入力値と商品情報をJSONにしてPOSTする。
5. 成功時に「見積依頼を受け付けました。」を表示する。
6. 失敗時にレスポンス本文を含めて画面とconsoleへ出す。

注意点: variant ID追従はDawnの商品ページで確認済みの簡易実装。テーマや商品フォーム構造が違う場合は再検証が必要。

## 5. App Proxy / storefront POSTの流れ

現在のstorefront POSTの最小フロー:

```text
Dawn product page
  ↓
Theme App Extension block
  ↓
b2b-quote-button.js
  ↓
POST /apps/b2b-quote/api/b2b-quote/requests
  ↓
app/routes/apps.b2b-quote.api.b2b-quote.requests.tsx
  ↓
app/routes/api.b2b-quote.requests.tsx
  ↓
createQuoteRequest()
  ↓
Prisma QuoteRequest create
```

`apps.b2b-quote.api.b2b-quote.requests.tsx`はApp Proxy path向けのrouteで、実装は`api.b2b-quote.requests.tsx`へ再exportしている。

`api.b2b-quote.requests.tsx`の責務:

- POSTだけ受け付ける。
- JSONまたはform dataを読み取る。
- App Proxy signatureがURLにある場合は`verifyAppProxySignature()`で検証する。
- signatureが有効な場合はURLの`shop`を信頼する。
- signatureがない場合はbodyの`shop`を使う。
- `createQuoteRequest()`へ渡して保存する。
- 成功時に`{ ok: true, quoteRequestId }`を返す。
- validation失敗時は`400`、signature不正時は`401`を返す。

本番前の注意: 現在はsignatureが存在する場合だけ検証している。App Proxy入口を本番化する前に、署名必須化、許可pathの整理、エラーログの見直しを行う。

## 6. QuoteRequest modelの役割

`QuoteRequest`はstorefrontから届いた法人見積依頼を保存する中心model。

定義は`b2b-quote-flow-jp/prisma/schema.prisma`にある。

主なフィールド:

- `shop`: shop単位でquoteを分離する。
- `status`: `NEW`, `REVIEWING`, `QUOTE_CREATED`, `SENT`, `WON`, `LOST`を想定。
- `companyName`, `contactName`, `email`, `phone`: 顧客情報。
- `productId`, `variantId`, `productTitle`, `variantTitle`, `productUrl`: 見積対象商品。
- `quantity`: 見積数量。
- `wantsInvoicePayment`, `needsApprovalPdf`: B2B向け希望条件。
- `customerNote`: 顧客入力メモ。
- `internalNote`: 内部状態や保存失敗マーカー。
- `draftOrderId`, `draftOrderName`, `draftOrderAdminUrl`, `draftOrderCreatedAt`: Draft Order連携結果。

関連実装は`b2b-quote-flow-jp/app/models/quoteRequest.server.ts`。

このmodel層の責務:

- storefront入力の正規化。
- 必須項目とメール形式のvalidation。
- shop domainのvalidation。
- product URLのvalidation。
- quantityの正規化。
- ProductVariant GIDの正規化。
- App Proxy signature検証。
- quote作成、一覧取得、詳細取得。
- Draft Order作成前のclaim。
- Draft Order作成失敗時のstatus reset。
- Draft Order保存失敗時のmarker保存。
- Draft Order保存成功時の`QUOTE_CREATED`更新。

## 7. Admin list/detail routeの役割

Admin appはShopify Admin内のembedded appとして動く。

共通Admin shell:

- `b2b-quote-flow-jp/app/routes/app.tsx`

このrouteは`authenticate.admin(request)`を実行し、`AppProvider`で配下routeを包む。Admin認証でBad Requestが出た場合は画面内に診断しやすいエラーを表示する。

quote list:

- `b2b-quote-flow-jp/app/routes/app._index.tsx`

`authenticate.admin(request)`から`session.shop`を取得し、`listQuoteRequests(session.shop)`でそのshopのquoteだけを表示する。表示項目はstatus、会社名、担当者、メール、商品、数量、作成日時、detailリンク。

quote detail:

- `b2b-quote-flow-jp/app/routes/app.quotes.$id.tsx`

detail routeの責務:

- Admin認証済みsession shopでquoteを取得する。
- quote内容を表示する。
- Draft Order作成ボタンを表示する。
- Draft Order作成済みならID、Name、status、管理画面リンクを表示する。
- Draft Order作成済みquoteでは再作成ボタンを表示しない。
- dev環境だけ`Admin認証だけ確認`診断ボタンを表示する。
- GraphQL / scope / protected customer data / validation / state / save failureを画面内に表示する。

Draft Order resource route:

- `b2b-quote-flow-jp/app/routes/app.quotes.$id.draft-order.tsx`

このfileは`app.quotes.$id.tsx`の`action`を再exportするだけ。UI routeのform actionではなくresource routeへ`fetch()`することで、React Router loader revalidation由来のBad Requestを回避している。

## 8. Draft Order作成処理の流れ

Draft Order作成はquote detail画面から開始する。

```text
quote detail
  ↓
fetch /app/quotes/:id/draft-order
  ↓
authenticate.admin(request)
  ↓
getQuoteRequest(session.shop, quoteId)
  ↓
guard: draftOrderIdがあれば作成しない
  ↓
guard: NEWまたは再試行可能なREVIEWINGだけ許可
  ↓
claimQuoteDraftOrderCreation()
  ↓
status NEW -> REVIEWING
  ↓
createDraftOrderForQuote(admin.graphql, quote)
  ↓
Shopify Admin GraphQL draftOrderCreate
  ↓
saveQuoteDraftOrder()
  ↓
status REVIEWING -> QUOTE_CREATED
  ↓
draftOrderId/name/adminUrl/createdAt保存
```

主なファイル:

- `b2b-quote-flow-jp/app/routes/app.quotes.$id.tsx`
- `b2b-quote-flow-jp/app/models/draftOrder.server.ts`
- `b2b-quote-flow-jp/app/models/quoteRequest.server.ts`

`createDraftOrderForQuote()`は以下をDraft Order inputに入れる。

- quoteのemail
- 商品variant GID
- quantity
- note
- tags
- customAttributes

二重作成防止:

- `draftOrderId`が既にあるquoteはactionで作成しない。
- `claimQuoteDraftOrderCreation()`は`draftOrderId: null`かつ`status: NEW`の行だけ`REVIEWING`に更新する。
- 作成済みdetail画面では再作成ボタンを表示しない。
- Draft Order作成後にDB保存だけ失敗した可能性がある場合は`internalNote`にmarkerを残し、Shopify AdminのDrafts確認を促す。

## 9. Protected customer data設定が必要な理由

Draft Order作成には`write_draft_orders` scopeだけでは足りない。

今回のdev store検証では、Shopify Admin GraphQL APIがDraftOrder objectへのProtected Customer Data accessを要求した。さらに現在のmutationはquoteの`email`をDraft Order inputへ渡すため、Partner Dashboard側でEmail fieldの利用も整理する必要がある。

必要な作業:

- Partner DashboardでProtected customer data accessを設定する。
- Draft Order関連データ利用の説明を本番向けに整理する。
- 実際に選択した用途とfieldsを審査説明と一致させる。
- コード側のscope追加だけで解決しようとしない。

詳細は`docs/B2B_QUOTE_DRAFT_ORDER_SUCCESS.md`を参照。

## 10. 主要ファイル一覧と責務

| File | 責務 |
| --- | --- |
| `b2b-quote-flow-jp/package.json` | npm scripts、React Router、Shopify、Prisma依存関係。 |
| `b2b-quote-flow-jp/shopify.app.toml` | Shopify app config。scope、webhook、App Proxy設定。secret値は書かない。 |
| `b2b-quote-flow-jp/app/shopify.server.ts` | Shopify app SDK初期化、Admin認証、session storage設定。 |
| `b2b-quote-flow-jp/app/db.server.ts` | PrismaClient singleton。dev環境ではglobalに保持。 |
| `b2b-quote-flow-jp/prisma/schema.prisma` | `Session`と`QuoteRequest`のDB schema。現在はSQLite dev DB。 |
| `b2b-quote-flow-jp/app/models/quoteRequest.server.ts` | QuoteRequestのvalidation、保存、取得、Draft Order state更新、App Proxy signature検証。 |
| `b2b-quote-flow-jp/app/models/draftOrder.server.ts` | Shopify Admin GraphQL `draftOrderCreate`実行、Draft Order note/customAttributes/admin URL生成。 |
| `b2b-quote-flow-jp/app/routes/app.tsx` | Admin embedded app shell、Admin auth、AppProvider、共通ErrorBoundary。 |
| `b2b-quote-flow-jp/app/routes/app._index.tsx` | Admin quote list。shop別quote一覧を表示。 |
| `b2b-quote-flow-jp/app/routes/app.quotes.$id.tsx` | Admin quote detail、Draft Order作成action、診断UI、作成済み表示。 |
| `b2b-quote-flow-jp/app/routes/app.quotes.$id.draft-order.tsx` | Draft Order作成resource route。detail actionを再export。 |
| `b2b-quote-flow-jp/app/routes/api.b2b-quote.requests.tsx` | Storefront/App Proxy POST入口の実装。quote requestを保存。 |
| `b2b-quote-flow-jp/app/routes/apps.b2b-quote.api.b2b-quote.requests.tsx` | App Proxy path用route。API routeを再export。 |
| `b2b-quote-flow-jp/app/routes/api.b2b-quote.$.tsx` | 不明なAPI pathを404にするfallback。 |
| `b2b-quote-flow-jp/extensions/b2b-quote-button/blocks/b2b-quote-button.liquid` | 商品ページに法人見積ボタンを出し、商品情報をJSへ渡すTheme App Extension block。 |
| `b2b-quote-flow-jp/extensions/b2b-quote-button/assets/b2b-quote-button.js` | storefront modal、form submit、App Proxy POST。 |
| `b2b-quote-flow-jp/extensions/b2b-quote-button/assets/b2b-quote-button.css` | storefront button/modalの最小CSS。 |
| `docs/B2B_QUOTE_DAWN_PROOF_SUCCESS.md` | Dawn商品ページからquote保存までの成功記録。 |
| `docs/B2B_QUOTE_DRAFT_ORDER_SUCCESS.md` | Draft Order作成成功、Protected Customer Data、実体確認チェックリスト。 |
| `docs/B2B_QUOTE_DRAFT_ORDER_SPIKE.md` | Draft Order実装中の調査ログ、Bad Request回避、GraphQL error整理。 |

## 11. dev storeでの確認手順

前提:

- Shopify CLI dev appとして起動できること。
- dev storeにappがinstall済みであること。
- Dawnの商品ページにTheme App Extension blockが配置済みであること。
- 必要scopeとProtected Customer Data設定が反映済みであること。
- secretや環境変数の値はdocsに残さない。

確認手順:

1. app本体ディレクトリへ移動する。

   ```bash
   cd b2b-quote-flow-jp
   ```

2. dev serverを起動する。

   ```bash
   npm run dev
   ```

3. Shopify AdminからDawnの商品ページを開き、法人見積ボタンが表示されることを確認する。

4. 法人見積ボタンを押し、モーダルに会社名、担当者名、メール、数量、備考を入力して送信する。

5. storefront上に「見積依頼を受け付けました。」が表示されることを確認する。

6. Admin appの`/app`を開き、NEW quote listに保存済みquoteが出ることを確認する。

7. quote detailを開き、商品、variant、数量、メール、備考がstorefront入力と一致することを確認する。

8. Draft Order作成前に、dev環境では必要なら`Admin認証だけ確認`を押してAdmin authとsession scopeを確認する。

9. `Draft Orderを作成`を押し、「Draft Orderを作成しました。」が表示されることを確認する。

10. quote detailでDraft Order ID、Name、管理画面リンク、`QUOTE_CREATED` statusが表示されることを確認する。

11. Shopify Admin > 注文管理 > 下書き でDraft Order実体を確認する。

12. Draft Orderの商品、variant、数量、顧客メール、note、customAttributesがquoteと一致することを確認する。

13. 同じquote detailを再表示し、再作成ボタンが表示されないことを確認する。

## 12. 既知の未完成項目

- App Proxy signature検証の本番向け厳密化。
- Dawn以外のテーマや別商品フォーム構造でのvariant追従確認。
- Admin status更新運用の整理。
- email通知。
- Draft Orderの業務妥当性確認の完了。
- invoice送信。
- Draft Order complete。
- PDF生成/見積書プレビュー。
- Billing。
- App Store listing。
- 本番DB移行。
- 本番deploy。
- App Proxy signatureやProtected Customer Data利用説明の審査向け整理。
- root login formのBad Request known issue解消。
- `Admin認証だけ確認`診断ボタンを本番前に完全削除するか、dev-only内部診断として残すかの最終判断。
- 自動テスト整備。
- quote detail/listの業務UI改善。

## 13. 次に触るべき順番

新機能に進む前に、まず成功済みproofを壊さない順で固める。

1. Draft Order実体確認チェックリストをdev storeで最後まで確認する。
2. 同一quoteの二重作成防止を実ストアで再確認する。
3. App Proxy signatureを本番向けに必須化する。
4. variant切り替え追従をDawn以外も含めて検証し、必要ならTheme Extension JSを強化する。
5. Admin status運用を決める。
6. email通知を追加する。
7. PDF生成/見積書プレビューを検討する。
8. invoice送信を検証する。
9. Draft Order completeは別スパイクとして扱う。
10. 本番DB、deploy、Billing、App Store listingは本番準備フェーズでまとめて扱う。

## 14. 本番前に必ずやること

- secretや環境変数の実値をcommitしない。
- `prisma/dev.sqlite`を本番DBとして使わない。
- 本番DB providerとmigration運用を決める。
- App Proxy signatureを必須検証にする。
- Protected Customer Data accessの用途、fields、審査説明をPartner Dashboard設定と一致させる。
- `write_draft_orders` scopeと必要scopeを最小化して再確認する。
- `Admin認証だけ確認`を完全削除するか、dev-only内部診断として残すか最終決定する。
- Shopify Admin > 注文管理 > 下書き でDraft Order実体を人間が確認する。
- Draft Order note/customAttributesに不要な個人情報や過剰データが入っていないか確認する。
- invoice送信、Draft Order complete、PDF、Billingを未実装のまま公開説明に書かない。
- lint、typecheck、build、Prisma validate/generateを本番前に再実行する。
- App Store listing、本番deploy、Billingは機能と運用が固まってから着手する。
