import { notifyProductAdded, notifyCartCleared, confirmCheckout } from "../coffee/alerts.coffee";
import { storageGetJSON, storageSetJSON, storageGetNumber, storageSetNumber } from "../ts/storage";
import { isUserLoggedIn, openRegisterModal } from "../ts/auth";

const ORDER_COUNTER_KEY = "irbis_order_counter";

// ===============================
// IRBIS SUPPLIES - SCRIPT AVANZADO
// - Orden automática
// - QR en comprobante
// - Factura + imprimir
// - Descargar PDF
// - Historial en localStorage
// - Notificación Netlify Forms
// ===============================

// ===============================
// REFERENCIAS DOM (compatibles con tu index remodelado)
// ===============================
const contenedorProductos = document.getElementById('productosContainer');
const carritoContainer = document.getElementById('carritoContainer');
const totalCarritoDOM = document.getElementById('totalCarrito');
const btnVaciarCarrito = document.getElementById('vaciarCarrito');
const btnCheckout = document.getElementById('btnCheckout');

// Drawer del carrito
const btnCart = document.getElementById("btnCart");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const btnCloseCart = document.getElementById("btnCloseCart");

// Nuevos elementos de facturación
const invoiceTypeDOM = document.getElementById("invoiceType");
const invoiceNumberDOM = document.getElementById("invoiceNumber");
const cuitDOM = document.getElementById("cuit");

const shippingSelect = document.getElementById("shippingMethod");
const paymentSelect = document.getElementById("paymentMethod");
const cardFields = document.getElementById("cardFields");
const qrSection = document.getElementById("qrSection");
const btnConfirmQR = document.getElementById("btnConfirmQR");
const couponInput = document.getElementById("couponInput");
const applyCouponBtn = document.getElementById("applyCoupon");

const subtotalDOM = document.getElementById("subtotal");
const discountDOM = document.getElementById("discount");
const ivaDOM = document.getElementById("iva");
const shippingCostDOM = document.getElementById("shippingCost");

// Opcional: Sección de historial con ID para renderizar
const historialContainer = document.getElementById('historialCompras');

// ===============================
// STORAGE KEYS
// ===============================
const CART_KEY = "carrito";
const ORDERS_KEY = "irbis_orders";

// ===============================
// ESTADO
// ===============================
let carrito = storageGetJSON(CART_KEY, []);

const COUPON_PROMPT_KEY = "irbis_coupon_prompted";

let descuentoCupon = 0;
let ajustePago = 0; // positivo = recargo, negativo = descuento
let qrConfirmado = false;
let cuponAplicado = false;
const IVA_RATE = 0.21;
const DESCUENTO_PERMANENTE = 0.30; // 30% fijo siempre

let orders = storageGetJSON(ORDERS_KEY, []);

// ===============================
// PRODUCTOS
// ===============================
let productos = [];

// Add-ons (solo accesorios no regulados)
const ADDONS = [
  {
    id: 9001,
    nombre: "Kit de limpieza (universal)",
    precio: 12000,
    imagen: "./images/addons/cleaning-kit.svg",
  },
  {
    id: 9002,
    nombre: "Guantes tácticos",
    precio: 18000,
    imagen: "./images/addons/gloves.svg",
  },
  {
    id: 9003,
    nombre: "Gafas protectoras",
    precio: 16000,
    imagen: "./images/addons/goggles.svg",
  },
  {
    id: 9004,
    nombre: "Rodilleras reforzadas",
    precio: 22000,
    imagen: "./images/addons/knee-pads.svg",
  },
  {
    id: 9005,
    nombre: "Botas de trekking",
    precio: 64000,
    imagen: "./images/addons/boots.svg",
  },
];

function openCartDrawer() {
  cartDrawer?.classList.add("is-open");
  cartOverlay?.classList.add("is-open");
  cartOverlay?.setAttribute("aria-hidden", "false");
}

function closeCartDrawer() {
  cartDrawer?.classList.remove("is-open");
  cartOverlay?.classList.remove("is-open");
  cartOverlay?.setAttribute("aria-hidden", "true");
}

btnCart?.addEventListener("click", openCartDrawer);
btnCloseCart?.addEventListener("click", closeCartDrawer);
cartOverlay?.addEventListener("click", closeCartDrawer);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCartDrawer();
});

const FECHA_BASE = new Date("2024-01-01");
const INFLACION_MENSUAL = 0.08; // 8% mensual

