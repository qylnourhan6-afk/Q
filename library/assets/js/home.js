// home.js — منطق الصفحة الرئيسية
import {
  initPage, $, esc, icon, bookCard, getFavoriteIds, bindFavorites, fetchBooks, skeleton, emptyState,
  getSettings, fmtNum, isConfigured, db, state
} from "./app.js";
import { collection, getDocs, getDoc, doc, query, where, orderBy, limit, getCountFromServer } from "./firebase.js";

await initPage();

$("#sIcon").innerHTML = icon("search", 18);
const settings = await getSettings();
$("#heroTitle").textContent = settings.heroTitle;
$("#heroSub").textContent = settings.heroSubtitle;

if (!isConfigured) {
  ["#latest", "#popular"].forEach((s) => ($(s).innerHTML = emptyState("اربط الموقع بـ Firebase لعرض الكتب.")));
  $("#comps").innerHTML = emptyState("لا توجد مسابقات حاليًا.");
  $("#stats").innerHTML = "";
} else {
  start();
}

async function loadCategories() {
  const snap = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));
  const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const fill = (sel, type) => {
    const el = $(sel);
    cats.filter((c) => c.type === type).forEach((c) => el.insertAdjacentHTML("beforeend", `<option value="${esc(c.name)}">${esc(c.name)}</option>`));
  };
  fill("#sGrade", "grade"); fill("#sSubject", "subject"); fill("#sTerm", "term");
  const grades = cats.filter((c) => c.type === "grade");
  if (grades.length) {
    $("#catsSec").hidden = false;
    $("#cats").innerHTML = grades.map((c) => `<a class="cat" href="library.html?grade=${encodeURIComponent(c.name)}">${icon("layers", 22)}<span>${esc(c.name)}</span></a>`).join("");
  }
}

async function start() {
  $("#latest").innerHTML = skeleton(4); $("#popular").innerHTML = skeleton(4);
  const favs = await getFavoriteIds();
  try {
    await loadCategories().catch((e) => console.warn("cats", e));
    const [latest, popular] = await Promise.all([
      fetchBooks([orderBy("createdAt", "desc")], 8),
      fetchBooks([orderBy("views", "desc")], 8)
    ]);
    const render = (el, list, msg) => { el.innerHTML = list.length ? list.map((b) => bookCard(b, favs)).join("") : emptyState(msg); bindFavorites(el, favs); };
    render($("#latest"), latest, "لم تُضف كتب بعد.");
    render($("#popular"), popular, "لا توجد كتب بعد.");

    // الكتب المميزة (من حقل featured في الكتاب)
    const featured = await fetchBooks([where("featured", "==", true)], 8).catch(() => []);
    if (featured.length) { $("#featuredSec").hidden = false; render($("#featured"), featured, ""); }
  } catch (e) { console.error(e); $("#latest").innerHTML = emptyState("تعذّر تحميل الكتب."); $("#popular").innerHTML = ""; }

  loadComps(); loadStats();
}

async function loadComps() {
  const el = $("#comps");
  try {
    const snap = await getDocs(query(collection(db, "competitions"), where("active", "==", true), limit(6)));
    el.innerHTML = snap.empty ? emptyState("لا توجد مسابقات متاحة حاليًا.") : snap.docs.map((d) => {
      const c = d.data();
      return `<div class="comp-card"><h3>${esc(c.title)}</h3><p class="muted">${esc((c.description || "").slice(0, 110))}</p>
        <div class="meta-row"><span>${icon("clock", 16)} ${fmtNum(c.durationMinutes)} دقيقة</span><span>${icon("check", 16)} ${fmtNum((c.questions || []).length)} سؤال</span></div>
        <a class="btn btn-navy btn-sm" href="competitions.html?id=${d.id}">ابدأ المسابقة</a></div>`;
    }).join("");
  } catch (e) { console.warn(e); el.innerHTML = emptyState("تعذّر تحميل المسابقات."); }
}

async function loadStats() {
  const out = [];
  try {
    const [b, c, st] = await Promise.all([
      getCountFromServer(collection(db, "books")),
      getCountFromServer(query(collection(db, "competitions"), where("active", "==", true))),
      getDoc(doc(db, "settings", "stats"))
    ]);
    const s = st.exists() ? st.data() : {};
    out.push(["book", b.data().count, "كتاب"], ["users", s.users || 0, "مستخدم"], ["trophy", c.data().count, "مسابقة نشطة"], ["eye", s.visits || 0, "زيارة"]);
  } catch (e) { console.warn("stats", e); }
  $("#stats").innerHTML = out.map(([i, n, t]) => `<div class="stat">${icon(i, 28)}<b>${fmtNum(n)}</b><span>${t}</span></div>`).join("");
}

$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const p = new URLSearchParams();
  const q = $("#sQ").value.trim(), g = $("#sGrade").value, s = $("#sSubject").value, t = $("#sTerm").value;
  if (q) p.set("q", q); if (g) p.set("grade", g); if (s) p.set("subject", s); if (t) p.set("term", t);
  location.href = `library.html${p.toString() ? "?" + p : ""}`;
});
