import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import katex from "katex";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, "dist", "nusaroute-ai-codelab");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error(`Target HTML not found: ${indexPath}`);
  process.exit(1);
}

// 1. Copy local KaTeX distribution (fonts, CSS, JS) for offline-ready rendering
const katexSrcDir = path.join(__dirname, "..", "node_modules", "katex", "dist");
const katexDistDest = path.join(distDir, "katex");
if (fs.existsSync(katexSrcDir)) {
  try {
    fs.cpSync(katexSrcDir, katexDistDest, { recursive: true });
    console.log("Bundled KaTeX assets locally into dist/katex.");
  } catch (err) {
    console.warn("Could not copy local KaTeX distribution:", err.message);
  }
}

let html = fs.readFileSync(indexPath, "utf-8");

// 2. Pre-render LaTeX Formulas to Static KaTeX HTML
const haversineLatex = `\\begin{aligned}
a &= \\sin^2\\left(\\frac{\\Delta \\text{lat}}{2}\\right) + \\cos(\\text{lat}_1) \\cdot \\cos(\\text{lat}_2) \\cdot \\sin^2\\left(\\frac{\\Delta \\text{lng}}{2}\\right) \\\\[8pt]
c &= 2 \\cdot \\operatorname{atan2}\\left(\\sqrt{a},\\; \\sqrt{1 - a}\\right) \\\\[8pt]
d &= R \\cdot c \\quad (R = 6.371\\text{ km})
\\end{aligned}`;

const backoffLatex = `t_{\\text{delay}} = t_{\\text{base}} \\cdot 2^{\\text{attempt} - 1} + t_{\\text{jitter}}`;

const on2Latex = `\\mathcal{O}(n^2)`;

const haversineRendered = katex.renderToString(haversineLatex, {
  displayMode: true,
  throwOnError: false,
});

const backoffRendered = katex.renderToString(backoffLatex, {
  displayMode: true,
  throwOnError: false,
});

const on2Rendered = katex.renderToString(on2Latex, {
  displayMode: false,
  throwOnError: false,
});

// Replace math placeholders
html = html.replaceAll("[[MATH_HAVERSINE_FORMULA]]", haversineRendered);
html = html.replaceAll("[[MATH_BACKOFF_FORMULA]]", backoffRendered);
html = html.replaceAll("[[MATH_ON2]]", on2Rendered);

// Clean up any previously injected custom styles for idempotent re-runs
const markerStart = "<!-- NUSAROUTE_ENHANCED_STYLES_START -->";
const markerEnd = "<!-- NUSAROUTE_ENHANCED_STYLES_END -->";
const existingStartIdx = html.indexOf(markerStart);
const existingEndIdx = html.indexOf(markerEnd);
if (existingStartIdx !== -1 && existingEndIdx !== -1) {
  html =
    html.substring(0, existingStartIdx) +
    html.substring(existingEndIdx + markerEnd.length);
}

