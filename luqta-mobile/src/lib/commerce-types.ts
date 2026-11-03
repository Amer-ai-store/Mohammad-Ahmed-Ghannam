export type StoreSettings = {
  storeName: string; currency: string; country: string;
  shippingFee: number; freeShippingThreshold: number; returnsDays: number;
  storefront?: { accentColor?: string; heroTitle?: string; heroSubtitle?: string; showAssistant?: boolean; promoVideoUrl?: string | null };
  character?: { modelUrl?: string | null };
  bundles?: { id: string; name: string; percent: number; minItems: number; productIds: string[]; categories: string[]; active?: boolean }[];
  branches?: Branch[];
};
export type Branch = { id: string; name: string; city?: string; latitude?: number; longitude?: number };
export type DeliverySlot = 'morning' | 'afternoon' | 'evening';
export const deliverySlots: { id: DeliverySlot; label: string; time: string }[] = [
  { id: 'morning', label: 'صباحاً', time: '9:00 - 12:00' },
  { id: 'afternoon', label: 'بعد الظهر', time: '12:00 - 5:00' },
  { id: 'evening', label: 'مساءً', time: '5:00 - 9:00' },
];
export type PaymentChoice = 'card' | 'cod' | 'wallet';
export type CheckoutDraft = { address?: Address; slot: DeliverySlot; payment: PaymentChoice; cardLast4?: string; coupon?: { code: string; discount: number; cartSignature: string }; eco?: boolean; pendingCouponCode?: string; deliveryMode?: 'standard' | 'express' | 'pickup'; pickupBranchId?: string; instructions?: string; contactless?: boolean; tip?: number; expressFee?: number; expressEta?: number };
export type CartIssue = { productId: string; code: 'price_changed' | 'insufficient_stock' | 'product_unavailable' | 'empty'; from?: number; to?: number; available?: number };
export type CartCheck = { ok: boolean; lines: { productId: string; name?: string; price?: number; quantity: number; available: number; ok: boolean }[]; issues: CartIssue[]; subtotal: number; shipping: number; total: number; currency: string; source: 'server' | 'local'; checkedAt?: string; bundle?: { id: string; name: string; percent: number; productIds: string[]; base: number; discount: number } | null; bundleDiscount?: number };
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
  extras?: OrderExtras | null;
};
export type OrderExtras = { mode?: 'standard' | 'express' | 'pickup'; tip?: number; instructions?: string | null; contactless?: boolean; etaMinutes?: number; branchId?: string; branchName?: string; eco?: number; bundle?: { name: string; discount: number } | null };
export const orderLabels: Record<string, string> = {
  pending: 'بانتظار التأكيد', confirmed: 'تم التأكيد', preparing: 'قيد التجهيز',
  out_for_delivery: 'خرج للتوصيل', delivered: 'تم التسليم', cancelled: 'ملغي',
};
