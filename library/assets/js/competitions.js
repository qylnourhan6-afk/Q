// competitions.js — عرض المسابقات، حل الأسئلة، حساب النتيجة، لوحة الترتيب
import { initPage, $, esc, icon, toast, state, fmtNum, fmtDate, param, emptyState, isConfigured, db } from "./app.js";
import { collection, getDocs, getDoc, doc, query, where, orderBy, limit, writeBatch, serverTimestamp } from "./firebase.js";

await initPage();
const listView = $("#listView"), quizView = $("#quizView");

if (!isConfigured) { listView.innerHTML = emptyState("اربط الموقع بـ Firebase لعرض المسابقات."); }
else if (param("id")) openCompetition(param("id"));
else loadList();

function compCard(d, past) {
  const c = d.data();
  return `<div class="comp-card"><h3>${esc(c.title)}</h3><p class="muted">${esc((c.description || "").slice(0, 120))}</p>
    <div class="meta-row"><span>${icon("clock", 16)} ${fmtNum(c.durationMinutes)} دقيقة</span><span>${icon("check", 16)} ${fmtNum((c.questions || []).length)} سؤال</span></div>
    <a class="btn ${past ? "btn-outline" : "btn-navy"} btn-sm" href="competitions.html?id=${d.id}">${past ? "لوحة الترتيب" : "ابدأ المسابقة"}</a></div>`;
}

async function loadList() {
  try {
    const snap = await getDocs(query(collection(db, "competitions"), orderBy("createdAt", "desc"), limit(60)));
    const act = snap.docs.filter((d) => d.data().active), past = snap.docs.filter((d) => !d.data().active);
    $("#activeList").innerHTML = act.length ? act.map((d) => compCard(d, false)).join("") : emptyState("لا توجد مسابقات متاحة حاليًا.");
    $("#pastList").innerHTML = past.length ? past.map((d) => compCard(d, true)).join("") : emptyState("لا توجد مسابقات سابقة.");
  } catch (e) { console.error(e); listView.innerHTML = emptyState("تعذّر تحميل المسابقات."); }
}

/* ---------- فتح مسابقة ---------- */
async function openCompetition(id) {
  listView.hidden = true; quizView.hidden = false;
  quizView.innerHTML = `<div class="center-msg muted">جارٍ التحميل...</div>`;
  try {
    const snap = await getDoc(doc(db, "competitions", id));
    if (!snap.exists()) { quizView.innerHTML = emptyState("المسابقة غير موجودة.", `<a class="btn btn-gold" href="competitions.html">العودة</a>`); return; }
    const comp = { id: snap.id, ...snap.data() };
    document.title = comp.title;
    let attempt = null;
    if (state.user) { const a = await getDoc(doc(db, "users", state.user.uid, "attempts", id)); if (a.exists()) attempt = a.data(); }

    if (attempt) return showResult(comp, attempt, null);
    if (!comp.active) return showBoard(comp, `<div class="card"><h2>${esc(comp.title)}</h2><p class="muted">هذه المسابقة منتهية.</p></div>`);
    showIntro(comp);
  } catch (e) { console.error(e); quizView.innerHTML = emptyState("تعذّر تحميل المسابقة."); }
}

function showIntro(comp) {
  const qs = comp.questions || [];
  quizView.innerHTML = `<div class="card" style="max-width:720px;margin-inline:auto;text-align:center">
    <h2>${esc(comp.title)}</h2><p class="muted">${esc(comp.description || "")}</p>
    <div class="meta-row" style="justify-content:center;margin-bottom:18px"><span>${icon("clock", 16)} ${fmtNum(comp.durationMinutes)} دقيقة</span><span>${icon("check", 16)} ${fmtNum(qs.length)} سؤال</span></div>
    <p class="muted">لديك محاولة واحدة فقط. عند انتهاء الوقت تُسلَّم إجاباتك تلقائيًا.</p>
    ${!qs.length ? `<p class="form-msg show err">لا توجد أسئلة في هذه المسابقة بعد.</p>` : state.user
      ? `<button class="btn btn-gold btn-lg" id="startBtn" type="button">ابدأ الآن</button>`
      : `<a class="btn btn-gold btn-lg" href="login.html?next=${encodeURIComponent("competitions.html?id=" + comp.id)}">سجّل الدخول للمشاركة</a>`}
    <div style="margin-top:12px"><a class="link" href="competitions.html">كل المسابقات</a></div></div>
    <div id="board" style="margin-top:24px"></div>`;
  $("#startBtn")?.addEventListener("click", () => startQuiz(comp));
  loadBoard(comp.id, $("#board"));
}