// 3. Authentic Google Developers / Google Cloud Documentation styling (flat, clean, understated)
const customStyles = `
${markerStart}
  <!-- KaTeX CSS (Local offline-first with CDN fallback) -->
  <link rel="stylesheet" href="./katex/katex.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">

  <style>
    /* Authentic Google Developers Typography & Reading Measure */
    google-codelab-step .instructions {
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 1.65;
      color: #202124;
      max-width: 900px;
    }

    google-codelab-step .instructions h2 {
      color: #202124 !important;
      font-size: 20px !important;
      font-weight: 500 !important;
      margin-top: 32px !important;
      margin-bottom: 14px !important;
      padding-bottom: 6px !important;
      border-bottom: 1px solid #e8eaed !important;
    }

    google-codelab-step .instructions h3 {
      color: #202124 !important;
      font-size: 16px !important;
      font-weight: 500 !important;
      margin-top: 24px !important;
      margin-bottom: 10px !important;
    }

    google-codelab-step .instructions h4 {
      color: #3c4043 !important;
      font-size: 14.5px !important;
      font-weight: 600 !important;
      margin-top: 18px !important;
      margin-bottom: 8px !important;
    }

    google-codelab-step .instructions a {
      color: #1a73e8;
      text-decoration: none;
    }

    google-codelab-step .instructions a:hover {
      text-decoration: underline;
    }

    /* Flat Google Cloud Docs Tables */
    .table-responsive-wrapper {
      width: 100%;
      overflow-x: auto;
      margin: 18px 0;
      border: 1px solid #dadce0;
      border-radius: 4px;
      background: #ffffff;
    }

    google-codelab-step .instructions table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 0 !important;
      font-size: 13.5px !important;
      line-height: 1.55 !important;
      border: none !important;
    }

    google-codelab-step .instructions table tr:first-child td {
      background-color: #f8f9fa !important;
      color: #202124 !important;
      font-weight: 500 !important;
      border-bottom: 1px solid #dadce0 !important;
      padding: 10px 14px !important;
      white-space: nowrap !important;
    }

    google-codelab-step .instructions table td {
      padding: 10px 14px !important;
      border-bottom: 1px solid #e8eaed !important;
      vertical-align: top !important;
      color: #3c4043 !important;
      background-color: #ffffff !important;
    }

    google-codelab-step .instructions table tr:last-child td {
      border-bottom: none !important;
    }

    google-codelab-step .instructions table tr:hover:not(:first-child) td {
      background-color: #f8f9fa !important;
    }

    /* Subtle Borderless Inline Code (Google Developers Standard) */
    google-codelab-step .instructions code:not(pre code) {
      background-color: #f1f3f4 !important;
      color: #202124 !important;
      padding: 1px 5px !important;
      border-radius: 3px !important;
      font-size: 13px !important;
      font-family: 'Roboto Mono', 'Source Code Pro', monospace !important;
      border: none !important;
    }

    /* Native Light Google Codelab Code Blocks */
    google-codelab-step pre {
      background-color: #f8f9fa !important;
      color: #202124 !important;
      border: 1px solid #dadce0 !important;
      border-radius: 4px !important;
      padding: 14px 16px !important;
      margin: 14px 0 !important;
      font-size: 13px !important;
      line-height: 1.55 !important;
      box-shadow: none !important;
      overflow-x: auto !important;
    }

    google-codelab-step pre code {
      font-family: 'Roboto Mono', 'Source Code Pro', monospace !important;
      background: transparent !important;
      padding: 0 !important;
      border: none !important;
      color: #202124 !important;
    }

    /* Official Google Developers Light Syntax Highlighting Palette */
    google-codelab-step pre .pln {
      color: #202124 !important;
    }

    google-codelab-step pre .pun,
    google-codelab-step pre .opn,
    google-codelab-step pre .clo {
      color: #3c4043 !important;
    }

    google-codelab-step pre .kwd {
      color: #8430ce !important;
    }

    google-codelab-step pre .str,
    google-codelab-step pre .atv {
      color: #137333 !important;
    }

    google-codelab-step pre .com {
      color: #5f6368 !important;
      font-style: italic;
    }

    google-codelab-step pre .typ,
    google-codelab-step pre .tag,
    google-codelab-step pre .atn {
      color: #1967d2 !important;
    }

    google-codelab-step pre .lit,
    google-codelab-step pre .dec {
      color: #b06000 !important;
    }

    /* Flat Google Material Callout Asides */
    google-codelab-step .instructions aside.special,
    google-codelab-step .instructions aside.tip {
      background-color: #e8f0fe !important;
      border-left: 4px solid #1a73e8 !important;
      border-radius: 0 4px 4px 0 !important;
      padding: 14px 18px !important;
      margin: 20px 0 !important;
      box-shadow: none !important;
      color: #202124 !important;
    }

    google-codelab-step .instructions aside.warning {
      background-color: #fef7e0 !important;
      border-left: 4px solid #f9ab00 !important;
      border-radius: 0 4px 4px 0 !important;
      padding: 14px 18px !important;
      margin: 20px 0 !important;
      box-shadow: none !important;
      color: #202124 !important;
    }

    google-codelab-step .instructions aside p {
      margin: 6px 0 !important;
      line-height: 1.6 !important;
      color: #202124 !important;
    }

    google-codelab-step .instructions aside ul {
      margin: 8px 0 6px 20px !important;
      padding: 0 !important;
      color: #3c4043 !important;
    }

    google-codelab-step .instructions aside li {
      margin-bottom: 5px !important;
      line-height: 1.55 !important;
    }

    google-codelab-step .instructions aside code:not(pre code) {
      background-color: rgba(32, 33, 36, 0.08) !important;
    }

    /* Clean Textbook KaTeX Formula Presentation */
    .katex-display {
      display: block !important;
      text-align: center !important;
      padding: 16px 14px !important;
      background: #ffffff !important;
      border: 1px solid #dadce0 !important;
      border-radius: 4px !important;
      overflow-x: auto !important;
      margin: 12px 0 !important;
      font-size: 1.08em !important;
      box-shadow: none !important;
    }

    .katex {
      font-size: 1.03em !important;
      color: #202124 !important;
    }

    /* Native Google Developers Style Copy Code Button */
    .code-block-wrapper {
      position: relative;
      margin: 14px 0;
    }

    .code-block-wrapper pre {
      margin: 0 !important;
      padding-right: 92px !important;
    }

    .copy-code-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 8px;
      background-color: #ffffff;
      color: #5f6368;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-family: 'Roboto', sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      z-index: 2;
      line-height: 1;
    }

    .copy-code-btn:hover {
      background-color: #f1f3f4;
      color: #202124;
      border-color: #bdc1c6;
    }

    .copy-code-btn .material-icons {
      font-size: 15px;
      line-height: 1;
    }

    .copy-code-btn.copied {
      color: #137333;
      border-color: #ceead6;
      background-color: #e6f4ea;
    }

    /* Clean Google Developers Screenshot Framing & Lightbox */
    .codelab-figure {
      margin: 16px 0 20px 0;
      padding: 0;
    }

    .codelab-figure img {
      display: block;
      max-width: 100%;
      height: auto;
      border: 1px solid #dadce0;
      border-radius: 6px;
      cursor: zoom-in;
      background: #f8f9fa;
    }

    .codelab-caption {
      margin-top: 6px;
      font-size: 12.5px;
      color: #5f6368;
      line-height: 1.4;
    }

    .codelab-lightbox {
      position: fixed;
      inset: 0;
      background: rgba(32, 33, 36, 0.86);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 9999;
      cursor: zoom-out;
    }

    .codelab-lightbox img {
      max-width: 96vw;
      max-height: 92vh;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    }
  </style>

  <script>
    (function() {
      function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text).catch(function() {
            return fallbackCopy(text);
          });
        }
        return Promise.resolve(fallbackCopy(text));
      }

      function fallbackCopy(text) {
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(textarea);
        }
      }

      function enhanceCodelabElements() {
        // 1. Wrap tables in responsive container
        document.querySelectorAll("google-codelab-step table").forEach(function(table) {
          if (!table.parentElement || !table.parentElement.classList.contains("table-responsive-wrapper")) {
            var wrapper = document.createElement("div");
            wrapper.className = "table-responsive-wrapper";
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
          }
        });

        // 2. Attach Google Developers style Copy button to all code blocks
        document.querySelectorAll("google-codelab-step pre").forEach(function(pre) {
          if (!pre.parentElement || pre.parentElement.classList.contains("code-block-wrapper")) {
            return;
          }

          var wrapper = document.createElement("div");
          wrapper.className = "code-block-wrapper";
          pre.parentNode.insertBefore(wrapper, pre);
          wrapper.appendChild(pre);

          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "copy-code-btn";
          btn.setAttribute("aria-label", "Salin kode");
          btn.setAttribute("title", "Salin kode");
          btn.innerHTML = '<span class="material-icons" aria-hidden="true">content_copy</span><span class="copy-label">Salin</span>';

          btn.addEventListener("click", function() {
            var codeEl = pre.querySelector("code");
            var rawText = (codeEl ? codeEl.innerText : pre.innerText).trimEnd();
            copyText(rawText).then(function() {
              btn.classList.add("copied");
              btn.innerHTML = '<span class="material-icons" aria-hidden="true">check</span><span class="copy-label">Tersalin</span>';
              clearTimeout(btn._resetTimer);
              btn._resetTimer = setTimeout(function() {
                btn.classList.remove("copied");
                btn.innerHTML = '<span class="material-icons" aria-hidden="true">content_copy</span><span class="copy-label">Salin</span>';
              }, 1800);
            });
          });

          wrapper.appendChild(btn);
        });

        // 3. Wrap screenshots in clean figure with caption and click-to-zoom lightbox
        document.querySelectorAll("google-codelab-step img").forEach(function(img) {
          if (img.closest(".codelab-figure")) return;
          var figure = document.createElement("figure");
          figure.className = "codelab-figure";
          img.parentNode.insertBefore(figure, img);
          figure.appendChild(img);

          var altText = img.getAttribute("alt");
          if (altText && altText.trim()) {
            var caption = document.createElement("figcaption");
            caption.className = "codelab-caption";
            caption.textContent = altText.trim() + " (klik gambar untuk memperbesar)";
            figure.appendChild(caption);
          }

          img.addEventListener("click", function() {
            var overlay = document.createElement("div");
            overlay.className = "codelab-lightbox";
            var zoomed = document.createElement("img");
            zoomed.src = img.src;
            zoomed.alt = altText || "";
            overlay.appendChild(zoomed);
            overlay.addEventListener("click", function() {
              if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            });
            document.body.appendChild(overlay);
          });
        });
      }

      function localizeUI() {
        var prevBtn = document.querySelector("#previous-step");
        if (prevBtn) {
          if (prevBtn.textContent.trim() === "Back") prevBtn.textContent = "Kembali";
          prevBtn.setAttribute("title", "Langkah sebelumnya");
        }

        var nextBtn = document.querySelector("#next-step");
        if (nextBtn) {
          if (nextBtn.textContent.trim() === "Next") nextBtn.textContent = "Lanjut";
          nextBtn.setAttribute("title", "Langkah berikutnya");
        }

        var doneBtn = document.querySelector("#done");
        if (doneBtn) {
          if (doneBtn.textContent.trim() === "Done") doneBtn.textContent = "Selesai";
          doneBtn.setAttribute("title", "Codelab selesai");
        }

        document.querySelectorAll("google-codelab a").forEach(function(link) {
          link.childNodes.forEach(function(node) {
            if (node.nodeType === 3 && node.nodeValue.indexOf("Report a mistake") !== -1) {
              node.nodeValue = node.nodeValue.replace("Report a mistake", "Laporkan kesalahan");
            }
          });
        });

        document.querySelectorAll(".codelab-time-container .time-remaining").forEach(function(el) {
          el.childNodes.forEach(function(node) {
            if (node.nodeType === 3) {
              if (node.nodeValue.indexOf("mins remaining") !== -1) {
                node.nodeValue = node.nodeValue.replace("mins remaining", "menit tersisa");
              } else if (node.nodeValue.indexOf("min remaining") !== -1) {
                node.nodeValue = node.nodeValue.replace("min remaining", "menit tersisa");
              }
            }
          });
        });
      }

      var timeObserverAttached = false;
      function initLocalization() {
        localizeUI();
        if (!timeObserverAttached && typeof MutationObserver !== "undefined") {
          var containers = document.querySelectorAll(".codelab-time-container");
          if (containers.length > 0) {
            var observer = new MutationObserver(localizeUI);
            containers.forEach(function(c) {
              observer.observe(c, { childList: true, subtree: true, characterData: true });
            });
            timeObserverAttached = true;
          }
        }
      }

      function onReady() {
        enhanceCodelabElements();
        initLocalization();
      }

      document.addEventListener("DOMContentLoaded", onReady);
      document.addEventListener("google-codelab-ready", onReady);
      document.addEventListener("google-codelab-step", localizeUI);
      window.addEventListener("load", onReady);
      window.addEventListener("hashchange", function() {
        setTimeout(localizeUI, 30);
      });
    })();
  </script>
${markerEnd}
`;

