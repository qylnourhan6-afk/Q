// profile.js — الملف الشخصي والمفضلة وسجل القراءة
import { initPage, $, $$, esc, toast, state, cleanText, fmtDate, fmtNum, bookCard, bindFavorites, emptyState, icon, isConfigured, db } from "./app.js";
import {
  auth, doc, getDoc, getDocs, updateDoc, collection, query, orderBy, limit, deleteDoc,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, verifyBeforeUpdateEmail
} from "./firebase.js";

await initPage({ requireAuth: true });
if (!state.user) await new Promise(() => {}); // جارٍ التحويل لصفحة الدخول

const user = state.user, uid = user.uid;
const prof = state.profile || {};
const loaded = new Set();

$("#head").innerHTML = `<div class="avatar">${esc((prof.displayName || prof.username || "؟").charAt(0))}</div>
  <div><h1 style="margin:0">${esc(prof.displayName || "")}</h1><p class="muted" style="margin:0" dir="ltr">@${esc(prof.username || "")}</p>
  <p class="muted" style="margin:4px 0 0">${prof.createdAt ? "عضو منذ " + fmtDate(prof.createdAt) : ""}</p></div>`;

$("#displayName").value = prof.displayName || "";
$("#username").value = prof.username || "";

getDocs(query(collection(db, "categories"), orderBy("order", "asc"))).then((s) => {
  s.docs.map((d) => d.data()).filter((c) => c.type === "grade").forEach((c) => {
    const o = document.createElement("option"); o.value = o.textContent = c.name; $("#grade").appendChild(o);
  });
  $("#grade").value = prof.grade || "";
}).catch(() => {});

/* ---------- التبويبات ---------- */
function openTab(name) {
  $$(".tab").forEach((t) => { t.classList.toggle("active", t.dataset.tab === name); t.setAttribute("aria-selected", t.dataset.tab === name); });
  $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
  if (!loaded.has(name)) { loaded.add(name); ({ favs: loadFavs, history: loadHistory, quiz: loadQuiz }[name] || (() => {}))(); }
  history.replaceState(null, "", "#" + name);
}
$$(".tab").forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab)));
const h = location.hash.slice(1); if (["info", "security", "favs", "history", "quiz"].includes(h)) openTab(h);

function msg(id, text, ok) { const m = $(id); m.textContent = text; m.className = `form-msg show ${ok ? "ok" : "err"}`; }

/* ---------- تعديل البيانات ---------- */
$("#infoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const displayName = cleanText($("#displayName").value, 40), grade = cleanText($("#grade").value, 60);
  if (displayName.length < 2) return msg("#infoMsg", "أدخل اسمًا من حرفين على الأقل.");
  try {
    await updateDoc(doc(db, "users", uid), { displayName, grade });
    msg("#infoMsg", "تم حفظ التعديلات.", true); toast("تم الحفظ", "success");
    $("#head h1").textContent = displayName;
  } catch (err) { console.error(err); msg("#infoMsg", "تعذّر حفظ التعديلات."); }
});

/* ---------- تغيير كلمة المرور ---------- */
async function reauth(pw) { await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw)); }
function pwErr(err) {
  return ["auth/invalid-credential", "auth/wrong-password"].includes(err.code) ? "كلمة المرور الحالية غير صحيحة."
    : err.code === "auth/too-many-requests" ? "محاولات كثيرة، حاول لاحقًا." : "حدث خطأ، حاول مرة أخرى.";
}
$("#pwForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cur = $("#curPw").value, n1 = $("#newPw").value, n2 = $("#newPw2").value;
  if (!cur) return msg("#pwMsg", "أدخل كلمة المرور الحالية.");
  if (n1.length < 8 || !/[a-z]/i.test(n1) || !/\d/.test(n1)) return msg("#pwMsg", "كلمة المرور الجديدة: 8 أحرف على الأقل مع حروف وأرقام.");
  if (n1 !== n2) return msg("#pwMsg", "كلمتا المرور الجديدتان غير متطابقتين.");
  if (n1 === cur) return msg("#pwMsg", "الكلمة الجديدة يجب أن تختلف عن الحالية.");
  try { await reauth(cur); await updatePassword(auth.currentUser, n1); $("#pwForm").reset(); msg("#pwMsg", "تم تغيير كلمة المرور بنجاح.", true); toast("تم تغيير كلمة المرور", "success"); }
  catch (err) { console.warn(err.code); msg("#pwMsg", pwErr(err)); }
});

