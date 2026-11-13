// library.js — عرض الكتب والفلترة والبحث والترتيب
import { initPage, $, esc, bookCard, getFavoriteIds, bindFavorites, fetchBooks, skeleton, emptyState, debounce, param, isConfigured, db } from "./app.js";
import { collection, getDocs, query, orderBy } from "./firebase.js";

await initPage();

const PAGE = 24;
let all = [], shown = PAGE, favs = new Set();
const grid = $("#grid");

if (!isConfigured) {
  grid.innerHTML = emptyState("اربط الموقع بـ Firebase لعرض الكتب (راجع README.md).");
} else {
  grid.innerHTML = skeleton(8);
  favs = await getFavoriteIds();
  bindFavorites(grid, favs);
  try {
    const [books, cats] = await Promise.all([
      fetchBooks([orderBy("createdAt", "desc")], 500),
      getDocs(query(collection(db, "categories"), orderBy("order", "asc"))).then((s) => s.docs.map((d) => d.data())).catch(() => [])
    ]);
    all = books;
    const fill = (sel, type, fromBooks) => {
      const names = new Set(cats.filter((c) => c.type === type).map((c) => c.name));
      all.forEach((b) => b[fromBooks] && names.add(b[fromBooks]));
      const el = $(sel); [...names].forEach((n) => el.insertAdjacentHTML("beforeend", `<option value="${esc(n)}">${esc(n)}</option>`));
    };
    fill("#fGrade", "grade", "grade"); fill("#fSubject", "subject", "subject"); fill("#fTerm", "term", "term");
    // قيم أولية من الرابط
    $("#fQ").value = param("q") || ""; $("#fGrade").value = param("grade") || "";
    $("#fSubject").value = param("subject") || ""; $("#fTerm").value = param("term") || "";
    if (["newest", "views", "title"].includes(param("sort"))) $("#fSort").value = param("sort");
    $("#fFeatured").checked = param("featured") === "1";
    render();
  } catch (e) { console.error(e); grid.innerHTML = emptyState("تعذّر تحميل الكتب. تحقق من الاتصال وقواعد الأمان."); }
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[ً-ٰٟ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

function filtered() {
  const q = norm($("#fQ").value.trim()), g = $("#fGrade").value, s = $("#fSubject").value, t = $("#fTerm").value;
  const feat = $("#fFeatured").checked, onlyFav = $("#fFav").checked, sort = $("#fSort").value;
  let list = all.filter((b) =>
    (!g || b.grade === g) && (!s || b.subject === s) && (!t || b.term === t) &&
    (!feat || b.featured) && (!onlyFav || favs.has(b.id)) &&
    (!q || norm([b.title, b.subject, b.teacher, b.author].join(" ")).includes(q)));
  if (sort === "views") list.sort((a, b) => (b.views || 0) - (a.views || 0));
  else if (sort === "title") list.sort((a, b) => String(a.title).localeCompare(String(b.title), "ar"));
  return list;
}

function render() {
  const list = filtered();
  $("#count").textContent = `${list.length.toLocaleString("ar-EG")} كتاب`;
  grid.innerHTML = list.length ? list.slice(0, shown).map((b) => bookCard(b, favs)).join("") : emptyState("لا توجد نتائج مطابقة. جرّب تغيير الفلاتر.");
  $("#more").hidden = list.length <= shown;
}

const rerender = () => { shown = PAGE; render(); };
$("#fQ").addEventListener("input", debounce(rerender, 250));
["#fGrade", "#fSubject", "#fTerm", "#fSort", "#fFeatured", "#fFav"].forEach((s) => $(s).addEventListener("change", rerender));
$("#more").addEventListener("click", () => { shown += PAGE; render(); });
$("#reset").addEventListener("click", () => {
  ["#fQ", "#fGrade", "#fSubject", "#fTerm"].forEach((s) => ($(s).value = ""));
  $("#fSort").value = "newest"; $("#fFeatured").checked = false; $("#fFav").checked = false; rerender();
});