// Copy vercel.json if present
const vercelConfigSrc = path.join(__dirname, "vercel.json");
const vercelConfigDest = path.join(distDir, "vercel.json");
if (fs.existsSync(vercelConfigSrc)) {
  fs.copyFileSync(vercelConfigSrc, vercelConfigDest);
}

// Normalize Windows backslashes emitted by claat in image src paths for cross-platform/Vercel hosting
html = html.replace(/src="img\\+/g, 'src="img/');

// Escape unescaped placeholders inside inline <code> tags so browser renders them instead of treating as custom HTML elements
html = html.replace(/<code>([\s\S]*?)<\/code>/g, (match, inner) => {
  return `<code>${inner.replace(/<([A-Z0-9_-]+)>/g, '&lt;$1&gt;')}</code>`;
});

// Heal fragmented paragraphs accidentally split by CLAAT inline parser:
// 1. Merge fragmented <p><em>...</em></p><p><strong><em>...</em></strong></p><p><em>...</em></p>
html = html.replace(/<\/em><\/p>\s*<p><strong><em>(.*?)<\/em><\/strong><\/p>\s*<p><em>/g, ' <strong><em>$1</em></strong> ');
html = html.replace(/<\/em><\/p>\s*<p><em><code>(.*?)<\/code><\/em><\/p>\s*<p><em>/g, ' <code>$1</code> ');
// 2. Merge fragments like <p>... (</p><p><strong><code>...</code></strong></p><p><strong>)</strong> ...</p>
html = html.replace(/<\/p>\s*<p>(<strong><code>[^<]+<\/code><\/strong>)<\/p>\s*<p>(<strong>\)[^<]*<\/strong>)/g, ' $1 $2');
// 3. Merge broken trailing inline code like <p>... (</p><p><code>...</code></p><p>)...</p>
html = html.replace(/<\/p>\s*<p>(<code>[^<]+<\/code>)<\/p>\s*<p>(\)[^<]*)/g, ' $1 $2');

