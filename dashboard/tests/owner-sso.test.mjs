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
  assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|postMessage\(/);
  assert.doesNotMatch(page,/name="new-password"[^>]+value="/);
  assert.match(source,/get isOwnerVerified\(\)\{return false/);
});
