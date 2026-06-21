(function () {
  function text(value) {
    return value == null ? "" : String(value);
  }

  function setText(node, value) {
    node.textContent = text(value);
  }

  function updateVariantContext(root) {
    var variantInput = document.querySelector('form[action*="/cart/add"] [name="id"]');
    if (variantInput && variantInput.value) {
      root.dataset.variantId = variantInput.value;
    }
  }

  function createModal(root) {
    var modal = document.createElement("div");
    modal.className = "b2b-quote-modal";
    modal.hidden = true;

    var productTitle = text(root.dataset.productTitle);
    var variantTitle = text(root.dataset.variantTitle);

    modal.innerHTML =
      '<div class="b2b-quote-modal__backdrop" data-b2b-quote-close></div>' +
      '<div class="b2b-quote-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="b2b-quote-title" aria-describedby="b2b-quote-description">' +
      '<div class="b2b-quote-modal__header">' +
      '<div>' +
      '<h2 class="b2b-quote-modal__title" id="b2b-quote-title"></h2>' +
      '<p class="b2b-quote-modal__description" id="b2b-quote-description"></p>' +
      '</div>' +
      '<button class="b2b-quote-modal__close" type="button" aria-label="閉じる" data-b2b-quote-close>&times;</button>' +
      "</div>" +
      '<p class="b2b-quote-product"></p>' +
      '<form class="b2b-quote-form">' +
      '<label><span>会社名 <span class="b2b-quote-required">必須</span></span><input name="companyName" autocomplete="organization" placeholder="株式会社サンプル" required></label>' +
      '<label><span>担当者名 <span class="b2b-quote-required">必須</span></span><input name="contactName" autocomplete="name" placeholder="山田 太郎" required></label>' +
      '<label><span>メールアドレス <span class="b2b-quote-required">必須</span></span><input name="email" type="email" autocomplete="email" placeholder="sales@example.com" required></label>' +
      '<label><span>数量 <span class="b2b-quote-required">必須</span></span><input name="quantity" type="number" min="1" value="1" inputmode="numeric" required></label>' +
      '<label><span>備考</span><textarea name="customerNote" placeholder="希望納期、数量条件、請求書払いの相談内容など"></textarea></label>' +
      '<div class="b2b-quote-form__checks">' +
      '<label><input name="wantsInvoicePayment" type="checkbox">請求書払いについて相談したい</label>' +
      '<label><input name="needsApprovalPdf" type="checkbox">社内稟議用の見積書が必要</label>' +
      "</div>" +
      '<button class="b2b-quote-submit" type="submit">見積依頼を送信</button>' +
      '<div class="b2b-quote-status" role="status" aria-live="polite"></div>' +
      "</form>" +
      "</div>";

    setText(
      modal.querySelector(".b2b-quote-modal__title"),
      root.dataset.modalTitle || "法人・まとめ買いの見積依頼",
    );
    setText(
      modal.querySelector(".b2b-quote-modal__description"),
      root.dataset.modalDescription ||
        "商品、数量、ご希望条件を店舗へ送信します。担当者が内容を確認してご連絡します。",
    );
    setText(
      modal.querySelector(".b2b-quote-product"),
      variantTitle && variantTitle !== "Default Title"
        ? productTitle + " / " + variantTitle
        : productTitle,
    );

    modal.addEventListener("click", function (event) {
      if (event.target && event.target.hasAttribute("data-b2b-quote-close")) {
        modal.hidden = true;
      }
    });

    modal.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      submitQuote(root, modal);
    });

    document.body.appendChild(modal);
    return modal;
  }

  function fieldValue(form, name) {
    var field = form.elements[name];
    return field ? field.value : "";
  }

  function fieldChecked(form, name) {
    var field = form.elements[name];
    return Boolean(field && field.checked);
  }

  function parseQuoteResponse(response) {
    var contentType = response.headers.get("content-type") || "";

    return response.text().then(function (responseText) {
      var body = null;

      if (responseText) {
        try {
          body = JSON.parse(responseText);
        } catch (error) {
          var debug = {
            status: response.status,
            contentType: contentType,
            responseText: responseText,
          };

          console.error("B2B quote response was not valid JSON", debug, error);

          throw new Error(
            "送信結果を確認できませんでした。時間をおいて再度お試しください。",
          );
        }
      }

      if (!response.ok || !body || body.ok !== true) {
        console.error("B2B quote request failed", {
          status: response.status,
          contentType: contentType,
          responseText: responseText,
          body: body,
        });

        throw new Error(
          body && body.error
            ? body.error
            : "送信できませんでした。入力内容を確認し、時間をおいて再度お試しください。",
        );
      }

      return body;
    });
  }

  function submitQuote(root, modal) {
    updateVariantContext(root);

    var form = modal.querySelector("form");
    var status = modal.querySelector(".b2b-quote-status");
    var submit = modal.querySelector(".b2b-quote-submit");
    var endpoint = root.dataset.submitEndpointPath || "/apps/b2b-quote/api/b2b-quote/requests";

    status.dataset.state = "";
    setText(status, "送信中です...");
    submit.disabled = true;

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        shop: root.dataset.shop,
        productId: root.dataset.productId,
        variantId: root.dataset.variantId,
        productTitle: root.dataset.productTitle,
        variantTitle: root.dataset.variantTitle,
        productUrl: root.dataset.productUrl,
        companyName: fieldValue(form, "companyName"),
        contactName: fieldValue(form, "contactName"),
        email: fieldValue(form, "email"),
        quantity: fieldValue(form, "quantity"),
        customerNote: fieldValue(form, "customerNote"),
        wantsInvoicePayment: fieldChecked(form, "wantsInvoicePayment"),
        needsApprovalPdf: fieldChecked(form, "needsApprovalPdf"),
      }),
    })
      .then(function (response) {
        return parseQuoteResponse(response);
      })
      .then(function () {
        status.dataset.state = "success";
        setText(status, "見積依頼を受け付けました。担当者よりご連絡します。");
        form.reset();
      })
      .catch(function (error) {
        status.dataset.state = "error";
        setText(status, error.message || "送信できませんでした。");
      })
      .finally(function () {
        submit.disabled = false;
      });
  }

  function boot(root) {
    if (root.dataset.b2bQuoteReady === "true") return;
    root.dataset.b2bQuoteReady = "true";

    var modal = createModal(root);
    var button = root.querySelector("[data-b2b-quote-open]");

    if (button) {
      button.addEventListener("click", function () {
        updateVariantContext(root);
        modal.hidden = false;
      });
    }
  }

  document.querySelectorAll("[data-b2b-quote-root]").forEach(boot);
})();