/* ---------- ربط بريد الاسترداد ---------- */
$("#mailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#recEmail").value.trim(), pw = $("#mailPw").value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg("#mailMsg", "أدخل بريدًا صحيحًا.");
  if (!pw) return msg("#mailMsg", "أدخل كلمة المرور الحالية.");
  try {
    await reauth(pw);
    await verifyBeforeUpdateEmail(auth.currentUser, email);
    msg("#mailMsg", "أرسلنا رابط تأكيد إلى بريدك. بعد التأكيد سجّل الدخول بهذا البريد.", true);
  } catch (err) {
    console.warn(err.code);
    msg("#mailMsg", err.code === "auth/email-already-in-use" ? "هذا البريد مستخدم في حساب آخر." : pwErr(err));
  }
});

/* ---------- المفضلة ---------- */
async function loadFavs() {
  const grid = $("#favGrid"); grid.innerHTML = "";
  try {
    const favSnap = await getDocs(collection(db, "users", uid, "favorites"));
    const favs = new Set(favSnap.docs.map((d) => d.id));
    const books = (await Promise.all([...favs].map((id) => getDoc(doc(db, "books", id)).catch(() => null))))
      .filter((s) => s && s.exists()).map((s) => ({ id: s.id, ...s.data() }));
    grid.innerHTML = books.length ? books.map((b) => bookCard(b, favs)).join("") : emptyState("لم تضف كتبًا إلى المفضلة بعد.", `<a class="btn btn-gold" href="library.html">تصفح المكتبة</a>`);
    bindFavorites(grid, favs);
  } catch (e) { console.error(e); grid.innerHTML = emptyState("تعذّر تحميل المفضلة."); }
}

/* ---------- سجل القراءة ---------- */
async function loadHistory() {
  const body = $("#histBody");
  try {
    const s = await getDocs(query(collection(db, "users", uid, "history"), orderBy("updatedAt", "desc"), limit(50)));
    body.innerHTML = s.empty ? `<tr><td colspan="4" class="muted">لم تقرأ أي كتاب بعد.</td></tr>` : s.docs.map((d) => {
      const x = d.data();
      return `<tr><td>${esc(x.title)}</td><td>${fmtNum(x.lastPage)} / ${fmtNum(x.totalPages)}</td><td>${fmtDate(x.updatedAt)}</td>
        <td style="white-space:nowrap"><a class="btn btn-gold btn-sm" href="reader.html?id=${encodeURIComponent(d.id)}">متابعة</a>
        <button class="btn btn-outline btn-sm" data-del="${esc(d.id)}" type="button" aria-label="حذف من السجل">${icon("trash", 14)}</button></td></tr>`;
    }).join("");
  } catch (e) { console.error(e); body.innerHTML = `<tr><td colspan="4">تعذّر تحميل السجل.</td></tr>`; }
}
$("#histBody").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del]"); if (!b) return;
  try { await deleteDoc(doc(db, "users", uid, "history", b.dataset.del)); b.closest("tr").remove(); toast("تم الحذف من السجل", "success"); } catch { toast("تعذّر الحذف", "error"); }
});

/* ---------- سجل المسابقات ---------- */
async function loadQuiz() {
  const body = $("#quizBody");
  try {
    const s = await getDocs(query(collection(db, "users", uid, "attempts"), orderBy("createdAt", "desc"), limit(50)));
    body.innerHTML = s.empty ? `<tr><td colspan="3" class="muted">لم تشارك في أي مسابقة بعد.</td></tr>` : s.docs.map((d) => {
      const x = d.data();
      return `<tr><td>${esc(x.title)}</td><td><strong>${fmtNum(x.score)}</strong> / ${fmtNum(x.total)}</td><td>${fmtDate(x.createdAt)}</td></tr>`;
    }).join("");
  } catch (e) { console.error(e); body.innerHTML = `<tr><td colspan="3">تعذّر تحميل السجل.</td></tr>`; }
}
