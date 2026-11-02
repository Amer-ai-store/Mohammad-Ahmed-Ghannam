/* Luqta 3D companion v3 — professional rigged GLB character (skinned mesh, real skeleton).
 * Runs inside a WebView/iframe with THREE r149 + THREE.GLTFLoader as globals.
 *
 * Model: any humanoid GLB with a Mixamo/ReadyPlayerMe-style skeleton (Hips, Spine, Spine1,
 * Spine2, Neck, Head, LeftArm, LeftForeArm, LeftHand, LeftUpLeg, LeftLeg, LeftFoot …, with or
 * without the "mixamorig:" prefix). Clips named idle / walk / run / jump / wave / thumbs /
 * sit / sleep … are used when present; every other action is produced procedurally by
 * rotating the model's own bones (retargeted from character space to each bone's rest frame).
 *
 * Messages in:  {type:'action',action} {type:'profile',profile} {type:'facing',yaw}
 *               {type:'reduceMotion',value} {type:'sound',value} {type:'pause',value}
 *               {type:'probe',id} {type:'processFace',dataUrl,id}
 * Messages out: ready, actionChanged, probe, faceProcessed, error.
 */
(function () {
  'use strict';
  var T = window.THREE;
  var post = function (msg) {
    var s = JSON.stringify(msg);
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); } catch (e) { /* ignore */ }
    try { if (window.parent && window.parent !== window) window.parent.postMessage(s, '*'); } catch (e) { /* ignore */ }
    window.__luqtaLast = msg;
    (window.__luqtaLog = window.__luqtaLog || []).push(msg); if (window.__luqtaLog.length > 60) window.__luqtaLog.shift();
  };
  if (!T || !T.GLTFLoader) { post({ type: 'error', code: 'NO_THREE' }); return; }
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;
  var init = window.__LUQTA_INIT__ || {};

  // ---------- renderer / scene ----------
  var canvas = document.getElementById('stage');
  var renderer;
  try { renderer = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, preserveDrawingBuffer: true }); }
  catch (e) { post({ type: 'error', code: 'NO_WEBGL', message: String(e && e.message || e) }); return; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(24, 1, 0.1, 60);
  scene.add(new T.HemisphereLight(0xffffff, 0xd6c8f5, 0.75));
  var key = new T.DirectionalLight(0xffffff, 1.25); key.position.set(1.8, 3.2, 3.4); scene.add(key);
  var rim = new T.DirectionalLight(0xc6b2ff, 0.9); rim.position.set(-2.6, 2.4, -2.2); scene.add(rim);
  var fill = new T.DirectionalLight(0xffe6dc, 0.35); fill.position.set(-2.2, 0.8, 2.6); scene.add(fill);

  // soft contact shadow
  var sc = document.createElement('canvas'); sc.width = sc.height = 128;
  var sx = sc.getContext('2d'); var grd = sx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(60,30,110,0.38)'); grd.addColorStop(1, 'rgba(60,30,110,0)'); sx.fillStyle = grd; sx.fillRect(0, 0, 128, 128);
  var shadow = new T.Mesh(new T.PlaneGeometry(1.1, 0.6), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; scene.add(shadow);

  // root (moves for jump / lying), turntable (facing)
  var root = new T.Group(); scene.add(root);
  var turn = new T.Group(); root.add(turn);

  function std(c, r, m) { return new T.MeshStandardMaterial({ color: c, roughness: r == null ? 0.6 : r, metalness: m || 0 }); }
  function at(mesh, parent, x, y, z) { mesh.position.set(x || 0, y || 0, z || 0); parent.add(mesh); return mesh; }

  // shopping cart prop (travels with the character)
  var cart = new T.Group();
  (function buildCart() {
    var red = std(0xe2393f, 0.35, 0.15), wire = std(0xc7cbd2, 0.25, 0.9), wheel = std(0x1b1b1b, 0.7);
    var basket = new T.Group(); basket.position.set(0, 0.56, 0); cart.add(basket);
    var w = 0.52, d = 0.64, h = 0.36;
    at(new T.Mesh(new T.BoxGeometry(w, 0.02, d), wire), basket, 0, -h / 2, 0);
    [-1, 1].forEach(function (s) { at(new T.Mesh(new T.BoxGeometry(0.02, h, d), red), basket, s * w / 2, 0, 0); });
    at(new T.Mesh(new T.BoxGeometry(w, h, 0.02), red), basket, 0, 0, d / 2);
    at(new T.Mesh(new T.BoxGeometry(w, h * 0.8, 0.02), red), basket, 0, -0.03, -d / 2);
    for (var i = -2; i <= 2; i++) at(new T.Mesh(new T.BoxGeometry(0.008, h, 0.008), wire), basket, i * 0.1, 0, d / 2 + 0.012);
    at(new T.Mesh(new T.BoxGeometry(0.14, 0.2, 0.1), std(0x2e5aa8, 0.6)), basket, -0.12, 0.05, 0.05);
    at(new T.Mesh(new T.BoxGeometry(0.1, 0.22, 0.08), std(0xf6f6f6, 0.5)), basket, 0.06, 0.07, 0.12);
    var ban = at(new T.Mesh(new T.TorusGeometry(0.07, 0.025, 8, 16, Math.PI), std(0xf5d33a, 0.5)), basket, 0.12, 0.17, -0.1); ban.rotation.z = 0.4;
    at(new T.Mesh(new T.SphereGeometry(0.05, 16, 12), std(0xc9312c, 0.5)), basket, -0.05, 0.16, -0.14);
    at(new T.Mesh(new T.SphereGeometry(0.06, 16, 12), std(0x4caf50, 0.7)), basket, 0.14, 0.12, 0.02);
    [-1, 1].forEach(function (s) {
      var p2 = at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.75, 8), wire), cart, s * 0.24, 0.42, -0.36); p2.rotation.x = -0.25;
      at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.62, 8), wire), cart, s * 0.22, 0.12, 0).rotation.x = Math.PI / 2;
    });
    var handle = at(new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.56, 12), red), cart, 0, 0.8, -0.45); handle.rotation.z = Math.PI / 2;
    cart.userData.wheels = [[-0.2, 0.26], [0.2, 0.26], [-0.2, -0.26], [0.2, -0.26]].map(function (p) {
      var wh = at(new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.03, 14), wheel), cart, p[0], 0.045, p[1]); wh.rotation.z = Math.PI / 2; return wh;
    });
  })();
  cart.scale.setScalar(1.3); cart.position.set(0, 0, 1.0); cart.visible = false; turn.add(cart);

  function letter(txt) {
    var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    x.fillStyle = '#7b5cc4'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 32, 34);
    var sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false })); sp.scale.set(0.16, 0.16, 1); return sp;
  }
  var zzz = [letter('z'), letter('z'), letter('Z')]; zzz.forEach(function (z) { z.visible = false; scene.add(z); });
  var pouf = new T.Mesh(new T.CylinderGeometry(0.22, 0.24, 0.56, 32), std(0xb9a6ea, 0.8)); pouf.visible = false; turn.add(pouf); pouf.position.set(0, 0.28, -0.3);
  var pillow = new T.Mesh(new T.SphereGeometry(0.3, 24, 16), std(0xcbbcf0, 0.85)); pillow.scale.set(1.25, 0.28, 0.75); pillow.visible = false; scene.add(pillow);

  // ---------- model loading ----------
  var model = null, mixer = null, clips = {}, bones = {}, rest = {}, chainOffset = {}, materials = [], modelHeight = 1.8, photoCap = null, headBone = null;
  var BONE_KEYS = {
    hips: ['Hips'], spine: ['Spine'], spine1: ['Spine1'], chest: ['Spine2', 'Chest', 'UpperChest'], neck: ['Neck'], head: ['Head'],
    shoulderL: ['LeftArm', 'LeftUpperArm'], elbowL: ['LeftForeArm', 'LeftLowerArm'], wristL: ['LeftHand'],
    shoulderR: ['RightArm', 'RightUpperArm'], elbowR: ['RightForeArm', 'RightLowerArm'], wristR: ['RightHand'],
    thighL: ['LeftUpLeg', 'LeftUpperLeg'], kneeL: ['LeftLeg', 'LeftLowerLeg'], ankleL: ['LeftFoot'],
    thighR: ['RightUpLeg', 'RightUpperLeg'], kneeR: ['RightLeg', 'RightLowerLeg'], ankleR: ['RightFoot'],
  };
  var EXTRA = { top: ['HeadTop_End', 'HeadTop'], eyeL: ['LeftEye'], eyeR: ['RightEye'] }, extra = {};
  var CHAIN = { shoulderL: 'armL', elbowL: 'armL', wristL: 'armL', shoulderR: 'armR', elbowR: 'armR', wristR: 'armR' };
  function cleanName(n) { return String(n || '').replace(/^mixamorig[:_]?/i, '').replace(/^.*[:|]/, ''); }

  function onModel(gltf) {
    model = gltf.scene;
    model.traverse(function (o) {
      if (o.isMesh || o.isSkinnedMesh) {
        o.frustumCulled = false;
        var ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(function (m) { if (m && materials.indexOf(m) < 0) { materials.push(m); m.userData.base = m.color ? m.color.clone() : null; } });
      }
      if (o.isBone) {
        var n = cleanName(o.name);
        Object.keys(BONE_KEYS).forEach(function (k) { if (!bones[k] && BONE_KEYS[k].indexOf(n) >= 0) bones[k] = o; });
        Object.keys(EXTRA).forEach(function (k) { if (!extra[k] && EXTRA[k].indexOf(n) >= 0) extra[k] = o; });
      }
    });
    // normalise size: feet on the ground, ~1.8 units tall, centred
    // (skinned meshes are drawn by their bones, so measure the skeleton rather than raw geometry)
    var measure = function () {
      model.updateMatrixWorld(true);
      var bx = new T.Box3(), v = new T.Vector3(), any = false;
      model.traverse(function (o) { if (o.isBone) { bx.expandByPoint(o.getWorldPosition(v)); any = true; } });
      return any ? bx : new T.Box3().setFromObject(model);
    };
    var box = measure(), size = box.getSize(new T.Vector3());
    var s = size.y > 0 ? 1.8 / size.y : 1; model.scale.multiplyScalar(s);
    box = measure(); var c = box.getCenter(new T.Vector3());
    model.position.set(model.position.x - c.x, model.position.y - box.min.y, model.position.z - c.z); modelHeight = 1.8;
    turn.add(model); model.updateMatrixWorld(true);
    // rest frames (model space) for retargeting
    var modelQ = model.getWorldQuaternion(new T.Quaternion()), invModel = modelQ.clone().invert();
    Object.keys(bones).forEach(function (k) {
      var b = bones[k], w = b.getWorldQuaternion(new T.Quaternion()).premultiply(invModel);
      var pw = b.parent ? b.parent.getWorldQuaternion(new T.Quaternion()).premultiply(invModel) : new T.Quaternion();
      rest[k] = { local: b.quaternion.clone(), world: w, parentWorld: pw, pos: b.position.clone() };
    });
    // arm chain offset: rotation that brings the rest upper arm to hanging straight down
    ['L', 'R'].forEach(function (side) {
      var a = bones['shoulder' + side], f = bones['elbow' + side];
      if (!a || !f) return;
      var pa = a.getWorldPosition(new T.Vector3()), pf = f.getWorldPosition(new T.Vector3());
      var dir = pf.sub(pa).applyQuaternion(invModel).normalize();
      chainOffset['arm' + side] = new T.Quaternion().setFromUnitVectors(dir, new T.Vector3(0, -1, 0));
    });
    headBone = bones.head || null;
    // clips by normalised name
    mixer = new T.AnimationMixer(model);
    (gltf.animations || []).forEach(function (clip) {
      var n = clip.name.toLowerCase().replace(/^.*\|/, '');
      var keyName = /idle/.test(n) ? 'idle' : /walk/.test(n) ? 'walk' : /run/.test(n) ? 'run' : /jump/.test(n) ? 'jump' : /wave|hello/.test(n) ? 'wave' :
        /thumb/.test(n) ? 'thumbs' : /sit/.test(n) ? 'sit' : /sleep|lying|lay/.test(n) ? 'sleep' : /wake|stand.?up|getup/.test(n) ? 'wake' :
        /push|cart/.test(n) ? 'cart' : /point/.test(n) ? 'point' : /think/.test(n) ? 'think' : /cross/.test(n) ? 'crossed' :
        /listen|phone/.test(n) ? 'listen' : /come|beckon/.test(n) ? 'come' : /agree|yes|nod/.test(n) ? 'agree' : /shake|no\b/.test(n) ? 'headShake' : null;
      if (keyName && !clips[keyName]) clips[keyName] = mixer.clipAction(clip);
    });
    applyProfile(init.profile || {});
    setAction(init.action || 'idle', true);
    post({ type: 'ready', webgl: true, model: init.modelName || 'embedded', bones: Object.keys(bones).length, skinned: true, clips: Object.keys(clips), actions: Object.keys(ACTIONS) });
  }
  function loadModel(url, fallback) {
    new T.GLTFLoader().load(url, onModel, undefined, function (err) {
      if (fallback) { loadModel(fallback, null); return; }
      post({ type: 'error', code: 'MODEL_LOAD', message: String(err && err.message || err) });
    });
  }

  // ---------- procedural poses (character space, same convention as v2) ----------
  var reduceMotion = !!init.reduceMotion, soundOn = init.sound !== false, audio = null;
  var amp = function () { return reduceMotion ? 0.45 : 1; };
  var S = Math.sin;
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function ease(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function P() { return { rootY: 0, rootRotZ: 0, rootX: 0 }; }
  function arms(p, l, r, el, er) { p.shoulderL = l; p.shoulderR = r; if (el) p.elbowL = el; if (er) p.elbowR = er; return p; }
  function crouch(p, k) { p.rootY = -0.17 * k; p.thighL = [-0.95 * k, 0, 0]; p.thighR = [-0.95 * k, 0, 0]; p.kneeL = [1.8 * k, 0, 0]; p.kneeR = [1.8 * k, 0, 0]; p.ankleL = [-0.85 * k, 0, 0]; p.ankleR = [-0.85 * k, 0, 0]; p.spine = [0.3 * k, 0, 0]; }
  function sitLegs(p, k) { p.thighL = [-1.57 * k, 0, 0.08 * k]; p.thighR = [-1.57 * k, 0, -0.08 * k]; p.kneeL = [1.57 * k, 0, 0]; p.kneeR = [1.57 * k, 0, 0]; }
  function relaxedArms(p) { return arms(p, [0.04, 0, 0.1], [0.04, 0, -0.1], [-0.12, 0, 0], [-0.12, 0, 0]); }
  // base: which clip drives the body; upper/full: which bones the procedural pose overrides
  var ACTIONS = {
    idle: { clip: 'idle', bones: null, pose: function (t) { var p = P(); if (!clips.idle) { relaxedArms(p); p.spine = [S(t * 2.1) * 0.02, 0, 0]; p.head = [0, S(t * 0.7) * 0.12, 0]; } return p; } },
    walk: { clip: 'walk', bones: null, pose: function () { return P(); } },
    run: { clip: 'run', fallback: 'walk', bones: null, pose: function () { return P(); } },
    cart: { clip: 'walk', bones: ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'spine'], pose: function () {
      var p = P(); arms(p, [-0.62, 0, -0.04], [-0.62, 0, 0.04], [-0.45, 0, 0], [-0.45, 0, 0]); p.wristL = [0.3, 0, 0]; p.wristR = [0.3, 0, 0]; p.spine = [0.14, 0, 0]; return p; } },
    jump: { clip: 'jump', bones: 'all', pose: function (t) {
      var c = (t % 1.6) / 1.6, p = P(), a = amp(); relaxedArms(p);
      if (c < 0.22) { var k = ease(c / 0.22); crouch(p, k); p.shoulderL = [0.6 * k, 0, 0.1]; p.shoulderR = [0.6 * k, 0, -0.1]; }
      else if (c < 0.36) { var k2 = ease((c - 0.22) / 0.14); crouch(p, 1 - k2); arms(p, [-2.6 * k2, 0, 0.35], [-2.0 * k2, 0, -0.5]); p.rootY = 0.1 * k2 * a; }
      else if (c < 0.78) { var k3 = (c - 0.36) / 0.42; p.rootY = (0.1 + 0.32 * S(Math.PI * k3)) * a; arms(p, [-2.6, 0, 0.35], [-0.4, 0, -1.2], null, [-1.2, 0, 0]); p.thighL = [-0.9, 0, 0.05]; p.kneeL = [1.5, 0, 0]; p.thighR = [-0.2, 0, -0.05]; p.kneeR = [0.9, 0, 0]; }
      else if (c < 0.9) { var k4 = ease((c - 0.78) / 0.12); crouch(p, 1 - Math.abs(k4 - 0.5) * 2); }
      return p; } },
    sleep: { clip: 'sleep', bones: 'all', pose: function (t) {
      var p = P(), br = S(t * 1.3) * 0.025; p.rootRotZ = Math.PI / 2; p.rootY = 0.18; p.rootX = 0.72;
      p.spine = [0.15 + br, 0, 0]; p.chest = [0.1 + br, 0, 0]; p.neck = [0.2, 0, 0]; p.head = [0, 0, 0.15];
      arms(p, [-0.4, 0, 0.6], [-1.9, 0.3, -0.2], [-2.2, 0, 0], [-1.9, 0, 0]);
      p.thighL = [-0.7, 0, 0]; p.kneeL = [1.2, 0, 0]; p.thighR = [-0.5, 0, 0]; p.kneeR = [1.0, 0, 0]; return p; } },
    wake: { clip: 'wake', bones: 'all', pose: function (t) {
      var c = Math.min(t, 3.2), p;
      if (c < 1.0) { p = ACTIONS.sleep.pose(0); var k = ease(c); p.rootRotZ = Math.PI / 2 * (1 - k); p.rootY = 0.18 * (1 - k) - 0.38 * k; p.rootX = 0.72 * (1 - k); sitLegs(p, k); }
      else if (c < 1.8) { p = P(); relaxedArms(p); var k2 = ease((c - 1.0) / 0.8); sitLegs(p, 1 - k2); p.rootY = -0.38 * (1 - k2); }
      else { p = P(); var k3 = S(Math.PI * clamp01((c - 1.8) / 1.4)); arms(p, [-2.9 * k3, 0, 0.25], [-2.9 * k3, 0, -0.25], [-0.4 * k3, 0, 0], [-0.4 * k3, 0, 0]); p.spine = [-0.12 * k3, 0, 0]; p.head = [-0.2 * k3, 0, 0]; }
      return p; } },
    come: { clip: 'come', base: 'idle', bones: ['shoulderR', 'elbowR', 'wristR'], pose: function (t) { var p = P(), w = S(t * 7) * amp(); p.shoulderR = [-0.95, -0.3, 0]; p.elbowR = [-0.5 - 0.9 * Math.max(0, w), 0, 0]; p.wristR = [-0.5, 0, 0]; return p; } },
    wave: { clip: 'wave', base: 'idle', bones: ['shoulderR', 'elbowR'], pose: function (t) { var p = P(); p.shoulderR = [-0.2, 0, -2.6]; p.elbowR = [0, 0, -0.35 - 0.35 * S(t * 8) * amp()]; return p; } },
    point: { clip: 'point', base: 'idle', bones: ['shoulderR', 'elbowR', 'wristR', 'head', 'chest'], pose: function () { var p = P(); p.shoulderR = [-1.45, -0.55, 0]; p.elbowR = [-0.1, 0, 0]; p.wristR = [0, 0, 0]; p.head = [0, -0.35, 0]; p.chest = [0, -0.15, 0]; return p; } },
    thumbs: { clip: 'thumbs', base: 'idle', bones: ['shoulderL', 'elbowL', 'wristL', 'head'], pose: function () { var p = P(); p.shoulderL = [-0.3, -0.25, 0]; p.elbowL = [-1.55, 0, 0]; p.wristL = [0, 0, 0]; p.head = [0, 0, 0.08]; return p; } },
    think: { clip: 'think', base: 'idle', bones: ['shoulderR', 'elbowR', 'wristR', 'shoulderL', 'elbowL', 'head'], pose: function (t) { var p = P(); p.shoulderR = [-0.5, 0.1, 0]; p.elbowR = [-2.3, 0.55, 0]; p.wristR = [0.3, 0, 0]; p.shoulderL = [-0.3, -0.1, 0]; p.elbowL = [-1.45, -0.8, 0]; p.head = [0.08, 0, 0.1 + S(t * 1.2) * 0.04]; return p; } },
    crossed: { clip: 'crossed', base: 'idle', bones: ['shoulderL', 'elbowL', 'shoulderR', 'elbowR'], pose: function () { var p = P(); arms(p, [-0.35, -0.04, 0], [-0.4, 0.04, 0], [-1.45, -0.42, 0], [-1.4, 0.42, 0]); return p; } },
    listen: { clip: 'listen', base: 'idle', bones: ['shoulderR', 'elbowR', 'head'], pose: function () { var p = P(); p.shoulderR = [-0.6, 0, -0.95]; p.elbowR = [-2.4, 0, 0]; p.head = [0, 0.1, -0.18]; return p; } },
    sit: { clip: 'sit', bones: 'all', pose: function (t) { var p = P(); relaxedArms(p); sitLegs(p, 1); p.rootY = -0.38; arms(p, [-0.55, 0, 0.12], [-0.55, 0, -0.12], [-0.55, 0, 0], [-0.55, 0, 0]); p.head = [0.05, S(t * 0.6) * 0.15, 0]; p.spine = [0.08 + S(t * 2) * 0.01, 0, 0]; return p; } },
  };
  ACTIONS.stop = ACTIONS.idle;
  var ALL = Object.keys(BONE_KEYS);

  // retarget: character-space euler → bone local quaternion  (L = inv(Wp_rest) · Q · W_rest)
  var tmpQ = new T.Quaternion(), tmpE = new T.Euler(), qInvP = new T.Quaternion();
  function targetLocal(key, e) {
    var r = rest[key]; if (!r) return null;
    tmpQ.setFromEuler(tmpE.set(e[0], e[1], e[2], 'ZYX')); // pitch (X) first, then swing (Y), then roll/abduct (Z)
    var chain = CHAIN[key], off = chain && chainOffset[chain];
    if (off) {
      if (key.indexOf('shoulder') === 0) tmpQ.multiply(off);                    // P · O
      else tmpQ.premultiply(off.clone().invert()).multiply(off);                // O⁻¹ · q · O
    }
    qInvP.copy(r.parentWorld).invert();
    return qInvP.multiply(tmpQ).multiply(r.world);
  }

  // ---------- state & loop ----------
  var state = { action: 'idle', started: 0, yaw: 0.25, targetYaw: 0.25, paused: false, weight: 0, current: null };
  var currentClip = null;
  function playClip(name) {
    var a = clips[name] || null;
    if (a === currentClip) return;
    if (a) { a.reset(); a.setEffectiveWeight(1); a.fadeIn(0.35); a.play(); }
    if (currentClip) currentClip.fadeOut(0.35);
    currentClip = a;
  }
  function chirp(kind) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime;
      var f = { jump: [520, 880], thumbs: [660, 990], wave: [600, 750], come: [500, 700], wake: [400, 800] }[kind] || [600, 700];
      o.type = 'sine'; o.frequency.setValueAtTime(f[0], t0); o.frequency.exponentialRampToValueAtTime(f[1], t0 + 0.12);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + 0.22);
    } catch (e) { /* audio unavailable */ }
  }
  function setAction(a, silent) {
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, a)) { post({ type: 'error', code: 'UNKNOWN_ACTION', action: a }); return; }
    var def = ACTIONS[a];
    state.action = a; state.started = performance.now() / 1000; state.weight = 0;
    var own = clips[def.clip];
    playClip(own ? def.clip : clips[def.base || def.fallback || ''] ? (def.base || def.fallback) : (def.bones === 'all' ? null : 'idle'));
    state.useProcedural = !own;
    // show the cart in profile; restore the previous facing afterwards
    if (a === 'cart' && state.cartYaw == null) { state.cartYaw = state.targetYaw; if (Math.abs(state.targetYaw) < 0.6) state.targetYaw = 0.95; }
    else if (a !== 'cart' && state.cartYaw != null) { state.targetYaw = state.cartYaw; state.cartYaw = null; }
    cart.visible = a === 'cart'; pouf.visible = a === 'sit'; pillow.visible = a === 'sleep'; zzz.forEach(function (z) { z.visible = a === 'sleep'; });
    frameCamera();
    if (!silent && (a === 'jump' || a === 'thumbs' || a === 'wave' || a === 'come' || a === 'wake')) chirp(a);
    post({ type: 'actionChanged', action: a, clip: own ? def.clip : null });
  }
  var rootPose = { y: 0, rz: 0, x: 0 };
  function frameCamera() {
    var lying = state.action === 'sleep', withCart = state.action === 'cart';
    var w = window.innerWidth || 200, h = window.innerHeight || 320; camera.aspect = w / h;
    var fit = lying ? Math.max(1, 2.3 / camera.aspect) : withCart ? Math.max(1, 1.25 / camera.aspect) : Math.max(1, 0.6 / camera.aspect);
    var ty = lying ? 0.32 : 0.9, tx = withCart ? Math.sin(state.targetYaw) * 0.75 : 0, dist = (lying ? 3.1 : 5.0) * fit;
    camera.position.set(tx, ty + (lying ? 0.35 : 0.1), dist); camera.lookAt(tx, ty, 0); camera.updateProjectionMatrix();
  }
  function resize() { renderer.setSize(window.innerWidth || 200, window.innerHeight || 320, false); frameCamera(); }
  window.addEventListener('resize', resize); resize();

  var last = performance.now(), lastRender = 0, frames = 0, fps = 0, fpsT = last;
  function loop(now) {
    requestAnimationFrame(loop);
    if (state.paused) return;
    if (reduceMotion && now - lastRender < 1000 / 30) return;
    lastRender = now;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = now / 1000 - state.started;
    if (mixer) mixer.update(dt * (reduceMotion ? 0.6 : 1));
    if (model) {
      var def = ACTIONS[state.action];
      state.weight = Math.min(1, state.weight + dt / 0.35);
      if (state.useProcedural || def.bones) {
        var pose = def.pose(t), list = def.bones === 'all' || (!currentClip && state.useProcedural) ? ALL : (def.bones || []);
        var w = state.weight;
        for (var i = 0; i < list.length; i++) {
          var k = list[i], b = bones[k]; if (!b) continue;
          var e = pose[k] || [0, 0, 0], q = targetLocal(k, e);
          if (q) { if (currentClip && def.bones !== 'all') b.quaternion.slerp(q, w); else b.quaternion.slerp(q, Math.min(1, w * 1.5)); }
        }
        rootPose.y += ((pose.rootY || 0) - rootPose.y) * Math.min(1, dt * 8);
        rootPose.rz += ((pose.rootRotZ || 0) - rootPose.rz) * Math.min(1, dt * 6);
        rootPose.x += ((pose.rootX || 0) - rootPose.x) * Math.min(1, dt * 6);
      } else { rootPose.y *= 0.9; rootPose.rz *= 0.9; rootPose.x *= 0.9; }
      root.position.set(rootPose.x, rootPose.y, 0); root.rotation.z = rootPose.rz;
    }
    state.yaw += (state.targetYaw - state.yaw) * (1 - Math.pow(0.002, dt));
    turn.rotation.y = state.yaw;
    if (cart.visible) cart.userData.wheels.forEach(function (wh) { wh.rotation.x += dt * 6; });
    if (pillow.visible) pillow.position.set(-0.62, 0.08, 0);
    if (zzz[0].visible) zzz.forEach(function (z, i) { var c = ((t * 0.45 + i / 3) % 1); z.position.set(0.15 + c * 0.35, 0.55 + c * 0.7, 0.2); z.material.opacity = 1 - c; });
    shadow.scale.set(1 - rootPose.y * 1.2, 1, 1 - rootPose.y * 1.2);
    renderer.render(scene, camera);
    frames++; if (now - fpsT > 1000) { fps = frames; frames = 0; fpsT = now; }
  }
  requestAnimationFrame(loop);

  // ---------- appearance ----------
  function hex(c) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : null; }
  function applyProfile(pr) {
    pr = pr || {};
    var rules = [[/skin|body_?skin|face_?skin/i, hex(pr.skin)], [/hair|beard/i, hex(pr.hair)], [/pant|trouser|jean|leg/i, hex(pr.pants)],
      [/vest|jacket|shirt|top|torso|outfit|cloth/i, hex(pr.outfit)], [/boot|shoe/i, hex(pr.boots)]];
    materials.forEach(function (m) {
      var name = m.name || '', applied = false;
      rules.forEach(function (r) { if (!applied && r[1] && r[0].test(name) && m.color) { m.color.set(r[1]); applied = true; } });
      if (!applied && m.userData.base && m.color) m.color.copy(m.userData.base);
      // neutral placeholder mannequin: brand colours (lavender body, coral joints)
      if (!applied && /Beta_HighLimbs|Beta_Surface|asdf1/i.test(name)) m.color.set(pr.outfit && pr.outfit !== '#141414' ? pr.outfit : '#b8a6ea');
      if (!applied && /Beta_Joints/i.test(name)) m.color.set(pr.pants || '#fe585c');
    });
    var faceMat = materials.filter(function (m) { return /face/i.test(m.name || ''); })[0];
    if (pr.faceDataUrl && /^data:image\/(png|jpeg|webp);base64,/.test(pr.faceDataUrl)) {
      new T.TextureLoader().load(pr.faceDataUrl, function (tex) {
        tex.encoding = T.sRGBEncoding; tex.flipY = false;
        if (faceMat) { faceMat.map = tex; faceMat.needsUpdate = true; }
        else attachPhotoCap(tex);
      });
    } else if (photoCap && photoCap.parent) { photoCap.parent.remove(photoCap); photoCap = null; }
  }
  // fallback for models without a "Face" material: a photo cap on the front of the head bone
  function attachPhotoCap(tex) {
    if (!headBone) return;
    if (photoCap && photoCap.parent) photoCap.parent.remove(photoCap);
    var a = document.createElement('canvas'); a.width = a.height = 128; var x = a.getContext('2d');
    var g = x.createRadialGradient(64, 62, 30, 64, 62, 62); g.addColorStop(0, '#fff'); g.addColorStop(0.8, '#fff'); g.addColorStop(1, '#000');
    x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128); x.fillStyle = g; x.beginPath(); x.ellipse(64, 62, 58, 62, 0, 0, Math.PI * 2); x.fill();
    tex.flipY = true;
    model.updateMatrixWorld(true);
    // holder: child of the head bone, oriented like the character and in world units
    var holder = new T.Object3D();
    var hq = headBone.getWorldQuaternion(new T.Quaternion()), mq = turn.getWorldQuaternion(new T.Quaternion());
    holder.quaternion.copy(hq.invert().multiply(mq));
    holder.scale.setScalar(1 / (headBone.getWorldScale(new T.Vector3()).x || 1));
    headBone.add(holder); holder.updateMatrixWorld(true);
    var loc = function (b) { return b ? holder.worldToLocal(b.getWorldPosition(new T.Vector3())) : null; };
    var top = loc(extra.top) || new T.Vector3(0, modelHeight * 0.11, 0);
    var eyes = extra.eyeL && extra.eyeR ? loc(extra.eyeL).add(loc(extra.eyeR)).multiplyScalar(0.5) : new T.Vector3(0, top.y * 0.5, modelHeight * 0.05);
    var headR = Math.max(0.06, top.length() * 0.5);
    var centre = new T.Vector3(eyes.x, eyes.y - headR * 0.18, eyes.z - headR * 0.6);
    var front = eyes.clone().sub(centre); var r = front.length() + headR * (init.faceInset == null ? 0.55 : init.faceInset); front.normalize();
    var cap = new T.Mesh(new T.SphereGeometry(r, 32, 24, Math.PI * 0.5 - 0.8, 1.6, 0.85, 1.35), new T.MeshStandardMaterial({ map: tex, alphaMap: new T.CanvasTexture(a), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    cap.position.copy(centre); cap.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), front);
    cap.scale.set(0.95, 1.2, 1.0); // faces are taller than wide; flatten so it hugs the head
    holder.add(cap); photoCap = holder;
  }
  // photo → cropped face texture + sampled skin/hair colours (on the device; nothing uploaded)
  function processFace(dataUrl, id) {
    var img = new Image();
    img.onload = function () {
      try {
        var w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h * 0.75) * 0.7;
        var sx2 = (w - side) / 2, sy2 = Math.max(0, h * 0.42 - side / 2);
        var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
        x.drawImage(img, sx2, sy2, side, side, 0, 0, 256, 256);
        var sample = function (x0, y0, ww, hh) {
          var d = x.getImageData(x0, y0, ww, hh).data, r = [], g = [], b = [];
          for (var i = 0; i < d.length; i += 4) { r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]); }
          var med = function (a) { a.sort(function (m, n) { return m - n; }); return a[a.length >> 1]; };
          return '#' + [med(r), med(g), med(b)].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
        };
        var skin = sample(92, 78, 72, 22), hairC = sample(70, 4, 116, 18);
        var lum = function (hx) { var n = parseInt(hx.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
        if (lum(skin) < 0.22 || lum(skin) > 0.96) skin = '#e0a27c';
        post({ type: 'faceProcessed', id: id, dataUrl: c.toDataURL('image/jpeg', 0.82), skin: skin, hair: hairC });
      } catch (e) { post({ type: 'error', id: id, code: 'FACE_PROCESS', message: String(e && e.message || e) }); }
    };
    img.onerror = function () { post({ type: 'error', id: id, code: 'FACE_LOAD' }); };
    img.src = dataUrl;
  }

  function probe(id) {
    var joints = {};
    Object.keys(bones).forEach(function (k) { var e = new T.Euler().setFromQuaternion(bones[k].quaternion); joints[k] = [e.x, e.y, e.z].map(function (v) { return Math.round(v * 1000) / 1000; }); });
    post({ type: 'probe', id: id, action: state.action, clip: currentClip ? currentClip.getClip().name : null, fps: fps, bones: Object.keys(bones).length, skinned: !!model, rootY: root.position.y, rootRotZ: root.rotation.z, cartVisible: cart.visible, photoFace: !!photoCap, joints: joints });
  }
  function command(msg) {
    if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'action': if (model) setAction(String(msg.action)); else init.action = String(msg.action); break;
      case 'profile': init.profile = msg.profile; if (model) applyProfile(msg.profile); break;
      case 'facing': state.targetYaw = Number(msg.yaw) || 0; if (state.cartYaw != null) state.cartYaw = state.targetYaw; frameCamera(); break;
      case 'reduceMotion': reduceMotion = !!msg.value; break;
      case 'sound': soundOn = !!msg.value; break;
      case 'pause': state.paused = !!msg.value; break;
      case 'probe': probe(msg.id); break;
      case 'processFace': processFace(String(msg.dataUrl || ''), msg.id); break;
      default: break;
    }
  }
  window.LuqtaAvatar = { command: command, actions: Object.keys(ACTIONS), get skeleton() { return { bones: Object.keys(bones) }; } };
  window.addEventListener('message', function (e) { command(e.data); });
  document.addEventListener('message', function (e) { command(e.data); });
  var embedded = window.__LUQTA_MODEL__ || null;
  var remote = typeof init.modelUrl === 'string' && /^https:\/\/[^\s]+\.(glb|gltf)(\?[^\s]*)?$/i.test(init.modelUrl) ? init.modelUrl : null;
  if (!remote && !embedded) { post({ type: 'error', code: 'NO_MODEL' }); return; }
  loadModel(remote || embedded, remote ? embedded : null);
})();
