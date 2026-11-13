// contact.js — الطلبات والشكاوى والاقتراحات والبلاغات (تُحفظ في Firestore: requests)
import { initPage, $, $$, toast, state, cleanText, param, isConfigured, db } from "./app.js";
import { collection, addDoc, serverTimestamp } from "./firebase.js";

await initPage();

const TYPES = {
  book_request: { label: "طلب إضافة كتاب", book: true, msg: "تفاصيل إضافية عن الكتاب المطلوب" },
  broken_book: { label: "بلاغ عن كتاب لا يعمل", book: true, msg: "صِف المشكلة (لا يفتح، ملف تالف، صفحات ناقصة...)" },
  complaint: { label: "شكوى", book: false, msg: "اكتب شكواك بالتفصيل" },
  suggestion: { label: "اقتراح", book: false, msg: "اكتب اقتراحك" },
  contact: { label: "تواصل مع الإدارة", book: false, msg: "رسالتك" }
};
let type = TYPES[param("type")] ? param("type") : "contact";
const bookId = (param("book") || "").slice(0, 60);

function setType(t) {
  type = t; const c = TYPES[t];
  $$("#types .tab").forEach((b) => { b.classList.toggle("active", b.dataset.type === t); b.setAttribute("aria-selected", b.dataset.type === t); });
  $("#bookFields").hidden = !c.book; $("#msgLabel").textContent = c.msg;
  $("#subjectField").hidden = c.book;
  history.replaceState(null, "", `?type=${t}`);
}
$$("#types .tab").forEach((b) => b.addEventListener("click", () => setType(b.dataset.type)));
setType(type);
if (param("title")) $("#bookTitle").value = cleanText(param("title"), 150);
if (state.profile) $("#name").value = state.profile.displayName || "";
$("#message").addEventListener("input", (e) => ($("#cnt").textContent = e.target.value.length));

function msg(text, ok) { const m = $("#msg"); m.textContent = text; m.className = `form-msg show ${ok ? "ok" : "err"}`; }

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isConfigured) return msg("الموقع غير مرتبط بـ Firebase بعد.");
  const c = TYPES[type];
  const data = {
    type, status: "new",
    name: cleanText($("#name").value, 60),
    contactInfo: cleanText($("#contactInfo").value, 100),
    subject: c.book ? cleanText($("#bookTitle").value, 150) : cleanText($("#subject").value, 120),
    bookExtra: c.book ? cleanText($("#bookExtra").value, 150) : "",
    bookId: type === "broken_book" ? bookId : "",
    message: cleanText($("#message").value, 2000),
    uid: state.user?.uid || "",
    createdAt: serverTimestamp()
  };
  if (data.name.length < 2) return msg("أدخل اسمك.");
  if (c.book && data.subject.length < 2) return msg("أدخل اسم الكتاب.");
  if (data.message.length < 5) return msg("الرسالة قصيرة جدًا.");
  // حد بسيط لمنع الإرسال المتكرر من نفس المتصفح (الحماية الفعلية في Rules)
  const last = +localStorage.getItem("lastReq") || 0;
  if (Date.now() - last < 20000) return msg("انتظر قليلًا قبل إرسال طلب آخر.");

  const btn = $("#submit"); btn.disabled = true;
  try {
    await addDoc(collection(db, "requests"), data);
    localStorage.setItem("lastReq", Date.now());
    $("#form").reset(); $("#cnt").textContent = "0";
    if (state.profile) $("#name").value = state.profile.displayName || "";
    msg("تم إرسال طلبك بنجاح. شكرًا لك!", true); toast("تم الإرسال", "success");
  } catch (err) { console.error(err); msg("تعذّر الإرسال. حاول لاحقًا."); }
  btn.disabled = false;
});
