/** GET / — Steam ID + country → download `.widgy` for Widgy import. */

import { SETUP_PAGE_COUNTRY_CODES } from "./steam/currency-from-country";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function countrySelectOptionsHtml(): string {
  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  return SETUP_PAGE_COUNTRY_CODES.map((code) => {
    let label = code;
    try {
      const name = regionNames.of(code);
      if (name) label = `${name} (${code})`;
    } catch {
      /* non-ISO or unsupported in this runtime */
    }
    const selected = code === "US" ? " selected" : "";
    return `<option value="${code}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

export function widgySetupPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Steam · Widgy</title>
  <style>
    :root {
      font-family: system-ui, sans-serif;
      --bg: #0c0e12;
      --border: #252a34;
      --muted: #8b939e;
      --text: #e8ecf1;
      --btn: #2a323c;
      color-scheme: dark;
      background: var(--bg);
      color: var(--text);
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100dvh; padding: 1rem; }
    .wrap { max-width: 22rem; margin: 0 auto; }
    h1 { font-size: 1.2rem; font-weight: 600; margin: 0 0 1rem; }
    label {
      display: block;
      margin-top: 0.65rem;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    label:first-of-type { margin-top: 0; }
    input {
      font: inherit;
      width: 100%;
      margin-top: 0.35rem;
      padding: 0.55rem 0.65rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #0e1116;
      color: var(--text);
    }
    input:focus,
    select:focus { outline: 2px solid #4a5568; outline-offset: 1px; }
    select {
      font: inherit;
      width: 100%;
      margin-top: 0.35rem;
      padding: 0.55rem 0.65rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #0e1116;
      color: var(--text);
    }
    .actions { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    button {
      font: inherit;
      cursor: pointer;
      width: 100%;
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--btn);
      color: var(--text);
      font-weight: 600;
    }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .hint {
      font-size: 0.8rem;
      color: var(--muted);
      line-height: 1.4;
      margin-top: 0.65rem;
    }
    .hint a { color: #b8c0cc; }
    .hint a:hover { color: var(--text); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Widgy import</h1>

    <form id="f" onsubmit="return false">
      <label for="steamid">Steam ID</label>
      <input id="steamid" name="steamid" inputmode="numeric" maxlength="17" placeholder="76561198901234567" autocomplete="off" />

      <label for="country">Country</label>
      <select id="country" name="country" autocomplete="country">
        ${countrySelectOptionsHtml()}
      </select>
    </form>

    <div class="actions">
      <button type="button" id="downloadWidgy" disabled>Download</button>
    </div>
    <p class="hint">Open the downloaded file in the Widgy app.</p>
    <p class="hint">Need the app? <a href="https://apps.apple.com/app/id1524540481" rel="noopener noreferrer">Install Widgy from the App Store</a> (iPhone / iPad).</p>
  </div>

  <script>
(function () {
  var steamEl = document.getElementById("steamid");
  var countryEl = document.getElementById("country");
  var dlBtn = document.getElementById("downloadWidgy");

  function base() {
    var o = location.origin;
    return o.endsWith("/") ? o.slice(0, -1) : o;
  }

  function widgyFileUrl() {
    var sid = (steamEl.value || "").trim();
    var cc = (countryEl.value || "US").trim().toUpperCase();
    if (!/^[0-9]{17}$/.test(sid)) return null;
    if (!cc || !countryEl.querySelector('option[value="' + cc + '"]')) return null;
    var q = "steamid=" + encodeURIComponent(sid) + "&country=" + encodeURIComponent(cc.toUpperCase());
    return base() + "/widgy-import.widgy?" + q;
  }

  function update() {
    dlBtn.disabled = !widgyFileUrl();
  }

  steamEl.addEventListener("input", update);
  countryEl.addEventListener("change", update);
  dlBtn.addEventListener("click", function () {
    var u = widgyFileUrl();
    if (!u) return;
    var a = document.createElement("a");
    a.href = u;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  var sp = new URLSearchParams(location.search);
  if (sp.get("steamid")) steamEl.value = sp.get("steamid");
  if (sp.get("country")) {
    var want = sp.get("country").trim().toUpperCase();
    if (countryEl.querySelector('option[value="' + want + '"]')) countryEl.value = want;
  }
  update();
})();
  </script>
</body>
</html>`;
}