/* ---------- حل المسابقة ---------- */
function startQuiz(comp) {
  const qs = comp.questions; const startedAt = Date.now(); const total = Math.max(1, comp.durationMinutes || 10) * 60;
  let finished = false, tick;
  quizView.innerHTML = `<div class="quiz-bar"><strong>${esc(comp.title)}</strong><span class="timer" id="timer" role="timer">--:--</span></div>
    <form id="qForm">${qs.map((q, i) => `<div class="q-card"><h3>${i + 1}. ${esc(q.text)}</h3>
      ${(q.options || []).map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"> <span>${esc(o)}</span></label>`).join("")}</div>`).join("")}
      <div style="text-align:center"><button class="btn btn-gold btn-lg" type="submit">تسليم الإجابات</button></div></form>`;
  window.scrollTo({ top: 0, behavior: "smooth" });

  const timerEl = $("#timer");
  const update = () => {
    const left = Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000));
    timerEl.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    timerEl.classList.toggle("low", left <= 30);
    if (left <= 0) { toast("انتهى الوقت! تم تسليم إجاباتك", "info"); finish(); }
  };
  tick = setInterval(update, 1000); update();

  const warn = (e) => { if (!finished) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", warn);

  async function finish() {
    if (finished) return; finished = true; clearInterval(tick); window.removeEventListener("beforeunload", warn);
    const answers = qs.map((_, i) => { const r = quizView.querySelector(`input[name="q${i}"]:checked`); return r ? +r.value : -1; });
    const score = answers.reduce((s, a, i) => s + (a === qs[i].correct ? 1 : 0), 0);
    const timeTaken = Math.min(total, Math.round((Date.now() - startedAt) / 1000));
    const name = state.profile?.displayName || state.profile?.username || "مستخدم";
    try {
      const b = writeBatch(db);
      b.set(doc(db, "competitions", comp.id, "results", state.user.uid), { uid: state.user.uid, name: String(name).slice(0, 40), score, total: qs.length, timeTaken, createdAt: serverTimestamp() });
      b.set(doc(db, "users", state.user.uid, "attempts", comp.id), { competitionId: comp.id, title: String(comp.title).slice(0, 150), score, total: qs.length, timeTaken, createdAt: serverTimestamp() });
      await b.commit();
    } catch (e) { console.error(e); toast("تعذّر حفظ النتيجة على الخادم، لكن هذه نتيجتك.", "error", 6000); }
    showResult(comp, { score, total: qs.length, timeTaken, createdAt: new Date() }, answers);
  }
  $("#qForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const unanswered = qs.filter((_, i) => !quizView.querySelector(`input[name="q${i}"]:checked`)).length;
    if (unanswered && !confirm(`لديك ${unanswered} سؤال بدون إجابة. هل تريد التسليم؟`)) return;
    finish();
  });
}

/* ---------- النتيجة ---------- */
function showResult(comp, a, answers) {
  const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
  const qs = comp.questions || [];
  const review = answers ? `<div style="margin-top:22px;text-align:start">${qs.map((q, i) => `<div class="q-card"><h3>${i + 1}. ${esc(q.text)}</h3>
    ${(q.options || []).map((o, j) => `<div class="opt ${j === q.correct ? "right" : j === answers[i] ? "wrong" : ""}">${j === q.correct ? icon("check", 16) : j === answers[i] ? icon("close", 16) : ""} <span>${esc(o)}</span></div>`).join("")}</div>`).join("")}</div>` : "";
  quizView.innerHTML = `<div class="card" style="max-width:760px;margin-inline:auto;text-align:center">
    <h2>${esc(comp.title)}</h2>
    <div class="score-ring" style="--pct:${pct}%"><span>${pct}%</span></div>
    <h3>${fmtNum(a.score)} من ${fmtNum(a.total)}</h3>
    <p class="muted">الزمن المستغرق: ${Math.floor((a.timeTaken || 0) / 60)} د ${(a.timeTaken || 0) % 60} ث</p>
    ${answers ? "" : `<p class="muted">لقد شاركت في هذه المسابقة سابقًا.</p>`}
    ${review}
    <div class="actions" style="justify-content:center"><a class="btn btn-gold" href="competitions.html">كل المسابقات</a></div></div>
    <div id="board" style="margin-top:24px"></div>`;
  loadBoard(comp.id, $("#board"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showBoard(comp, headHtml) {
  quizView.innerHTML = `${headHtml}<div id="board" style="margin-top:24px"></div><div style="margin-top:14px"><a class="link" href="competitions.html">كل المسابقات</a></div>`;
  loadBoard(comp.id, $("#board"));
}

/* ---------- لوحة الترتيب ---------- */
async function loadBoard(id, el) {
  el.innerHTML = `<div class="section-head"><h2>لوحة الترتيب</h2></div><div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>المتسابق</th><th>النتيجة</th><th>الزمن</th></tr></thead><tbody id="bb"><tr><td colspan="4" class="muted">جارٍ التحميل...</td></tr></tbody></table></div>`;
  try {
    const s = await getDocs(query(collection(db, "competitions", id, "results"), orderBy("score", "desc"), limit(100)));
    const rows = s.docs.map((d) => d.data()).sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken).slice(0, 20);
    $("#bb", el).innerHTML = rows.length ? rows.map((r, i) => `<tr class="rank-${i + 1}"><td>${i + 1}</td><td>${esc(r.name)}${r.uid === state.user?.uid ? " (أنت)" : ""}</td><td>${fmtNum(r.score)} / ${fmtNum(r.total)}</td><td>${Math.floor(r.timeTaken / 60)}:${String(r.timeTaken % 60).padStart(2, "0")}</td></tr>`).join("")
      : `<tr><td colspan="4" class="muted">لا توجد نتائج بعد. كن أول المشاركين!</td></tr>`;
  } catch (e) { console.warn(e); $("#bb", el).innerHTML = `<tr><td colspan="4" class="muted">${state.user ? "تعذّر تحميل الترتيب." : "سجّل الدخول لعرض لوحة الترتيب."}</td></tr>`; }
}
