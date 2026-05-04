// Wires up the toolbar's "copy markdown source" button. The source is
// inlined into the page as JSON inside #mdbrowse-source so this can run
// without a network round trip.
(function () {
  function readSource() {
    var node = document.getElementById("mdbrowse-source");
    if (!node) return null;
    try {
      return JSON.parse(node.textContent || "");
    } catch (e) {
      return null;
    }
  }

  function flashCopied(button) {
    var icon = button.querySelector(".copy-source-toggle-icon");
    var originalGlyph = icon ? icon.textContent : null;
    button.classList.add("is-copied");
    if (icon) icon.textContent = "✓";
    button.setAttribute("title", "Copied!");
    setTimeout(function () {
      button.classList.remove("is-copied");
      if (icon && originalGlyph !== null) icon.textContent = originalGlyph;
      button.setAttribute("title", "Copy markdown source");
    }, 1200);
  }

  function copyViaTextarea(text) {
    // Fallback for browsers without async clipboard API access (e.g.
    // older Safari over plain http on a non-localhost LAN address).
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
  }

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.getElementById("copy-source-toggle");
    if (!button) return;
    var source = readSource();
    if (source === null) return;

    button.addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(source).then(
          function () {
            flashCopied(button);
          },
          function () {
            copyViaTextarea(source);
            flashCopied(button);
          },
        );
      } else {
        copyViaTextarea(source);
        flashCopied(button);
      }
    });
  });
})();
