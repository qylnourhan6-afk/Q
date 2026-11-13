// admin.js — لوحة التحكم
// تنبيه أمني: إخفاء/إظهار هذه الواجهة للتجميل فقط. الحماية الحقيقية في firestore.rules و storage.rules
// حيث تُمنح صلاحيات الكتابة فقط لمن لديه مستند في المجموعة admins/{uid}.
import { initPage, $, $$, esc, icon, toast, state, fmtDate, fmtNum, cleanText, safeUrl, isConfigured, db } from "./app.js";
import {
  auth, storage, signOut, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, limit,
  where, serverTimestamp, getCountFromServer, sRef, uploadBytesResumable, getDownloadURL, deleteObject
} from "./firebase.js";

await initPage({ requireAuth: true, requireAdmin: true, noChrome: true });
if (!state.isAdmin) await new Promise(() => {}); // الواجهة تعرض رسالة «غير مصرّح»

let content = $("#content");
$("#logoIco").innerHTML = icon("shield", 22);
$("#sideBtn").innerHTML = icon("menu", 24);
$("#who").textContent = state.profile?.displayName || state.profile?.username || "";
$("#logout").addEventListener("click", async () => { await signOut(auth); location.href = "login.html"; });
$("#sideBtn").addEventListener("click", () => $("#side").classList.toggle("open"));

const SECTIONS = [
  ["dash", "الإحصائيات", "grid", renderDash],
  ["books", "الكتب", "book", renderBooks],
  ["cats", "الصفوف والمواد والفصول", "layers", renderCats],
  ["users", "المستخدمون", "users", renderUsers],
  ["comps", "المسابقات", "trophy", renderComps],
  ["reqs", "الطلبات والشكاوى", "mail", renderReqs],
  ["ann", "الإعلانات والتنبيهات", "bell", renderAnn],
  ["site", "محتوى الصفحة الرئيسية", "settings", renderSite]
];
$("#adminNav").innerHTML = SECTIONS.map(([k, t, i]) => `<button type="button" data-k="${k}">${icon(i, 18)}<span>${t}</span></button>`).join("");
$("#adminNav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(b.dataset.k); });
window.addEventListener("hashchange", () => go(location.hash.slice(1)));

async function go(k) {
  const s = SECTIONS.find((x) => x[0] === k) || SECTIONS[0];
  $$("#adminNav button").forEach((b) => b.classList.toggle("active", b.dataset.k === s[0]));
  $("#secTitle").textContent = s[1]; $("#side").classList.remove("open");
  history.replaceState(null, "", "#" + s[0]);
  // استبدال الحاوية بنسخة نظيفة لإزالة أي مستمعي أحداث قديمين من الأقسام السابقة
  const fresh = content.cloneNode(false); content.replaceWith(fresh); content = fresh;
  content.innerHTML = `<div class="center-msg muted">جارٍ التحميل...</div>`;
  try { await s[3](); } catch (e) { console.error(e); content.innerHTML = `<div class="panel"><p class="form-msg show err">حدث خطأ: ${esc(e.code || e.message)}. تأكد من نشر قواعد الأمان ومن أن حسابك مسجّل في admins.</p></div>`; }
}

/* ---------- أدوات مشتركة ---------- */
function modal(html, wide = false) {
  const back = document.createElement("div");
  back.className = "modal-back"; back.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  back.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  return { el: back.firstElementChild, close };
}
const ask = (t) => confirm(t);
const tbl = (head, rows, empty = "لا توجد بيانات.") => `<div class="table-wrap"><table class="tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${head.length}" class="muted">${empty}</td></tr>`}</tbody></table></div>`;
const list = async (col, ...c) => (await getDocs(query(collection(db, col), ...c))).docs.map((d) => ({ id: d.id, ...d.data() }));
let catsCache = null;
async function getCats(force) { if (!catsCache || force) catsCache = await list("categories", orderBy("order", "asc")); return catsCache; }
const opts = (cats, type, sel) => `<option value="">—</option>` + cats.filter((c) => c.type === type).map((c) => `<option ${c.name === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("");
const TYPE_LABEL = { grade: "صف دراسي", subject: "مادة", term: "فصل دراسي" };

function uploadFile(file, path, onProg) {
  return new Promise((resolve, reject) => {
    const r = sRef(storage, path);
    const t = uploadBytesResumable(r, file, { contentType: file.type });
    t.on("state_changed", (s) => onProg?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)), reject, async () => resolve({ url: await getDownloadURL(r), path }));
  });
}
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const extOf = (f, fb) => (f.name.split(".").pop() || fb).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || fb;

