// reader.js — قارئ PDF مبني على PDF.js
import { initPage, $, icon, safeUrl, param, toast, state, isConfigured, db, esc } from "./app.js";
import { doc, getDoc, setDoc, serverTimestamp } from "./firebase.js";

await initPage({ noChrome: true });

const pdfjsLib = window.pdfjsLib;
const stage = $("#stage"), msg = $("#msg");
const id = param("id");

// الأيقونات
$("#back").innerHTML = icon("chevR", 20); $("#prev").innerHTML = icon("chevR", 20); $("#next").innerHTML = icon("chevL", 20);
$("#zIn").innerHTML = icon("zoomIn", 20); $("#zOut").innerHTML = icon("zoomOut", 20); $("#full").innerHTML = icon("full", 20);
$("#sNext").innerHTML = icon("search", 18);

function fail(text) { stage.innerHTML = `<div class="reader-msg"><p>${esc(text)}</p><a class="btn btn-gold" href="library.html">العودة للمكتبة</a></div>`; }

if (!isConfigured) fail("اربط الموقع بـ Firebase أولًا.");
else if (!id) fail("لم يتم تحديد الكتاب.");
else if (!pdfjsLib) fail("تعذّر تحميل مكتبة عرض PDF. تحقق من اتصال الإنترنت.");
else init();

let pdf, scale = 1, total = 0, pageEls = [], rendered = new Map(), baseW = 600, baseH = 800;
let term = "", matches = [], matchIdx = -1, textCache = new Map(), current = 1, bookMeta = null;

async function init() {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const snap = await getDoc(doc(db, "books", id));
    if (!snap.exists()) return fail("الكتاب غير موجود.");
    bookMeta = { id: snap.id, ...snap.data() };
    document.title = bookMeta.title;
    $("#title").textContent = bookMeta.title;
    $("#back").href = `book-details.html?id=${encodeURIComponent(id)}`;
    const url = safeUrl(bookMeta.pdfUrl);
    if (!url) return fail("لا يوجد ملف PDF لهذا الكتاب.");

    const task = pdfjsLib.getDocument({ url });
    task.onProgress = (p) => { if (p.total) $("#prog").style.width = Math.round((p.loaded / p.total) * 100) + "%"; };
    pdf = await task.promise;
    total = pdf.numPages;
    $("#total").textContent = `/ ${total}`; $("#pageIn").max = total;

    const p1 = await pdf.getPage(1); const vp = p1.getViewport({ scale: 1 });
    baseW = vp.width; baseH = vp.height;
    scale = Math.min(1.6, Math.max(0.5, (stage.clientWidth - 36) / baseW));
    buildPages();

    // استكمال القراءة من آخر صفحة
    let start = parseInt(param("page"), 10) || 1;
    if (state.user && !param("page")) {
      try { const h = await getDoc(doc(db, "users", state.user.uid, "history", id)); if (h.exists() && h.data().lastPage) start = h.data().lastPage; } catch { /* تجاهل */ }
    }
    goTo(Math.min(Math.max(1, start), total), false);
    saveHistory();
  } catch (e) {
    console.error(e);
    fail(/CORS|NetworkError|Failed to fetch|Unexpected server response/i.test(String(e?.message)) ? "تعذّر تحميل الملف (قد تحتاج إلى ضبط CORS لـ Firebase Storage — راجع README.md)." : "تعذّر فتح الملف. قد يكون تالفًا أو غير متاح.");
  }
}

/* ---------- بناء الصفحات ---------- */
let io;
function buildPages() {
  stage.innerHTML = ""; pageEls = []; rendered.clear();
  io?.disconnect();
  io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) renderPage(+en.target.dataset.n); }), { root: stage, rootMargin: "600px 0px" });
  for (let n = 1; n <= total; n++) {
    const d = document.createElement("div");
    d.className = "pdf-page"; d.dataset.n = n;
    d.style.width = baseW * scale + "px"; d.style.height = baseH * scale + "px";
    stage.appendChild(d); pageEls.push(d); io.observe(d);
  }
  $("#zoomLbl").textContent = Math.round(scale * 100) + "%";
}

async function renderPage(n) {
  const el = pageEls[n - 1];
  if (!el || rendered.get(n) === scale) return;
  rendered.set(n, scale);
  try {
    const page = await pdf.getPage(n);
    if (rendered.get(n) !== scale) return;
    const vp = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = vp.width + "px"; canvas.style.height = vp.height + "px";
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
    const tl = document.createElement("div"); tl.className = "textLayer";
    tl.style.setProperty("--scale-factor", scale);
    el.style.width = vp.width + "px"; el.style.height = vp.height + "px";
    el.replaceChildren(canvas, tl);
    const tc = await page.getTextContent();
    const divs = [];
    await pdfjsLib.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp, textDivs: divs }).promise;
    if (term) highlight(tl);
  } catch (e) { if (e?.name !== "RenderingCancelledException") console.warn("render", n, e); rendered.delete(n); }
}

