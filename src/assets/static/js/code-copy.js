// Adds a "copy code" button to the top-right corner of every shiki-rendered
// `<pre>` block. Mermaid pre blocks (class="mermaid") are skipped; they get
// replaced with SVG by mermaid-init.js anyway.
(function () {
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
    return Promise.resolve();
  }

  function flashCopied(button) {
    var icon = button.querySelector(".code-copy-icon");
    var originalGlyph = icon ? icon.textContent : null;
    button.classList.add("is-copied");
    if (icon) icon.textContent = "✓";
    button.setAttribute("title", "Copied!");
    setTimeout(function () {
      button.classList.remove("is-copied");
      if (icon && originalGlyph !== null) icon.textContent = originalGlyph;
      button.setAttribute("title", "Copy code");
    }, 1200);
  }

  function attach(pre) {
    if (pre.dataset.codeCopyAttached === "1") return;
    pre.dataset.codeCopyAttached = "1";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.title = "Copy code";
    button.setAttribute("aria-label", "Copy code");
    var icon = document.createElement("span");
    icon.className = "code-copy-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⧉";
    button.appendChild(icon);

    button.addEventListener("click", function (e) {
      e.preventDefault();
      var code = pre.querySelector("code");
      var text = (code ? code.textContent : pre.textContent) || "";
      copyText(text).then(function () {
        flashCopied(button);
      });
    });

    pre.appendChild(button);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pres = document.querySelectorAll(".markdown-body pre.shiki");
    for (var i = 0; i < pres.length; i++) attach(pres[i]);
  });
})();