// Set Indonesian document language and inject custom styles right before </head>
html = html.replace("<html>", '<html lang="id">');
html = html.replace("</head>", `${customStyles}\n</head>`);
fs.writeFileSync(indexPath, html, "utf-8");
console.log("Enhanced Codelab index.html with authentic Google Developers styling.");

// Sync to git-tracked folder codelab/nusaroute-ai-codelab/
const trackedDir = path.join(__dirname, "nusaroute-ai-codelab");
if (fs.existsSync(trackedDir)) {
  fs.copyFileSync(indexPath, path.join(trackedDir, "index.html"));
  const jsonSrc = path.join(distDir, "codelab.json");
  if (fs.existsSync(jsonSrc)) {
    fs.copyFileSync(jsonSrc, path.join(trackedDir, "codelab.json"));
  }
  if (fs.existsSync(vercelConfigSrc)) {
    fs.copyFileSync(vercelConfigSrc, path.join(trackedDir, "vercel.json"));
  }

  const trackedKatex = path.join(trackedDir, "katex");
  if (fs.existsSync(katexSrcDir)) {
    try {
      fs.cpSync(katexSrcDir, trackedKatex, { recursive: true });
    } catch (e) {
      // ignore
    }
  }

  const srcImgDir = path.join(__dirname, "img");
  const distImgDir = path.join(distDir, "img");
  const trackedImgDir = path.join(trackedDir, "img");
  if (fs.existsSync(srcImgDir)) {
    try {
      fs.cpSync(srcImgDir, distImgDir, { recursive: true });
    } catch (e) {
      // ignore
    }
  }
  if (fs.existsSync(distImgDir)) {
    try {
      fs.cpSync(distImgDir, trackedImgDir, { recursive: true });
    } catch (e) {
      // ignore
    }
  }

  console.log("Synchronized codelab, KaTeX, and screenshot assets to git-tracked folder.");
}