/* ---------- التنقل ---------- */
function goTo(n, smooth = true) {
  n = Math.min(Math.max(1, n), total); current = n;
  pageEls[n - 1]?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  updateNav();
}
function updateNav() {
  $("#pageIn").value = current;
  $("#prev").disabled = current <= 1; $("#next").disabled = current >= total;
}
let scrollT;
stage.addEventListener("scroll", () => {
  clearTimeout(scrollT);
  scrollT = setTimeout(() => {
    const top = stage.getBoundingClientRect().top; let best = 1, bd = Infinity;
    for (const el of pageEls) { const d = Math.abs(el.getBoundingClientRect().top - top - 10); if (d < bd) { bd = d; best = +el.dataset.n; } else if (el.getBoundingClientRect().top > top + stage.clientHeight) break; }
    if (best !== current) { current = best; updateNav(); saveHistorySoon(); }
  }, 120);
});
$("#prev").addEventListener("click", () => goTo(current - 1));
$("#next").addEventListener("click", () => goTo(current + 1));
$("#pageIn").addEventListener("change", (e) => goTo(parseInt(e.target.value, 10) || 1));
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "ArrowLeft" || e.key === "PageDown") { e.preventDefault(); goTo(current + 1); }
  if (e.key === "ArrowRight" || e.key === "PageUp") { e.preventDefault(); goTo(current - 1); }
  if (e.key === "+" || e.key === "=") zoom(0.15);
  if (e.key === "-") zoom(-0.15);
});

/* ---------- التكبير ---------- */
function zoom(delta) {
  if (!total) return;
  const ns = Math.min(3, Math.max(0.4, +(scale + delta).toFixed(2)));
  if (ns === scale) return;
  const keep = current; scale = ns; buildPages(); goTo(keep, false);
}
$("#zIn").addEventListener("click", () => zoom(0.15));
$("#zOut").addEventListener("click", () => zoom(-0.15));

/* ---------- ملء الشاشة ---------- */
$("#full").addEventListener("click", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => toast("المتصفح لا يدعم ملء الشاشة", "error"));
  else document.exitFullscreen();
});

/* ---------- البحث داخل الملف ---------- */
async function pageText(n) {
  if (textCache.has(n)) return textCache.get(n);
  const page = await pdf.getPage(n); const tc = await page.getTextContent();
  const t = tc.items.map((i) => i.str).join(" "); textCache.set(n, t); return t;
}
function highlight(layer) {
  const re = new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
  layer.querySelectorAll("span").forEach((s) => {
    const t = s.textContent;
    if (!re.test(t)) return;
    re.lastIndex = 0;
    // نقسم النص الخام ثم نهرّب كل جزء (لا نُدخل HTML غير مهرَّب أبدًا)
    s.innerHTML = t.split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join("");
  });
}
$("#sForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pdf) return;
  const q = $("#sIn").value.trim().slice(0, 60);
  if (!q) { term = ""; matches = []; $("#sRes").textContent = ""; rerenderAll(); return; }
  term = q; matches = []; matchIdx = -1;
  $("#sRes").textContent = "جارٍ البحث...";
  const low = q.toLowerCase();
  for (let n = 1; n <= total; n++) { if ((await pageText(n)).toLowerCase().includes(low)) matches.push(n); }
  $("#sRes").textContent = matches.length ? `${matches.length} صفحة` : "لا نتائج";
  rerenderAll();
  if (matches.length) nextMatch();
});
function nextMatch() { if (!matches.length) return; matchIdx = (matchIdx + 1) % matches.length; goTo(matches[matchIdx]); }
$("#sNext").addEventListener("click", () => (matches.length ? nextMatch() : $("#sForm").requestSubmit()));
function rerenderAll() { rendered.clear(); pageEls.forEach((el) => { el.replaceChildren(); io.unobserve(el); io.observe(el); }); }

/* ---------- سجل القراءة ---------- */
let histT;
function saveHistorySoon() { clearTimeout(histT); histT = setTimeout(saveHistory, 2500); }
async function saveHistory() {
  if (!state.user || !bookMeta) return;
  try {
    await setDoc(doc(db, "users", state.user.uid, "history", id), {
      bookId: id, title: String(bookMeta.title || "").slice(0, 200), coverUrl: String(bookMeta.coverUrl || ""),
      lastPage: current, totalPages: total, updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) { console.warn("history", e); }
}
window.addEventListener("pagehide", () => saveHistory());
