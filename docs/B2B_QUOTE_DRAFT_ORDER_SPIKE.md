# B2B Quote Flow JP Draft Order Spike

Last updated: 2026-06-14

## 0. Application Error対応

Draft Order作成ボタン押下時に、Shopify Admin内のquote detail画面で以下が表示された。

```text
Application Error
Error: Bad Request
React Router singleFetchAction / handleSingleFetchRequest / requestHandler
```

推定原因:

- POST action内の `authenticate.admin(request)` またはShopify Admin GraphQL呼び出しが `Bad Request` Response/例外を投げ、route全体のErrorBoundaryまで到達していた。
- actionが失敗理由をActionDataとして返す前に落ちていたため、quote detail画面上に原因を表示できなかった。

修正内容:

- Draft Order作成Formに `intent=create-draft-order` を追加。
- actionでintentを検証し、不明なPOSTを画面エラーとして返す。
- actionでは `request.clone().formData()` でintentを先に読み、元requestはShopify Admin認証へ渡す。
- `authenticate.admin(request)` の失敗をcatchし、redirect以外は画面エラーとして返す。
- action後のloader再実行で `authenticate.admin(request)` がBad Requestを投げても、redirect以外はloader dataとして返して画面内に表示する。
- quote lookup / claim / GraphQL / DB保存失敗を分類してActionDataで返す。
- GraphQL `userErrors` / top-level `errors` / validation / auth / api / save error を画面上に表示する。
- 想定外のroute error用にcustom `ErrorBoundary` を追加し、少なくとも「一覧へ戻る」を表示する。
- safe logを追加し、shop、quoteRequestId、intent、status、hasDraftOrderId、variantId形式、quantity、GraphQL error message/fieldだけを出す。

ログに出さないもの:

- access token
- Shopify API secret
- session token
- raw headers
- cookie
- full request body
- customer note全文

## 1. 実装した内容

quote detail画面からShopify Admin APIの `draftOrderCreate` を呼び、Draft Orderを1件作成する小スパイクを追加した。

実装範囲:

- `QuoteRequest` にDraft Order連携用フィールドを追加。
- quote detail画面に `Draft Orderを作成` ボタンを追加。
- 既に `draftOrderId` があるquoteでは二重作成しない。
- NEW statusのquoteだけDraft Order作成対象にする。
- 作成開始時にserver action側でNEW quoteを `REVIEWING` にclaimし、連打や並列POSTでの二重作成を抑止する。
- 作成済みquoteではDraft Order ID/Name/作成日時/Admin URLを表示。
- 成功時に `QuoteRequest.status` を `QUOTE_CREATED` に更新。
- Shopify GraphQL `userErrors` とtop-level `errors` を画面に返す。
- 例外時も画面を落とさず、secret/access tokenをログに出さない。

## 2. 追加したscope

`shopify.app.toml` に以下を追加した。

```text
write_draft_orders
```

現在のscope:

```text
write_products,write_metaobjects,write_metaobject_definitions,write_draft_orders
```

重要:

scope変更後はdev storeでアプリの再インストールまたは権限更新が必要。権限更新前にボタンを押すと、Shopify Admin API側で権限エラーになる可能性がある。

## 3. Migration内容

追加migration:

```text
prisma/migrations/20260614091000_add_draft_order_fields/migration.sql
```

追加カラム:

```text
draftOrderId TEXT
draftOrderName TEXT
draftOrderAdminUrl TEXT
draftOrderCreatedAt DATETIME
```

すべてnullableなので、既存のquote requestには影響しない。

ローカル確認では以下を実行する。

```bash
npx prisma validate
npx prisma generate
npx prisma migrate status
```

ローカルdev DBへ適用する場合のみ:

```bash
npx prisma migrate deploy
```

## 4. GraphQL mutation概要

Admin GraphQL APIで `draftOrderCreate` を呼ぶ。

主なinput:

- `email`: quoteのメールアドレス。
- `lineItems`: quoteのvariant IDと数量。
- `note`: quote ID、会社名、担当者、請求書払い希望、稟議用PDF希望、備考。
- `tags`: `b2b-quote-flow-jp` と `quote-request:<quoteId>`。
- `customAttributes`: quote ID、会社名、担当者、請求書払い希望、稟議用PDF希望、備考。