// ===============================
// CALCULAR INFLACIÓN LOCAL
// ===============================
function calcularPrecioInflacion(precioBase) {
  const hoy = new Date();

  const meses =
    (hoy.getFullYear() - FECHA_BASE.getFullYear()) * 12 +
    (hoy.getMonth() - FECHA_BASE.getMonth());

  return Math.round(
    precioBase * Math.pow(1 + INFLACION_MENSUAL, meses)
  );
}

// ===============================
// VALORIZACIÓN PRODUCOTS
// ===============================
function obtenerFactorValorizacion(producto) {
  let factor = 1;

  if (producto.precioBase >= 4000) factor += 0.30;
  if (producto.nombre.includes("Táctica") || producto.nombre.includes("Tactical")) factor += 0.20;
  if (producto.nombre.includes("AK") || producto.nombre.includes("FN")) factor += 0.15;
  if (producto.colores.length >= 5) factor += 0.05;

  return factor;
}

function obtenerFactorTiempo() {
  const añoBase = 2026;
  const añoActual = new Date().getFullYear();
  const diferencia = añoActual - añoBase;

  return Math.pow(1.05, diferencia); // 5% anual acumulativo
}

// ===============================
// CARGAR PRODUCTOS
// ===============================
async function cargarProductos() {
  try {
    const response = await fetch("./data.json");
    productos = await response.json();

    let factorInflacion = null;

    // Intentar usar Netlify Function
    try {
      const api = await fetch("/.netlify/functions/prices");
      const data = await api.json();
      factorInflacion = data.factor;
    } catch (e) {
      console.log("Netlify no disponible. Usando inflación local.");
    }

      productos = productos.map(p => {
      
        const inflacion = factorInflacion
          ? factorInflacion
          : calcularPrecioInflacion(p.precioBase) / p.precioBase;
      
        const valorizacion = obtenerFactorValorizacion(p);
        const tiempo = obtenerFactorTiempo();
      
        const precioFinal = Math.round(
          p.precioBase * inflacion * valorizacion * tiempo
        );
      
        return {
          ...p,
          precio: precioFinal
        };
      });
    
      // ORDEN ALFABÉTICO
      productos.sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
      );

    renderProductos();

  } catch (error) {
    console.error("Error cargando productos:", error);
  }
}

