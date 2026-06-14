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
      '<div class="b2b-quote-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="b2b-quote-title">' +
      '<div class="b2b-quote-modal__header">' +
      '<h2 class="b2b-quote-modal__title" id="b2b-quote-title"></h2>' +
      '<button class="b2b-quote-modal__close" type="button" aria-label="閉じる" data-b2b-quote-close>&times;</button>' +
      "</div>" +
      '<p class="b2b-quote-product"></p>' +
      '<form class="b2b-quote-form">' +
      '<label>会社名<input name="companyName" autocomplete="organization" required></label>' +
      '<label>担当者名<input name="contactName" autocomplete="name" required></label>' +
      '<label>メールアドレス<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>数量<input name="quantity" type="number" min="1" value="1" required></label>' +
      '<label>備考<textarea name="customerNote"></textarea></label>' +
      '<div class="b2b-quote-form__checks">' +
      '<label><input name="wantsInvoicePayment" type="checkbox">請求書払いについて相談したい</label>' +
      '<label><input name="needsApprovalPdf" type="checkbox">稟議用PDFを希望する</label>' +
      "</div>" +
      '<button class="b2b-quote-submit" type="submit">送信する</button>' +
      '<div class="b2b-quote-status" role="status" aria-live="polite"></div>' +
      "</form>" +
      "</div>";

    setText(modal.querySelector(".b2b-quote-modal__title"), "法人見積を依頼");
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
            "送信レスポンスを解析できませんでした。status=" +
              response.status +
              " content-type=" +
              contentType +
              " body=" +
              responseText,
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
            : "送信できませんでした。status=" +
                response.status +
                " content-type=" +
                contentType +
                " body=" +
                responseText,
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
        setText(status, "見積依頼を受け付けました。");
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
