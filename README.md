# 🐺 Irbis-Supplies

Proyecto e-commerce estático desarrollado originalmente en **JavaScript Vanilla** como parte del curso de JavaScript en Coderhouse.  

Posteriormente evolucionado con **TypeScript**, **CoffeeScript** y un sistema de build moderno para mejorar robustez, escalabilidad y calidad del código, manteniendo la esencia original del proyecto.

---

## ✅ Mejoras de realismo (Feb 2026)

### Carrito como desplegable (panel derecho)
- El botón **🛒** abre un **drawer** fijo a la derecha.
- La lista de ítems del carrito tiene **scroll interno** para no romper el layout.

### Imagen del producto dentro del carrito
- Cada ítem del carrito ahora muestra su **imagen**.

### Pop-up de incentivo + cupón
- Al agregar el **primer** producto al carrito, aparece un pop-up invitando a registrarte.
- Cupón: **IRBIS15** (15% OFF).

### Iniciar sesión / Registrarse (cuentas reales con email)
Se integró **Firebase Authentication (Email/Password)**.

Incluye:
- Alta de cuenta con contraseña (validación mínima + confirmación).
- Envío de **email de verificación** al correo declarado.
- Inicio / cierre de sesión.

> Si Firebase no está configurado, la UI se muestra igual pero informa qué falta.

### Accesorios opcionales (upsell) antes del checkout
Antes de pagar, aparece un modal opcional para sumar accesorios **no regulados** (ej.: kit de limpieza, guantes, gafas, etc.).

---

## 🔐 Configurar Firebase (Auth real)

1. Creá un proyecto en Firebase.
2. Activá **Authentication → Sign-in method → Email/Password**.
3. Editá `public/firebase-config.js` y reemplazá `REEMPLAZAR` por tu config.

> La config cliente de Firebase no es un secreto. No pegues claves privadas.

## 🚀 Tecnologías Utilizadas

- **JavaScript (Vanilla)** – Base original del proyecto
- **TypeScript** – Tipado fuerte y modularización
- **CoffeeScript** – Helpers y lógica UI declarativa
- **SweetAlert2 (Dark Theme)** – Interacciones y modales
- **esbuild** – Bundler ligero y rápido
- **Netlify** – Deploy y serverless functions

---

## 🧠 Evolución Técnica

El proyecto comenzó como una aplicación estática en JavaScript.  

En su versión actual:

- Se preserva el código original en `src/legacy/`
- Se incorporan módulos tipados en `src/ts/`
- Se agregan helpers en CoffeeScript en `src/coffee/`
- Se implementa un pipeline de build moderno
- Se optimiza la estructura para escalabilidad futura

Esta evolución demuestra progresión técnica sin migrar a frameworks como React o Next.js.

---

## 📁 Estructura del Proyecto

```bash
.
├── src/
│   ├── legacy/        # Código JavaScript original
│   ├── ts/            # Módulos tipados
│   └── coffee/        # Helpers UI
├── dist/              # Build de producción
├── netlify/
│   └── functions/     # Serverless functions
├── package.json
├── tsconfig.json
├── netlify.toml
└── vite.config.ts
```

## ⚙️ Instalación y Desarrollo

```bash
npm install
npm run dev
npm run build

🌐 Deploy

El proyecto está configurado para Netlify:

Build Command: npm run build

Publish Directory: dist

Archivo netlify.toml incluido.

📌 Objetivo del Proyecto

Demostrar:

- Dominio de JavaScript puro

- Incorporación progresiva de TypeScript

- Capacidad de refactorización y mejora arquitectónica

- Implementación de pipeline moderno sin frameworks pesados

- Preparación para escalabilidad futura