/* ============================================================
   الإحصائيات
   ============================================================ */
async function renderDash() {
  const [b, u, c, r, st, books] = await Promise.all([
    getCountFromServer(collection(db, "books")), getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "competitions")), getCountFromServer(query(collection(db, "requests"), where("status", "==", "new"))),
    getDoc(doc(db, "settings", "stats")), list("books", orderBy("views", "desc"), limit(500))
  ]);
  const s = st.exists() ? st.data() : {};
  const totalViews = books.reduce((a, x) => a + (x.views || 0), 0), totalDl = books.reduce((a, x) => a + (x.downloads || 0), 0);
  const K = [["book", b.data().count, "كتاب"], ["users", u.data().count, "مستخدم"], ["eye", totalViews, "مشاهدة للكتب"], ["download", totalDl, "تحميل"],
    ["clock", s.visits || 0, "زيارة للموقع"], ["trophy", c.data().count, "مسابقة"], ["mail", r.data().count, "طلب جديد"]];
  content.innerHTML = `<div class="kpis">${K.map(([i, n, t]) => `<div class="kpi"><div class="ico-wrap">${icon(i, 24)}</div><div><b>${fmtNum(n)}</b><span>${t}</span></div></div>`).join("")}</div>
    <div class="panel"><div class="panel-head"><h2>الكتب الأكثر مشاهدة</h2></div>${tbl(["الكتاب", "المشاهدات", "التحميلات"], books.slice(0, 8).map((x) => `<tr><td>${esc(x.title)}</td><td>${fmtNum(x.views)}</td><td>${fmtNum(x.downloads)}</td></tr>`), "لا توجد كتب.")}</div>`;
}

/* ============================================================
   الكتب
   ============================================================ */
async function renderBooks() {
  const books = await list("books", orderBy("createdAt", "desc"), limit(500));
  const draw = (q = "") => {
    const f = books.filter((b) => !q || [b.title, b.author, b.subject, b.grade].join(" ").toLowerCase().includes(q.toLowerCase()));
    $("#bTbl").innerHTML = tbl(["", "الكتاب", "الصف", "المادة", "مشاهدات", "مميز", ""], f.map((b) => `<tr>
      <td>${safeUrl(b.coverUrl) ? `<img class="thumb" src="${esc(safeUrl(b.coverUrl))}" alt="" loading="lazy">` : ""}</td>
      <td><strong>${esc(b.title)}</strong><div class="muted">${esc(b.author || "")}</div></td><td>${esc(b.grade || "—")}</td><td>${esc(b.subject || "—")}</td><td>${fmtNum(b.views)}</td>
      <td>${b.featured ? `<span class="tag ok">نعم</span>` : "—"}</td>
      <td class="row-actions"><button class="btn btn-outline btn-sm" data-edit="${b.id}" type="button">${icon("edit", 14)}</button><button class="btn btn-danger btn-sm" data-del="${b.id}" type="button">${icon("trash", 14)}</button></td></tr>`), "لا توجد كتب.");
  };
  content.innerHTML = `<div class="panel"><div class="panel-head"><h2>إدارة الكتب (${fmtNum(books.length)})</h2>
    <div class="inline-form"><input class="input" id="bSearch" placeholder="بحث..." style="width:200px"><button class="btn btn-gold" id="addBook" type="button">${icon("plus", 16)} إضافة كتاب</button></div></div><div id="bTbl"></div></div>`;
  draw();
  $("#bSearch").addEventListener("input", (e) => draw(e.target.value));
  $("#addBook").addEventListener("click", () => bookForm(null, () => go("books")));
  $("#bTbl").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
    if (ed) bookForm(books.find((x) => x.id === ed.dataset.edit), () => go("books"));
    if (dl) {
      const b = books.find((x) => x.id === dl.dataset.del);
      if (!ask(`حذف الكتاب «${b.title}» نهائيًا مع ملفاته؟`)) return;
      try {
        await Promise.all([b.pdfPath, b.coverPath].filter(Boolean).map((p) => deleteObject(sRef(storage, p)).catch(() => {})));
        await deleteDoc(doc(db, "books", b.id)); toast("تم حذف الكتاب", "success"); go("books");
      } catch (err) { console.error(err); toast("تعذّر الحذف", "error"); }
    }
  });
}

