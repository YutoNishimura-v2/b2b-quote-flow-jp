# B2B Quote Flow JP Draft Order Spike

Last updated: 2026-06-14

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
