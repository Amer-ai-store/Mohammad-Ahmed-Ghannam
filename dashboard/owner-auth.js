/* Central single sign-on for same-origin command screens.
 * Firebase SDK manages the browser's local auth persistence for single sign-on.
 * App code never manually stores passwords, bearer tokens, SQL credentials
 * or privileged roles in app localStorage, files or GitHub.
 * A verified email alone is NOT sufficient to establish owner authorization:
 * each protected backend must independently validate JWT uid/claims + allowlist.
 * Cross-origin services must perform their own secure authorization handshake.
 */
(()=>{'use strict';
  if(window.AAS_OWNER_AUTH)return;
  const SDK_VERSION='10.14.1';
  const users=new Set();
  let app=null,auth=null,identity=null,initialized=false;
  let phoneVerifier=null,phoneConfirmation=null,authAccess='guest';
  let captchaPhone=null,captchaPassed=false,phoneSending=false;
  function withTimeout(promise,milliseconds,code){
    let timeoutId;
    const deadline=new Promise((_,reject)=>{
      timeoutId=setTimeout(()=>reject(Error(code)),milliseconds);
    });
    return Promise.race([Promise.resolve(promise),deadline])
      .finally(()=>clearTimeout(timeoutId));
  }
  function resetPhoneChallenge(){
    phoneConfirmation=null;
    captchaPhone=null;
    captchaPassed=false;
    if(phoneVerifier){try{phoneVerifier.clear()}catch{}phoneVerifier=null}
  }
  const validPhone=value=>typeof value==='string'&&/^\+[1-9][0-9]{7,14}$/.test(value);
  const asciiDigits=value=>String(value).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660))
    .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0));
  function formatPhoneNumber(dialCode,localPhone,region=''){
    const countryCode=asciiDigits(dialCode).trim();
    const raw=asciiDigits(localPhone).trim();
    if(!/^\+[1-9][0-9]{0,3}$/.test(countryCode)||
       !raw||/[^0-9+()\s.\-]/.test(raw))throw Error('PHONE_E164_REQUIRED');
    let number=raw.replace(/[\s().-]/g,'');
    if(number.startsWith('00'))number='+'+number.slice(2);
    if(!number.startsWith('+')){
      // Most national prefixes are trunk zero and must be removed in E.164.
      // Italian national significant 0 is retained.
      if(region!=='IT')number=number.replace(/^0+/, '');
      number=countryCode+number;
    }
    if(!validPhone(number))throw Error('PHONE_E164_REQUIRED');
    return number;
  }
  function detectRegion(languages){
    for(const language of (Array.isArray(languages)?languages:[])){
      if(typeof language!=='string')continue;
      try{
        const region=typeof Intl?.Locale==='function'?new Intl.Locale(language).region:
          (language.match(/[-_]([A-Za-z]{2})\b/)||[])[1];
        if(region)return region.toUpperCase();
      }catch{}
    }
    return 'JO'; // Fallback only; the user can change country.
  }
  function identityVerified(user){
    if(!user||user.isAnonymous)return false;
    if(user.emailVerified===true)return true;
    return validPhone(user.phoneNumber)&&
      (user.providerData||[]).some(p=>p?.providerId==='phone');
  }
  const listeners=new Set();
  function emitAccess(){
    if(document.documentElement?.dataset)document.documentElement.dataset.aasAccess=authAccess;
    if(typeof window.dispatchEvent==='function'&&typeof Event==='function')
      window.dispatchEvent(new Event('aas:auth-access-changed'));
    for(const f of listeners){try{f(authAccess)}catch{}}
  }
  async function checkRole(user){
    if(!identityVerified(user)){authAccess='guest';emitAccess();return}
    authAccess='viewer';emitAccess();
    // This UI flag is an advisory from Firebase's signed token; every protected
    // API must independently verify JWT and its owner UID/custom claim.
    try{
      const data=await user.getIdTokenResult();
      if(identity!==user)return;
      const claims=data?.claims||{};
      authAccess=(claims.jawafaOwner===true||claims.aasOwner===true)?'owner':'viewer';
    }catch{authAccess='viewer'}
    emitAccess();
  }
  function sdk(name){
    const expected='https://cdn.jsdelivr.net/npm/firebase@'+SDK_VERSION+'/firebase-'+name+'-compat.js';
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=expected;script.async=true;
      script.onload=resolve;
      script.onerror=()=>reject(Error('FIREBASE_SDK_UNAVAILABLE'));
      document.head.append(script);
    });
  }
  async function setup(){
    const cfg=window.AMER_FIREBASE_CONFIG;
    if(!cfg||typeof cfg.projectId!=='string'||typeof cfg.apiKey!=='string'||
       !/^[a-z0-9-]{4,80}$/.test(cfg.projectId))throw Error('FIREBASE_CONFIG_MISSING');
    if(!window.firebase?.apps)await sdk('app');
    if(typeof window.firebase?.auth!=='function')await sdk('auth');
    const fb=window.firebase;
    app=fb.apps.length?fb.app():fb.initializeApp(cfg);
    if(app.options.projectId!==cfg.projectId)throw Error('FIREBASE_PROJECT_MISMATCH');
    auth=app.auth();
    await auth.setPersistence(fb.auth.Auth.Persistence.LOCAL);
    return new Promise((resolve,reject)=>{
      auth.onAuthStateChanged(user=>{
        identity=user&&!user.isAnonymous?user:null;
        if(!identity)resetPhoneChallenge();
        void checkRole(identity);
        for(const listener of users){try{listener(identity)}catch{}}
        if(!initialized){initialized=true;resolve(auth);}
      },err=>{if(!initialized)reject(err);});
    });
  }
  const ready=setup();
  async function getUser(){
    await ready;
    return identity;
  }
  async function token(forceRefresh=false){
    const user=await getUser();
    if(!user)throw Error('OWNER_SIGN_IN_REQUIRED');
    if(!identityVerified(user))throw Error('VERIFIED_LOGIN_REQUIRED');
    return user.getIdToken(forceRefresh===true);
  }
  async function signIn(){
    await ready;
    const provider=new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    try{return await auth.signInWithPopup(provider);}
    catch(e){
      if(e?.code==='auth/popup-blocked' || e?.code==='auth/operation-not-supported-in-this-environment'){
        await auth.signInWithRedirect(provider);return null;
      }
      throw e;
    }
  }
  async function signInWithEmail(email,password){
    await ready;
    if(typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||
       typeof password!=='string'||!password.length)
      throw Error('EMAIL_LOGIN_INPUT_INVALID');
    // Firebase validates credentials; username "admin" alone never grants access.
    return auth.signInWithEmailAndPassword(email.trim().toLowerCase(),password);
  }
  async function startPhoneLogin(phone,onProgress=()=>{}){
    await withTimeout(ready,12000,'FIREBASE_INITIALIZATION_TIMEOUT');
    const number=typeof phone==='string'?phone.trim():'';
    if(!validPhone(number))throw Error('PHONE_E164_REQUIRED');
    if(phoneSending)throw Error('SMS_REQUEST_IN_PROGRESS');
    if(phoneConfirmation)throw Error('SMS_CODE_ALREADY_REQUESTED');
    if(!phoneVerifier||captchaPhone!==number){
      resetPhoneChallenge();
      onProgress('CAPTCHA_LOADING');
      // The checkbox is intentionally visible, so the user can see and complete it.
      const verifier=new window.firebase.auth.RecaptchaVerifier('owner-phone-recaptcha',{
        size:'normal',
        callback:()=>{
          if(phoneVerifier!==verifier)return;
          captchaPassed=true;
          onProgress('CAPTCHA_PASSED');
        },
        'expired-callback':()=>{
          if(phoneVerifier!==verifier)return;
          captchaPassed=false;
          onProgress('CAPTCHA_EXPIRED');
        },
        'error-callback':()=>{
          if(phoneVerifier!==verifier)return;
          captchaPassed=false;
          onProgress('CAPTCHA_UNAVAILABLE');
        }
      });
      phoneVerifier=verifier;captchaPhone=number;
      try{
        await withTimeout(verifier.render(),15000,'CAPTCHA_RENDER_TIMEOUT');
      }catch(err){resetPhoneChallenge();throw err}
      if(!captchaPassed)onProgress('CAPTCHA_ACTION_REQUIRED');
      return {sent:false,next:'COMPLETE_CAPTCHA_THEN_SUBMIT'};
    }
    if(!captchaPassed){
      onProgress('CAPTCHA_ACTION_REQUIRED');
      return {sent:false,next:'COMPLETE_CAPTCHA_THEN_SUBMIT'};
    }
    phoneSending=true;
    onProgress('SMS_REQUESTING');
    try{
      // Network request is made ONLY after the checkbox has been solved.
      const confirmation=await withTimeout(
        auth.signInWithPhoneNumber(number,phoneVerifier),
        25000,'SMS_REQUEST_TIMEOUT_UNKNOWN');
      if(typeof confirmation?.confirm!=='function')
        throw Error('PHONE_AUTH_INVALID_RESPONSE');
      phoneConfirmation=confirmation;
      captchaPassed=false;
      onProgress('SMS_REQUEST_ACCEPTED');
      return {sent:true};
    }catch(err){
      // Timeout does not prove Firebase did not issue an SMS.
      onProgress(err?.message==='SMS_REQUEST_TIMEOUT_UNKNOWN'?
        'SMS_REQUEST_STATUS_UNKNOWN':'SMS_REQUEST_FAILED');
      resetPhoneChallenge();
      throw err;
    }finally{phoneSending=false}
  }
  async function confirmPhoneLogin(code){
    await ready;
    if(!phoneConfirmation)throw Error('REQUEST_SMS_FIRST');
    if(typeof code!=='string'||!/^[0-9]{6}$/.test(code.trim()))
      throw Error('SMS_CODE_INVALID_FORMAT');
    const credential=await phoneConfirmation.confirm(code.trim());
    phoneConfirmation=null;
    if(!identityVerified(credential?.user))throw Error('PHONE_IDENTITY_UNVERIFIED');
    return credential;
  }
  async function signOut(){
    await ready;
    resetPhoneChallenge();
    await auth.signOut();
  }
  async function changePassword(currentPassword,newPassword,confirmPassword){
    await ready;
    const user=identity;
    if(!user||!user.emailVerified)throw Error('VERIFIED_USER_REQUIRED');
    // A Google-only user must change their Google password at Google.
    // Do not silently create a second password authentication provider.
    const providers=(user.providerData||[]).map(p=>p?.providerId);
    if(!providers.includes('password'))throw Error('GOOGLE_PASSWORD_MANAGED_AT_GOOGLE');
    if(typeof currentPassword!=='string'||typeof newPassword!=='string'||
       newPassword!==confirmPassword||newPassword.length<14||
       /^(admin|administrator|password|123456)$/i.test(newPassword)||
       newPassword===currentPassword)throw Error('PASSWORD_POLICY_FAILED');
    const credential=window.firebase.auth.EmailAuthProvider.credential(user.email,currentPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
    // A fresh sign-in is required after a credential rotation.
    await auth.signOut();
    return true;
  }
  const API=Object.freeze({
    ready,getUser,getIdToken:token,signIn,signInWithEmail,startPhoneLogin,confirmPhoneLogin,formatPhoneNumber,detectRegion,signOut,changePassword,
    subscribe(listener){
      if(typeof listener!=='function')throw TypeError('callback');
      users.add(listener);
      if(initialized){try{listener(identity)}catch{}}
      return ()=>users.delete(listener);
    },
    get projectId(){return app?.options?.projectId||null;},
    get isAuthenticated(){return identityVerified(identity);},
    get accessRole(){return authAccess;},
    onAccessChange(listener){if(typeof listener!=='function')throw TypeError('listener');listeners.add(listener);listener(authAccess);return ()=>listeners.delete(listener);},
    get isOwnerVerified(){return false;} // Backend authorization only.
  });
  window.AAS_OWNER_AUTH=API;
  ready.catch(()=>{for(const fn of users){try{fn(null)}catch{}}});
  function setupPanel(){
    const root=document.getElementById('owner-security-root');
    if(!root)return;
    const status=root.querySelector('#owner-sso-status');
    const email=root.querySelector('#owner-sso-email');
    const login=root.querySelector('#owner-sso-login');
    const logout=root.querySelector('#owner-sso-logout');
    const emailLogin=root.querySelector('#owner-email-signin-form');
    const phoneLogin=root.querySelector('#owner-phone-signin-form');
    const phoneConfirm=root.querySelector('#owner-phone-confirm-form');
    const countrySelect=phoneLogin?.querySelector('[name=owner-country-code]');
    const countryHint=root.querySelector('#owner-country-detection');
    if(countrySelect){
      const langs=typeof navigator==='undefined'?[]:
        (Array.isArray(navigator.languages)&&navigator.languages.length?navigator.languages:[navigator.language]);
      const detectedRegion=detectRegion(langs);
      const options=Array.from(countrySelect.options||[]);
      const matched=options.find(option=>option.dataset?.region===detectedRegion);
      const fallback=options.find(option=>option.dataset?.region==='JO');
      const selected=matched||fallback;
      if(selected)selected.selected=true;
      function updateCountryHint(isAuto){
        if(!countryHint)return;
        const current=countrySelect.selectedOptions?.[0]||selected;
        countryHint.textContent=(isAuto?'تم تحديد':'تم اختيار')+' كود الدولة: '+
          String(current?.textContent||'الأردن (+962)')+
          (isAuto?' بحسب لغة الجهاز؛ تأكد من صحته قبل إرسال الرمز.':'؛ يمكنك تغييره قبل الإرسال.');
      }
      updateCountryHint(Boolean(matched));
      countrySelect.addEventListener('change',()=>updateCountryHint(false));
    }
    const passwordForm=root.querySelector('#owner-password-form');
    const google=root.querySelector('#owner-google-security');
    const result=root.querySelector('#owner-password-result');
    const viewerLogout=document.getElementById('aas-viewer-signout');
    viewerLogout?.addEventListener('click',()=>{void signOut()});
    const setMessage=text=>{if(status)status.textContent=text;};
    const render=user=>{
      const authenticated=Boolean(user&&!user.isAnonymous);
      const verified=identityVerified(user);
      const pwd=verified&&(user.providerData||[]).some(p=>p?.providerId==='password');
      if(email)email.textContent=authenticated?String(user.email||user.phoneNumber||'UID موجود'):'لا توجد جلسة مالك';
      if(login)login.hidden=authenticated;
      if(emailLogin)emailLogin.hidden=authenticated;
      if(phoneLogin)phoneLogin.hidden=authenticated;
      if(phoneConfirm&&authenticated)phoneConfirm.hidden=true;
      if(logout)logout.hidden=!authenticated;
      if(passwordForm)passwordForm.hidden=!pwd;
      if(google)google.hidden=!verified||pwd||!user?.email;
      if(result)result.textContent='';
      setMessage(!authenticated?'غير مسجل الدخول. جميع المسارات الخاصة محجوبة.':
        !verified?'سجلت الدخول؛ يجب توثيق هوية الحساب قبل استخدام البيانات الخاصة.':
        'تم تأكيد الهوية في Firebase. الصلاحيات تبدأ بمستخدم عادي؛ إدارة المالك تتطلب اعتماد هوية UID على الخادم.');
    };
    login?.addEventListener('click',async()=>{
      login.disabled=true;setMessage('جارٍ فتح تسجيل الدخول الرسمي...');
      try{await signIn();}
      catch(e){setMessage('لم ينجح الدخول: '+String(e?.code||'AUTH_FAILED').slice(0,70));}
      finally{login.disabled=false;}
    });
    emailLogin?.addEventListener('submit',async e=>{
      e.preventDefault();
      const email=emailLogin.querySelector('[name=owner-login-email]');
      const password=emailLogin.querySelector('[name=owner-login-password]');
      const button=emailLogin.querySelector('button[type=submit]');
      if(!email||!password||!button)return;
      button.disabled=true;
      try{await signInWithEmail(email.value,password.value);}
      catch(err){setMessage('لم ينجح تسجيل الدخول بالبريد وكلمة المرور: '+String(err?.code||err?.message||'AUTH_FAILED').slice(0,90));}
      finally{password.value='';button.disabled=false;}
    });
    phoneLogin?.addEventListener('submit',async event=>{
      event.preventDefault();
      const phone=phoneLogin.querySelector('[name=owner-phone-number]');
      const button=phoneLogin.querySelector('button[type=submit]');
      if(!phone||!button||!countrySelect)return;
      const captchaBox=root.querySelector('#owner-phone-recaptcha');
      const phoneStatus=root.querySelector('#owner-phone-status');
      const initialLabel='تحضير التحقق وإرسال رمز SMS';
      const message=value=>{
        if(phoneStatus)phoneStatus.textContent=value;
        setMessage(value);
      };
      const stage=name=>{
        const messages={
          CAPTCHA_LOADING:'جارٍ تجهيز تحقق reCAPTCHA؛ لم يُرسل أي رمز بعد...',
          CAPTCHA_ACTION_REQUIRED:'حدد مربع «أنا لست روبوتًا» الظاهر أسفل الرقم، ثم اضغط الزر مجددًا لإرسال SMS.',
          CAPTCHA_PASSED:'نجح تحقق reCAPTCHA. اضغط «إرسال SMS الآن» لإرسال الرمز.',
          CAPTCHA_EXPIRED:'انتهت صلاحية reCAPTCHA؛ أعد التحقق ثم اضغط إرسال الرمز.',
          CAPTCHA_UNAVAILABLE:'تعذر تحميل reCAPTCHA. تحقق من إعدادات الموقع وخصوصية المتصفح.',
          SMS_REQUESTING:'نجح reCAPTCHA. يجري طلب إرسال SMS من Firebase؛ ستظهر نتيجة العملية خلال 25 ثانية.',
          SMS_REQUEST_ACCEPTED:'قبل Firebase طلب إرسال SMS. أدخل الرمز عند وصوله، دون مشاركته.',
          SMS_REQUEST_STATUS_UNKNOWN:'انتهت مهلة انتظار Firebase؛ قد يكون الرمز أُرسل. تحقق من الرسائل قبل إعادة الطلب.',
          SMS_REQUEST_FAILED:'رفض Firebase طلب إرسال SMS؛ راجع رسالة الخطأ الظاهرة.'
        };
        message(messages[name]||name);
        if(name==='CAPTCHA_LOADING'||name==='CAPTCHA_ACTION_REQUIRED'||name==='CAPTCHA_EXPIRED'){
          if(captchaBox&&typeof captchaBox.scrollIntoView==='function')
            captchaBox.scrollIntoView({behavior:'smooth',block:'center'});
        }
        if(name==='CAPTCHA_PASSED')button.textContent='إرسال SMS الآن';
        if(name==='SMS_REQUESTING')button.textContent='جارٍ إرسال الطلب...';
      };
      button.disabled=true;
      try{
        const region=countrySelect.selectedOptions?.[0]?.dataset?.region||'JO';
        const response=await startPhoneLogin(
          formatPhoneNumber(countrySelect.value,phone.value,region),stage);
        if(response.sent===true){
          if(phoneConfirm)phoneConfirm.hidden=false;
          message('تم قبول طلب رمز SMS من Firebase. افتح الرسائل وأدخل رمز التحقق.');
        }else{
          button.textContent='إرسال SMS بعد اجتياز reCAPTCHA';
        }
      }catch(error){
        const code=String(error?.code||error?.message||'PHONE_AUTH_FAILED');
        const translations={
          PHONE_E164_REQUIRED:'تحقق من الدولة والرقم المكتوب.',
          FIREBASE_INITIALIZATION_TIMEOUT:'انتهت مهلة تحميل Firebase. افحص اتصال الإنترنت ثم أعد تحميل الصفحة.',
          CAPTCHA_RENDER_TIMEOUT:'تعذر عرض reCAPTCHA خلال 15 ثانية؛ افحص المتصفح أو جرّب Chrome دون حظر الإعلانات.',
          SMS_REQUEST_TIMEOUT_UNKNOWN:'لم يصل تأكيد إرسال من Firebase خلال 25 ثانية؛ افحص الرسائل قبل إعادة المحاولة.',
          'auth/operation-not-allowed':'دخول الهاتف غير مفعّل في Firebase. يلزم تفعيله من إعدادات Authentication.',
          'auth/unauthorized-domain':'نطاق amer-ai-store.github.io غير معتمد للدخول في Firebase.',
          'auth/invalid-app-credential':'رفض Firebase تحقق reCAPTCHA أو إعدادات نطاق التطبيق.',
          'auth/captcha-check-failed':'فشل اختبار reCAPTCHA. حاول مجددًا بعد إعادة تحميل الصفحة.',
          'auth/invalid-phone-number':'رقم الهاتف غير صحيح أو غير مدعوم.',
          'auth/quota-exceeded':'انتهت حصة الرسائل أو لم يُعتمد إعداد الفوترة.',
          'auth/billing-not-enabled':'يلزم تفعيل الفوترة على مشروع Firebase لإرسال رسائل SMS.',
          'auth/too-many-requests':'تم تقييد إرسال الرسائل مؤقتًا بسبب تكرار المحاولات.',
          'auth/phone-number-not-allowed':'منطقة الهاتف غير مسموحة ضمن سياسة Firebase للرسائل.'
        };
        message(translations[code]||'تعذر طلب الرمز من Firebase: '+code.slice(0,100));
      }finally{
        if(!phoneConfirmation&&button.textContent==='جارٍ إرسال الطلب...')
          button.textContent=initialLabel;
        button.disabled=false;
      }
    });
    phoneConfirm?.addEventListener('submit',async event=>{
      event.preventDefault();
      const code=phoneConfirm.querySelector('[name=owner-sms-code]');
      const button=phoneConfirm.querySelector('button[type=submit]');
      if(!code||!button)return;
      button.disabled=true;
      try{
        await confirmPhoneLogin(code.value);
        code.value='';
        setMessage('تم التحقق من الهاتف. صلاحية المالك لا تنتقل تلقائيًا من أسبقية التسجيل.');
      }catch(err){
        setMessage('تعذر تأكيد رمز الهاتف: '+String(err?.code||err?.message||'SMS_FAILED').slice(0,85));
      }finally{code.value='';button.disabled=false}
    });
    logout?.addEventListener('click',async()=>{
      logout.disabled=true;
      try{await signOut();}
      catch{setMessage('تعذر إنهاء الجلسة.');}
      finally{logout.disabled=false;}
    });
    passwordForm?.addEventListener('submit',async e=>{
      e.preventDefault();
      const submit=passwordForm.querySelector('button[type=submit]');
      const current=passwordForm.querySelector('[name=current-password]');
      const next=passwordForm.querySelector('[name=new-password]');
      const confirm=passwordForm.querySelector('[name=confirm-password]');
      if(!current||!next||!confirm)return;
      submit.disabled=true;
      try{
        await changePassword(current.value,next.value,confirm.value);
        if(result)result.textContent='نجح تغيير كلمة مرور Firebase. تم تسجيل الخروج؛ ادخل مجددًا بكلمة المرور الجديدة.';
      }catch(err){
        const code=err?.code||err?.message||'CHANGE_FAILED';
        const messages={
          PASSWORD_POLICY_FAILED:'كلمة المرور الجديدة تحتاج 14 محرفًا على الأقل، وأن تتطابق مع التأكيد وألا تكون admin أو مماثلة للقديمة.',
          VERIFIED_USER_REQUIRED:'يتطلب تغيير كلمة المرور تسجيل دخول موثقًا.',
          GOOGLE_PASSWORD_MANAGED_AT_GOOGLE:'هذا الحساب يستخدم Google؛ غيّر كلمة مرور Google من صفحة أمان الحساب الرسمية.'
        };
        if(result)result.textContent=messages[code]||'تعذر التعديل؛ أكمل إعادة إثبات الهوية أو راجع Firebase: '+String(code).slice(0,75);
      }finally{
        current.value='';next.value='';confirm.value='';
        submit.disabled=false;
      }
    });
    subscribe(render);
    ready.catch(()=>setMessage('خدمة Firebase غير متاحة، ولم تُرسل أي كلمة مرور.'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupPanel,{once:true});
  else setupPanel();
})();