async function bookForm(b, done) {
  const cats = await getCats(); const isNew = !b; b = b || {};
  const m = modal(`<h2>${isNew ? "إضافة كتاب جديد" : "تعديل الكتاب"}</h2>
    <form class="form" id="bf" novalidate><div class="form-msg" id="bfMsg"></div>
      <div class="form-grid"><div class="field"><label>عنوان الكتاب *</label><input class="input" name="title" maxlength="150" value="${esc(b.title || "")}"></div>
        <div class="field"><label>المؤلف</label><input class="input" name="author" maxlength="100" value="${esc(b.author || "")}"></div></div>
      <div class="form-grid"><div class="field"><label>المدرس</label><input class="input" name="teacher" maxlength="100" value="${esc(b.teacher || "")}"></div>
        <div class="field"><label>الصف</label><select class="select" name="grade">${opts(cats, "grade", b.grade)}</select></div></div>
      <div class="form-grid"><div class="field"><label>المادة</label><select class="select" name="subject">${opts(cats, "subject", b.subject)}</select></div>
        <div class="field"><label>الفصل الدراسي</label><select class="select" name="term">${opts(cats, "term", b.term)}</select></div></div>
      <div class="field"><label>الوصف</label><textarea class="textarea" name="description" maxlength="2000">${esc(b.description || "")}</textarea></div>
      <div class="form-grid"><div class="field"><label>ملف PDF ${isNew ? "*" : "(اتركه فارغًا للإبقاء على الحالي)"}</label><input class="input" type="file" name="pdf" accept="application/pdf"><div class="upload-prog" id="pp"><i></i></div></div>
        <div class="field"><label>صورة الغلاف ${isNew ? "" : "(اتركها فارغة للإبقاء على الحالية)"}</label><input class="input" type="file" name="cover" accept="image/jpeg,image/png,image/webp"><div class="upload-prog" id="cp"><i></i></div></div></div>
      <label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="featured" ${b.featured ? "checked" : ""}> كتاب مميز (يظهر في الصفحة الرئيسية)</label>
      <div class="modal-actions"><button class="btn btn-outline" type="button" data-close>إلغاء</button><button class="btn btn-gold" type="submit">حفظ</button></div></form>`, true);
  const f = $("#bf", m.el), msg = (t) => { const e = $("#bfMsg", m.el); e.textContent = t; e.className = "form-msg show err"; };
  const prog = (id) => (p) => { const w = $("#" + id, m.el); w.style.display = "block"; $("i", w).style.width = p + "%"; };
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(f); const title = cleanText(fd.get("title"), 150);
    const pdf = f.pdf.files[0], cover = f.cover.files[0];
    if (title.length < 2) return msg("أدخل عنوان الكتاب.");
    if (isNew && !pdf) return msg("ارفع ملف PDF.");
    if (pdf && (pdf.type !== "application/pdf" || pdf.size > 100 * 1024 * 1024)) return msg("الملف يجب أن يكون PDF بحجم أقصاه 100 ميجابايت.");
    if (cover && (!/^image\/(jpeg|png|webp)$/.test(cover.type) || cover.size > 5 * 1024 * 1024)) return msg("الغلاف: JPG أو PNG أو WEBP بحجم أقصاه 5 ميجابايت.");
    const btn = f.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "جارٍ الحفظ...";
    try {
      const data = {
        title, author: cleanText(fd.get("author"), 100), teacher: cleanText(fd.get("teacher"), 100),
        grade: cleanText(fd.get("grade"), 60), subject: cleanText(fd.get("subject"), 60), term: cleanText(fd.get("term"), 60),
        description: cleanText(fd.get("description"), 2000), featured: !!fd.get("featured")
      };
      if (pdf) {
        const up = await uploadFile(pdf, `books/pdf/${rid()}.pdf`, prog("pp"));
        if (b.pdfPath) deleteObject(sRef(storage, b.pdfPath)).catch(() => {});
        data.pdfUrl = up.url; data.pdfPath = up.path;
      }
      if (cover) {
        const up = await uploadFile(cover, `books/covers/${rid()}.${extOf(cover, "jpg")}`, prog("cp"));
        if (b.coverPath) deleteObject(sRef(storage, b.coverPath)).catch(() => {});
        data.coverUrl = up.url; data.coverPath = up.path;
      }
      if (isNew) await addDoc(collection(db, "books"), { ...data, coverUrl: data.coverUrl || "", coverPath: data.coverPath || "", views: 0, downloads: 0, createdAt: serverTimestamp(), createdBy: state.user.uid });
      else await updateDoc(doc(db, "books", b.id), data);
      toast("تم حفظ الكتاب", "success"); m.close(); done();
    } catch (err) { console.error(err); msg("تعذّر الحفظ: " + (err.code || err.message)); btn.disabled = false; btn.textContent = "حفظ"; }
  });
}

