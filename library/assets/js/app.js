// ============================================================
//  app.js — الوظائف المشتركة بين جميع الصفحات
// ============================================================
import {
  auth, db, isConfigured, onAuthStateChanged, signOut, doc, getDoc, getDocs, setDoc, deleteDoc,
  updateDoc, collection, query, where, orderBy, limit, increment, serverTimestamp
} from "./firebase.js";

/* ---------- أدوات عامة ---------- */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
/** يسمح فقط بروابط http/https (يمنع javascript: وغيرها) */
export function safeUrl(u) {
  try { const x = new URL(u, location.href); return ["http:", "https:"].includes(x.protocol) ? x.href : ""; } catch { return ""; }
}
export function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}
export function fmtNum(n) { return Number(n || 0).toLocaleString("ar-EG"); }
export function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function param(name) { return new URLSearchParams(location.search).get(name); }
export function cleanText(s, max = 500) {
  return String(s ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/<[^>]*>/g, "").trim().slice(0, max);
}

/* ---------- الأيقونات (SVG مضمّنة) ---------- */
const ICONS = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>',
  zoomIn: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  full: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'
};
export function icon(name, size = 20) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

/* ---------- الإشعارات (Toast) ---------- */
export function toast(message, type = "info", ms = 4000) {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `${icon(type === "success" ? "check" : type === "error" ? "alert" : "bell", 18)}<span>${esc(message)}</span>`;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms);
}

/* ---------- حالة المستخدم ---------- */
export const state = { user: null, profile: null, isAdmin: false, ready: false };
const listeners = [];

export function onReady(cb) { state.ready ? cb(state) : listeners.push(cb); }

async function loadProfile(user) {
  state.user = user; state.profile = null; state.isAdmin = false;
  if (user) {
    try {
      const [p, a] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDoc(doc(db, "admins", user.uid)).catch(() => null)
      ]);
      state.profile = p.exists() ? { id: p.id, ...p.data() } : null;
      // هذا للواجهة فقط (إظهار رابط لوحة التحكم)؛ الحماية الفعلية في Security Rules
      state.isAdmin = !!(a && a.exists());
      if (state.profile?.disabled) {
        await signOut(auth);
        toast("هذا الحساب موقوف. تواصل مع الإدارة.", "error", 6000);
        state.user = null; state.profile = null; state.isAdmin = false;
      }
    } catch (e) { console.warn("profile load", e); }
  }
}

/* ---------- الرأس والتذييل ---------- */
// [الرابط، العنوان، الأيقونة، يظهر على الكمبيوتر فقط؟]
const NAV = [
  ["index.html", "الرئيسية", "home", false],
  ["library.html", "المكتبة", "book", true],
  ["competitions.html", "المسابقات", "trophy", true],
  ["contact.html", "تواصل معنا", "mail", true]
];

function renderHeader(s) {
  const cur = location.pathname.split("/").pop() || "index.html";
  const pills = NAV.map(([h, t, i, d]) => `<a href="${h}" class="nav-pill ${d ? "desk-only" : ""} ${cur === h ? "active" : ""}">${icon(i, 18)}<span>${t}</span></a>`).join("");
  const u = state.user;
  const authHtml = u
    ? `${state.isAdmin ? `<a class="nav-pill" href="admin.html">${icon("shield", 18)}<span>الإدارة</span></a>` : ""}
       <a class="nav-pill ${cur === "profile.html" ? "active" : ""}" href="profile.html">${icon("user", 18)}<span>حسابك</span></a>
       <button class="nav-pill" id="logoutBtn" type="button" aria-label="تسجيل الخروج" title="تسجيل الخروج">${icon("logout", 18)}</button>`
    : `<a class="nav-pill ${cur === "login.html" ? "active" : ""}" href="login.html">${icon("user", 18)}<span>حسابك</span></a>
       <a class="nav-pill desk-only" href="register.html"><span>إنشاء حساب</span></a>`;
  const h = document.createElement("header");
  h.className = "site-header";
  h.innerHTML = `<div class="container header-in">
      <a class="brand" href="index.html" aria-label="الصفحة الرئيسية"><span class="brand-mark">${icon("book", 38)}</span>
        <span class="brand-text"><b>${esc(s.siteName)}</b>${s.tagline ? `<small>${esc(s.tagline)}</small>` : ""}</span></a>
      <nav class="main-nav" aria-label="التنقل الرئيسي">${pills}${authHtml}</nav>
    </div>`;
  document.body.prepend(h);
  $$("#logoutBtn").forEach((b) => b.addEventListener("click", async () => {
    await signOut(auth); toast("تم تسجيل الخروج", "success"); setTimeout(() => (location.href = "index.html"), 500);
  }));
}

