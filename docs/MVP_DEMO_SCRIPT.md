# B2B Quote Flow JP MVP Demo Script

Last updated: 2026-06-14

## 1. 想定マーチャント向けの一文説明

B2B Quote Flow JPは、商品ページから法人見積依頼を受け付け、Shopify Adminで内容を確認し、その依頼をDraft OrderへつなげられるShopify appです。

## 2. 現在のMVPで見せられること

- Dawnの商品ページに法人見積ボタンを表示できる。
- ボタンから見積依頼モーダルを開ける。
- 会社名、担当者、メール、数量、備考、請求書払い相談、稟議PDF希望を入力できる。
- 見積依頼を保存できる。
- Shopify Admin appでquote list/detailを確認できる。
- quote detailからShopify Draft Orderを作成できる。
- Draft Order作成済み状態、ID、Name、管理画面リンクを表示できる。
- 同じquoteからの二重作成を防止できる。
- Draft Order作成に必要なProtected Customer Data設定はdev storeで確認済み。

## 3. 3分デモ手順

### 0:00-0:20 導入

説明すること:

「このアプリは、B2B購入者が商品ページから見積依頼を送り、マーチャントがShopify Admin内で依頼を見て、そのままDraft Orderを作れるかを検証するMVPです。」

見せる画面:

- Dawnの商品ページ。
- 商品情報セクション内の法人見積ボタン。

### 0:20-0:55 Storefrontから見積依頼

操作:

1. 商品ページの法人見積ボタンを押す。
2. モーダルを開く。
3. 会社名、担当者名、メール、数量、備考を入力する。
4. 請求書払い相談と稟議PDF希望を必要に応じて選ぶ。
5. 送信する。

確認すること:

- storefront上に「見積依頼を受け付けました。」が表示される。
- B2B購入者はcartやcheckoutへ進まずに、法人見積依頼を送れる。

### 0:55-1:30 Adminで依頼確認

操作:

1. Shopify Admin appのquote listを開く。
2. 送信したquoteが一覧に出ていることを見せる。
3. quote detailを開く。

確認すること:

- company、contact、email、product、variant、quantityが見える。
- 請求書払い相談、稟議PDF希望、備考が見える。
- マーチャントが商品ページから届いた依頼をAdmin内で確認できる。

### 1:30-2:20 Draft Order作成

操作:

1. quote detailで`Draft Orderを作成`を押す。
2. 成功メッセージを確認する。
3. Draft Order ID、Name、管理画面リンク、`QUOTE_CREATED` statusを確認する。
4. Shopify AdminのDraft Order画面を開く。

確認すること:

- quoteからShopify-nativeなDraft Orderへ接続できる。
- 商品、variant、数量、顧客メール、note、customAttributesが確認対象になる。
- 作成後は再作成ボタンが出ず、二重作成を防止できる。

### 2:20-3:00 制限とヒアリングへの接続

説明すること:

「現時点では、見積依頼の受付からDraft Order作成までの業務仮説を検証するMVPです。まだ本番販売用ではありません。ここから確認したいのは、マーチャントがこの導線を本当に使うか、どの情報が足りないか、Draft Orderに渡す内容が業務に合っているかです。」

聞くこと:

- 「この流れなら、今の法人見積対応のどの部分が楽になりそうですか」
- 「逆に、このままだと使えない点はどこですか」

## 4. 現在の価値仮説

主仮説:

商品ページ上のB2B購入意欲を逃さず、Shopify Admin内のDraft Order作成までつなげることで、マーチャントの法人見積対応の初動を短縮できる。

補助仮説:

- B2B購入者はcheckout前に、数量、請求書払い、社内稟議、見積書の相談をしたい。
- マーチャントはメールや問い合わせフォームではなく、商品、variant、数量が紐づいた状態で依頼を受けたい。
- Draft Orderへ変換できれば、見積対応がShopifyの注文管理フローに近づく。
- `請求書払い相談`と`稟議PDF希望`は、B2B商談の温度感を測る入力として有用。
- 最初からPDFや決済完了まで作るより、quote受付とDraft Order接続の価値を先に検証した方が速い。

## 5. まだ売ってはいけない理由

このMVPはユーザーテストや販売前ヒアリングには使えるが、まだ有料販売や本番運用に出す段階ではない。

理由:

- App Proxy signature検証が本番向けに厳密化されていない。
- 現在のDBはdev SQLiteで、本番運用DBではない。
- Draft Orderのline item、顧客メール、note、customAttributesの業務妥当性確認が完了していない。
- Dawn以外のテーマや商品フォームでvariant追従が安定するか未確認。
- email通知がなく、マーチャントが依頼に気づかない可能性がある。
- quote status運用がまだ最小実装で、業務フローとしては粗い。
- PDF生成、invoice送信、Draft Order completeは未実装。
- BillingとApp Store listingが未整備。
- Protected Customer Data利用説明を本番審査向けに整理する必要がある。
- 自動テストと本番deploy手順が未整備。

## 6. ユーザーテストで聞くべき質問

1. 現在、法人見積依頼はどのチャネルで受けていますか。
2. 商品ページから見積依頼できる導線は、自社の購入者にとって自然ですか。
3. 見積依頼フォームに足りない項目、不要な項目はありますか。
4. 会社名、担当者、メール、数量、備考だけで初回対応できますか。
5. `請求書払い相談`と`稟議PDF希望`は業務判断に役立ちますか。
6. Adminのquote list/detailで、最初に見たい情報は何ですか。
7. quoteからDraft Orderを作れることは、現在の見積対応を短縮しますか。
8. Draft Orderのnote/customAttributesに入れるべき情報は何ですか。
9. 見積依頼が届いたとき、誰に、どの方法で通知されるべきですか。
10. 有料で使うなら、最低限どの機能と信頼性が必要ですか。

## 7. 次に実装するなら何を優先するか

### 必須

販売や本番ユーザーテストに近づけるため、次に優先するもの。

1. App Proxy signature検証の本番向け厳密化。
2. Draft Order実体の業務妥当性確認。
3. Dawn以外も含めたvariant追従の安定化。
4. email通知またはAdmin内通知の最小実装。
5. quote status運用の整理。
6. 本番DB移行方針の決定。
7. Protected Customer Data利用説明の本番審査向け整理。
8. 診断ボタンを完全削除するかdev-only内部診断として残すかの最終判断。

### 後回し

価値検証後でよいもの。

1. PDF生成。
2. Draft Order invoice送信。
3. Draft Order complete。
4. Billing。
5. App Store listing。
6. 大規模UI改善。
7. 高度な見積承認ワークフロー。
8. 複数担当者、権限、通知ルールの細分化。
9. CRM連携。
10. 分析ダッシュボード。

## 8. デモ時の注意

- 「販売可能な完成品」ではなく「見積受付からDraft Order接続までのMVP」と説明する。
- PDF、invoice送信、Draft Order complete、Billingはまだ見せない。
- secretや環境変数の値は画面共有や資料に出さない。
- Draft Order作成後はShopify Admin > 注文管理 > 下書きで実体を確認する。
- 失敗した場合は新機能実装へ進まず、既存proofが壊れていないかを先に確認する。
