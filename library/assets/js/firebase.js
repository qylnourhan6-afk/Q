// ============================================================
//  firebase.js — إعداد الاتصال بـ Firebase (المكان الوحيد للإعدادات)
//  ضع هنا قيم مشروعك من: Firebase Console > Project settings > Your apps > Web app
//  ملاحظة: هذه القيم عامة بطبيعتها (ليست أسرارًا)، والحماية الحقيقية تأتي من
//  Security Rules الموجودة في firestore.rules و storage.rules.
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, verifyBeforeUpdateEmail, deleteUser, setPersistence,
  browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection,
  query, where, orderBy, limit, increment, serverTimestamp, writeBatch, getCountFromServer,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// النطاق الداخلي الذي يُستخدم لربط اسم المستخدم بحساب Firebase Auth.
// المستخدم لا يرى البريد ولا يكتبه أبدًا. (نطاق غير حقيقي عمدًا)
export const USERNAME_DOMAIN = "users.elibrary.app";

export const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE_");

let app, auth, db, storage;
if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export {
  app, auth, db, storage,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  verifyBeforeUpdateEmail, deleteUser, setPersistence, browserLocalPersistence, browserSessionPersistence,
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, orderBy,
  limit, increment, serverTimestamp, writeBatch, getCountFromServer, Timestamp,
  sRef, uploadBytesResumable, getDownloadURL, deleteObject
};

/** تحويل اسم المستخدم إلى البريد الداخلي */
export const usernameToEmail = (u) => `${String(u).trim().toLowerCase()}@${USERNAME_DOMAIN}`;