function renderFooter(s) {
  const f = document.createElement("footer");
  f.className = "site-footer";
  f.innerHTML = `<div class="container footer-grid">
    <div><div class="brand"><span class="brand-mark">${icon("book", 22)}</span><span class="brand-name">${esc(s.siteName)}</span></div>
      <p class="muted">${esc(s.footerText)}</p></div>
    <div><h4>روابط سريعة</h4><ul>
      <li><a href="library.html">المكتبة</a></li><li><a href="competitions.html">المسابقات</a></li>
      <li><a href="contact.html">تواصل معنا</a></li><li><a href="profile.html">حسابي</a></li></ul></div>
    <div><h4>الخدمات</h4><ul>
      <li><a href="contact.html?type=book_request">طلب إضافة كتاب</a></li>
      <li><a href="contact.html?type=broken_book">الإبلاغ عن كتاب لا يعمل</a></li>
      <li><a href="contact.html?type=suggestion">إرسال اقتراح</a></li>
      <li><a href="contact.html?type=complaint">إرسال شكوى</a></li></ul></div>
    <div><h4>معلومات التواصل</h4><ul class="muted">
      ${s.contactEmail ? `<li>${esc(s.contactEmail)}</li>` : ""}
      ${s.contactPhone ? `<li dir="ltr" style="text-align:right">${esc(s.contactPhone)}</li>` : ""}
      ${!s.contactEmail && !s.contactPhone ? `<li><a href="contact.html">نموذج التواصل</a></li>` : ""}</ul></div>
  </div><div class="footer-bottom"><div class="container">© ${new Date().getFullYear()} ${esc(s.siteName)} — جميع الحقوق محفوظة</div></div>`;
  document.body.appendChild(f);
}

/* ---------- الإعدادات العامة ---------- */
export const DEFAULT_SETTINGS = {
  siteName: "مدرسة تونا الجبل الثانوية المشتركة",
  tagline: "بوابة المعرفة والثقافة والقراءة",
  heroTitle: "أهلاً بك في مكتبة مدرستنا 📚",
  heroSubtitle: "عالم من المعرفة والثقافة والقراءة بين يديك",
  footerText: "مكتبة إلكترونية تتيح لطلاب المدرسة الوصول إلى الكتب الدراسية والمسابقات بسهولة.",
  contactEmail: "", contactPhone: "", featuredIds: []
};
let _settings = null;
export async function getSettings() {
  if (_settings) return _settings;
  _settings = { ...DEFAULT_SETTINGS };
  if (isConfigured) {
    try { const s = await getDoc(doc(db, "settings", "site")); if (s.exists()) _settings = { ..._settings, ...s.data() }; } catch (e) { console.warn("settings", e); }
  }
  return _settings;
}

/* ---------- التنبيهات والإعلانات ---------- */
async function renderAnnouncements() {
  try {
    const snap = await getDocs(query(collection(db, "announcements"), where("active", "==", true), limit(3)));
    if (snap.empty) return;
    const closed = JSON.parse(sessionStorage.getItem("ann_closed") || "[]");
    const items = snap.docs.filter((d) => !closed.includes(d.id));
    if (!items.length) return;
    const bar = document.createElement("div");
    bar.className = "announce-wrap";
    bar.innerHTML = items.map((d) => {
      const a = d.data();
      return `<div class="announce announce-${esc(a.type || "info")}" data-id="${d.id}">${icon("bell", 18)}<span>${esc(a.text)}</span><button type="button" aria-label="إغلاق">${icon("close", 16)}</button></div>`;
    }).join("");
    document.body.prepend(bar);
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const el = b.parentElement; closed.push(el.dataset.id);
      sessionStorage.setItem("ann_closed", JSON.stringify(closed)); el.remove();
    });
  } catch (e) { console.warn("announcements", e); }
}

/* ---------- عدّاد الزيارات (مرة لكل جلسة) ---------- */
async function countVisit() {
  if (sessionStorage.getItem("visited")) return;
  sessionStorage.setItem("visited", "1");
  try { await setDoc(doc(db, "settings", "stats"), { visits: increment(1) }, { merge: true }); } catch { /* تجاهل */ }
}

/* ---------- تهيئة الصفحة ---------- */
export function showConfigWarning() {
  const d = document.createElement("div");
  d.className = "config-warning";
  d.innerHTML = `<strong>الموقع غير مرتبط بـ Firebase بعد.</strong> افتح الملف <code>assets/js/firebase.js</code> وضع إعدادات مشروعك، ثم اتبع خطوات ملف README.md.`;
  document.body.prepend(d);
}

/**
 * options.requireAuth  : يوجّه إلى صفحة الدخول إن لم يكن المستخدم مسجلًا
 * options.requireAdmin : يمنع غير الأدمن من الواجهة (الحماية الحقيقية في Rules)
 * options.noChrome     : بدون هيدر/فوتر (للوحة الأدمن وغيرها)
 */