/* ============================================================
   الصفوف / المواد / الفصول
   ============================================================ */
async function renderCats() {
  const cats = await getCats(true);
  content.innerHTML = `<div class="panel"><div class="panel-head"><h2>إضافة قسم</h2></div>
    <form class="inline-form" id="cf"><div class="field"><label>النوع</label><select class="select" name="type"><option value="grade">صف دراسي</option><option value="subject">مادة</option><option value="term">فصل دراسي</option></select></div>
    <div class="field"><label>الاسم</label><input class="input" name="name" maxlength="60" required></div>
    <div class="field" style="max-width:120px"><label>الترتيب</label><input class="input" name="order" type="number" value="${cats.length + 1}" min="0" max="9999"></div>
    <button class="btn btn-gold" type="submit">${icon("plus", 16)} إضافة</button></form></div>
    <div class="panel">${tbl(["النوع", "الاسم", "الترتيب", ""], cats.map((c) => `<tr><td><span class="tag">${TYPE_LABEL[c.type] || c.type}</span></td><td>${esc(c.name)}</td><td>${fmtNum(c.order)}</td>
      <td class="row-actions"><button class="btn btn-danger btn-sm" data-del="${c.id}" type="button">${icon("trash", 14)}</button></td></tr>`), "لا توجد أقسام. ابدأ بإضافة الصفوف والمواد.")}</div>`;
  $("#cf").addEventListener("submit", async (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const name = cleanText(fd.get("name"), 60);
    if (!name) return toast("أدخل الاسم", "error");
    try { await addDoc(collection(db, "categories"), { type: fd.get("type"), name, order: Math.max(0, parseInt(fd.get("order"), 10) || 0) }); toast("تمت الإضافة", "success"); go("cats"); } catch { toast("تعذّر الإضافة", "error"); }
  });
  content.addEventListener("click", async function h(e) {
    const d = e.target.closest("[data-del]"); if (!d) return;
    content.removeEventListener("click", h);
    if (!ask("حذف هذا القسم؟ (الكتب المرتبطة به تحتفظ بالاسم)")) return go("cats");
    try { await deleteDoc(doc(db, "categories", d.dataset.del)); toast("تم الحذف", "success"); } catch { toast("تعذّر الحذف", "error"); }
    go("cats");
  });
}

/* ============================================================
   المستخدمون
   ============================================================ */