// ===============================
// HELPERS
// ===============================
function currency(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

function nowARString() {
  return new Date().toLocaleString('es-AR', { hour12: false });
}

function generarOrdenId() {
  let counter = storageGetNumber(ORDER_COUNTER_KEY, 0);
  counter++;
  storageSetNumber(ORDER_COUNTER_KEY, counter);

  const year = new Date().getFullYear();
  return `IRB-${year}-${String(counter).padStart(6, "0")}`;
}

function generarFacturaDemo() {
  if (!invoiceTypeDOM || !invoiceNumberDOM) return;

  const tipos = ["A", "B", "C"];
  const tipo = tipos[Math.floor(Math.random() * tipos.length)];
  const numero = Math.floor(10000000 + Math.random() * 90000000);

  invoiceTypeDOM.innerText = tipo;
  invoiceNumberDOM.innerText = numero;
}

function guardarCarrito() {
  storageSetJSON(CART_KEY, carrito);
}

function guardarOrders() {
  // Limitamos historial para que no explote el storage
  if (orders.length > 50) orders = orders.slice(0, 50);
  storageSetJSON(ORDERS_KEY, orders);
}

function totalActual() {
  return carrito.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
}

function calcularResumen() {

  const subtotal = totalActual();
  const envio = shippingSelect ? Number(shippingSelect.value) : 0;

  // 30% permanente
  const descuentoBase = subtotal * DESCUENTO_PERMANENTE;

  // Cupón adicional
  const descuentoExtra = subtotal * descuentoCupon;

  const descuentoTotal = descuentoBase + descuentoExtra;

  const baseImponible = subtotal - descuentoTotal;
  const iva = baseImponible * IVA_RATE;

  const totalAntesPago = baseImponible + iva + envio;
  const total = totalAntesPago + (totalAntesPago * ajustePago);

  return {
    subtotal,
    descuento: descuentoTotal,
    iva,
    envio,
    ajustePago: totalAntesPago * ajustePago,
    total
  };
}

function maskCard(num) {
  const clean = String(num || "").replace(/\s+/g, "");
  const last4 = clean.slice(-4);
  return last4 ? `**** **** **** ${last4}` : "**** **** **** ****";
}

// ===============================
// RENDER PRODUCTOS
// ===============================
function renderProductos() {
  if (!contenedorProductos) return;

  contenedorProductos.innerHTML = "";

  productos.forEach(producto => {

    const card = document.createElement("div");
    card.classList.add("contenedorDeCard");

    card.innerHTML = `
      <img src="${producto.imagen}" alt="${producto.nombre}">
      <h3>${producto.nombre}</h3>

      <button class="btn-detalles" data-id="${producto.id}">
        Detalles
      </button>

      <div class="detalles-container" id="detalles-${producto.id}" style="display:none;">
        
        <p class="descripcion-producto">
          ${producto.descripcion}
        </p>

        <div class="colores-container">
          ${producto.colores.map(c => `
            <span class="color-swatch"
                  data-producto="${producto.id}"
                  data-color="${c.nombre}"
                  title="${c.nombre}"
                  style="
                    background:${c.hex};
                    display:inline-block;
                    width:18px;
                    height:18px;
                    border-radius:50%;
                    margin-right:4px;
                    border:1px solid #333;
                    cursor:pointer;
                  ">
            </span>
          `).join("")}
        </div>

      </div>

      <p class="precio-producto">
        ${currency(producto.precio)}
      </p>

      <button class="btn-primary" data-id="${producto.id}">
        Agregar al carrito
      </button>
    `;

    contenedorProductos.appendChild(card);
  });
}

// ===============================
// CARRITO
// ===============================

// 🔹 FUNCIÓN GLOBAL
function agregarAlCarrito(id) {

  const carritoEstabaVacio = carrito.length === 0;

  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  const colorActivo = document.querySelector(
    `.color-swatch.color-activo[data-producto="${id}"]`
  );

  if (!colorActivo) {
    alertaError("Seleccioná un color antes de agregar al carrito.");
    return;
  }

  const color = colorActivo.dataset.color;

  const existe = carrito.find(
    p => p.id === id && p.color === color
  );

  if (existe) {
    existe.cantidad++;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1,
      color: color,
      imagen: producto.imagen
    });
  }

  guardarCarrito();
  renderCarrito();
  alertaProductoAgregado(`${producto.nombre} (${color})`);

  // Abrimos el drawer para que el usuario vea que se cargó.
  openCartDrawer();

  // Pop-up: 1er producto agregado => incentivo de registro + cupón
  const yaMostrado = localStorage.getItem(COUPON_PROMPT_KEY) === "1";
  if (carritoEstabaVacio && !yaMostrado && !isUserLoggedIn()) {
    localStorage.setItem(COUPON_PROMPT_KEY, "1");
    Swal.fire({
      title: "Cupón gratis",
      html: `Creá tu cuenta y obtené <strong>15% OFF</strong> con el cupón <code>IRBIS15</code>.`,
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Crear cuenta",
      cancelButtonText: "Ahora no",
      background: "#1e1e1e",
      color: "#fff",
    }).then(async (r) => {
      if (r.isConfirmed) {
        await openRegisterModal();
      }
    });
  }
}

// 🔹 MODIFICAR CANTIDADES
function modificarCantidad(id, color, cambio) {

  const index = carrito.findIndex(
    p => p.id === id && p.color === color
  );

  if (index === -1) return;

  carrito[index].cantidad += cambio;

  if (carrito[index].cantidad <= 0) {
    carrito.splice(index, 1);
  }

  guardarCarrito();
  renderCarrito();
}

window.modificarCantidad = modificarCantidad;
window.agregarAlCarrito = agregarAlCarrito;

// 🔹 RENDER DEL CARRITO
function renderCarrito() {
  if (!carritoContainer || !totalCarritoDOM) return;

  carritoContainer.innerHTML = "";

  if (carrito.length === 0) {
    carritoContainer.innerHTML = `<p>El carrito está vacío.</p>`;
    totalCarritoDOM.innerText = currency(0);

    if (btnVaciarCarrito) {
      btnVaciarCarrito.disabled = true;
      btnVaciarCarrito.classList.add("btn-disabled");
    }

    return;
  }

  // DESHABILITA BOTÓN SI EL CARRITO ESTÁ VACÍO
  if (btnVaciarCarrito) {
    btnVaciarCarrito.disabled = false;
    btnVaciarCarrito.classList.remove("btn-disabled");
  }

  carrito.forEach(p => {
    const row = document.createElement("div");
    row.classList.add("item-carrito");

    const imgSrc = p.imagen || productos.find(x => x.id === p.id)?.imagen || "";

    row.innerHTML = `
      ${imgSrc ? `<img class="item-carrito__thumb" src="${imgSrc}" alt="${p.nombre}">` : ""}
      <div class="item-carrito__info">
        ${p.nombre} <span style="color:#c2a34a;">(${p.color})</span>
        <p class="item-carrito__precio">
          ${currency(p.precio)} x ${p.cantidad} = ${currency(p.precio * p.cantidad)}
        </p>
      </div>
      <div class="item-carrito__acciones">
        <button class="btn-secondary" onclick="modificarCantidad(${p.id}, '${p.color}', -1)">-</button>
        <button class="btn-secondary" onclick="modificarCantidad(${p.id}, '${p.color}', 1)">+</button>
      </div>
    `;
    carritoContainer.appendChild(row);
  });

  const resumen = calcularResumen();

  if (subtotalDOM) subtotalDOM.innerText = currency(resumen.subtotal);
  if (discountDOM) discountDOM.innerText = currency(resumen.descuento);
  if (ivaDOM) ivaDOM.innerText = currency(resumen.iva);
  if (shippingCostDOM) shippingCostDOM.innerText = currency(resumen.envio);
  
  totalCarritoDOM.innerText = currency(resumen.total);

}

