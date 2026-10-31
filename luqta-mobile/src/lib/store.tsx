import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ActivityIndicator, View} from 'react-native';
import {products as sampleProducts, type Product} from '../data/products';
import {api} from './api';
import {useSession} from './session';
import {useTheme} from './theme';
import type {Address, CommerceOrder, StoreSettings} from './commerce-types';
import {cartLimit, cartSubtotal, reorderCart} from './reorder';

export type Order = CommerceOrder;
type State = {cart: Record<string,number>; favorites: string[]; compareIds: string[]; recentIds: string[]};
type Store = State & {
  hydrated: boolean; toast: string; products: Product[]; orders: Order[];
  catalogStatus: 'sample'|'loading'|'connected'|'offline'; catalogError: string;
  settings: StoreSettings; cartCount: number; subtotal: number; shipping: number;
  wishlistSynced: boolean; refreshCatalog:()=>Promise<void>; refreshOrders:()=>Promise<void>; refreshWishlist:()=>Promise<void>;
  addToCart:(id:string)=>void; setQuantity:(id:string,quantity:number)=>void;
  toggleFavorite:(id:string)=>void; toggleCompare:(id:string)=>void; rememberProduct:(id:string)=>void;
  submitOrder:(input:{address:Address;paymentMethod:'cod'|'wallet';couponCode?:string;idempotencyKey:string})=>Promise<Order>;
  reorder:(order:Order)=>void; notify:(message:string)=>void; clearCart:()=>void;
  clearPersonalData:()=>Promise<void>;
};
const Context=createContext<Store|null>(null);
const initial:State={cart:{},favorites:[],compareIds:[],recentIds:[]};
const defaults:StoreSettings={storeName:'لُقطة',currency:'JOD',country:'JO',shippingFee:2.5,freeShippingThreshold:30,returnsDays:14};
const KEY='luqta-store-v2';
const validId=(id:unknown):id is string=>typeof id==='string' && id.length>0 && id.length<=160;
const cleanIds=(value:unknown,limit=100):string[]=>Array.isArray(value)?[...new Set(value.filter(validId))].slice(0,limit):[];
function normalizeProduct(value:unknown):Product|null {
  if(!value || typeof value!=='object')return null;
  const r=value as Partial<Product>;
  if(!validId(r.id)||typeof r.name!=='string'||!Number.isFinite(r.price)||Number(r.price)<0)return null;
  const seed=sampleProducts.find(p=>p.id===r.id);
  const texts=(v:unknown,fallback:string[]=[]):string[]=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,50):fallback;
  return {...seed,...r,id:r.id,name:r.name,price:Number(r.price),
    subtitle:typeof r.subtitle==='string'?r.subtitle:seed?.subtitle||'',
    brand:typeof r.brand==='string'?r.brand:seed?.brand||'لُقطة',
    category:typeof r.category==='string'?r.category:'other',
    description:typeof r.description==='string'?r.description:'',
    image:typeof r.image==='string'&&/^https:\/\//.test(r.image)?r.image:seed?.image||'',
    tags:texts(r.tags),features:texts(r.features,seed?.features),colors:texts(r.colors,seed?.colors),
    stock:Number.isInteger(r.stock)?Math.max(0,Number(r.stock)):0,
    rating:Number.isFinite(r.rating)?Number(r.rating):0,reviews:Number.isInteger(r.reviews)?Number(r.reviews):0,
    active:r.active!==false};
}
export function StoreProvider({children}:{children:React.ReactNode}) {
  const {user,configured,baseUrl}=useSession();
  const {colors,setAccentColor}=useTheme();
  const [state,setState]=useState<State>(initial);
  const [hydrated,setHydrated]=useState(false);
  const [toast,notify]=useState('');
  const [products,setProducts]=useState<Product[]>(sampleProducts);
  const [settings,setSettings]=useState(defaults);
  useEffect(()=>{setAccentColor(settings.storefront?.accentColor||null);},[settings.storefront?.accentColor,setAccentColor]);
  const [orders,setOrders]=useState<Order[]>([]);
  const [catalogStatus,setCatalogStatus]=useState<Store['catalogStatus']>('sample');
  const [catalogError,setCatalogError]=useState('');
  const [wishlistSynced,setWishlistSynced]=useState(false);
  const requestVersion=useRef(0);
  const wishlistVersion=useRef(0);
  const ownerRef=useRef('');
  const previousUser=useRef<string|undefined>(undefined);
  useEffect(()=>{let active=true;AsyncStorage.getItem(KEY).then(value=>{
    if(!active||!value)return;
    try {const data=JSON.parse(value);const cart=Object.fromEntries(Object.entries(data.cart||{}).filter(([id,q])=>validId(id)&&Number.isInteger(q)&&Number(q)>0&&Number(q)<=99));
      setState({cart:cart as Record<string,number>,favorites:cleanIds(data.favorites),compareIds:cleanIds(data.compareIds,4),recentIds:cleanIds(data.recentIds,20)});
    }catch{/* Corrupted cache never authenticates a user or creates an order. */}
  }).catch(()=>{}).finally(()=>{if(active)setHydrated(true);});return()=>{active=false;};},[]);
  useEffect(()=>{if(hydrated)AsyncStorage.setItem(KEY,JSON.stringify(state)).catch(()=>{});},[state,hydrated]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>notify(''),3500);return()=>clearTimeout(timer);},[toast]);
  const refreshCatalog=useCallback(async()=>{
    const version=++requestVersion.current;
    if(!configured||!baseUrl){setProducts(sampleProducts);setSettings(defaults);setCatalogStatus('sample');setCatalogError('');return;}
    setCatalogStatus('loading');setCatalogError('');
    try {
      const [catalog,configuration]=await Promise.all([api.get<{products:unknown[]}>('/products'),api.get<{settings:StoreSettings}>('/settings')]);
      if(version!==requestVersion.current)return;
      if(!Array.isArray(catalog.products))throw new Error('استجابة الكتالوج غير صالحة');
      setProducts(catalog.products.map(normalizeProduct).filter((p):p is Product=>p!==null&&p.active!==false));
      setSettings({...defaults,...configuration.settings});setCatalogStatus('connected');
    }catch(e){if(version===requestVersion.current){setCatalogStatus('offline');setCatalogError(e instanceof Error?e.message:'تعذّر تحديث الكتالوج من الخادم');}}
  },[configured,baseUrl]);
  const userId=user?.id;
  const ownerKey=`${baseUrl}:${userId||''}`;
  useEffect(()=>{ownerRef.current=ownerKey;wishlistVersion.current++;const versionRef=wishlistVersion;return()=>{versionRef.current++;};},[ownerKey]);
  const refreshWishlist=useCallback(async()=>{
    if(!userId||!configured||!hydrated)return;
    const version=++wishlistVersion.current, expected=ownerKey;
    try{
      const response=await api.get<{productIds:string[]}>('/wishlist');
      if(version!==wishlistVersion.current||ownerRef.current!==expected)return;
      setState(s=>({...s,favorites:cleanIds(response.productIds)}));setWishlistSynced(true);
    }catch(error){
      if(version===wishlistVersion.current&&ownerRef.current===expected)setWishlistSynced(false);
      throw error;
    }
  },[userId,configured,hydrated,ownerKey]);
  const refreshOrders=useCallback(async()=>{
    if(!userId){setOrders([]);return;}
    const response=await api.get<{orders:Order[]}>('/orders');setOrders(response.orders);
  },[userId]);
  const invalidateCatalogRequest=useCallback(()=>{requestVersion.current++;},[]);
  useEffect(()=>{const timer=setTimeout(()=>void refreshCatalog(),0);return()=>{clearTimeout(timer);invalidateCatalogRequest();};},[refreshCatalog,invalidateCatalogRequest]);
  useEffect(()=>{
    let active=true;
    const timer=setTimeout(()=>{
      if(!active)return;
      setOrders([]);setWishlistSynced(false);
      if(!hydrated)return;
      if(!userId){if(previousUser.current)setState(s=>({...s,favorites:[]}));previousUser.current=undefined;return;}
      if(previousUser.current!==userId)setState(s=>({...s,favorites:[]}));
      previousUser.current=userId;
      api.get<{orders:Order[]}>('/orders').then(r=>{if(active)setOrders(r.orders);}).catch(()=>{});
      void refreshWishlist().catch(()=>{});
    },0);
    return()=>{active=false;clearTimeout(timer);};
  },[userId,hydrated,baseUrl,refreshWishlist]);
  const subtotal=cartSubtotal(state.cart,products);
  const shipping=subtotal===0||subtotal>=settings.freeShippingThreshold?0:settings.shippingFee;
  const limit=(id:string)=>cartLimit(products,id);
  const setQuantity=(id:string,quantity:number)=>{
    if(!validId(id)||!Number.isFinite(quantity))return;
    const maximum=limit(id);
    if(quantity>maximum)notify(maximum===0?'هذا المنتج غير متوفر حاليًا':`المتاح ${maximum} قطعة فقط`);
    setState(s=>{const cart={...s.cart};const next=Math.min(maximum,Math.floor(quantity));if(next<=0)delete cart[id];else cart[id]=next;return {...s,cart};});
  };
  const addToCart=(id:string)=>{if(limit(id)<1){notify('هذا المنتج غير متوفر حاليًا');return;}setQuantity(id,(state.cart[id]||0)+1);notify('أُضيف المنتج إلى سلتك');};
  const toggleFavorite=(id:string)=>{
    if(!products.some(p=>p.id===id))return;
    wishlistVersion.current++;
    const next=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];
    setState(s=>({...s,favorites:next}));setWishlistSynced(false);
    if(user)api.put('/wishlist',{productIds:next}).then(()=>{if(ownerRef.current===ownerKey)setWishlistSynced(true);}).catch(()=>{if(ownerRef.current===ownerKey)notify('حُفظ التغيير محليًا؛ تعذّرت مزامنة المفضلة');});
  };
  const toggleCompare=(id:string)=>setState(s=>{
    if(s.compareIds.includes(id))return {...s,compareIds:s.compareIds.filter(x=>x!==id)};
    if(s.compareIds.length>=4){notify('يمكن مقارنة أربعة منتجات في المرة الواحدة');return s;}
    return {...s,compareIds:[...s.compareIds,id]};
  });
  const rememberProduct=useCallback((id:string)=>{if(validId(id))setState(s=>s.recentIds[0]===id?s:{...s,recentIds:[id,...s.recentIds.filter(x=>x!==id)].slice(0,20)});},[]);
  const submitOrder=async(input:{address:Address;paymentMethod:'cod'|'wallet';couponCode?:string;idempotencyKey:string})=>{
    if(!user)throw new Error('سجّل الدخول لإنشاء طلب على الخادم');
    if(!Object.keys(state.cart).length)throw new Error('السلة فارغة');
    const response=await api.post<{order:Order}>('/orders',{...input,items:Object.entries(state.cart).map(([productId,quantity])=>({productId,quantity}))});
    setOrders(old=>[response.order,...old.filter(o=>o.id!==response.order.id)]);setState(s=>({...s,cart:{}}));void refreshCatalog();return response.order;
  };
  const reorder=(order:Order)=>{const cart=reorderCart(order.items,products);setState(s=>({...s,cart}));notify(Object.keys(cart).length?'أُضيفت المنتجات المتوفرة إلى السلة بأسعارها الحالية':'منتجات هذا الطلب غير متوفرة حاليًا');};
  const clearPersonalData=async()=>{
    wishlistVersion.current++;
    previousUser.current=undefined;
    setState(initial);
    setOrders([]);
    setWishlistSynced(false);
    await AsyncStorage.removeItem(KEY);
  };
  if(!hydrated)return <View style={{flex:1,backgroundColor:colors.background,justifyContent:'center',alignItems:'center'}}><ActivityIndicator color={colors.orange}/></View>;
  return <Context.Provider value={{...state,hydrated,toast,products,orders,catalogStatus,catalogError,settings,wishlistSynced,subtotal,shipping,cartCount:Object.values(state.cart).reduce((a,b)=>a+b,0),refreshCatalog,refreshOrders,refreshWishlist,addToCart,setQuantity,toggleFavorite,toggleCompare,rememberProduct,submitOrder,reorder,notify,clearCart:()=>setState(s=>({...s,cart:{}})),clearPersonalData}}>{children}</Context.Provider>;
}
export function useStore(){const value=useContext(Context);if(!value)throw new Error('StoreProvider is required');return value;}
