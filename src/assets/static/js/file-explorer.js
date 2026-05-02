(function () {
  var STORAGE_KEY = "go-grip-explorer";
  var DESKTOP_MIN = 768;

  function isDesktop() {
    return window.matchMedia("(min-width: " + DESKTOP_MIN + "px)").matches;
  }

  function getPreference() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "open" || stored === "closed") return stored;
    } catch (e) {}
    return isDesktop() ? "open" : "closed";
  }

  function applyState(state) {
    if (state === "open") {
      document.body.classList.add("explorer-open");
    } else {
      document.body.classList.remove("explorer-open");
    }
    try {
      localStorage.setItem(STORAGE_KEY, state);
    } catch (e) {}
  }

  function toggle() {
    applyState(getPreference() === "open" ? "closed" : "open");
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("file-explorer")) {
      // Still drop preload so other transitions (theme toggle) work.
      requestAnimationFrame(function () {
        document.documentElement.classList.remove("preload");
      });
      return;
    }

    applyState(getPreference());

    // After the initial state has been applied and the next frame paints,
    // re-enable transitions so deliberate toggles animate normally.
    requestAnimationFrame(function () {
      document.documentElement.classList.remove("preload");
    });

    var btn = document.getElementById("explorer-toggle");
    if (btn) btn.addEventListener("click", toggle);

    var backdrop = document.getElementById("explorer-backdrop");
    if (backdrop) backdrop.addEventListener("click", function () { applyState("closed"); });

    // Auto-close on file-link click in mobile so the page navigates without
    // leaving the overlay covering the new content.
    var explorer = document.getElementById("file-explorer");
    if (explorer) {
      explorer.addEventListener("click", function (e) {
        var target = e.target;
        if (target && target.tagName === "A" && !isDesktop()) {
          applyState("closed");
        }
      });
    }
  });
})();
