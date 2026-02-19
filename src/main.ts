/**
 * Irbis Supplies - entrypoint
 * - Mantiene el core JS (legacy) pero permite sumar TS/Coffee y build para Netlify.
 */
import "./legacy/script.js";
import { wireAuthUI } from "./ts/auth";

// Auth UI (Firebase si está configurado)
wireAuthUI();
