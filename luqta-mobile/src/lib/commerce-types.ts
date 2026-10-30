export type StoreSettings = {
  storeName: string; currency: string; country: string;
  shippingFee: number; freeShippingThreshold: number; returnsDays: number;
  storefront?: { accentColor?: string; heroTitle?: string; heroSubtitle?: string; showAssistant?: boolean };
};
export type Address = {
  id?: string; name: string; phone: string; city: string; street: string;
  latitude?: number; longitude?: number; label?: string; isDefault?: boolean;
};
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type CommerceOrder = {
  id: string; date: string; createdAt?: string; status: OrderStatus;
  total: number; subtotal: number; discount: number; shipping: number;
  currency: string; paymentMethod: 'cod' | 'wallet'; paymentStatus: string;
  address: Address; driverId?: string;
  items: {productId: string; name: string; price: number; quantity: number}[];
  events?: {status: string; createdAt?: string; date?: string; note?: string}[];
};
export const orderLabels: Record<string, string> = {
  pending: 'بانتظار التأكيد', confirmed: 'تم التأكيد', preparing: 'قيد التجهيز',
  out_for_delivery: 'خرج للتوصيل', delivered: 'تم التسليم', cancelled: 'ملغي',
};