// ===============================
// ALERTAS (SweetAlert2 dark)
// ===============================
function alertaProductoAgregado(nombre) {
  notifyProductAdded(nombre);
}

function alertaError(msg) {
  Swal.fire({
    title: "Error",
    text: msg,
    icon: "error",
    background: "#1e1e1e",
    color: "#fff"
  });
}

// ===============================
// HISTORIAL
// ===============================

function renderHistorial() {
  if (!historialContainer) return;

  historialContainer.innerHTML = "";

  if (!orders.length) {
    historialContainer.innerHTML = `<p>No hay compras registradas aún.</p>`;
    return;
  }

  const ul = document.createElement("ul");
  ul.classList.add("historial-lista");

  orders.forEach(o => {
    const li = document.createElement("li");
    li.classList.add("historial-item");

    li.innerHTML = `
      <div>
        <strong>${o.orderId}</strong> — ${o.date}
        <div>Total: ${currency(o.total)}</div>
      </div>
      <button class="btn-secondary ver-factura-btn"
              data-order="${o.orderId}">
        Ver factura
      </button>
    `;

    ul.appendChild(li);
  });

  historialContainer.appendChild(ul);
}

function abrirFacturaDesdeHistorial(orderId) {
  const o = orders.find(x => x.orderId === orderId);
  if (!o) {
    alertaError("No se encontró esa orden en el historial.");
    return;
  }

  abrirVentanaFactura(o);
}

// ===============================
// BOTÓN NAVBAR HISTORIAL
// ===============================

const btnHistorial = document.getElementById("btnHistorial");

btnHistorial?.addEventListener("click", () => {

  if (!orders.length) {
    Swal.fire({
      title: "Sin historial",
      text: "Todavía no hay compras registradas.",
      icon: "info",
      background: "#1e1e1e",
      color: "#fff"
    });
    return;
  }

  const lista = orders.map(o => `
    <div style="text-align:left; margin-bottom:12px;">
      <strong>${o.orderId}</strong><br>
      Fecha: ${o.date}<br>
      Total: ${currency(o.total)}<br>
      <button class="btn-secondary ver-factura-modal"
              data-order="${o.orderId}"
              style="margin-top:6px;">
        Ver factura
      </button>
    </div>
    <hr>
  `).join("");

  Swal.fire({
    title: "Historial de Compras",
    html: `<div style="max-height:350px; overflow:auto;">${lista}</div>`,
    width: 600,
    background: "#1e1e1e",
    color: "#fff",
    showConfirmButton: false,
    didOpen: () => {

      document.querySelectorAll(".ver-factura-modal").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const orderId = e.target.dataset.order;
          abrirFacturaDesdeHistorial(orderId);
        });
      });

    }
  });

});

// ===============================
// EVENT DELEGATION PARA LISTA FIJA
// ===============================

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("ver-factura-btn")) {
    const orderId = e.target.dataset.order;
    abrirFacturaDesdeHistorial(orderId);
  }
});

// Toggle Detalles
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-detalles");
  if (!btn) return;

  const id = btn.dataset.id;
  const contenedor = document.getElementById(`detalles-${id}`);

  if (!contenedor) return;

  contenedor.style.display =
    contenedor.style.display === "none" ? "block" : "none";
});

// Selección de color
document.addEventListener("click", (e) => {
  const swatch = e.target.closest(".color-swatch");
  if (!swatch) return;

  const productoId = swatch.dataset.producto;

  // Limpiar selección previa del mismo producto
  document.querySelectorAll(`.color-swatch[data-producto="${productoId}"]`)
    .forEach(el => el.classList.remove("color-activo"));

  swatch.classList.add("color-activo");
});

