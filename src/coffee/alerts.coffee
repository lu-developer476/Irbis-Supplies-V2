# SweetAlert2 helpers (tema oscuro). Dependen del global `Swal` cargado por CDN.
fire = (opts) ->
  Swal.fire Object.assign {
    background: "#1e1e1e"
    color: "#fff"
    confirmButtonColor: "#3085d6"
  }, opts

notifyProductAdded = (nombre) ->
  fire
    title: "Producto agregado"
    text: "#{nombre} fue añadido al carrito"
    icon: "success"
    timer: 1600
    showConfirmButton: false

notifyCartCleared = ->
  fire
    title: "Carrito vacío"
    text: "Se eliminaron todos los productos"
    icon: "info"
    timer: 1400
    showConfirmButton: false

confirmCheckout = (total) ->
  fire
    title: "Confirmar compra"
    html: "<b>Total:</b> $#{total.toLocaleString('es-AR')}"
    icon: "question"
    showCancelButton: true
    confirmButtonText: "Comprar"
    cancelButtonText: "Cancelar"

export { notifyProductAdded, notifyCartCleared, confirmCheckout }
