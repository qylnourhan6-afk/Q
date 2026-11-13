# المكتبة الإلكترونية التعليمية

منصة مكتبة إلكترونية بـ **HTML5 + CSS3 + JavaScript (ES6+)** فقط، بدون أي Framework، وتعتمد على Firebase
(Authentication + Firestore + Storage). الواجهة متوافقة بالكامل مع **GitHub Pages**.

## 1) هيكل المشروع

```
index.html  library.html  book-details.html  reader.html
login.html  register.html  forgot.html  profile.html
competitions.html  contact.html  admin.html
firestore.rules  storage.rules  cors.json
assets/
  css/  style.css  responsive.css  admin.css
  js/   firebase.js  app.js  home.js  library.js  book-details.js  reader.js
        auth.js  profile.js  competitions.js  contact.js  admin.js
  images/
```

## 2) إعداد Firebase

1. من [Firebase Console](https://console.firebase.google.com) أنشئ مشروعًا جديدًا.
2. **Authentication** ← Sign-in method ← فعّل **Email/Password**.
   (الموقع يربط اسم المستخدم ببريد داخلي مثل `username@users.elibrary.app`؛ المستخدم لا يراه.)
3. **Firestore Database** ← Create database (Production mode).
4. **Storage** ← Get started. (قد يتطلب Firebase تفعيل خطة Blaze لإنشاء Bucket جديد؛ الاستهلاك المجاني يكفي غالبًا.)
5. **Project settings** ← Your apps ← أضف تطبيق **Web** وانسخ كائن `firebaseConfig`.
6. الصق القيم في الملف **`assets/js/firebase.js`** مكان `PASTE_YOUR_...` (هذا هو المكان الوحيد للإعدادات).
   هذه القيم عامة بطبيعتها وليست أسرارًا، والحماية تأتي من القواعد.

## 3) نشر قواعد الأمان

- **Firestore** ← Rules ← الصق محتوى `firestore.rules` ← Publish.
- **Storage** ← Rules ← الصق محتوى `storage.rules` ← Publish.
  (سيطلب Firebase منحك صلاحية قراءة Firestore من Storage لدوال `firestore.exists`؛ وافق.)

أو عبر CLI:
```bash
npm i -g firebase-tools && firebase login && firebase init   # اختر Firestore و Storage
firebase deploy --only firestore:rules,storage
```

## 4) إنشاء أول مدير (Admin)

لا يمكن إنشاء مدير من داخل الموقع (حماية مقصودة).

1. سجّل حسابًا عاديًا من `register.html`.
2. من Firebase Console ← Authentication ← Users انسخ **User UID** لحسابك.
3. Firestore ← Start collection باسم **`admins`** ← Document ID = الـ UID الذي نسخته ← أضف أي حقل (مثلًا `role: "admin"`).
4. أعد تحميل الموقع: سيظهر زر «الإدارة» ويمكنك دخول `admin.html`.

لإضافة مدير آخر كرر الخطوتين 3 و 4 بـ UID الشخص الآخر.

> إخفاء زر الإدارة للتجميل فقط. حتى لو فتح أحدهم `admin.html` أو عدّل JavaScript، ترفض Security Rules أي قراءة/كتابة إدارية.

## 5) ضبط CORS لعرض ملفات PDF (مهم)

قارئ PDF يجلب الملف من Storage عبر المتصفح، فيلزم السماح بذلك مرة واحدة:

```bash
gcloud storage buckets update gs://YOUR_BUCKET --cors-file=cors.json
# أو:  gsutil cors set cors.json gs://YOUR_BUCKET
```
اسم الـ Bucket تجده في Storage (مثل `my-project.appspot.com` أو `my-project.firebasestorage.app`).
إن ظهر خطأ CORS في القارئ فهذه هي الخطوة الناقصة.

## 6) البيانات الأولى

من لوحة الأدمن:
1. **الصفوف والمواد والفصول**: أضف الصفوف والمواد والفصول (تظهر في الفلاتر ونماذج الكتب).
2. **الكتب**: أضف كتابًا (PDF + غلاف).
3. **الإعلانات** و**محتوى الصفحة الرئيسية** و**المسابقات** اختياريًا.

لا توجد أي بيانات وهمية في المشروع؛ الصفحات تعرض حالة فارغة إلى أن تضيف محتواك.

## 7) النشر على GitHub Pages

1. أنشئ مستودعًا على GitHub وارفع **كل** الملفات (يمكنك استبعاد `*.rules` و `cors.json` أو تركها).
2. Settings ← Pages ← Source: **Deploy from a branch** ← Branch: `main` / `(root)` ← Save.
3. الرابط سيكون `https://USERNAME.github.io/REPO/`.
4. **مهم:** في Firebase Console ← Authentication ← Settings ← **Authorized domains** أضف `USERNAME.github.io`.
5. جميع الروابط نسبية، فتعمل داخل مجلد المستودع دون تعديل.

## 8) هيكل البيانات (Firestore)

| المجموعة | الوصف |
|---|---|
| `admins/{uid}` | المدراء (تُنشأ يدويًا) |
| `usernames/{name}` | `{uid}` — يمنع تكرار اسم المستخدم |
| `users/{uid}` | `username, displayName, grade, createdAt, disabled?` |
| `users/{uid}/favorites/{bookId}` | المفضلة |
| `users/{uid}/history/{bookId}` | سجل القراءة وآخر صفحة |
| `users/{uid}/attempts/{compId}` | سجل مسابقات المستخدم |
| `books/{id}` | `title, author, teacher, description, grade, subject, term, coverUrl/Path, pdfUrl/Path, views, downloads, featured, createdAt` |
| `categories/{id}` | `type (grade/subject/term), name, order` |
| `competitions/{id}` | `title, description, durationMinutes, active, questions[{text, options[], correct}]` |
| `competitions/{id}/results/{uid}` | نتائج وترتيب المتسابقين |
| `requests/{id}` | طلبات الكتب، البلاغات، الشكاوى، الاقتراحات، التواصل |
| `announcements/{id}` | التنبيهات |
| `settings/site`, `settings/stats` | محتوى الصفحة الرئيسية + عدّادات الزيارات والمستخدمين |

## 9) ملاحظات أمنية وحدود معروفة (بصراحة)

- **كلمات المرور** لا تُخزَّن إلا داخل Firebase Authentication (مجزّأة)، ولا تُحفظ في Firestore أو LocalStorage.
- **استعادة كلمة المرور**: بما أن التسجيل بلا بريد، الاستعادة التلقائية تتطلب أن يربط المستخدم «بريد استرداد» من صفحة حسابه
  (يؤكده برسالة)، وبعدها يسجّل الدخول بهذا البريد. من لم يربط بريدًا يتواصل مع الإدارة.
- **إجابات المسابقات**: لأن المشروع بلا خادم، الإجابة الصحيحة محفوظة في مستند المسابقة ويستطيع مستخدم تقني قراءتها،
  وحساب النتيجة يتم في المتصفح. هذا مناسب لمسابقات تعليمية ودّية. للمسابقات ذات الجوائز استخدم Cloud Functions لحساب النتيجة.
- **إيقاف المستخدم** (`disabled`) يُطبَّق من الواجهة عند الدخول؛ للحظر الصارم احذف الحساب من Authentication.
- **حذف المسابقة/الكتاب** يحذف المستند وملفات الكتاب، لكن النتائج الفرعية للمسابقة تبقى مخفية في قاعدة البيانات.
- عدّادات المشاهدات والزيارات تقبل زيادة +1 فقط من أي زائر (قد يعبث بها شخص تقني بتكرار الطلب)؛ هي مؤشرات تقريبية.
- لا توجد مفاتيح أسرار في الكود. لا تضع أي Service Account أو مفتاح Admin SDK في هذا المشروع.
- أي نص يُعرض يمرّ عبر `esc()` لمنع حقن HTML/JS، والروابط تُفحص عبر `safeUrl()`.

## 10) اختبار محلي

لا يعمل الموقع عبر `file://` (بسبب ES Modules)، شغّل خادمًا محليًا:
```bash
python3 -m http.server 8080    # ثم افتح http://localhost:8080
```
أضف `localhost` إلى Authorized domains (يكون مضافًا افتراضيًا).