async function renderUsers() {
  const users = await list("users", orderBy("createdAt", "desc"), limit(300));
  content.innerHTML = `<div class="panel"><div class="panel-head"><h2>المستخدمون (${fmtNum(users.length)})</h2></div>
    <p class="muted">الإيقاف يمنع المستخدم من استخدام الموقع. لحذف حساب تسجيل الدخول نفسه استخدم Firebase Console ← Authentication. لإضافة مدير جديد أنشئ مستندًا في المجموعة <code>admins</code> بمعرّف المستخدم (UID).</p>
    ${tbl(["الاسم", "اسم المستخدم", "الصف", "تاريخ التسجيل", "الحالة", "UID", ""], users.map((u) => `<tr><td>${esc(u.displayName)}</td><td dir="ltr">${esc(u.username)}</td><td>${esc(u.grade || "—")}</td><td>${fmtDate(u.createdAt)}</td>
      <td>${u.disabled ? `<span class="tag err">موقوف</span>` : `<span class="tag ok">نشط</span>`}</td><td dir="ltr" class="muted" style="font-size:.75rem">${esc(u.id)}</td>
      <td class="row-actions"><button class="btn btn-outline btn-sm" data-tog="${u.id}" type="button">${u.disabled ? "تفعيل" : "إيقاف"}</button><button class="btn btn-danger btn-sm" data-del="${u.id}" type="button">${icon("trash", 14)}</button></td></tr>`), "لا يوجد مستخدمون.")}</div>`;
  content.querySelector(".panel").addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tog]"), d = e.target.closest("[data-del]");
    try {
      if (t) { const u = users.find((x) => x.id === t.dataset.tog); await updateDoc(doc(db, "users", u.id), { disabled: !u.disabled }); toast("تم التحديث", "success"); go("users"); }
      if (d) {
        const u = users.find((x) => x.id === d.dataset.del);
        if (!ask(`حذف بيانات المستخدم «${u.username}»؟ (لن يُحذف حساب الدخول من Authentication)`)) return;
        await deleteDoc(doc(db, "usernames", u.username)).catch(() => {}); await deleteDoc(doc(db, "users", u.id)); toast("تم حذف البيانات", "success"); go("users");
      }
    } catch (err) { console.error(err); toast("تعذّر تنفيذ العملية", "error"); }
  });
}

/* ============================================================
   المسابقات
   ============================================================ */
async function renderComps() {
  const comps = await list("competitions", orderBy("createdAt", "desc"), limit(100));
  content.innerHTML = `<div class="panel"><div class="panel-head"><h2>المسابقات (${fmtNum(comps.length)})</h2><button class="btn btn-gold" id="addC" type="button">${icon("plus", 16)} مسابقة جديدة</button></div>
    ${tbl(["العنوان", "الأسئلة", "المدة", "الحالة", ""], comps.map((c) => `<tr><td><strong>${esc(c.title)}</strong></td><td>${fmtNum((c.questions || []).length)}</td><td>${fmtNum(c.durationMinutes)} د</td>
      <td>${c.active ? `<span class="tag ok">مفتوحة</span>` : `<span class="tag">منتهية</span>`}</td>
      <td class="row-actions"><button class="btn btn-outline btn-sm" data-tog="${c.id}" type="button">${c.active ? "إنهاء" : "فتح"}</button><button class="btn btn-outline btn-sm" data-edit="${c.id}" type="button">${icon("edit", 14)}</button><button class="btn btn-danger btn-sm" data-del="${c.id}" type="button">${icon("trash", 14)}</button></td></tr>`), "لا توجد مسابقات.")}</div>`;
  $("#addC").addEventListener("click", () => compForm(null, () => go("comps")));
  content.addEventListener("click", async function h(e) {
    const t = e.target.closest("[data-tog]"), ed = e.target.closest("[data-edit]"), d = e.target.closest("[data-del]");
    if (!t && !ed && !d) return;
    content.removeEventListener("click", h);
    try {
      if (ed) return compForm(comps.find((x) => x.id === ed.dataset.edit), () => go("comps"));
      if (t) { const c = comps.find((x) => x.id === t.dataset.tog); await updateDoc(doc(db, "competitions", c.id), { active: !c.active }); toast("تم التحديث", "success"); }
      if (d && ask("حذف المسابقة؟ (تبقى نتائجها المسجلة في قاعدة البيانات ولا تظهر)")) { await deleteDoc(doc(db, "competitions", d.dataset.del)); toast("تم الحذف", "success"); }
    } catch (err) { console.error(err); toast("تعذّر تنفيذ العملية", "error"); }
    go("comps");
  });
}

