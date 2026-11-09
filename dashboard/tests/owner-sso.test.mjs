import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const source=readFileSync('dashboard/owner-auth.js','utf8');
const page=readFileSync('dashboard/index.html','utf8');
const jawafa=readFileSync('dashboard/jawafa-integration.js','utf8');

function mockUser(provider='google.com'){
  return {
    email:'test-owner@example.invalid',
    emailVerified:true,isAnonymous:false,
    providerData:[{providerId:provider}],
    getIdToken:async(force)=>force?'fresh.jwt.token':'valid.jwt.token',
    reauthenticateWithCredential:async value=>{mockUser.reauth=value;},
    updatePassword:async value=>{mockUser.updated=value;}
  };
}
async function environment(provider='google.com'){
  let current=mockUser(provider),subscriber=null;
  const auth={
    setPersistence:async value=>{assert.equal(value,'LOCAL')},
    onAuthStateChanged(callback){subscriber=callback;queueMicrotask(()=>callback(current));return ()=>{}},
    signInWithPopup:async()=>{const result={user:current};subscriber(current);return result},
    signInWithRedirect:async()=>{},
    signInWithEmailAndPassword:async(email,password)=>{mockUser.emailLogin={email,password};subscriber(current);return {user:current}},
    signOut:async()=>{current=null;subscriber(null)},
  };
  const app={options:{projectId:'owner-sso-test'},auth:()=>auth};
  function fbAuth(){return auth}
  fbAuth.Auth={Persistence:{LOCAL:'LOCAL'}};
  fbAuth.GoogleAuthProvider=class{setCustomParameters(){}};
  fbAuth.EmailAuthProvider={credential:(email,password)=>({email,password})};
  const fb={apps:[app],app:()=>app,initializeApp:()=>app,auth:fbAuth};
  const window={firebase:fb,AMER_FIREBASE_CONFIG:{projectId:'owner-sso-test',apiKey:'web-public-config'}};
  const document={readyState:'loading',addEventListener(){}};
  const context={window,document,console,setTimeout,clearTimeout,Error,Promise,Set,Boolean,String};
  new Script(source,{filename:'owner-auth.js'}).runInNewContext(context);
  const service=window.AAS_OWNER_AUTH;
  await service.ready;
  return {service,window,auth,changeUser:user=>{current=user;subscriber(user)}};
}
test('central owner SSO is loaded once and identity token is memory-only',async()=>{
  const e=await environment();
  assert.equal(e.service.projectId,'owner-sso-test');
  assert.equal(e.service.isAuthenticated,true);
  assert.equal(e.service.isOwnerVerified,false,'only backend validates owner');
  assert.equal(await e.service.getIdToken(),'valid.jwt.token');
  assert.equal(await e.service.getIdToken(true),'fresh.jwt.token');
  assert.equal(e.window.localStorage,undefined);
  const first=e.service;
  // Idempotency: the script does not create a second session manager.
  new Script(source).runInNewContext({window:e.window,document:{readyState:'loading',addEventListener(){}},console});
  assert.equal(e.window.AAS_OWNER_AUTH,first);
});
test('single sign-out invalidates all central screens and emits session updates',async()=>{
  const e=await environment();
  const signals=[];
  const unsub=e.service.subscribe(user=>signals.push(Boolean(user)));
  await e.service.signOut();
  assert.equal(e.service.isAuthenticated,false);
  assert.equal(signals.at(-1),false);
  await assert.rejects(e.service.getIdToken(),/OWNER_SIGN_IN_REQUIRED/);
  unsub();
});
test('Google-only identity does NOT get a second Firebase password or password bypass',async()=>{
  const e=await environment('google.com');
  await assert.rejects(e.service.changePassword('old-good-password','longer-secure-test-password!','longer-secure-test-password!'),/GOOGLE_PASSWORD_MANAGED_AT_GOOGLE/);
  assert.equal(mockUser.updated,undefined);
});
test('email-password identity requires recent current-password proof, rejects weak passwords and signs out after rotation',async()=>{
  const e=await environment('password');
  await assert.rejects(e.service.changePassword('old-secret','admin','admin'),/PASSWORD_POLICY_FAILED/);
  assert.equal(mockUser.reauth,undefined);
  await assert.rejects(e.service.changePassword('old-secret','a-strong-password-with-21','different-passphrase'),/PASSWORD_POLICY_FAILED/);
  await e.service.changePassword('previous-password!','a-long-unique-passphrase-123!','a-long-unique-passphrase-123!');
  assert.equal(mockUser.reauth.email,'test-owner@example.invalid');
  assert.equal(mockUser.reauth.password,'previous-password!');
  assert.equal(mockUser.updated,'a-long-unique-passphrase-123!');
  assert.equal(e.service.isAuthenticated,false);
});
test('central settings expose password rotation only behind authenticated provider logic',()=>{
  assert.match(page,/id="owner-security-root"/);
  assert.match(page,/id="owner-sso-login"/);
  assert.match(page,/id="owner-email-signin-form"/);
  assert.match(page,/name="owner-login-password" autocomplete="current-password"/);
  assert.match(page,/id="owner-password-form"[^>]+hidden/);
  assert.match(page,/name="current-password" autocomplete="current-password"/);
  assert.match(page,/name="new-password" autocomplete="new-password"/);
  assert.match(page,/href="https:\/\/myaccount.google.com\/security"/);
  assert.match(page,/<script src="owner-auth\.js"><\/script>/);
  assert.ok(page.indexOf('owner-auth.js')<page.indexOf('  async function initLive()'));
  assert.match(jawafa,/window\.AAS_OWNER_AUTH\.getIdToken\(\)/);
  assert.match(jawafa,/window\.AAS_OWNER_AUTH\.subscribe\(/);
  assert.match(source,/await user\.reauthenticateWithCredential\(credential\)/);
  assert.match(source,/await user\.updatePassword\(newPassword\)/);
  assert.doesNotMatch(source,/\b(?:window|globalThis)\.(?:localStorage|sessionStorage)\b|\bdocument\.cookie\b|\bpostMessage\s*\(/);
  assert.doesNotMatch(page,/name="new-password"[^>]+value="/);
  assert.match(source,/get isOwnerVerified\(\)\{return false/);
});

test('single Firebase email login delegates credentials only to Firebase Auth, never a custom SQL connector',async()=>{
  const e=await environment('password');
  await assert.rejects(e.service.signInWithEmail('admin','admin'),/EMAIL_LOGIN_INPUT_INVALID/);
  const result=await e.service.signInWithEmail('TEST-OWNER@EXAMPLE.INVALID','another-secret-phrase');
  assert.equal(result.user.email,'test-owner@example.invalid');
  assert.equal(mockUser.emailLogin.email,'test-owner@example.invalid');
  assert.equal(mockUser.emailLogin.password,'another-secret-phrase');
  assert.equal(e.service.isAuthenticated,true);
  assert.ok(!Object.hasOwn(e.window,'localStorage'));
});

test('country dialing code auto-detection uses browser locale with Jordan as safe editable fallback',async()=>{
  const {service}=await environment();
  assert.equal(service.detectRegion(['ar-JO','en-US']),'JO');
  assert.equal(service.detectRegion(['en-GB']),'GB');
  assert.equal(service.detectRegion(['fr-CA']),'CA');
  assert.equal(service.detectRegion(['ar']),'JO');
  assert.equal(service.detectRegion([]),'JO');
  assert.equal(service.detectRegion(['xx-INVALID-REGION']),'JO');
});
test('country calling code formats local, pasted international and Arabic digits as E.164',async()=>{
  const {service}=await environment();
  assert.equal(service.formatPhoneNumber('+962','0791234567','JO'),'+962791234567');
  assert.equal(service.formatPhoneNumber('+962','٠٧٩١٢٣٤٥٦٧','JO'),'+962791234567');
  assert.equal(service.formatPhoneNumber('+966','0551234567','SA'),'+966551234567');
  assert.equal(service.formatPhoneNumber('+1','(415) 555-0100','US'),'+14155550100');
  assert.equal(service.formatPhoneNumber('+962','+447123456789','JO'),'+447123456789');
  assert.equal(service.formatPhoneNumber('+962','00962791234567','JO'),'+962791234567');
  assert.equal(service.formatPhoneNumber('+39','0612345678','IT'),'+390612345678');
  assert.throws(()=>service.formatPhoneNumber('+962','123'),/PHONE_E164_REQUIRED/);
  assert.throws(()=>service.formatPhoneNumber('+962','079BAD4567'),/PHONE_E164_REQUIRED/);
  assert.throws(()=>service.formatPhoneNumber('962','0791234567'),/PHONE_E164_REQUIRED/);
});
test('phone registration form exposes manual country override and never defaults to owner role',()=>{
  assert.match(page,/name="owner-country-code"/);
  assert.match(page,/data-region="JO">الأردن \(\+962\)/);
  assert.match(page,/data-region="SA">السعودية \(\+966\)/);
  assert.match(page,/data-region="GB">المملكة المتحدة \(\+44\)/);
  assert.match(page,/id="owner-country-detection"/);
  assert.match(page,/name="owner-phone-number"/);
  assert.match(page,/id="owner-phone-recaptcha"/);
  assert.match(page,/name="owner-sms-code"/);
  assert.match(source,/startPhoneLogin\(\s*formatPhoneNumber\(countrySelect.value,phone.value,region\),stage\)/);
  assert.match(source,/auth\.signInWithPhoneNumber\(number,phoneVerifier\)/);
  assert.match(page,/id="owner-phone-status"/);
  assert.match(source,/CAPTCHA_ACTION_REQUIRED/);
  assert.match(source,/SMS_REQUEST_TIMEOUT_UNKNOWN/);
  assert.match(source,/authAccess='viewer'/);
  assert.match(source,/claims\.jawafaOwner===true\|\|claims\.aasOwner===true/);
  assert.doesNotMatch(source,/firstRegistrant|firstPhoneIsOwner|anyPhoneIsOwner/);
});

test('SMS request cannot run until reCAPTCHA is completed, and reports each real stage',async()=>{
  const e=await environment('phone');
  let captchaOptions=null,renders=0,sent=0,cleared=0;
  e.window.firebase.auth.RecaptchaVerifier=class{
    constructor(container,options){
      assert.equal(container,'owner-phone-recaptcha');
      captchaOptions=options;
    }
    async render(){renders++;return 31;}
    clear(){cleared++;}
  };
  e.auth.signInWithPhoneNumber=async(number,verifier)=>{
    assert.equal(number,'+962791234567');assert.ok(verifier);
    sent++;return {confirm:async code=>({user:{phoneNumber:number,providerData:[{providerId:'phone'}]}})};
  };
  const stages=[];
  const first=await e.service.startPhoneLogin('+962791234567',x=>stages.push(x));
  assert.equal(first.sent,false);
  assert.equal(sent,0,'do not call backend before user completes captcha');
  assert.equal(renders,1);
  assert.ok(stages.includes('CAPTCHA_ACTION_REQUIRED'));
  captchaOptions.callback('recaptcha-ok');
  assert.ok(stages.includes('CAPTCHA_PASSED'));
  const second=await e.service.startPhoneLogin('+962791234567',x=>stages.push(x));
  assert.equal(second.sent,true);assert.equal(sent,1);
  assert.ok(stages.includes('SMS_REQUESTING'));
  assert.ok(stages.includes('SMS_REQUEST_ACCEPTED'));
  assert.equal(cleared,0);
  assert.ok(typeof captchaOptions['expired-callback']==='function');
});
test('SMS code is not accepted before a real Firebase confirmation',async()=>{
  const e=await environment('phone');
  await assert.rejects(e.service.confirmPhoneLogin('000000'),/REQUEST_SMS_FIRST/);
});
test('captcha expiration and changing phone cannot reuse a prior verified captcha',async()=>{
  const e=await environment('phone');
  const challenge=[];
  let sends=0,rendered=0;
  e.window.firebase.auth.RecaptchaVerifier=class {
    constructor(container,options){challenge.push(options)}
    async render(){rendered++;return rendered;}
    clear(){}
  };
  e.auth.signInWithPhoneNumber=async()=>{sends++;return {confirm:async()=>({})}};
  const steps=[];
  await e.service.startPhoneLogin('+962791234567',stage=>steps.push(stage));
  challenge[0].callback('solved');
  challenge[0]['expired-callback']();
  const one=await e.service.startPhoneLogin('+962791234567',stage=>steps.push(stage));
  assert.equal(one.sent,false);assert.equal(sends,0);
  challenge[0].callback('solved');
  const two=await e.service.startPhoneLogin('+962791234568',stage=>steps.push(stage));
  assert.equal(two.sent,false);assert.equal(rendered,2);assert.equal(sends,0);
});
