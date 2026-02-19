import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updateProfile,
  type User,
} from "firebase/auth";

declare global {
  interface Window {
    IRBIS_FIREBASE_CONFIG?: Record<string, string>;
  }
}

let app: FirebaseApp | null = null;

function getConfig() {
  const cfg = window.IRBIS_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey === "REEMPLAZAR") return null;
  return cfg;
}

export function initAuth() {
  const cfg = getConfig();
  if (!cfg) return { enabled: false as const };

  app = initializeApp(cfg);
  const auth = getAuth(app);
  return { enabled: true as const, auth };
}

export function wireAuthUI() {
  const loginBtn = document.getElementById("btnLogin") as HTMLButtonElement | null;
  const registerBtn = document.getElementById("btnRegister") as HTMLButtonElement | null;
  const badge = document.getElementById("authBadge") as HTMLSpanElement | null;

  const init = initAuth();
  if (!loginBtn || !registerBtn || !badge) return;

  if (!init.enabled) {
    // Degradación elegante: UI sigue, pero explica.
    loginBtn.addEventListener("click", () => explainNoFirebase());
    registerBtn.addEventListener("click", () => explainNoFirebase());
    badge.textContent = "";
    return;
  }

  const { auth } = init;

  function renderUser(u: User | null) {
    if (!u) {
      badge.textContent = "";
      loginBtn.style.display = "inline-block";
      registerBtn.style.display = "inline-block";
      return;
    }

    const label = u.displayName ? `${u.displayName} · ${u.email}` : (u.email || "Sesión iniciada");
    badge.textContent = label;

    loginBtn.style.display = "none";
    registerBtn.style.display = "none";

    // Click en badge => menu rápido
    badge.style.cursor = "pointer";
    badge.title = "Click para cerrar sesión";
    badge.onclick = async () => {
      const ok = await (window as any).Swal?.fire?.({
        title: "Cerrar sesión",
        text: "¿Querés salir de tu cuenta?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar",
        background: "#1e1e1e",
        color: "#fff",
      });
      if (ok?.isConfirmed) await signOut(auth);
    };
  }

  onAuthStateChanged(auth, (u) => renderUser(u));

  loginBtn.addEventListener("click", () => openLoginModal(auth));
  registerBtn.addEventListener("click", () => openRegisterModal(auth));
}

export function isUserLoggedIn(): boolean {
  const cfg = getConfig();
  if (!cfg || !app) return false;
  const auth = getAuth(app);
  return !!auth.currentUser;
}

export async function openRegisterModal(auth = getAuth(app!)) {
  const Swal = (window as any).Swal;
  if (!Swal) return;

  const res = await Swal.fire({
    title: "Crear cuenta",
    html: `
      <input id="regName" class="swal2-input" placeholder="Nombre">
      <input id="regEmail" class="swal2-input" placeholder="Email" type="email">
      <input id="regPass" class="swal2-input" placeholder="Contraseña" type="password">
      <input id="regPass2" class="swal2-input" placeholder="Repetir contraseña" type="password">
      <p style="font-size:0.9rem; opacity:0.8; margin:8px 0 0; text-align:left;">
        Te vamos a enviar un correo de verificación.
      </p>
    `,
    confirmButtonText: "Crear",
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    background: "#1e1e1e",
    color: "#fff",
    focusConfirm: false,
    preConfirm: () => {
      const name = (document.getElementById("regName") as HTMLInputElement)?.value.trim();
      const email = (document.getElementById("regEmail") as HTMLInputElement)?.value.trim();
      const pass = (document.getElementById("regPass") as HTMLInputElement)?.value;
      const pass2 = (document.getElementById("regPass2") as HTMLInputElement)?.value;

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const strongEnough = (pass || "").length >= 8;

      if (!name || !email || !pass || !pass2) {
        Swal.showValidationMessage("Completá todos los campos.");
        return;
      }
      if (!emailOk) {
        Swal.showValidationMessage("Email inválido.");
        return;
      }
      if (!strongEnough) {
        Swal.showValidationMessage("La contraseña debe tener al menos 8 caracteres.");
        return;
      }
      if (pass !== pass2) {
        Swal.showValidationMessage("Las contraseñas no coinciden.");
        return;
      }
      return { name, email, pass };
    },
  });

  if (!res.isConfirmed) return;

  try {
    const cred = await createUserWithEmailAndPassword(auth, res.value.email, res.value.pass);
    if (res.value.name) await updateProfile(cred.user, { displayName: res.value.name });
    await sendEmailVerification(cred.user);

    await Swal.fire({
      title: "Cuenta creada",
      html: `Listo. Te mandamos un email de verificación a <strong>${res.value.email}</strong>.`,
      icon: "success",
      background: "#1e1e1e",
      color: "#fff",
    });
  } catch (e: any) {
    await Swal.fire({
      title: "No se pudo crear",
      text: e?.message || "Error inesperado.",
      icon: "error",
      background: "#1e1e1e",
      color: "#fff",
    });
  }
}

export async function openLoginModal(auth = getAuth(app!)) {
  const Swal = (window as any).Swal;
  if (!Swal) return;

  const res = await Swal.fire({
    title: "Iniciar sesión",
    html: `
      <input id="loginEmail" class="swal2-input" placeholder="Email" type="email">
      <input id="loginPass" class="swal2-input" placeholder="Contraseña" type="password">
    `,
    confirmButtonText: "Entrar",
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    background: "#1e1e1e",
    color: "#fff",
    focusConfirm: false,
    preConfirm: () => {
      const email = (document.getElementById("loginEmail") as HTMLInputElement)?.value.trim();
      const pass = (document.getElementById("loginPass") as HTMLInputElement)?.value;
      if (!email || !pass) {
        Swal.showValidationMessage("Completá email y contraseña.");
        return;
      }
      return { email, pass };
    },
  });

  if (!res.isConfirmed) return;

  try {
    await signInWithEmailAndPassword(auth, res.value.email, res.value.pass);
    await Swal.fire({
      title: "Bienvenido",
      text: "Sesión iniciada.",
      icon: "success",
      background: "#1e1e1e",
      color: "#fff",
      timer: 1400,
      showConfirmButton: false,
    });
  } catch (e: any) {
    await Swal.fire({
      title: "No se pudo iniciar",
      text: e?.message || "Error inesperado.",
      icon: "error",
      background: "#1e1e1e",
      color: "#fff",
    });
  }
}

function explainNoFirebase() {
  const Swal = (window as any).Swal;
  if (!Swal) return;
  Swal.fire({
    title: "Auth no configurado",
    html: `
      Para que <strong>Iniciar sesión / Registrarse</strong> sea real, necesitás Firebase.<br>
      Editá <code>public/firebase-config.js</code> con tu config.
    `,
    icon: "info",
    background: "#1e1e1e",
    color: "#fff",
  });
}