function compForm(c, done) {
  const isNew = !c; c = c || { questions: [], active: true, durationMinutes: 10 };
  const m = modal(`<h2>${isNew ? "مسابقة جديدة" : "تعديل المسابقة"}</h2>
    <form class="form" id="cf2" novalidate><div class="form-msg" id="cfMsg"></div>
      <div class="field"><label>عنوان المسابقة *</label><input class="input" name="title" maxlength="150" value="${esc(c.title || "")}"></div>
      <div class="field"><label>الوصف</label><textarea class="textarea" name="description" maxlength="500" style="min-height:70px">${esc(c.description || "")}</textarea></div>
      <div class="form-grid"><div class="field"><label>المدة (بالدقائق) *</label><input class="input" type="number" name="duration" min="1" max="240" value="${esc(c.durationMinutes || 10)}"></div>
        <label style="display:flex;gap:8px;align-items:center;font-weight:700;padding-top:28px"><input type="checkbox" name="active" ${c.active ? "checked" : ""}> مسابقة مفتوحة</label></div>
      <div class="panel-head"><h3 style="margin:0">الأسئلة</h3><button class="btn btn-outline btn-sm" id="addQ" type="button">${icon("plus", 14)} إضافة سؤال</button></div>
      <div id="qs"></div>
      <div class="modal-actions"><button class="btn btn-outline" type="button" data-close>إلغاء</button><button class="btn btn-gold" type="submit">حفظ المسابقة</button></div></form>`, true);
  const qs = $("#qs", m.el);
  let n = 0;
  const addQ = (q = { text: "", options: ["", "", "", ""], correct: 0 }) => {
    const i = n++; const div = document.createElement("div"); div.className = "q-block";
    div.innerHTML = `<div class="panel-head" style="margin-bottom:6px"><strong class="qn"></strong><button class="btn btn-danger btn-sm" data-rm type="button">${icon("trash", 14)}</button></div>
      <input class="input" data-q placeholder="نص السؤال" maxlength="300" value="${esc(q.text)}">
      ${q.options.map((o, j) => `<div class="opt-row"><input type="radio" name="c${i}" value="${j}" ${q.correct === j ? "checked" : ""} aria-label="الإجابة الصحيحة"><input class="input" type="text" data-o placeholder="الخيار ${j + 1}" maxlength="150" value="${esc(o)}"></div>`).join("")}
      <small class="muted">حدّد الدائرة بجانب الإجابة الصحيحة.</small>`;
    qs.appendChild(div); renum();
  };
  const renum = () => $$(".q-block", qs).forEach((d, k) => ($(".qn", d).textContent = `السؤال ${k + 1}`));
  qs.addEventListener("click", (e) => { const r = e.target.closest("[data-rm]"); if (r) { r.closest(".q-block").remove(); renum(); } });
  (c.questions.length ? c.questions : [undefined]).forEach((q) => addQ(q));
  $("#addQ", m.el).addEventListener("click", () => addQ());

  $("#cf2", m.el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = (t) => { const x = $("#cfMsg", m.el); x.textContent = t; x.className = "form-msg show err"; };
    const fd = new FormData(e.target); const title = cleanText(fd.get("title"), 150);
    const duration = parseInt(fd.get("duration"), 10);
    if (title.length < 2) return msg("أدخل عنوان المسابقة.");
    if (!(duration >= 1 && duration <= 240)) return msg("المدة بين 1 و 240 دقيقة.");
    const questions = [];
    for (const d of $$(".q-block", qs)) {
      const text = cleanText($("[data-q]", d).value, 300); const options = $$("[data-o]", d).map((o) => cleanText(o.value, 150));
      const chk = d.querySelector("input[type=radio]:checked");
      if (!text) return msg("لا يمكن ترك نص سؤال فارغًا.");
      if (options.some((o) => !o)) return msg(`أكمل جميع خيارات السؤال: ${text.slice(0, 30)}`);
      questions.push({ text, options, correct: chk ? +chk.value : 0 });
    }
    if (!questions.length) return msg("أضف سؤالًا واحدًا على الأقل.");
    const data = { title, description: cleanText(fd.get("description"), 500), durationMinutes: duration, active: !!fd.get("active"), questions };
    try {
      if (isNew) await addDoc(collection(db, "competitions"), { ...data, createdAt: serverTimestamp() }); else await updateDoc(doc(db, "competitions", c.id), data);
      toast("تم حفظ المسابقة", "success"); m.close(); done();
    } catch (err) { console.error(err); msg("تعذّر الحفظ: " + (err.code || err.message)); }
  });
}

/* ============================================================
   الطلبات والشكاوى
   ============================================================ */
