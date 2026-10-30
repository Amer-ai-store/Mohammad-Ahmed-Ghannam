import React from 'react';
import {View} from 'react-native';
import {router} from 'expo-router';
import {Shell} from '../components/Shell';
import {ProductGrid} from '../components/ProductGrid';
import {Button,EmptyState,Txt} from '../components/ui';
import {useStore} from '../lib/store';
import {useTheme} from '../lib/theme';
export default function Offers(){
 const {colors:t}=useTheme();const {products,catalogStatus}=useStore();
 const offers=products.filter(p=>!p.variantOf&&p.oldPrice!==undefined&&p.oldPrice>p.price&&p.stock!==0).sort((a,b)=>((b.oldPrice!-b.price)/b.oldPrice!)-((a.oldPrice!-a.price)/a.oldPrice!));
 return <Shell title="العروض والأسعار المخفضة" subtitle="التخفيضات المعروضة من بيانات الكتالوج الحالي.">
  {catalogStatus!=='connected'?<Txt style={{color:t.muted,marginBottom:18}}>هذه العروض للكتالوج التجريبي أو آخر كتالوج محفوظ حتى يتصل التطبيق بالخادم.</Txt>:null}
  {offers.length?<View style={{gap:16}}><Txt style={{color:t.green}}>يوجد {offers.length} منتجات بسعر أقل من السعر السابق المعلن.</Txt><ProductGrid items={offers}/></View>:<View style={{gap:15}}><EmptyState title="لا توجد عروض حالية" detail="يمكن للمدير إضافة السعر السابق والسعر الحالي من لوحة الإدارة."/><Button secondary title="تصفح كل المنتجات" onPress={()=>router.push('/explore')}/></View>}
 </Shell>;
}