export async function initPage(options = {}) {
  const mainEl = $("main"); if (mainEl && !mainEl.id) mainEl.id = "main";
  if (mainEl && !options.noChrome) document.body.insertAdjacentHTML("afterbegin", '<a class="skip-link" href="#main">تخطي إلى المحتوى</a>');
  if (!isConfigured) {
    const s = { ...DEFAULT_SETTINGS };
    if (!options.noChrome) { renderHeader(s); renderFooter(s); }
    showConfigWarning(); state.ready = true; listeners.forEach((cb) => cb(state));
    return state;
  }
  await new Promise((res) => { const un = onAuthStateChanged(auth, async (u) => { await loadProfile(u); un(); res(); }); });
  if (options.requireAuth && !state.user) { location.replace(`login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`); return state; }
  if (options.requireAdmin && !state.isAdmin) { document.body.innerHTML = `<div class="center-msg"><h2>غير مصرّح</h2><p>هذه الصفحة للإدارة فقط.</p><a class="btn btn-gold" href="index.html">العودة للرئيسية</a></div>`; return state; }
  const settings = await getSettings();
  document.title = `${document.title} | ${settings.siteName}`;
  if (!options.noChrome) { renderHeader(settings); renderFooter(settings); renderAnnouncements(); }
  countVisit();
  state.ready = true; listeners.forEach((cb) => cb(state));
  return state;
}

/* ---------- الكتب والمفضلة ---------- */
export function bookCard(b, favSet = new Set()) {
  const cover = safeUrl(b.coverUrl);
  const fav = favSet.has(b.id);
  return `<article class="book-card" data-id="${esc(b.id)}">
    <a class="book-cover" href="book-details.html?id=${encodeURIComponent(b.id)}" aria-label="${esc(b.title)}">
      ${cover ? `<img src="${esc(cover)}" alt="غلاف ${esc(b.title)}" loading="lazy" decoding="async">` : `<div class="cover-ph">${icon("book", 44)}</div>`}
      ${b.featured ? `<span class="badge-gold">${icon("star", 13)} مميز</span>` : ""}
    </a>
    <button class="fav-btn ${fav ? "on" : ""}" type="button" data-fav="${esc(b.id)}" aria-label="إضافة للمفضلة" aria-pressed="${fav}">${icon("heart", 18)}</button>
    <div class="book-body">
      <h3 class="book-title"><a href="book-details.html?id=${encodeURIComponent(b.id)}">${esc(b.title)}</a></h3>
      <p class="book-meta">${esc(b.author || "")}</p>
      <div class="chips">${b.grade ? `<span class="chip">${esc(b.grade)}</span>` : ""}${b.subject ? `<span class="chip">${esc(b.subject)}</span>` : ""}</div>
      <div class="book-foot"><span class="muted">${icon("eye", 14)} ${fmtNum(b.views)}</span>
        <a class="btn btn-gold btn-sm" href="reader.html?id=${encodeURIComponent(b.id)}">قراءة</a></div>
    </div></article>`;
}

export async function getFavoriteIds() {
  if (!state.user) return new Set();
  try { const s = await getDocs(collection(db, "users", state.user.uid, "favorites")); return new Set(s.docs.map((d) => d.id)); } catch { return new Set(); }
}

/** يربط أزرار المفضلة داخل حاوية (event delegation) */
export function bindFavorites(container, favSet) {
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-fav]"); if (!btn) return;
    e.preventDefault();
    if (!state.user) { toast("سجّل الدخول لإضافة الكتب إلى المفضلة", "info"); return; }
    const id = btn.dataset.fav; const ref = doc(db, "users", state.user.uid, "favorites", id);
    btn.disabled = true;
    try {
      if (favSet.has(id)) { await deleteDoc(ref); favSet.delete(id); btn.classList.remove("on"); toast("أُزيل من المفضلة", "info"); }
      else { await setDoc(ref, { bookId: id, createdAt: serverTimestamp() }); favSet.add(id); btn.classList.add("on"); toast("أُضيف إلى المفضلة", "success"); }
      btn.setAttribute("aria-pressed", favSet.has(id));
    } catch (err) { console.error(err); toast("تعذّر تنفيذ العملية", "error"); }
    btn.disabled = false;
  });
}

export async function fetchBooks(extra = [], max = 100) {
  const s = await getDocs(query(collection(db, "books"), ...extra, limit(max)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function skeleton(n = 4) {
  return Array.from({ length: n }, () => `<div class="book-card skel"><div class="book-cover"></div><div class="book-body"><div class="sk-line"></div><div class="sk-line short"></div></div></div>`).join("");
}
export function emptyState(msg, cta = "") {
  return `<div class="empty">${icon("book", 40)}<p>${esc(msg)}</p>${cta}</div>`;
}

export { auth, db, isConfigured };