// ===============================
// NETLIFY FORMS (notificación)
// ===============================
function notificarNetlify(order) {
  const formData = new FormData();
  formData.append("form-name", "orden-compra");
  formData.append("orderId", order.orderId);
  formData.append("nombre", order.customer.nombre);
  formData.append("email", order.customer.email);
  formData.append("direccion", order.customer.direccion);
  formData.append("detalle", order.items.map(i => `${i.nombre} x${i.cantidad}`).join(", "));
  formData.append("total", order.total);

  // No frenamos el UX si falla: es notificación, no “pago”
  fetch("/", { method: "POST", body: formData }).catch(() => {});
}

// ===============================
// FACTURA + QR + PDF
// ===============================
function invoiceHTML(order) {
  const itemsRows = order.items.map(i => `
    <tr>
      <td>${i.nombre}</td>
      <td style="text-align:center;">${i.cantidad}</td>
      <td style="text-align:right;">${currency(i.precio)}</td>
      <td style="text-align:right;">${currency(i.precio * i.cantidad)}</td>
    </tr>
  `).join("");

  // Recalculamos el resumen para mostrar desglose real
  const subtotalBruto = order.items.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
  const descuentoBase = subtotalBruto * DESCUENTO_PERMANENTE;
  const descuentoExtra = subtotalBruto * descuentoCupon;
  const descuentoTotal = descuentoBase + descuentoExtra;
  
  const baseImponible = subtotalBruto - descuentoTotal;
  const iva = baseImponible * IVA_RATE;
  
  // reconstruimos el total antes del ajuste
  const totalAntesPago = baseImponible + iva;
  const ajusteMonto = totalAntesPago * order.ajustePago;
  
  // envío estimado (si lo querés mostrar correctamente después)
  const envio = 0; // si querés mantenerlo simple por ahora
  
  const descuentoBase = subtotalBruto * DESCUENTO_PERMANENTE;
  const descuentoExtra = subtotalBruto * descuentoCupon;
  const descuentoTotal = descuentoBase + descuentoExtra;
  
  const baseImponible = subtotalBruto - descuentoTotal;
  const iva = baseImponible * IVA_RATE;
  
  // En el PDF usamos el total guardado en la orden
  const totalFinal = order.total;

  return `
  <div id="invoice" class="invoice">
    <div class="top">
      <div>
        <div class="brand">IRBIS SUPPLIES</div>
        <div class="muted">Factura / Comprobante (demo)</div>
      </div>
      <div class="meta">
        <div><strong>Factura ${order.invoiceType} Nº ${order.invoiceNumber}</strong></div>
        <div><strong>Orden:</strong> ${order.orderId}</div>
        <div><strong>Fecha:</strong> ${order.date}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <div class="boxTitle">Cliente</div>
        <div><strong>${order.customer.nombre}</strong></div>
        <div>${order.customer.email}</div>
        <div>${order.customer.direccion}</div>
      </div>

      <div class="box">
        <div class="boxTitle">Pago (simulado)</div>
        <div><strong>Método:</strong> ${order.payment.metodo}</div>
        ${order.payment.metodo === "tarjeta"
          ? `<div><strong>Tarjeta:</strong> ${order.payment.cardMasked}</div>`
          : ""}
        <div><strong>Estado:</strong> Aprobado (demo)</div>
      </div>

      <div class="box qrBox">
        <div class="boxTitle">Verificación</div>
        <div id="qr"></div>
        <div class="muted small">Escaneá para ver la orden</div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Producto</th>
          <th style="text-align:center;">Cantidad</th>
          <th style="text-align:right;">Precio</th>
          <th style="text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals">
      <div class="totalsBox">
        <div class="row">
          <span>Subtotal bruto</span>
          <span>${currency(subtotalBruto)}</span>
        </div>
    
        <div class="row">
          <span>Descuento permanente (30%)</span>
          <span>- ${currency(descuentoBase)}</span>
        </div>
    
        ${descuentoExtra > 0 ? `
        <div class="row">
          <span>Cupón adicional (15%)</span>
          <span>- ${currency(descuentoExtra)}</span>
        </div>
        ` : ""}
    
        <div class="row">
          <span>IVA (21%)</span>
          <span>${currency(iva)}</span>
        </div>
    
        <div class="row">
          <span>Envío</span>
          <span>${currency(envio)}</span>
        </div>
        
        ${order.ajustePago !== 0 ? `
          <div class="row">
            <span>
              ${order.ajustePago > 0
                ? "Recargo por tarjeta (10%)"
                : "Descuento por pago en efectivo (5%)"}
            </span>
            <span>
              ${order.ajustePago > 0 ? "+" : "-"} ${currency(Math.abs(ajusteMonto))}
            </span>
          </div>
        ` : ""}
    
        <div class="row grand">
          <span>Total</span>
          <span>${currency(totalFinal)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="muted small">
        Simulación sin procesos de pagos reales | © 2026 Todos los derechos reservados | Lucas Leonel Montenegro Burgos
      </div>
    </div>
  </div>
  `;
}

