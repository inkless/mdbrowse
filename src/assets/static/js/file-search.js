(function () {
  "use strict";

  var indexEl = document.getElementById("mdbrowse-file-index");
  if (!indexEl) return;

  /** @type {{ path: string; name: string }[]} */
  var entries;
  try {
    entries = JSON.parse(indexEl.textContent || "[]");
  } catch (e) {
    console.error("[mdbrowse] failed to parse file index:", e);
    return;
  }
  if (!Array.isArray(entries) || entries.length === 0) return;

  var MAX_RESULTS = 50;
  var dialog = buildDialog();
  document.body.appendChild(dialog);

  var input = dialog.querySelector(".mdbrowse-search__input");
  var resultsEl = dialog.querySelector(".mdbrowse-search__results");
  var emptyEl = dialog.querySelector(".mdbrowse-search__empty");
  var selectedIdx = 0;
  /** @type {{ path: string; name: string }[]} */
  var current = entries.slice(0, MAX_RESULTS);

  // Open shortcut: Cmd+K (mac) or Ctrl+K (everyone else).
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (dialog.open) dialog.close();
      else openDialog();
    }
  });

  var toggle = document.getElementById("search-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      if (dialog.open) dialog.close();
      else openDialog();
    });
  }

  input.addEventListener("input", function () {
    refresh(input.value);
  });

  // Keyboard navigation inside the dialog.
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigateToSelected();
    }
    // Escape is handled natively by <dialog>.
  });

  resultsEl.addEventListener("click", function (e) {
    var li = e.target instanceof Element ? e.target.closest("li") : null;
    if (!li) return;
    var path = li.getAttribute("data-path");
    if (path) location.assign(path);
  });

  function openDialog() {
    input.value = "";
    refresh("");
    dialog.showModal();
    requestAnimationFrame(function () {
      input.focus();
    });
  }

  function refresh(query) {
    current = filter(entries, query, MAX_RESULTS);
    selectedIdx = 0;
    render();
  }

  function render() {
    resultsEl.innerHTML = "";
    if (current.length === 0) {
      emptyEl.hidden = false;
      resultsEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    resultsEl.hidden = false;
    for (var i = 0; i < current.length; i++) {
      var entry = current[i];
      var li = document.createElement("li");
      li.className = "mdbrowse-search__result";
      li.setAttribute("role", "option");
      li.setAttribute("data-path", entry.path);
      if (i === selectedIdx) li.setAttribute("aria-selected", "true");

      var name = document.createElement("div");
      name.className = "mdbrowse-search__result-name";
      name.textContent = entry.name;
      li.appendChild(name);

      var path = document.createElement("div");
      path.className = "mdbrowse-search__result-path";
      path.textContent = entry.path;
      li.appendChild(path);

      resultsEl.appendChild(li);
    }
    scrollSelectedIntoView();
  }

  function moveSelection(delta) {
    if (current.length === 0) return;
    selectedIdx = (selectedIdx + delta + current.length) % current.length;
    var rows = resultsEl.querySelectorAll("li");
    for (var i = 0; i < rows.length; i++) {
      if (i === selectedIdx) rows[i].setAttribute("aria-selected", "true");
      else rows[i].removeAttribute("aria-selected");
    }
    scrollSelectedIntoView();
  }

  function scrollSelectedIntoView() {
    var sel = resultsEl.querySelector('li[aria-selected="true"]');
    if (sel && typeof sel.scrollIntoView === "function") {
      sel.scrollIntoView({ block: "nearest" });
    }
  }

  function navigateToSelected() {
    var entry = current[selectedIdx];
    if (entry) location.assign(entry.path);
  }

  /**
   * fzf-style subsequence match against the full path. Empty query
   * returns the first `limit` entries unchanged.
   */
  function filter(all, query, limit) {
    if (!query) return all.slice(0, limit);
    var q = query.toLowerCase();
    var scored = [];
    for (var i = 0; i < all.length; i++) {
      var entry = all[i];
      var s = score(entry.path.toLowerCase(), q, entry.name.length);
      if (s > -Infinity) scored.push({ entry: entry, score: s });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.path.length - b.entry.path.length;
    });
    var out = [];
    for (var j = 0; j < Math.min(limit, scored.length); j++) out.push(scored[j].entry);
    return out;
  }

  /**
   * Subsequence score. Returns -Infinity when `q` is not a subsequence of
   * `path`. Otherwise: bonus 5 per query char that lands in the basename
   * (the trailing `basenameLen` chars of `path`); penalty 1 per gap
   * between matched characters. Higher is better.
   *
   * Exported on `window.__mdbrowseSearch` so unit tests in node can pull
   * the same implementation via JSDOM if we ever want to.
   */
  function score(path, q, basenameLen) {
    var pi = 0,
      qi = 0,
      gaps = 0,
      bonus = 0;
    while (pi < path.length && qi < q.length) {
      if (path[pi] === q[qi]) {
        if (pi >= path.length - basenameLen) bonus += 5;
        qi++;
      } else {
        gaps++;
      }
      pi++;
    }
    if (qi !== q.length) return -Infinity;
    return bonus - gaps;
  }

  // Expose for tests.
  window.__mdbrowseSearch = { filter: filter, score: score };

  function buildDialog() {
    var d = document.createElement("dialog");
    d.className = "mdbrowse-search";
    d.innerHTML =
      '<div class="mdbrowse-search__input-row">' +
      '<input class="mdbrowse-search__input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type to search files…" aria-label="Search files" />' +
      '<span class="mdbrowse-search__hint">Esc to close</span>' +
      "</div>" +
      '<ul class="mdbrowse-search__results" role="listbox"></ul>' +
      '<div class="mdbrowse-search__empty" hidden>No matches</div>';
    return d;
  }
})();
