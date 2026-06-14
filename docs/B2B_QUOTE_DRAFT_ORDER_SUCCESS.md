# B2B Quote Flow JP Draft Order Success

Last updated: 2026-06-14

## Summary

Dawn商品ページから作成したquoteについて、Admin quote detail画面の `Draft Orderを作成` ボタンからShopify dev store上でDraft Order作成が成功した。

今回確認できた成功は小スパイクの成功であり、production-readyではない。

## 確認済み

- Partner DashboardでProtected customer data設定を行った。
- `write_draft_orders` scopeがAdmin sessionに含まれることを確認した。
- `DraftOrder` object accessのProtected Customer Dataブロッカーを解消した。
- quote detail画面で `Admin認証だけ確認` が成功した。
- quote detail画面で `Draft Orderを作成` を押した。
- 画面上に `Draft Orderを作成しました。` が表示された。
- Shopify dev store上でDraft Order作成APIが実際に成功した。

## 成功までの経緯

1. Dawn商品ページで最小proofが成功した。
2. `QuoteRequest` にDraft Order連携用フィールドを追加した。
3. quote detail画面に `Draft Orderを作成` ボタンを追加した。
4. Admin GraphQL APIの `draftOrderCreate` を実装した。
5. `write_draft_orders` scopeを追加した。
6. Shopify app configをdeployし、dev appのscopeへ反映した。
7. React Router UI actionのBad Requestを回避するため、Draft Order操作をresource route POSTへ切り替えた。
8. GraphQL errorを画面へ安全に表示できるようにした。
9. Protected customer data設定後、Draft Order作成が成功した。

## Protected Customer Data

Draft Order作成には `write_draft_orders` scopeだけでは不十分だった。

Shopify GraphQLは以下のエラーを返した。

```text
This app is not approved to access the DraftOrder object.
```

対応内容:

- Partner DashboardでProtected customer data accessを設定した。
- Draft Order関連のProtected Customer Data利用を有効化した。
- 今回のmutationではquoteの `email` をDraft Order inputへ渡すため、Email fieldが必要。

この設定はコードだけでは解決できず、Partner Dashboard側の人間操作が必要。

## Partner Dashboardで選択した用途/fields

今回の検証で必要になったもの:

- 用途: Draft Order作成のためのOrders/Draft Orders関連データ利用。
- field: Email。

本番前には、Partner Dashboard上で実際に選択した用途とfieldsを再確認し、アプリ審査向けの説明文と一致させること。

## まだ人間が確認すべきこと

- Shopify Admin > 注文管理 > 下書き でDraft Order実体が存在すること。
- Draft Orderのline itemの商品/variant/数量が見積依頼と一致すること。
- email / note / customAttributes が業務上妥当であること。
- 同じquoteで二重作成されないこと。
- quote detailに保存されたDraft Order ID/Name/Admin URLが正しいこと。
- statusが `QUOTE_CREATED` へ更新されていること。

## Production-readyではない理由

今回の成功はdev store上の小スパイク成功。

未完成:

- Draft Orderの中身の業務妥当性確認。
- invoice送信。
- Draft Order complete。
- PDF生成/見積書プレビュー。
- email通知。
- Billing。
- App Store listing。
- 本番DB。
- 本番deploy。
- App Proxy signature厳密化。
- 診断ボタンのdev-only化または削除。
- protected customer data利用説明の本番向け整理。

## 次に実装するべき順番

1. Draft Order中身の業務妥当性確認。
2. 同一quoteの二重作成防止を実ストアで確認し、必要ならDB制約または追加guardを強化する。
3. 診断ボタンをdev-only化または削除する。
4. Draft Order detail表示を業務確認しやすい最小UIに整える。
5. email通知を追加する。
6. PDF生成/見積書プレビューを追加する。
7. invoice送信を検証する。
8. Draft Order complete/決済処理は最後に別スパイクで扱う。
9. Billing/App Store listing/本番DB/本番deployを本番準備フェーズで進める。

## 現時点の判断

Draft Order作成スパイクは成功。

ただし、下書き注文の実体内容と業務データの妥当性確認が終わるまでは、次の大きな機能へ進まない。