const RT = { book_request: "طلب كتاب", broken_book: "كتاب لا يعمل", complaint: "شكوى", suggestion: "اقتراح", contact: "تواصل" };
const RS = { new: ["جديد", "warn"], reviewed: ["تمت المراجعة", ""], done: ["منجز", "ok"] };
async function renderReqs() {
  const reqs = await list("requests", orderBy("createdAt", "desc"), limit(300));
  const draw = () => {
    const t = $("#rType").value, s = $("#rStatus").value;
    const f = reqs.filter((r) => (!t || r.type === t) && (!s || r.status === s));
    $("#rTbl").innerHTML = tbl(["النوع", "المرسل", "الموضوع", "التاريخ", "الحالة", ""], f.map((r) => `<tr><td><span class="tag">${RT[r.type] || esc(r.type)}</span></td><td>${esc(r.name)}</td><td>${esc((r.subject || r.message || "").slice(0, 50))}</td><td>${fmtDate(r.createdAt)}</td>
      <td><span class="tag ${(RS[r.status] || ["", ""])[1]}">${(RS[r.status] || [r.status])[0]}</span></td>
      <td class="row-actions"><button class="btn btn-outline btn-sm" data-view="${r.id}" type="button">${icon("eye", 14)}</button><button class="btn btn-danger btn-sm" data-del="${r.id}" type="button">${icon("trash", 14)}</button></td></tr>`), "لا توجد طلبات.");
  };
  content.innerHTML = `<div class="panel"><div class="panel-head"><h2>الطلبات والشكاوى (${fmtNum(reqs.length)})</h2><div class="inline-form">
    <select class="select" id="rType"><option value="">كل الأنواع</option>${Object.entries(RT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
    <select class="select" id="rStatus"><option value="">كل الحالات</option>${Object.entries(RS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select></div></div><div id="rTbl"></div></div>`;
  draw(); $("#rType").addEventListener("change", draw); $("#rStatus").addEventListener("change", draw);
  $("#rTbl").addEventListener("click", async (e) => {
    const v = e.target.closest("[data-view]"), d = e.target.closest("[data-del]");
    if (d) { if (!ask("حذف هذا الطلب؟")) return; try { await deleteDoc(doc(db, "requests", d.dataset.del)); toast("تم الحذف", "success"); go("reqs"); } catch { toast("تعذّر الحذف", "error"); } }
    if (v) {
      const r = reqs.find((x) => x.id === v.dataset.view);
      const m = modal(`<h2>${RT[r.type] || ""}</h2><p><strong>${esc(r.name)}</strong> ${r.contactInfo ? `— <span dir="ltr">${esc(r.contactInfo)}</span>` : ""}</p>
        ${r.subject ? `<p><strong>الموضوع:</strong> ${esc(r.subject)}</p>` : ""}${r.bookExtra ? `<p><strong>تفاصيل:</strong> ${esc(r.bookExtra)}</p>` : ""}
        ${r.bookId ? `<p><a class="link" target="_blank" href="book-details.html?id=${encodeURIComponent(r.bookId)}">فتح الكتاب المبلَّغ عنه</a></p>` : ""}
        <div class="msg-body">${esc(r.message)}</div><p class="muted">${fmtDate(r.createdAt)}</p>
        <div class="modal-actions"><button class="btn btn-outline" data-s="reviewed" type="button">تمت المراجعة</button><button class="btn btn-gold" data-s="done" type="button">منجز</button><button class="btn btn-outline" data-close type="button">إغلاق</button></div>`);
      m.el.addEventListener("click", async (ev) => {
        const b = ev.target.closest("[data-s]"); if (!b) return;
        try { await updateDoc(doc(db, "requests", r.id), { status: b.dataset.s }); toast("تم تحديث الحالة", "success"); m.close(); go("reqs"); } catch { toast("تعذّر التحديث", "error"); }
      });
      if (r.status === "new") updateDoc(doc(db, "requests", r.id), { status: "reviewed" }).then(() => (r.status = "reviewed")).catch(() => {});
    }
  });
}

/* ============================================================
   الإعلانات والتنبيهات
   ============================================================ */
