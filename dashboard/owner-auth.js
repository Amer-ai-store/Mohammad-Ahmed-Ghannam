/* Central single sign-on for same-origin command screens.
 * Firebase ID tokens are kept IN MEMORY ONLY; never save passwords, API keys,
 * bearer tokens, SQL credentials or privileged roles in localStorage or GitHub.
 * A verified email alone is NOT sufficient to establish owner authorization:
 * each protected backend must independently validate JWT uid/claims + allowlist.
 * Cross-origin services must perform their own secure authorization handshake.
 */
(()=>{'use strict';
  if(window.AAS_OWNER_AUTH)return;
  const SDK_VERSION='10.14.1';
  const users=new Set();
  let app=null,auth=null,identity=null,initialized=false;
  let load=Promise.resolve();
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
    if(user.emailVerified!==true)throw Error('EMAIL_VERIFICATION_REQUIRED');
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
  async function signOut(){
    await ready;
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
    ready,getUser,getIdToken:token,signIn,signInWithEmail,signOut,changePassword,
    subscribe(listener){
      if(typeof listener!=='function')throw TypeError('callback');
      users.add(listener);
      if(initialized){try{listener(identity)}catch{}}
      return ()=>users.delete(listener);
    },
    get projectId(){return app?.options?.projectId||null;},
    get isAuthenticated(){return Boolean(identity&&identity.emailVerified);},
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
    const passwordForm=root.querySelector('#owner-password-form');
    const google=root.querySelector('#owner-google-security');
    const result=root.querySelector('#owner-password-result');
    const setMessage=text=>{if(status)status.textContent=text;};
    const render=user=>{
      const authenticated=Boolean(user&&!user.isAnonymous);
      const verified=authenticated&&user.emailVerified===true;
      const pwd=verified&&(user.providerData||[]).some(p=>p?.providerId==='password');
      if(email)email.textContent=authenticated?String(user.email||'UID موجود'):'لا توجد جلسة مالك';
      if(login)login.hidden=authenticated;
      if(emailLogin)emailLogin.hidden=authenticated;
      if(logout)logout.hidden=!authenticated;
      if(passwordForm)passwordForm.hidden=!pwd;
      if(google)google.hidden=!verified||pwd;
      if(result)result.textContent='';
      setMessage(!authenticated?'غير مسجل الدخول. جميع المسارات الخاصة محجوبة.':
        !verified?'سجلت الدخول؛ يجب توثيق البريد قبل استخدام البيانات الخاصة.':
        'جلسة Firebase موثقة لهذا الحساب. صلاحية المالك لدى الخادم تُختبر مستقلًا عند كل طلب.');
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