function generarNumeroFactura() {
  return String(
    Math.floor(10000000 + Math.random() * 90000000)
  );
}

function abrirVentanaFactura(order) {
  // En el QR codificamos un “payload” útil (podés cambiarlo por URL real)
  const qrPayload = JSON.stringify({
    orderId: order.orderId,
    total: order.total,
    date: order.date,
    email: order.customer.email
  });

  const w = window.open("", "_blank");
  if (!w) return alertaError("El navegador bloqueó la ventana emergente. Permití pop-ups para imprimir/descargar.");

  // Inyectamos libs en la ventana para QR + PDF
  w.document.write(`
    <html>
      <head>
        <title>Factura ${order.orderId} - Irbis Supplies</title>
        <meta charset="UTF-8" />
        <style>
          html, body {
            height: 100%;
          }
          
          body {
            font-family: Arial, Helvetica, sans-serif;
            padding: 24px;
            background:#0f0f12;
            color:#eaeaea;
            display: flex;
            flex-direction: column;
          }
          
          .invoice {
            background:#14141a;
            border:1px solid #2a2a33;
            border-radius:16px;
            padding:18px;
            display:flex;
            flex-direction:column;
            min-height: 100%;
          }
          .actions { display:flex; gap:10px; margin-bottom:16px; }
          button { cursor:pointer; border:0; padding:10px 14px; border-radius:10px; font-weight:700; }
          .btn { background:#2b2b33; color:#fff; }
          .btnPrimary { background:#5b7cfa; color:#fff; }
          .invoice { background:#14141a; border:1px solid #2a2a33; border-radius:16px; padding:18px; }
          .top { display:flex; justify-content:space-between; gap:14px; border-bottom:1px solid #2a2a33; padding-bottom:12px; margin-bottom:12px; }
          .brand { font-size:20px; font-weight:900; letter-spacing:1px; }
          .muted { color:#a9a9b2; }
          .small { font-size:12px; }
          .meta { text-align:right; }
          .grid { display:grid; grid-template-columns: 1.3fr 1fr 0.8fr; gap:12px; margin:12px 0; }
          .box { background:#101016; border:1px solid #2a2a33; border-radius:12px; padding:12px; }
          .boxTitle { font-weight:800; margin-bottom:8px; color:#cfcfe6; }
          .qrBox { display:flex; flex-direction:column; align-items:center; text-align:center; }
          #qr { background:#fff; padding:10px; border-radius:10px; }
          table {
            width:100%;
            border-collapse:collapse;
            margin-top:12px;
            flex-grow: 1;
          }
          th, td { padding:10px; border-bottom:1px solid #2a2a33; vertical-align:top; }
          th { color:#cfcfe6; text-align:left; font-size:13px; }
          .totals {
            display:flex;
            justify-content:flex-end;
            margin-top:auto;
          }
          .totalsBox { width: 320px; background:#101016; border:1px solid #2a2a33; border-radius:12px; padding:12px; }
          .footer {
            margin-top: auto;
            text-align: center;
            padding-top: 12px;
          }
          .row { display:flex; justify-content:space-between; padding:6px 0; }
          .grand { font-size:16px; font-weight:900; border-top:1px solid #2a2a33; margin-top:8px; padding-top:10px; }
          @media print {
            body { background:#fff; color:#000; }
            .actions { display:none; }
            .invoice { border:0; }
            #qr { border:1px solid #000; }
          }
        </style>

        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
      </head>

      <body>
        <div class="actions">
          <button class="btn" onclick="window.print()">Imprimir</button>
          <button class="btnPrimary" onclick="downloadPDF()">Descargar PDF</button>
        </div>

        ${invoiceHTML(order)}

        <script>
          const payload = ${qrPayload};
          new QRCode(document.getElementById("qr"), {
            text: payload,
            width: 140,
            height: 140,
            correctLevel: QRCode.CorrectLevel.M
          });

          async function downloadPDF() {
            const { jsPDF } = window.jspdf;
            const el = document.getElementById("invoice");
          
            const canvas = await html2canvas(el, { scale: 2 });
            const imgData = canvas.toDataURL("image/png");
          
            const pdf = new jsPDF("p", "mm", "a4");
          
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
          
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
            let heightLeft = imgHeight;
            let position = 0;
          
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          
            while (heightLeft > 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
            }
          
            pdf.save("${order.orderId}.pdf");
          }

        </script>
      </body>
    </html>
  `);

  w.document.close();
}