返却値:

- `draftOrder.id`
- `draftOrder.name`
- `draftOrder.createdAt`
- `userErrors`

## 5. variantId正規化方針

Theme App ExtensionのLiquidから来る `variantId` は数値IDの可能性がある。

保存済みquoteの `variantId` はDraft Order作成前に以下の方針で正規化する。

- `gid://shopify/ProductVariant/<id>` 形式ならそのまま使う。
- 数値IDなら `gid://shopify/ProductVariant/<id>` に変換する。
- それ以外はinvalidとしてDraft Order作成を止める。
- quantityは1以上の整数でなければDraft Order作成前に止める。

実装helper:

```text
normalizeProductVariantGid
```

## 6. 人間がdev storeで確認する手順

1. `shopify app dev --reset --store b2b-quote-flow-test.myshopify.com` を起動する。
2. `write_draft_orders` の権限更新または再インストールを承認する。
3. Dawn商品ページから新しい法人見積依頼を送信する。
4. Admin appでNEW quote detailを開く。
5. `Draft Orderを作成` を押す。
6. detail画面でDraft Order ID/Name/Admin URL、または少なくともID/Nameが表示されるか確認する。
7. statusが `QUOTE_CREATED` になるか確認する。
8. もう一度押して二重作成されないことを確認する。
9. Shopify Admin > Orders > Drafts でDraft Orderが存在するか確認する。
10. line itemの商品/variant/quantityが見積依頼と一致するか確認する。
11. email/note/customAttributesが業務上妥当か確認する。

## 7. 成功/失敗時の切り分け

成功時:

- quote detail画面に `Draft Orderを作成しました。` が表示される。
- `QuoteRequest.draftOrderId` が保存される。
- `QuoteRequest.status` が `QUOTE_CREATED` になる。
- Admin URLからShopify AdminのDraft Orderを確認できる。
- もう一度quote detailを開いたとき、作成ボタンではなく作成済み情報が表示される。
- NEW以外のstatusでは作成ボタンを出さない。

失敗時:

- Shopify GraphQL `userErrors` またはtop-level `errors` が画面に表示される。
- Admin auth failureは `auth` として画面に表示される。
- variant/quantity/intent failureは `validation` として画面に表示される。
- quote state conflictは `state` として画面に表示される。
- network/API exceptionは `api_error` として画面に表示される。
- Draft Order作成後にDB保存だけ失敗した可能性がある場合は `save_error` として画面に表示される。
- 例外時は汎用エラーが表示される。
- サーバログにはshop、quoteRequestId、error messageのみ出す。
- access tokenやsecretはログに出さない。
- Draft Order作成前に失敗した場合はstatusを `NEW` に戻す。
- Draft Order作成後にDB保存が失敗した可能性がある場合は、二重作成防止のため `REVIEWING` のまま残し、Shopify AdminのDrafts確認を促す。

よくある原因:

- `write_draft_orders` scopeがdev storeでまだ承認されていない。
- variant IDが存在しない、または対象shopの商品variantではない。
- quoteのemailやquantityがShopify Draft Order inputとして不正。
- アプリのAdmin API sessionが失効している。

権限未承認時の対処:

1. `shopify app dev --reset --store b2b-quote-flow-test.myshopify.com` を再起動する。
2. `write_draft_orders` の権限更新画面が出たら承認する。
3. 承認後、quote detailを再読み込みして `Draft Orderを作成` を再実行する。
4. それでも `auth` または `graphql_error` が出る場合は、アプリがdev storeに再インストールされているか確認する。

retry可能性:

- `draftOrderId` が保存されていない失敗は、基本的に `REVIEWING -> NEW` に戻して再試行可能にする。
- GraphQL `userErrors`、top-level `errors`、validation error、network/API exceptionでは再試行可能。
- loader/authのBad Requestはdetail内のloader errorとして表示し、route ErrorBoundaryへ落とさない。
- `REVIEWING` かつ `draftOrderId` なしで、DB保存失敗マーカーがないquoteは、前回処理が中断されたものとして再試行可能にする。
- Draft Order作成成功後にDB保存だけ失敗した可能性がある場合は、internal noteに保存失敗マーカーを残し、二重作成回避のためNEWへ戻さず、Shopify Admin > Orders > Draftsを確認してから対応する。

