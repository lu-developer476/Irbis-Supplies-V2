export type CurrencyARS = number;

export interface Product {
  id: number;
  nombre: string;
  precio: CurrencyARS;
  img: string;
  categoria?: string;
  stock?: number;
  descripcion?: string;
}

export interface CartItem extends Product {
  cantidad: number;
}

export type InvoiceType = "A" | "B" | "C";

export type ShippingMethod = "retiro" | "correo" | "mensajeria";
