// book-details.js — صفحة تفاصيل الكتاب
import { initPage, $, esc, icon, safeUrl, fmtDate, fmtNum, param, toast, state, bookCard, getFavoriteIds, bindFavorites, fetchBooks, emptyState, isConfigured, db } from "./app.js";
import { doc, getDoc, updateDoc, increment, setDoc, deleteDoc, serverTimestamp, where } from "./firebase.js";

await initPage();
const box = $("#box");
const id = param("id");

if (!isConfigured) box.innerHTML = emptyState("اربط الموقع بـ Firebase أولًا.");
else if (!id) box.innerHTML = emptyState("لم يتم تحديد الكتاب.", `<a class="btn btn-gold" href="library.html">إلى المكتبة</a>`);
else load();

async function load() {
  try {
    const snap = await getDoc(doc(db, "books", id));
    if (!snap.exists()) { box.innerHTML = emptyState("الكتاب غير موجود أو تم حذفه.", `<a class="btn btn-gold" href="library.html">إلى المكتبة</a>`); return; }
    const b = { id: snap.id, ...snap.data() };
    document.title = `${b.title} | ${document.title.split("|").pop().trim()}`;

    // عدّاد المشاهدات: مرة لكل جلسة لكل كتاب
    const key = "viewed_" + id;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      updateDoc(doc(db, "books", id), { views: increment(1) }).then(() => { b.views = (b.views || 0) + 1; $("#vCount") && ($("#vCount").textContent = fmtNum(b.views)); }).catch(() => {});
    }

    const favs = await getFavoriteIds();
    const cover = safeUrl(b.coverUrl), pdf = safeUrl(b.pdfUrl);
    box.innerHTML = `<div class="card"><div class="book-detail">
      <div class="detail-cover">${cover ? `<img src="${esc(cover)}" alt="غلاف ${esc(b.title)}">` : `<div class="cover-ph">${icon("book", 80)}</div>`}</div>
      <div class="detail-info">
        <div class="chips">${b.grade ? `<span class="chip">${esc(b.grade)}</span>` : ""}${b.subject ? `<span class="chip">${esc(b.subject)}</span>` : ""}${b.term ? `<span class="chip">${esc(b.term)}</span>` : ""}${b.featured ? `<span class="chip" style="background:var(--gold-300)">مميز</span>` : ""}</div>
        <h1>${esc(b.title)}</h1>
        <p class="muted">${b.author ? "تأليف: " + esc(b.author) : ""}</p>
        <div class="info-grid">
          <div class="info-item"><small>المدرس</small><b>${esc(b.teacher || "—")}</b></div>
          <div class="info-item"><small>تاريخ الإضافة</small><b>${fmtDate(b.createdAt)}</b></div>
          <div class="info-item"><small>المشاهدات</small><b id="vCount">${fmtNum(b.views)}</b></div>
          <div class="info-item"><small>التحميلات</small><b id="dCount">${fmtNum(b.downloads)}</b></div>
        </div>
        <h3>الوصف</h3><p class="desc">${esc(b.description || "لا يوجد وصف.")}</p>
        <div class="actions">
          <a class="btn btn-gold btn-lg" href="reader.html?id=${encodeURIComponent(b.id)}">${icon("book", 20)} قراءة الكتاب</a>
          ${pdf ? `<a class="btn btn-navy btn-lg" id="dl" href="${esc(pdf)}" target="_blank" rel="noopener" download>${icon("download", 20)} تحميل PDF</a>` : ""}
          <button class="btn btn-outline btn-lg" id="favBtn" type="button">${icon("heart", 20)} <span>${favs.has(b.id) ? "إزالة من المفضلة" : "أضف للمفضلة"}</span></button>
          <a class="btn btn-outline" href="contact.html?type=broken_book&book=${encodeURIComponent(b.id)}&title=${encodeURIComponent(b.title)}">${icon("flag", 18)} الإبلاغ عن مشكلة</a>
        </div></div></div></div>`;

    $("#dl")?.addEventListener("click", () => {
      updateDoc(doc(db, "books", id), { downloads: increment(1) }).then(() => { $("#dCount").textContent = fmtNum((b.downloads || 0) + 1); b.downloads = (b.downloads || 0) + 1; }).catch(() => {});
    });

    $("#favBtn").addEventListener("click", async () => {
      if (!state.user) { toast("سجّل الدخول لاستخدام المفضلة", "info"); return; }
      const ref = doc(db, "users", state.user.uid, "favorites", id);
      try {
        if (favs.has(id)) { await deleteDoc(ref); favs.delete(id); toast("أُزيل من المفضلة", "info"); }
        else { await setDoc(ref, { bookId: id, createdAt: serverTimestamp() }); favs.add(id); toast("أُضيف إلى المفضلة", "success"); }
        $("#favBtn span").textContent = favs.has(id) ? "إزالة من المفضلة" : "أضف للمفضلة";
      } catch (e) { toast("تعذّر تنفيذ العملية", "error"); }
    });

    // كتب مشابهة (نفس المادة)
    if (b.subject) {
      const rel = (await fetchBooks([where("subject", "==", b.subject)], 9)).filter((x) => x.id !== b.id).slice(0, 4);
      if (rel.length) { $("#relSec").hidden = false; $("#related").innerHTML = rel.map((x) => bookCard(x, favs)).join(""); bindFavorites($("#related"), favs); }
    }
  } catch (e) {
    console.error(e); box.innerHTML = emptyState("تعذّر تحميل بيانات الكتاب.");
  }
}
