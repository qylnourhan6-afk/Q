// auth.js — تسجيل الدخول / إنشاء حساب / استعادة كلمة المرور
// آلية الربط: اسم المستخدم ⇄ بريد داخلي (username@users.elibrary.app) لا يراه المستخدم.
// كلمات المرور تُدار بالكامل داخل Firebase Authentication ولا تُخزَّن في أي مكان آخر.
import { initPage, $, $$, toast, state, cleanText, isConfigured, showConfigWarning } from "./app.js";
import {
  auth, db, usernameToEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence, deleteUser,
  doc, getDoc, writeBatch, setDoc, increment, serverTimestamp, collection, getDocs, query, orderBy
} from "./firebase.js";

const page = document.body.dataset.page;
await initPage({ noChrome: true });
if (!isConfigured) { /* التحذير ظاهر؛ نمنع الإرسال لاحقًا */ }
if (state.user && page !== "forgot") location.replace(safeNext() || "profile.html");

const form = $("#form"), msg = $("#msg"), submit = $("#submit");

/* ---------- أدوات ---------- */
function safeNext() {
  const n = new URLSearchParams(location.search).get("next");
  return n && /^[\w\-.]+\.html(\?[\w\-=&%.]*)?$/i.test(n) ? n : "";
}
function showMsg(text, ok = false) { msg.textContent = text; msg.className = `form-msg show ${ok ? "ok" : "err"}`; }
function setErr(id, text) {
  const el = $(`[data-for="${id}"]`); if (el) el.textContent = text || "";
  $("#" + id)?.classList.toggle("invalid", !!text);
}
function clearErrs() { $$(".field-err").forEach((e) => (e.textContent = "")); $$(".invalid").forEach((e) => e.classList.remove("invalid")); msg.className = "form-msg"; }
function busy(b, label) { submit.disabled = b; if (label) submit.dataset.l ??= submit.textContent; submit.textContent = b ? label : submit.dataset.l || submit.textContent; }
const USER_RE = /^[a-z0-9][a-z0-9_.]{2,19}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authError(e) {
  const c = e?.code || "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(c)) return "اسم المستخدم أو كلمة المرور غير صحيحة.";
  if (c === "auth/too-many-requests") return "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.";
  if (c === "auth/network-request-failed") return "تعذّر الاتصال بالإنترنت.";
  if (c === "auth/email-already-in-use") return "اسم المستخدم مستخدم بالفعل.";
  if (c === "auth/weak-password") return "كلمة المرور ضعيفة جدًا.";
  if (c === "auth/user-disabled") return "هذا الحساب موقوف.";
  if (c === "permission-denied" || c === "auth/operation-not-allowed") return "إعدادات Firebase غير مكتملة (راجع README.md).";
  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

// إظهار/إخفاء كلمة المرور
$$("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
  const i = $("#" + b.dataset.toggle); const show = i.type === "password"; i.type = show ? "text" : "password"; b.textContent = show ? "إخفاء" : "إظهار";
}));

/* ---------- تسجيل الدخول ---------- */
if (page === "login") {
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); clearErrs();
    if (!isConfigured) return showMsg("الموقع غير مرتبط بـ Firebase بعد.");
    const u = $("#username").value.trim(), p = $("#password").value;
    let bad = false;
    if (!u) { setErr("username", "أدخل اسم المستخدم."); bad = true; }
    if (!p) { setErr("password", "أدخل كلمة المرور."); bad = true; }
    if (bad) return;
    // يقبل اسم المستخدم أو بريد الاسترداد (إن تم ربطه)
    const email = u.includes("@") ? u : usernameToEmail(u);
    if (!u.includes("@") && !USER_RE.test(u.toLowerCase())) return showMsg("اسم المستخدم أو كلمة المرور غير صحيحة.");
    busy(true, "جارٍ الدخول...");
    try {
      await setPersistence(auth, $("#remember").checked ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, p);
      const prof = await getDoc(doc(db, "users", cred.user.uid));
      if (prof.exists() && prof.data().disabled) { await auth.signOut(); busy(false); return showMsg("هذا الحساب موقوف. تواصل مع الإدارة."); }
      toast("تم تسجيل الدخول بنجاح", "success");
      setTimeout(() => (location.href = safeNext() || "index.html"), 600);
    } catch (err) { console.warn(err.code); showMsg(authError(err)); busy(false); }
  });
}

