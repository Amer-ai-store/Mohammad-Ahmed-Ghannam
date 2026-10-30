import React, {useEffect, useState} from 'react';
import {Pressable, Share, View} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {Minus,Plus,Star,Truck} from 'lucide-react-native';
import {Shell} from '../../components/Shell';
import {ProductImage,ProductCard} from '../../components/ProductCard';
import {ProductReviews} from '../../components/ProductReviews';
import {Button,EmptyState,SectionTitle,Txt} from '../../components/ui';
import {formatPrice} from '../../data/products';
import {useStore} from '../../lib/store';
import {useTheme} from '../../lib/theme';

export default function ProductScreen(){
 const {id}=useLocalSearchParams<{id:string}>();
 return <ProductContent key={id||'new'} id={id}/>;
}
function ProductContent({id}:{id:string}){
 const {colors:t}=useTheme();
 const {products,cart,favorites,compareIds,settings,catalogStatus,rememberProduct,setQuantity,toggleFavorite,toggleCompare,notify}=useStore();
 const [quantity,setSelectedQuantity]=useState(1);
 const [variantId,setVariantId]=useState(id||'');
 const requested=products.find(p=>p.id===id);
 const product=requested?.variantOf?products.find(p=>p.id===requested.variantOf)||requested:requested;
 const variants=product?products.filter(p=>p.variantOf===product.id&&p.active!==false):[];
 const requiresVariant=variants.length>0;
 const selectedVariant=variants.find(p=>p.id===variantId);
 const selectedProduct=requiresVariant?selectedVariant:product;
 useEffect(()=>{if(product?.id)rememberProduct(product.id);},[product?.id,rememberProduct]);
 if(!product)return <Shell title="تفاصيل المنتج"><EmptyState title="المنتج غير متاح" detail={catalogStatus==='loading'?'جارٍ تحميل الكتالوج…':'قد يكون المنتج مؤرشفًا أو الرابط غير صحيح.'}/></Shell>;
 const available=selectedProduct?.stock===undefined?(requiresVariant?0:10):Math.max(0,selectedProduct.stock);
 const remaining=Math.min(99,available-(selectedProduct?cart[selectedProduct.id]||0:0));
 const liked=favorites.includes(product.id);
 const compared=compareIds.includes(product.id);
 async function share(){
  if(!product)return;
  const link=`luqta://product/${encodeURIComponent(product.id)}`;
  try{await Share.share({title:product.name,message:`${product.name}${selectedVariant?` — ${selectedVariant.variantLabel}`:''} — ${formatPrice(selectedProduct?.price??product.price,settings.currency)}\n${link}`,url:link});}
  catch(e){notify(e instanceof Error?e.message:'تعذّرت مشاركة المنتج');}
 }
 function add(){if(!selectedProduct){notify('اختر المقاس أو اللون أولًا');return;}if(remaining<1){notify('الكمية المتاحة موجودة في سلتك أو نفد المخزون');return;}const chosen=Math.min(quantity,remaining);setQuantity(selectedProduct.id,(cart[selectedProduct.id]||0)+chosen);notify(chosen===quantity?'أُضيف المنتج إلى سلتك':`أُضيفت ${chosen} قطع حسب الكمية المتاحة`);}
 const related=products.filter(p=>!p.variantOf&&p.category===product.category&&p.id!==product.id).slice(0,4);
 return <Shell title={product.name} subtitle={product.subtitle}>
  <View style={{gap:22,flexDirection:'column',maxWidth:1100,width:'100%',alignSelf:'center'}}>
   <View style={{borderRadius:20,overflow:'hidden',backgroundColor:t.imageBackground,aspectRatio:1,maxHeight:520}}><ProductImage product={product}/></View>
   <View style={{gap:12,padding:20,backgroundColor:t.paper,borderRadius:18}}>
    <Txt style={{color:t.muted}}>{product.brand} · {product.category}</Txt>
    <Txt weight="extra" style={{fontSize:28}}>{product.name}</Txt>
    <Txt style={{color:t.muted,lineHeight:25}}>{product.description}</Txt>
    <View style={{flexDirection:'row-reverse',alignItems:'center',gap:5}}><Star size={16} color={t.orange} fill={product.reviews? t.orange:'transparent'}/><Txt>{product.reviews?`${product.rating} (${product.reviews} تقييم)`: 'لا توجد تقييمات موثقة بعد'}</Txt></View>
    <View style={{flexDirection:'row-reverse',alignItems:'center',gap:13,flexWrap:'wrap'}}><Txt weight="extra" style={{fontSize:27,color:t.orange}}>{formatPrice(selectedProduct?.price??product.price,settings.currency)}</Txt>{product.oldPrice&&product.oldPrice>product.price?<Txt style={{textDecorationLine:'line-through',color:t.muted}}>{formatPrice(product.oldPrice,settings.currency)}</Txt>:null}</View>
    {requiresVariant?<View style={{gap:9}}><Txt weight="bold">اختر المقاس أو اللون · كل خيار له مخزون مستقل</Txt><View style={{flexDirection:'row-reverse',flexWrap:'wrap',gap:9}}>{variants.map(variant=><Pressable key={variant.id} accessibilityRole="button" accessibilityLabel={`${variant.variantLabel||variant.id}، المتوفر ${variant.stock??0}`} accessibilityState={{selected:variant.id===variantId}} onPress={()=>{setVariantId(variant.id);setSelectedQuantity(1);}} style={{borderWidth:2,borderColor:variant.id===variantId?t.orange:t.line,backgroundColor:variant.id===variantId?t.orangeSoft:t.paper,borderRadius:12,padding:12,minHeight:44}}><Txt weight="bold">{variant.variantLabel||variant.id}</Txt><Txt style={{color:t.muted,fontSize:12}}>{formatPrice(variant.price,settings.currency)} · {variant.stock??0} متوفر</Txt></Pressable>)}</View></View>:null}
    <Txt style={{color:available>0?t.green:t.danger}}>{available>0?`المتوفر: ${available}`:'نفد المخزون'}</Txt>
    <View style={{flexDirection:'row-reverse',alignItems:'center',gap:13}}>
     <Pressable accessibilityRole="button" accessibilityLabel="تقليل الكمية" disabled={quantity<=1} onPress={()=>setSelectedQuantity(q=>Math.max(1,q-1))} style={{padding:12,borderWidth:1,borderColor:t.line,borderRadius:10,opacity:quantity<=1?.4:1}}><Minus size={20} color={t.ink}/></Pressable>
     <Txt weight="bold">{quantity}</Txt>
     <Pressable accessibilityRole="button" accessibilityLabel="زيادة الكمية" disabled={quantity>=Math.max(1,remaining)} onPress={()=>setSelectedQuantity(q=>Math.min(Math.max(1,remaining),q+1))} style={{padding:12,borderWidth:1,borderColor:t.line,borderRadius:10,opacity:quantity>=remaining?.4:1}}><Plus size={20} color={t.ink}/></Pressable>
     <View style={{flex:1}}><Button title={requiresVariant&&!selectedVariant?'اختر المقاس أو اللون':'أضف إلى السلة'} disabled={remaining<=0||requiresVariant&&!selectedVariant} onPress={add}/></View>
    </View>
    <View style={{flexDirection:'row-reverse',gap:10,flexWrap:'wrap'}}><Button secondary title={liked?'إزالة من المفضلة':'حفظ بالمفضلة'} onPress={()=>toggleFavorite(product.id)}/><Button secondary title={compared?'إزالة من المقارنة':'أضف للمقارنة'} onPress={()=>toggleCompare(product.id)}/><Button secondary title="مشاركة" onPress={()=>void share()}/></View>
    {compared?<Button secondary title="عرض المقارنة" onPress={()=>router.push('/compare')}/>:null}
    {product.features.length?<View style={{gap:8,marginTop:12}}><Txt weight="bold">المواصفات</Txt>{product.features.map((f,i)=><Txt key={i} style={{color:t.muted}}>• {f}</Txt>)}</View>:null}
    <View style={{flexDirection:'row-reverse',gap:8,alignItems:'center'}}><Truck size={17} color={t.green}/><Txt style={{color:t.green}}>التوصيل يُحسب من إعدادات المتجر عند تأكيد الطلب.</Txt></View>
    <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/assistant',params:{q:`هل ${product.name} مناسب لي؟`}})} style={{padding:15,backgroundColor:t.orangeSoft,borderRadius:12}}><Txt weight="bold" style={{color:t.orange}}>اسأل مساعد التسوق عن هذا المنتج</Txt></Pressable>
   </View>
   <ProductReviews productId={product.id}/>
   {related.length?<View><SectionTitle title="قد يعجبك أيضًا" subtitle="من القسم نفسه"/><View style={{flexDirection:'row-reverse',flexWrap:'wrap',justifyContent:'space-between',rowGap:16}}>{related.map(p=><ProductCard key={p.id} product={p} width="48%"/>)}</View></View>:null}
  </View>
 </Shell>;
}