// ===============================
// CHECKOUT (con orden + historial + factura)
// ===============================
btnCheckout?.addEventListener("click", () => {
  if (!carrito.length) return alertaError("Agregá productos antes de finalizar la compra.");
  if (paymentSelect?.value === "qr" && !qrConfirmado) {
  return alertaError("Confirmá el pago QR antes de continuar.");
}


  const openCheckout = () => {
    const resumen = calcularResumen();
    const total = resumen.total;

    Swal.fire({
      title: "Checkout",
      html: `
        <input id="nombreCliente" class="swal2-input" placeholder="Nombre completo">
        <input id="emailCliente" class="swal2-input" placeholder="Email">
        <input id="direccionCliente" class="swal2-input" placeholder="Dirección">
        <input id="tarjetaCliente" class="swal2-input" placeholder="Número de tarjeta">
        <input id="vencimientoCliente" class="swal2-input" placeholder="Vencimiento">
        <input id="cvvCliente" class="swal2-input" placeholder="CVV">
      `,
      confirmButtonText: "Confirmar compra",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      background: "#1e1e1e",
      color: "#fff",
      focusConfirm: false,
      preConfirm: () => {
        const nombre = document.getElementById("nombreCliente").value.trim();
        const email = document.getElementById("emailCliente").value.trim();
        const direccion = document.getElementById("direccionCliente").value.trim();
        const tarjeta = document.getElementById("tarjetaCliente").value.trim();
        const venc = document.getElementById("vencimientoCliente").value.trim();
        const cvv = document.getElementById("cvvCliente").value.trim();

        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const cardOk = tarjeta.replace(/\s+/g, "").length >= 12;
        const cvvOk = /^\d{3,4}$/.test(cvv);

        if (!nombre || !email || !direccion || !tarjeta || !venc || !cvv) {
          Swal.showValidationMessage("Todos los campos son obligatorios.");
          return;
        }
        if (!emailOk) {
          Swal.showValidationMessage("Email inválido.");
          return;
        }
        if (!cardOk) {
          Swal.showValidationMessage("Tarjeta inválida.");
          return;
        }
        if (!cvvOk) {
          Swal.showValidationMessage("CVV inválido.");
          return;
        }

        return { nombre, email, direccion, tarjeta };
      }
    }).then(result => {
      if (!result.isConfirmed) return;

      const order = {
        orderId: generarOrdenId(),
        date: nowARString(),
        invoiceType: "B",
        invoiceNumber: generarNumeroFactura(),
        customer: {
          nombre: result.value.nombre,
          email: result.value.email,
          direccion: result.value.direccion
        },
        items: carrito.map(p => ({
          id: p.id,
          nombre: p.nombre,
          precio: p.precio,
          cantidad: p.cantidad,
          color: p.color,
          imagen: p.imagen
        })),
          total: total,
          payment: {
            metodo: paymentSelect?.value || "tarjeta",
            cardMasked: paymentSelect?.value === "tarjeta"
              ? maskCard(result.value.tarjeta)
              : "N/A"
          },
          ajustePago: ajustePago
        };

      orders = [order, ...orders];
      guardarOrders();
      renderHistorial();

      notificarNetlify(order);
      abrirVentanaFactura(order);

      Swal.fire({
        title: "Compra confirmada",
        text: "Se generó tu factura. Podés imprimirla o descargarla en PDF.",
        icon: "success",
        background: "#1e1e1e",
        color: "#fff"
      });

      carrito = [];
      guardarCarrito();
      renderCarrito();
    });
  };

  const addonsHtml = ADDONS.map(a => `
    <label style="display:flex; align-items:center; gap:10px; margin:10px 0; text-align:left;">
      <input type="checkbox" class="addon-check" value="${a.id}">
      <img src="${a.imagen}" alt="${a.nombre}" style="width:36px; height:36px; object-fit:contain; border:1px solid #333; background:#111;">
      <span>${a.nombre} — <strong>${currency(a.precio)}</strong></span>
    </label>
  `).join("");

  Swal.fire({
    title: "¿Sumás accesorios?",
    html: `
      <div style="max-height:320px; overflow:auto; padding-right:6px;">
        ${addonsHtml}
      </div>
      <p style="font-size:0.9rem; opacity:0.75; text-align:left; margin:10px 0 0;">
        Esto es opcional. Si no querés, seguí directo al checkout.
      </p>
    `,
    showCancelButton: true,
    confirmButtonText: "Continuar",
    cancelButtonText: "Cancelar",
    background: "#1e1e1e",
    color: "#fff",
    preConfirm: () => {
      const ids = Array.from(document.querySelectorAll(".addon-check:checked")).map((el) => Number(el.value));
      return ids;
    }
  }).then((r) => {
    if (!r.isConfirmed) return;

    const ids = r.value || [];
    if (ids.length) {
      ids.forEach((id) => {
        const a = ADDONS.find(x => x.id === id);
        if (!a) return;
        const existe = carrito.find(p => p.id === a.id && p.color === "N/A");
        if (existe) existe.cantidad++;
        else carrito.push({ id: a.id, nombre: a.nombre, precio: a.precio, cantidad: 1, color: "N/A", imagen: a.imagen });
      });
      guardarCarrito();
      renderCarrito();
    }
    openCheckout();
  });
});

