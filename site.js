// Palette used for ASCII glyphs AND cycling link color
const PALETTE = [
  "#ff4d4d",
  "#ff9f1c",
  "#ffd60a",
  "#2ec4b6",
  "#3a86ff",
  "#8338ec",
  "#ff006e",
];

function invertHex(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (
    "#" +
    (255 - r).toString(16).padStart(2, "0") +
    (255 - g).toString(16).padStart(2, "0") +
    (255 - b).toString(16).padStart(2, "0")
  );
}

function setAccentByIndex(i) {
  const idx = ((i % PALETTE.length) + PALETTE.length) % PALETTE.length;
  const accent = PALETTE[idx];

  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accentOpp", invertHex(accent));

  localStorage.setItem("accentIndex", String(idx));
  return idx;
}

function escapeHtml(ch) {
  if (ch === "&") return "&amp;";
  if (ch === "<") return "&lt;";
  if (ch === ">") return "&gt;";
  return ch;
}

/**
 * "One unified color per big ASCII letter"
 *
 * Practical approach for FIGlet-like ASCII:
 * - Treat each column as "ink" if ANY row has a non-space char in that column.
 * - Split into contiguous ink-runs (separated by fully-blank columns).
 * - Each run gets one color (palette alternates).
 *
 * This matches the idea of "letters" made of multiple characters across multiple lines.
 */
function renderAsciiByColumnRuns(preEl, palette, offset = 0) {
  const raw = preEl.textContent.replace(/\r\n/g, "\n");
  let lines = raw.split("\n");

  // Drop trailing fully-empty last line (common when <pre> ends with newline)
  if (lines.length && lines[lines.length - 1].trim() === "" && lines[lines.length - 1].length === 0) {
    lines = lines.slice(0, -1);
  }

  const rows = lines.length;
  const cols = Math.max(...lines.map(l => l.length), 0);

  const grid = lines.map(l => l.padEnd(cols, " ").split(""));

  // Which columns contain ink?
  const colHasInk = Array(cols).fill(false);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] !== " ") { colHasInk[c] = true; break; }
    }
  }

  // Build column-run segments
  const colToSeg = Array(cols).fill(-1);
  let seg = -1;
  for (let c = 0; c < cols; c++) {
    if (colHasInk[c]) {
      if (c === 0 || !colHasInk[c - 1]) seg++;
      colToSeg[c] = seg;
    }
  }

  // Render HTML with data-seg on each non-space char
  let html = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      if (ch === " ") {
        html += " ";
        continue;
      }
      const s = colToSeg[c];
      const color = palette[((s >= 0 ? s : 0) + offset) % palette.length];
      html += `<span class="ch" data-seg="${s}" style="color:${color}">${escapeHtml(ch)}</span>`;
    }
    if (r < rows - 1) html += "\n";
  }

  preEl.innerHTML = html;
}

function recolorAsciiBySeg(preEl, palette, offset = 0) {
  const spans = preEl.querySelectorAll(".ch[data-seg]");
  for (const s of spans) {
    const seg = Number(s.dataset.seg);
    const idx = ((seg >= 0 ? seg : 0) + offset) % palette.length;
    s.style.color = palette[idx];
  }
}

function markActiveNav() {
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const links = document.querySelectorAll("nav a[href]");
  links.forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    // match exact filename for typical static sites
    if (href === here) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  markActiveNav();

  // Accent index (also used as ASCII offset)
  let accentIndex = Number(localStorage.getItem("accentIndex"));
  if (!Number.isFinite(accentIndex)) accentIndex = 0;
  accentIndex = setAccentByIndex(accentIndex);

  // ASCII logo coloring
  const logoPre = document.getElementById("logoArt");
  const logoBtn = document.getElementById("logoBtn");
  if (logoPre && logoBtn) {
    renderAsciiByColumnRuns(logoPre, PALETTE, accentIndex);

    logoBtn.addEventListener("click", () => {
      accentIndex = setAccentByIndex(accentIndex + 1);
      recolorAsciiBySeg(logoPre, PALETTE, accentIndex);
    });
  }
  // Auto-cycle settings
  const AUTO_CYCLE = true;
  const CYCLE_MS = 7500; // slower/faster here
  
  let cycleTimer = null;
  
  function tickCycle() {
    accentIndex = setAccentByIndex(accentIndex + 1);
    recolorAsciiBySeg(logoPre, PALETTE, accentIndex);
  }
  
  function startCycle() {
    if (!AUTO_CYCLE || cycleTimer) return;
    cycleTimer = setInterval(tickCycle, CYCLE_MS);
  }
  
  function stopCycle() {
    if (!cycleTimer) return;
    clearInterval(cycleTimer);
    cycleTimer = null;
  }

  // Start cycling
  startCycle();
  
  // Optional: pause when tab not visible (saves CPU + avoids “skipping”)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopCycle();
    else startCycle();
  });
  
  // Keep click-to-cycle too (and it will sync with the auto state)
  logoBtn.addEventListener("click", () => {
    tickCycle();
});
  // Dark mode toggle + persist + swap wordcloud image if present
  const toggleButton = document.getElementById("dark-mode-toggle");
  const body = document.body;
  const researchImage = document.getElementById("research-image");

  function setToggleLabel() {
    if (!toggleButton) return;
    const isDark = body.classList.contains("dark-mode");
    toggleButton.textContent = isDark ? "Toggle Light Theme" : "Toggle Dark Theme";
  }

  function syncWordcloud() {
    if (!researchImage) return;
    const isDark = body.classList.contains("dark-mode");
    researchImage.src = isDark ? "wordcloud_Dark.png" : "wordcloud_light.png";
  }

  // restore saved mode
  const darkModeEnabled = localStorage.getItem("dark-mode") === "enabled";
  if (darkModeEnabled) body.classList.add("dark-mode");

  syncWordcloud();
  setToggleLabel();

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      const isDarkMode = body.classList.toggle("dark-mode");
      localStorage.setItem("dark-mode", isDarkMode ? "enabled" : "disabled");
      syncWordcloud();
      setToggleLabel();
    });
  }

});