/* ---------- إنشاء حساب ---------- */
if (page === "register") {
  // قائمة الصفوف من الأقسام (إن وجدت)
  if (isConfigured) getDocs(query(collection(db, "categories"), orderBy("order", "asc"))).then((s) => {
    s.docs.map((d) => d.data()).filter((c) => c.type === "grade").forEach((c) => {
      const o = document.createElement("option"); o.value = o.textContent = c.name; $("#grade").appendChild(o);
    });
  }).catch(() => {});

  $("#password").addEventListener("input", (e) => {
    const v = e.target.value; let s = 0;
    if (v.length >= 8) s++; if (/[a-z]/i.test(v) && /\d/.test(v)) s++; if (/[^a-z0-9]/i.test(v)) s++; if (v.length >= 12) s++;
    const m = $("#meter"); m.style.width = s * 25 + "%"; m.style.background = ["#c0392b", "#c0392b", "#c98a1b", "#1f8f5f", "#1f8f5f"][s];
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); clearErrs();
    if (!isConfigured) return showMsg("الموقع غير مرتبط بـ Firebase بعد.");
    const displayName = cleanText($("#displayName").value, 40);
    const username = $("#username").value.trim().toLowerCase();
    const grade = cleanText($("#grade").value, 60);
    const pw = $("#password").value, pw2 = $("#confirm").value;
    let bad = false;
    if (displayName.length < 2) { setErr("displayName", "أدخل اسمًا من حرفين على الأقل."); bad = true; }
    if (!USER_RE.test(username)) { setErr("username", "اسم المستخدم غير صالح (3–20: حروف إنجليزية صغيرة وأرقام و _ .)."); bad = true; }
    if (pw.length < 8 || !/[a-z]/i.test(pw) || !/\d/.test(pw)) { setErr("password", "8 أحرف على الأقل مع حروف وأرقام."); bad = true; }
    if (pw !== pw2) { setErr("confirm", "كلمتا المرور غير متطابقتين."); bad = true; }
    if (bad) return;

    busy(true, "جارٍ إنشاء الحساب...");
    try {
      if ((await getDoc(doc(db, "usernames", username))).exists()) { setErr("username", "اسم المستخدم محجوز، اختر اسمًا آخر."); return busy(false); }
      const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), pw);
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, "usernames", username), { uid: cred.user.uid });
        batch.set(doc(db, "users", cred.user.uid), { username, displayName, grade, createdAt: serverTimestamp() });
        await batch.commit();
      } catch (err) {
        // فشل حفظ البيانات (مثلًا الاسم أُخذ في نفس اللحظة): نحذف حساب Auth الذي أُنشئ للتو
        await deleteUser(cred.user).catch(() => {});
        throw err;
      }
      setDoc(doc(db, "settings", "stats"), { users: increment(1) }, { merge: true }).catch(() => {});
      toast("تم إنشاء حسابك بنجاح!", "success");
      setTimeout(() => (location.href = safeNext() || "index.html"), 700);
    } catch (err) {
      console.warn(err.code || err);
      if (err.code === "permission-denied") setErr("username", "اسم المستخدم محجوز، اختر اسمًا آخر.");
      else showMsg(authError(err));
      busy(false);
    }
  });
}

/* ---------- استعادة كلمة المرور ---------- */
if (page === "forgot") {
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); clearErrs();
    if (!isConfigured) return showMsg("الموقع غير مرتبط بـ Firebase بعد.");
    const email = $("#email").value.trim();
    if (!EMAIL_RE.test(email)) return setErr("email", "أدخل بريدًا إلكترونيًا صحيحًا.");
    busy(true, "جارٍ الإرسال...");
    try { await sendPasswordResetEmail(auth, email); } catch (err) { if (err.code === "auth/network-request-failed") { busy(false); return showMsg(authError(err)); } }
    // رسالة موحّدة حتى لا نكشف وجود البريد من عدمه
    showMsg("إن كان هذا البريد مرتبطًا بحساب، فقد أرسلنا إليه رابط الاستعادة. تفقّد الوارد والبريد المزعج.", true);
    busy(false);
  });
}