// ===============================
// VACIAR CARRITO
// ===============================
btnVaciarCarrito?.addEventListener("click", () => {

  if (!carrito.length) {
    Swal.fire({
      title: "El carrito ya está vacío",
      icon: "info",
      background: "#1e1e1e",
      color: "#fff",
      timer: 1200,
      showConfirmButton: false
    });
    return;
  }

  carrito.length = 0; // Más limpio que reasignar el array
  guardarCarrito();
  renderCarrito();

  Swal.fire({
    title: "Carrito vaciado",
    icon: "success",
    background: "#1e1e1e",
    color: "#fff",
    timer: 1200,
    showConfirmButton: false
  });
});

// ===============================
// EVENTOS PRODUCTOS (delegación)
// ===============================
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-primary");
  if (!btn) return;

  const id = parseInt(btn.dataset.id, 10);
  if (Number.isNaN(id)) return;

  agregarAlCarrito(id);
});

// ===============================
// EVENTOS HISTORIAL (si existe contenedor)
// ===============================
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-order]");
  if (!btn) return;
  abrirFacturaDesdeHistorial(btn.dataset.order);
});

// ===============================
// EVENTO ENVÍO
// ===============================
shippingSelect?.addEventListener("change", () => {
  renderCarrito();
});

// ===============================
// EVENTO MÉTODO DE PAGO
// ===============================

paymentSelect?.addEventListener("change", () => {

  const metodo = paymentSelect.value;

  ajustePago = 0;
  qrConfirmado = false;

  cardFields?.classList.add("hidden");
  qrSection?.classList.add("hidden");

  if (metodo === "tarjeta") {
    ajustePago = 0.10; // +10%
    cardFields?.classList.remove("hidden");
  }

  if (metodo === "efectivo") {
    ajustePago = -0.05; // -5%
  }

  if (metodo === "qr") {
    qrSection?.classList.remove("hidden");
    btnCheckout.disabled = true;
  }

  renderCarrito();
});

btnConfirmQR?.addEventListener("click", () => {
  qrConfirmado = true;
  btnCheckout.disabled = false;

  Swal.fire({
    title: "Pago QR confirmado",
    icon: "success",
    background: "#1e1e1e",
    color: "#fff",
    timer: 1200,
    showConfirmButton: false
  });
});

// ===============================
// CUPÓN
// ===============================
applyCouponBtn?.addEventListener("click", () => {

  if (cuponAplicado) {
    alertaError("Ya se aplicó un cupón en esta compra.");
    return;
  }

  const code = couponInput.value.trim().toUpperCase();

  if (code === "IRBIS15") {

    descuentoCupon = 0.15;
    cuponAplicado = true;
    renderCarrito();

    Swal.fire({
      title: "Cupón aplicado",
      text: "Se aplicó un 15% adicional.",
      icon: "success",
      background: "#1e1e1e",
      color: "#fff"
    });

  } else {
    alertaError("Cupón inválido.");
  }
});

// ===============================
// INIT
// ===============================
cargarProductos();  // 👈 PRIMERO
renderCarrito();
renderHistorial();
generarFacturaDemo();
