# B2B Quote Flow JP Dawn Proof Success

Last updated: 2026-06-14

## 1. 結論

Dawnの商品ページ上で、B2B Quote Flow JPの最小proofは成功した。

商品ページの商品情報セクションにTheme App Extension blockを配置し、法人見積ボタンからモーダルを開き、フォーム送信後にquote requestが保存され、Admin app側のNEW quote list/detailで確認できるところまで到達した。

これはローカルデモではなく、Dawn商品ページ上のTheme App Extension blockを入口にした実Shopify app flowの最小成功である。

## 2. 確認済みの成功内容

- Dawnの商品ページの商品情報セクションにTheme App Extension blockを配置できた。
- 商品ページ上に法人見積ボタンが表示された。
- 法人見積ボタンからモーダルが開いた。
- モーダル内フォームへ入力できた。
- フォーム送信後に「見積依頼を受け付けました」と表示された。
- quote requestが保存された。
- Admin appのNEW quote listに保存済みquoteが表示された。
- quote detail画面を開けた。
- collectionページに誤って配置したApp Blockは削除済み。

## 3. 現在できている最小フロー

```text
Dawn product page
  ↓
Theme App Extension block
  ↓
法人見積ボタン
  ↓
モーダル
  ↓
会社名/担当者/メール/数量/備考を入力
  ↓
POST /apps/b2b-quote/api/b2b-quote/requests
  ↓
quote request保存
  ↓
Admin app NEW quote list
  ↓
quote detail
```

## 4. 未完成項目

- Draft Order連携。
- PDF生成/見積書プレビュー。
- Billing。
- App Store listing。
- 本番DB。
- 本番deploy。
- root login formのBad Request known issue。
- App Proxy signature検証の厳密化。
- variant切り替え時のvariantId追従。
- email通知。
- admin status update改善。

## 5. 次にやるべき順番

1. App Proxy signature検証の厳密化。
   StorefrontからのPOST入口なので、まず信頼境界を固める。

2. variant切り替え時のvariantId追従。
   見積依頼の対象商品/variantがずれると業務データとして致命的になるため、早めに潰す。

3. admin status update改善。
   NEW quoteを受けた後の運用フローを最低限回せる状態にする。

4. email通知。
   マーチャントが管理画面を見に行かなくても依頼に気づけるようにする。

5. Draft Order連携。
   保存されたquoteをShopify上の実オペレーションへ接続する。

6. PDF生成/見積書プレビュー。
   Draft Order連携後に、見積書として顧客へ渡せる表現を整える。

7. 本番DB。
   SQLite/dev DBから本番運用できるDBへ移行する。

8. 本番deploy。
   本番DBと環境変数を固めた後に実施する。

9. root login formのBad Request known issue。
   App Store審査や初回導入体験に影響するため、本番deploy前後で解消する。

10. Billing。
    無料検証フローが安定してから課金導線を追加する。

11. App Store listing。
    機能、課金、サポート、スクリーンショット、本番URLが揃ってから着手する。

## 6. 現時点の評価

最小proofとしては成功。

ただし、まだproduction-readyではない。特に、App Proxy署名、variant追従、通知、Draft Order、本番DB、本番deploy、Billingが未完成であるため、現段階では「Dawn上で商品ページ見積依頼が保存されることを証明できた状態」と扱う。