それでもBad Requestになる場合に見るserver log:

- `b2b_quote_detail_loader_start`
- `b2b_quote_detail_loader_authenticated`
- `b2b_quote_detail_loader_error`
- `b2b_quote_draft_order_action_start`
- `b2b_quote_draft_order_auth_error`
- `b2b_quote_draft_order_graphql_failed`

これらにはtoken、secret、cookie、raw headers、customer note全文は出さない。

### 0.1 Bad Request継続時の診断

Application Errorをcustom ErrorBoundaryへ置き換えた後も、Draft Order作成ボタン押下後にquote detailが以下のBad Request表示になる状態が残った。

```text
見積依頼詳細
エラー
見積依頼詳細を表示できませんでした。画面を再読み込みするか、一覧へ戻って再度開いてください。
Bad Request
```

また、`write_draft_orders` の権限更新/再インストール確認画面も表示されないケースがあった。

この段階ではDraft Order mutationまで到達しているか、Admin auth/action POST自体で失敗しているかを切り分ける必要があるため、quote detail画面に開発用診断ボタンを追加した。

診断ボタン:

```text
Admin認証だけ確認
```

診断action:

```text
intent=debug-admin-auth
```

処理内容:

- `authenticate.admin(request)` を実行する。
- 成功した場合だけ、軽いAdmin GraphQL query `shop { name myshopifyDomain }` を実行する。
- 成功時はdetail画面内に `[debug] Admin auth OK`、`shop`、`myshopifyDomain` を表示する。
- 失敗時はErrorBoundaryへ落とさず、detail画面内に `[auth] Admin auth failed` とsafe errorを表示する。
- access token、API secret、session token、cookie、raw headers、full bodyは表示しない。

切り分け:

- `Admin認証だけ確認` もBad Request/認証エラーになる場合は、Draft Order mutationではなくAdmin action/auth/form/sessionの問題として調査する。
- `Admin認証だけ確認` がOKで、`Draft Orderを作成` だけ失敗する場合は、`write_draft_orders` scope、mutation input、variantId、quantity、GraphQL `userErrors` を調査する。

既知失敗時のHTTP status方針:

- Draft Order作成actionの想定内失敗はHTTP 4xx/5xxを返さず、HTTP 200のActionDataとして返す。
- 対象はintent不正、Admin authのnon-redirect Response、scope不足、variantId不正、quantity不正、GraphQL `userErrors`、top-level GraphQL errors、API exception、state不整合。
- Shopify auth flowに必要なredirect Responseのみrethrowする。

`write_draft_orders` scope反映確認:

- `shopify.app.toml` に `write_draft_orders` があることを確認する。
- `shopify app dev --reset --store b2b-quote-flow-test.myshopify.com` 起動ログで `app_access` に `write_draft_orders` が含まれるか確認する。
- 権限更新画面が出ない場合でも、ログにscopeが含まれないならアプリをアンインストールして再インストールする。
- それでもscopeが反映されない場合は、`shopify.app.toml` のscopeがdev serverに読み込まれていない可能性がある。

注意:

- `Admin認証だけ確認` はdev spike用の診断UI。
- 本番前に削除するか、dev-only表示にする。

### 0.2 親app route loaderのBad Request対策

`write_draft_orders` scope反映後も、Draft Order作成時にquote detail routeのErrorBoundaryで `Bad Request` が表示された。

原因:

- quote detail child route側のloader/actionはBad RequestをcatchしてActionData/loader dataへ変換していた。
- しかし親route `app/routes/app.tsx` のloaderでも `authenticate.admin(request)` を実行しており、action後のrevalidation時にここでnon-redirect `Bad Request` が投げられると、child routeの通常UIまで戻れなかった。

修正内容:

- 親route loaderでも `authenticate.admin(request)` をtry/catchする。
- Shopify auth flowに必要なredirect Responseはrethrowする。
- non-redirect Response/ErrorはHTTP 4xx/5xxとして投げず、safe loader dataとして返す。
- 親route側に `[auth]` の最小表示を出しつつ、child routeのdetail UIを表示できるようにする。
- ログは `b2b_quote_app_loader_auth_error` に限定し、methodとsafe errorだけを出す。

ログに出さないもの:

