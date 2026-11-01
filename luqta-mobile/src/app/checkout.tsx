import React,{useEffect,useRef,useState} from 'react';
import {Pressable,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import * as Location from 'expo-location';
import {Shell} from '../components/Shell';
import {Button,EmptyState,Txt} from '../components/ui';
import {useStore} from '../lib/store';
import {useSession} from '../lib/session';
import {useTheme} from '../lib/theme';
import {api} from '../lib/api';
import {formatPrice} from '../data/products';
import type {Address,CommerceOrder} from '../lib/commerce-types';

export default function Checkout(){
  const {colors:t}=useTheme();
  const {user,configured}=useSession();
  const {cart,products,subtotal,shipping,settings,submitOrder,catalogStatus}=useStore();
  const [address,setAddress]=useState<Address>({name:user?.name||'',phone:'',city:'',street:''});
  const [addresses,setAddresses]=useState<Address[]>([]);
  const [paymentMethod,setPayment]=useState<'cod'|'wallet'>('cod');
  const [coupon,setCoupon]=useState('');const [validated,setValidated]=useState('');
  const [validatedFor,setValidatedFor]=useState('');
  const [discount,setDiscount]=useState(0);const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);const [locating,setLocating]=useState(false);
  const [order,setOrder]=useState<CommerceOrder|null>(null);
  const idempotency=useRef('');
  const items=Object.entries(cart).map(([productId,quantity])=>({productId,quantity}));
  const signature=JSON.stringify({items,address,paymentMethod,validated});
  const cartSignature=JSON.stringify(items);
  const appliedCoupon=validatedFor===cartSignature?validated:'';
  const appliedDiscount=appliedCoupon?discount:0;
  useEffect(()=>{idempotency.current=`app-${Date.now()}-${Math.random().toString(36).slice(2)}`;},[signature]);
  useEffect(()=>{if(!user)return;let active=true;api.get<{addresses:Address[]}>('/addresses').then(r=>{if(!active)return;setAddresses(r.addresses);const saved=r.addresses.find(a=>a.isDefault)||r.addresses[0];if(saved)setAddress(saved);}).catch(()=>{});return()=>{active=false;};},[user]);
  const field=(key:'name'|'phone'|'city'|'street',label:string)=> <View style={{gap:6}}><Txt weight="bold">{label}</Txt><TextInput accessibilityLabel={label} value={address[key]} onChangeText={value=>setAddress(a=>({...a,[key]:value}))} keyboardType={key==='phone'?'phone-pad':'default'} maxLength={key==='street'?300:100} placeholderTextColor={t.muted} style={{padding:14,borderWidth:1,borderColor:t.line,borderRadius:12,color:t.ink,backgroundColor:t.paper,fontFamily:'Tajawal_400Regular',textAlign:'right',minHeight:48}}/></View>;
  async function locate(){setLocating(true);setError('');try{const p=await Location.requestForegroundPermissionsAsync();if(p.status!=='granted')throw new Error('لم تمنح إذن الموقع. يمكنك متابعة الطلب بالعنوان المكتوب.');const point=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});setAddress(a=>({...a,latitude:point.coords.latitude,longitude:point.coords.longitude}));}catch(e){setError(e instanceof Error?e.message:'تعذّر تحديد الموقع');}finally{setLocating(false);}}
  async function validateCoupon(){setBusy(true);setError('');try{const r=await api.post<{code:string;discount:number}>('/coupons/validate',{code:coupon,items});setValidated(r.code);setValidatedFor(cartSignature);setDiscount(r.discount);}catch(e){setValidated('');setDiscount(0);setError(e instanceof Error?e.message:'تعذّر تطبيق القسيمة');}finally{setBusy(false);}}
  async function submit(){
    setError('');if(address.name.trim().length<2||address.phone.trim().length<7||address.city.trim().length<2||address.street.trim().length<5){setError('أكمل الاسم ورقم الهاتف والمدينة والشارع قبل تأكيد الطلب.');return;}
    setBusy(true);try{const created=await submitOrder({address,paymentMethod,couponCode:appliedCoupon||undefined,idempotencyKey:idempotency.current});setOrder(created);}catch(e){setError(e instanceof Error?e.message:'تعذّر إنشاء الطلب. لم نؤكد نجاحه.');}finally{setBusy(false);}
  }
  return <Shell title={order?'تم تسجيل الطلب على الخادم':'إتمام الطلب'} subtitle="تُراجع الأسعار والكميات والخصم على الخادم عند التأكيد.">
    {order?<View style={{gap:18,padding:24,borderRadius:18,backgroundColor:t.paper}}><Txt weight="extra" style={{fontSize:25}}>طلبك {order.id}</Txt><Txt>المجموع: {formatPrice(order.total,order.currency)}</Txt><Txt>{order.paymentMethod==='cod'?'الدفع عند الاستلام؛ لم يتم تحصيل أموال إلكترونيًا.':'خُصم المبلغ من رصيد المحفظة الداخلي على الخادم.'}</Txt><Button title="تفاصيل الطلب وتتبّعه" onPress={()=>router.replace(`/order/${order.id}`)}/><Button secondary title="متابعة التسوق" onPress={()=>router.replace('/explore')}/></View>
    :!configured?<View style={{gap:14}}><Txt>يجب ربط التطبيق بخادم المتجر لإنشاء طلب فعلي محفوظ في قاعدة البيانات.</Txt><Button title="إعداد اتصال الخادم" onPress={()=>router.push('/connection')}/></View>
    :!user?<View style={{gap:14}}><Txt>سجّل الدخول لحفظ طلبك ومتابعته من حسابك.</Txt><Button title="تسجيل الدخول" onPress={()=>router.push('/login')}/><Button secondary title="إنشاء حساب" onPress={()=>router.push('/register')}/></View>
    :!items.length?<EmptyState title="السلة فارغة" detail="أضف منتجات متوفرة قبل تأكيد الطلب."/>
    :<View style={{gap:20,maxWidth:850,width:'100%',alignSelf:'center'}}>
      {catalogStatus!=='connected'?<Txt style={{color:t.danger}}>الكتالوج غير متصل حاليًا. لن يظهر نجاح الطلب إلا بعد تأكيد الخادم.</Txt>:null}
      <View style={{padding:20,borderRadius:18,backgroundColor:t.paper,gap:14}}><Txt weight="extra" style={{fontSize:21}}>عنوان التوصيل</Txt>
        {addresses.map((a,i)=><Pressable key={a.id||i} accessibilityRole="button" onPress={()=>setAddress(a)} style={{padding:13,borderRadius:10,borderWidth:1,borderColor:address.id===a.id?t.orange:t.line}}><Txt>{a.label||a.name}: {a.city}، {a.street}</Txt></Pressable>)}
        {field('name','اسم المستلم')}{field('phone','رقم الهاتف')}{field('city','المدينة')}{field('street','الشارع والمبنى والتفاصيل')}
        <Button secondary title={locating?'جارٍ تحديد الموقع…':'إضافة موقعي الحالي للتوصيل'} disabled={locating} onPress={()=>void locate()}/>
        {address.latitude!==undefined?<Txt>الموقع المرفق: {address.latitude.toFixed(5)}، {address.longitude?.toFixed(5)}</Txt>:null}
        <Button secondary title="إدارة العناوين المحفوظة" onPress={()=>router.push('/addresses')}/>
      </View>
      <View style={{padding:20,borderRadius:18,backgroundColor:t.paper,gap:14}}><Txt weight="extra" style={{fontSize:21}}>الدفع والقسيمة</Txt>
        {(['cod','wallet'] as const).map(method=><Pressable key={method} accessibilityRole="radio" accessibilityState={{checked:paymentMethod===method}} onPress={()=>setPayment(method)} style={{padding:15,borderWidth:1,borderColor:paymentMethod===method?t.orange:t.line,borderRadius:12}}><Txt>{paymentMethod===method?'●':'○'} {method==='cod'?'الدفع عند الاستلام':'رصيد المحفظة الداخلي'}</Txt></Pressable>)}
        <Txt style={{color:t.muted}}>المحفظة دفتر رصيد لدى المتجر، ولا تشحن بطاقة بنكية من هذه الشاشة.</Txt>
        <TextInput accessibilityLabel="رمز القسيمة" value={coupon} onChangeText={value=>{setCoupon(value);setValidated('');setDiscount(0);}} autoCapitalize="characters" placeholder="رمز الخصم" placeholderTextColor={t.muted} style={{padding:14,borderWidth:1,borderColor:t.line,borderRadius:12,color:t.ink,fontFamily:'Tajawal_400Regular',textAlign:'right'}}/>
        <Button secondary title="تطبيق القسيمة" disabled={busy||!coupon.trim()} onPress={()=>void validateCoupon()}/>
        {appliedCoupon?<Txt style={{color:t.green}}>تم قبول {appliedCoupon}: خصم {formatPrice(appliedDiscount,settings.currency)}</Txt>:null}
      </View>
      <View style={{padding:20,borderRadius:18,backgroundColor:t.paper,gap:14}}><Txt weight="extra" style={{fontSize:21}}>ملخص الطلب</Txt>
        {items.map(item=><Txt key={item.productId}>{products.find(p=>p.id===item.productId)?.name||item.productId} × {item.quantity}</Txt>)}
        <Txt>المنتجات: {formatPrice(subtotal,settings.currency)}</Txt><Txt>الخصم: {formatPrice(appliedDiscount,settings.currency)}</Txt><Txt>التوصيل: {formatPrice(shipping,settings.currency)}</Txt><Txt weight="extra" style={{fontSize:22}}>التقدير الحالي: {formatPrice(Math.max(0,subtotal-appliedDiscount)+shipping,settings.currency)}</Txt>
        <Txt style={{color:t.muted}}>القيمة النهائية يحددها الخادم. لن تُرسل بيانات بطاقة دفع.</Txt>
        {error?<Txt accessibilityRole="alert" style={{color:t.danger}}>{error}</Txt>:null}
        <Button title={busy?'جارٍ تأكيد الطلب…':'تأكيد الطلب على الخادم'} disabled={busy||locating} onPress={()=>void submit()}/>
      </View>
    </View>}
  </Shell>;
}
