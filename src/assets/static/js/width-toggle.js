(function () {
  var STORAGE_KEY = "go-grip-width";
  var MODES = ["narrow", "wide"];

  function getPreference() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && MODES.indexOf(stored) !== -1) return stored;
    } catch (e) {}
    return "narrow";
  }

  function applyMode(mode) {
    if (mode === "wide") {
      document.body.classList.add("wide");
    } else {
      document.body.classList.remove("wide");
    }

    updateIcon(mode);

    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {}
  }

  function updateIcon(mode) {
    var btn = document.getElementById("width-toggle");
    if (!btn) return;
    var icon = btn.querySelector(".width-toggle-icon");
    if (!icon) return;

    if (mode === "wide") {
      icon.textContent = "⇹";
      btn.title = "Width: Wide";
    } else {
      icon.textContent = "⤢";
      btn.title = "Width: Narrow";
    }
  }

  function toggle() {
    var current = getPreference();
    applyMode(current === "narrow" ? "wide" : "narrow");
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyMode(getPreference());

    var btn = document.getElementById("width-toggle");
    if (btn) {
      btn.addEventListener("click", toggle);
    }
  });
})();