- access token
- Shopify API secret
- session token
- cookie
- raw headers
- full request body

### 0.3 action後revalidationのBad Request対策

親route loaderのBad Request対策後も、Draft Order作成POSTの直後に同じBad Request ErrorBoundaryが出るケースが残った。

追加原因候補:

- React Routerはaction完了後に親子route loaderをrevalidateする。
- Draft Order action自体がActionDataを返していても、その後の親/子loader revalidationで `authenticate.admin(request)` がBad Requestを投げると、画面内のactionDataではなくErrorBoundaryへ落ちる。

修正内容:

- `app/routes/app.tsx` と `app/routes/app.quotes.$id.tsx` に `shouldRevalidate` を追加。
- `intent=create-draft-order` と `intent=debug-admin-auth` のPOST後はloader revalidationを止める。
- Draft Order作成や診断の結果は、まずactionDataとしてdetail画面内に表示する。

注意:

- Draft Order作成成功後のDraft Order ID/Name表示は、画面再読み込み後にDB保存済み情報として表示される。
- これはBad Request原因切り分けを優先するためのspike対応。

### 0.4 React Router Form経路の切り離し

`shouldRevalidate` 追加後も同じBad Request ErrorBoundaryに落ちる状態が続いたため、Draft Order spikeの送信経路をReact Router `<Form>` / `useActionData` からブラウザ `fetch` に切り替えた。

目的:

- React Router singleFetch / navigation error boundary経路を避ける。
- HTTP 400、HTML、空body、JSON parse失敗でもquote detail画面内に表示する。
- actionはDraft Order/診断POSTに対してHTTP 200 JSONを返す。

画面表示方針:

- JSON成功時は従来通り `[debug]` または成功メッセージを表示する。
- JSONの分類エラーは `[auth]`、`[scope]`、`[validation]`、`[graphql_user_error]`、`[graphql_error]`、`[api_error]`、`[save_error]` として表示する。
- JSONではないレスポンスは `[api_error] JSONとして読めないレスポンスです。HTTP <status> ...` として先頭500文字だけ表示する。
- 空bodyは `[api_error] 空のレスポンスです。HTTP <status> ...` として表示する。

### 0.5 React Router action CSRF許可Origin

`fetch` 切り替え後、画面内に以下が表示された。

```text
[api_error] JSONとして読めないレスポンスです。HTTP 400 : Bad Request
```

原因:

- React Router 7.9系にはUI route actionへの外部Origin POSTを拒否するCSRF保護がある。
- Shopify Admin embedded appでは、POSTの `Origin` がアプリhostではなく `admin.shopify.com` になることがある。
- `Origin` と `host` / `x-forwarded-host` が一致せず、`allowedActionOrigins` 未設定のため、action実行前にReact Routerが `Bad Request` を返していた。

修正内容:

- `react-router.config.ts` を追加。
- `allowedActionOrigins` に `admin.shopify.com`、`*.myshopify.com`、`**.app.github.dev` を追加。

注意:

- これはShopify Admin embedded appからのaction POSTを許可するための設定。
- secret、token、cookie、raw headersはログ出力しない。

### 0.6 resource route POSTへの切り替え

`allowedActionOrigins` 追加後もUI route actionへのPOSTで同じHTTP 400が続いた。

追加対応:

- quote detail画面からのPOST先をUI route `/app/quotes/:id` ではなくresource route `/app/quotes/:id/draft-order` に変更した。
- resource route `app/routes/app.quotes.$id.draft-order.tsx` を追加し、既存Draft Order actionを再利用する。
- React Routerの外部Origin CSRF保護はUI route action向けのため、resource route POSTでaction本体まで到達させる。

確認方法:

- `Admin認証だけ確認` のfetch先が `/app/quotes/<quoteId>/draft-order` になっていること。
- ここでまだHTTP 400が出る場合は、React Router UI action CSRFではなくresource routeまたはShopify auth側のBad Requestとして切り分ける。

## 8. 未実装

今回のスパイクでは以下は実装していない。

- Draft Order invoice送信。
- Draft Order complete。
- 決済処理。
- PDF生成。
- Billing。
- App Store listing。
- 本番deploy。
- UI polish。
- App Proxy signature厳密化。

本番前にはApp Proxy signatureの厳密化が必要。