async function renderAnn() {
  const items = await list("announcements", orderBy("createdAt", "desc"), limit(50));
  content.innerHTML = `<div class="panel"><div class="panel-head"><h2>إضافة تنبيه</h2></div>
    <form class="inline-form" id="af"><div class="field" style="flex:3"><label>نص التنبيه</label><input class="input" name="text" maxlength="250" required></div>
      <div class="field"><label>النوع</label><select class="select" name="type"><option value="info">معلومة</option><option value="success">نجاح</option><option value="warning">تنبيه</option><option value="danger">هام</option></select></div>
      <button class="btn btn-gold" type="submit">${icon("plus", 16)} نشر</button></form></div>
    <div class="panel">${tbl(["النص", "النوع", "الحالة", ""], items.map((a) => `<tr><td>${esc(a.text)}</td><td>${esc(a.type)}</td><td>${a.active ? `<span class="tag ok">ظاهر</span>` : `<span class="tag">مخفي</span>`}</td>
      <td class="row-actions"><button class="btn btn-outline btn-sm" data-tog="${a.id}" type="button">${a.active ? "إخفاء" : "إظهار"}</button><button class="btn btn-danger btn-sm" data-del="${a.id}" type="button">${icon("trash", 14)}</button></td></tr>`), "لا توجد تنبيهات.")}</div>`;
  $("#af").addEventListener("submit", async (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const text = cleanText(fd.get("text"), 250);
    if (!text) return toast("اكتب نص التنبيه", "error");
    try { await addDoc(collection(db, "announcements"), { text, type: fd.get("type"), active: true, createdAt: serverTimestamp() }); toast("تم النشر", "success"); go("ann"); } catch { toast("تعذّر النشر", "error"); }
  });
  content.addEventListener("click", async function h(e) {
    const t = e.target.closest("[data-tog]"), d = e.target.closest("[data-del]"); if (!t && !d) return;
    content.removeEventListener("click", h);
    try {
      if (t) { const a = items.find((x) => x.id === t.dataset.tog); await updateDoc(doc(db, "announcements", a.id), { active: !a.active }); }
      if (d && ask("حذف التنبيه؟")) await deleteDoc(doc(db, "announcements", d.dataset.del));
      toast("تم", "success");
    } catch { toast("تعذّر تنفيذ العملية", "error"); }
    go("ann");
  });
}

/* ============================================================
   محتوى الصفحة الرئيسية والموقع
   ============================================================ */
async function renderSite() {
  const s = { siteName: "", tagline: "", heroTitle: "", heroSubtitle: "", footerText: "", contactEmail: "", contactPhone: "", ...((await getDoc(doc(db, "settings", "site"))).data() || {}) };
  const fld = (k, l, max, ta) => `<div class="field"><label>${l}</label>${ta ? `<textarea class="textarea" name="${k}" maxlength="${max}" style="min-height:90px">${esc(s[k])}</textarea>` : `<input class="input" name="${k}" maxlength="${max}" value="${esc(s[k])}">`}</div>`;
  content.innerHTML = `<div class="panel" style="max-width:760px"><form class="form" id="sf"><div class="form-msg" id="sfMsg"></div>
    ${fld("siteName", "اسم المدرسة / المكتبة", 80)}${fld("tagline", "العبارة تحت الاسم", 80)}${fld("heroTitle", "عنوان القسم الترحيبي (Hero)", 100)}${fld("heroSubtitle", "النص التعريفي", 300, true)}${fld("footerText", "نص التذييل", 300, true)}
    <div class="form-grid">${fld("contactEmail", "بريد التواصل", 100)}${fld("contactPhone", "هاتف التواصل", 30)}</div>
    <p class="muted">لإدارة «الكتب المميزة» فعّل خيار «كتاب مميز» داخل نموذج تعديل الكتاب.</p>
    <button class="btn btn-gold" type="submit">حفظ</button></form></div>`;
  $("#sf").addEventListener("submit", async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const data = { siteName: cleanText(fd.get("siteName"), 80), tagline: cleanText(fd.get("tagline"), 80), heroTitle: cleanText(fd.get("heroTitle"), 100), heroSubtitle: cleanText(fd.get("heroSubtitle"), 300),
      footerText: cleanText(fd.get("footerText"), 300), contactEmail: cleanText(fd.get("contactEmail"), 100), contactPhone: cleanText(fd.get("contactPhone"), 30) };
    if (!data.siteName) return toast("اسم المكتبة مطلوب", "error");
    try { await setDoc(doc(db, "settings", "site"), data, { merge: true }); toast("تم حفظ محتوى الصفحة الرئيسية", "success"); } catch (err) { console.error(err); toast("تعذّر الحفظ", "error"); }
  });
}

go(location.hash.slice(1) || "dash");
