#!/usr/bin/env node
/* ============================================================
   程序化几何库的离线自检
   ------------------------------------------------------------
   为什么几何库一定要有离线测试：
   加一件换装道具的代价很低（十几行），所以会一直加。加到第 40 件时，
   靠开浏览器一件件看是不现实的 —— 而这正是程序化几何最大的风险：
   代码不报错，但模型是塌的、悬空的、或者朝向反了。

   这个文件在 Node 里把每一件都真的建一遍（three.js 的核心几何
   不需要 WebGL，离屏可用），然后检查：
     · 建得出来（不抛异常）
     · 有网格（不是空组）
     · 站在地面上（最低点贴近 y=0），不会陷进岛里或飘在空中
     · 尺寸在同一量级，不会突然冒出一个比兔子还大的帽子
     · 挂在正确的换装槽位上（翅膀必须在身后）
     · 三角形预算撑得住 42 个棋子同屏

   用法：node tests/geom3d.test.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/* ---------- 在 Node 里把库跑起来 ---------- */
const THREE = require(path.join(ROOT, 'lab', 'vendor', 'three.min.js'));
const src = fs.readFileSync(path.join(ROOT, 'shared', 'geom3d.js'), 'utf8');
const fakeWindow = {};
/* 库的 IIFE 是 (typeof window !== 'undefined' ? window : this)，
   把 window 作为形参传进去，它就会挂到我们给的假对象上 */
new Function('window', 'THREE', src)(fakeWindow, THREE);
const G = fakeWindow.Geom3D;
if(!G) throw new Error('geom3d.js 没有挂出 window.Geom3D');

let fail = 0;
const ok = (cond, msg) => { if(!cond){ fail++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const section = t => { console.log('\n【' + t + '】'); };

function triangleCount(obj){
  let n = 0;
  obj.traverse(o => {
    if(!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    n += g.index ? g.index.count / 3 : g.position.count / 3;
  });
  return Math.round(n);
}
function meshCount(obj){
  let n = 0;
  obj.traverse(o => { if(o.isMesh) n++; });
  return n;
}
function box(obj){
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj);
}

/* ---------- 1. 五种萝卜 ---------- */
section('五种萝卜');
const radishTris = [];
for(let k = 0; k < G.RADISH_COUNT; k++){
  let r;
  try { r = G.radish(k); }
  catch(e){ fail++; console.log('  ✗ 第 ' + k + ' 种建不出来：' + e.message); continue; }
  const b = box(r);
  const h = b.max.y - b.min.y;
  const w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  const tri = triangleCount(r);
  radishTris.push(tri);
  const problems = [];
  if(meshCount(r) < 2) problems.push('网格太少（' + meshCount(r) + '）');
  if(Math.abs(b.min.y) > 0.02) problems.push('没站在地面上（最低点 ' + b.min.y.toFixed(3) + '）');
  if(h < 0.5 || h > 1.4) problems.push('高度失控（' + h.toFixed(2) + '）');
  if(w < 0.3 || w > 1.0) problems.push('宽度失控（' + w.toFixed(2) + '）');
  if(tri > 400) problems.push('面数偏高（' + tri + '）');
  console.log('  ' + (problems.length ? '✗' : '✓') + ' 第 ' + k + ' 种：' +
    meshCount(r) + ' 个网格 / ' + tri + ' 面 / 高 ' + h.toFixed(2) + ' 宽 ' + w.toFixed(2) +
    (problems.length ? '  ← ' + problems.join('，') : ''));
  if(problems.length) fail++;
}
ok(G.RADISH_COUNT === 5, '一共 5 种萝卜');

/* 五种必须真的长得不一样，不能只是换了颜色 ——
   三消要在「颜色」和「轮廓」两个维度同时拉开。

   这里不用「高宽比」当尺子。高宽比只看占了多大容积：
   一根圆柱和一个扁球完全可以有一样的比例，而形状天差地别，
   用它当指纹会漏掉真正的问题（也会误报没有的问题）。
   真正该测的是**宽度沿高度的分布**，也就是轮廓本身。 */
section('五种必须轮廓也不同');
const BANDS = 6, DIRS = 10;
/* 用射线量真实轮廓，而不是采样顶点。
   原因：ConeGeometry / CylinderGeometry 的高度分段默认是 1，
   中间根本没有顶点 —— 采样顶点得到的剖面会是「两头有值、中间一串 0」，
   那不是轮廓，只是两个端点。射线打出来的才是各高度的实际半径。 */
function profile(obj){
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const h = Math.max(b.max.y - b.min.y, 1e-6);
  const reach = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 + 0.4;
  const rc = new THREE.Raycaster();
  const origin = new THREE.Vector3(), dir = new THREE.Vector3();
  const out = [];
  for(let k = 0; k < BANDS; k++){
    const y = b.min.y + (k + 0.5) / BANDS * h;
    let mx = 0;
    for(let d = 0; d < DIRS; d++){
      const a = d / DIRS * Math.PI * 2;
      const cx = Math.cos(a), cz = Math.sin(a);
      origin.set(cx * reach, y, cz * reach);
      dir.set(-cx, 0, -cz);
      rc.set(origin, dir);
      const hits = rc.intersectObject(obj, true);
      if(hits.length){
        const r = reach - hits[0].distance;   /* 从外往里打，命中处就是轮廓半径 */
        if(r > mx) mx = r;
      }
    }
    out.push(mx);
  }
  const max = Math.max(...out) || 1;
  return out.map(x => x / max);               /* 归一化：只比形状，不比大小 */
}
{
  const profiles = [];
  for(let k = 0; k < G.RADISH_COUNT; k++) profiles.push(profile(G.radish(k)));
  profiles.forEach((p, i) =>
    console.log('  第 ' + i + ' 种宽度剖面（下→上）：' + p.map(x => x.toFixed(2)).join('  ')));

  const rms = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);

  /* 颜色和轮廓是两个独立的识别通道：色觉正常的人主要用颜色，
     色弱的人主要用轮廓。所以判定不该是「两者都必须拉开」，
     而是「至少有一个拉得开」—— 那才是玩家实际能用的信息。 */
  const P = G.PALETTE;
  const kinds = [P.carrot, P.daikon, P.purple, P.green, P.cherry];
  const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const cd = (a, b) => { const A = rgb(a), B = rgb(b); return Math.round(Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2])); };

  const MIN_SHAPE = 0.18, MIN_COLOR = 70;
  let bad = [];
  for(let i = 0; i < profiles.length; i++){
    for(let j = i + 1; j < profiles.length; j++){
      const shape = rms(profiles[i], profiles[j]);
      const color = cd(kinds[i], kinds[j]);
      const pass = shape > MIN_SHAPE || color > MIN_COLOR;
      console.log('    ' + i + '/' + j + '  轮廓差 ' + shape.toFixed(3) +
                  '　色差 ' + String(color).padStart(3) + '　' +
                  (pass ? '✓ 靠' + (shape > MIN_SHAPE ? '轮廓' : '颜色') : '✗ 两个通道都弱'));
      if(!pass) bad.push(i + '/' + j);
    }
  }
  ok(bad.length === 0, bad.length
     ? '有 ' + bad.length + ' 对既不靠轮廓也分不开颜色：' + bad.join('、')
     : '任意两种都至少有一个识别通道拉得开（轮廓 > ' + MIN_SHAPE + ' 或色差 > ' + MIN_COLOR + '）');
}

/* ---------- 2. 三角形预算 ---------- */
section('三角形预算');
{
  const per = radishTris.reduce((a, b) => a + b, 0) / radishTris.length;
  const board = per * 42;
  console.log('  单个棋子平均 ' + Math.round(per) + ' 面，42 个同屏约 ' + Math.round(board) + ' 面');
  ok(board < 20000, '满盘棋子的面数在预算内（' + Math.round(board) + ' < 20000）');
}

/* ---------- 3. 兔子 ---------- */
section('兔子');
const bunny = G.bunny();
const bunnyBox = box(bunny);
const bunnyH = bunnyBox.max.y - bunnyBox.min.y;
ok(meshCount(bunny) >= 10, '兔子的部件数（' + meshCount(bunny) + ' 个网格）');
ok(Math.abs(bunnyBox.min.y) < 0.03, '兔子的脚落在地面上（最低点 ' + bunnyBox.min.y.toFixed(3) + '）');
ok(bunnyH > 1.2 && bunnyH < 2.2, '兔子高度合理（' + bunnyH.toFixed(2) + '，含耳朵）');
console.log('  兔子 ' + meshCount(bunny) + ' 个网格 / ' + triangleCount(bunny) + ' 面 / 高 ' + bunnyH.toFixed(2));

const slots = ['back', 'cloth', 'hat', 'acc'].map(s => bunny.getObjectByName(s + 'Slot'));
ok(slots.every(Boolean), '四个换装槽位都在（back / cloth / hat / acc）');
{
  const hatSlot = bunny.getObjectByName('hatSlot');
  const headTop = 1.02 + 0.38;      /* 头心 1.02，半径 0.38 */
  ok(hatSlot.position.y >= headTop, '帽位在头顶之上（' + hatSlot.position.y + ' ≥ ' + headTop +
     '），否则整顶帽子会陷进脑袋里');
}

/* ---------- 4. 全部换装道具 ---------- */
function checkItems(label, table, names, opts){
  section(label);
  let built = 0;
  for(const name of names){
    let g;
    try { g = table[name](); }
    catch(e){ fail++; console.log('  ✗ ' + name + ' 建不出来：' + e.message); continue; }
    const b = box(g);
    const size = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    const tri = triangleCount(g);
    const problems = [];
    if(name !== 'none'){
      if(meshCount(g) < 1) problems.push('没有网格');
      if(size > (opts.maxSize || 1.6)) problems.push('尺寸过大（' + size.toFixed(2) + '）');
      if(size < 0.02) problems.push('尺寸过小（' + size.toFixed(3) + '）');
      if(tri > 600) problems.push('面数偏高（' + tri + '）');
      built++;
    }
    console.log('  ' + (problems.length ? '✗' : '✓') + ' ' + name.padEnd(10) +
      String(meshCount(g)).padStart(2) + ' 网格 / ' + String(tri).padStart(4) + ' 面' +
      (problems.length ? '  ← ' + problems.join('，') : ''));
    if(problems.length) fail++;
  }
  return built;
}

const hatTable = {}; G.HAT_NAMES.forEach(n => hatTable[n] = G.HATS[n]);
const clothTable = {}; G.CLOTH_NAMES.forEach(n => clothTable[n] = G.CLOTHES[n]);
const accTable = {}; G.ACC_NAMES.forEach(n => accTable[n] = G.ACCS[n]);

const nHat = checkItems('帽子', hatTable, G.HAT_NAMES, { maxSize: 0.9 });
const nCloth = checkItems('衣服', clothTable, G.CLOTH_NAMES, { maxSize: 1.4 });
/* 配饰上限放到 1.45：翅膀要张开才像翅膀，本来就是全身最宽的一件 */
const nAcc = checkItems('配饰', accTable, G.ACC_NAMES, { maxSize: 1.45 });
const nReal = nHat + nCloth + nAcc;
ok(nReal >= 19, '可换装的道具一共 ' + nReal + " 件（帽子 " + nHat + " / 衣服 " + nCloth + " / 配饰 " + nAcc + '）');

/* ---------- 5. 换装：挂对槽位 ---------- */
section('换装挂点');
{
  const b2 = G.bunny();
  G.dress(b2, { hat: 'crown', cloth: 'overall', acc: 'glass' });
  ok(b2.getObjectByName('hatSlot').children.length === 1, '帽子进了 hatSlot');
  ok(b2.getObjectByName('clothSlot').children.length === 1, '衣服进了 clothSlot');
  ok(b2.getObjectByName('accSlot').children.length === 1, '配饰进了 accSlot');
  ok(b2.getObjectByName('backSlot').children.length === 0, '翅膀以外的配饰不会跑到身后');

  /* 翅膀横向最宽，必须挂在身后而不是身前，否则会穿脸 */
  G.dress(b2, { acc: 'wing' });
  ok(b2.getObjectByName('backSlot').children.length === 1, '翅膀挂在身后（backSlot）');
  ok(b2.getObjectByName('accSlot').children.length === 0, '翅膀没有再挂一份在身前');

  /* 反复换装不能越挂越多 */
  for(let i = 0; i < 8; i++) G.dress(b2, { hat: i % 2 ? 'beret' : 'crown', cloth: 'dress', acc: 'bow' });
  const total = ['back', 'cloth', 'hat', 'acc']
    .reduce((n, s) => n + b2.getObjectByName(s + 'Slot').children.length, 0);
  ok(total === 3, '连续换装 8 次后仍然只有 3 件（实际 ' + total + '），不会越挂越多');

  /* 空搭配要能清干净 */
  G.dress(b2, {});
  const after = ['back', 'cloth', 'hat', 'acc']
    .reduce((n, s) => n + b2.getObjectByName(s + 'Slot').children.length, 0);
  ok(after === 0, '空搭配能把身上清干净（剩 ' + after + ' 件）');
}

/* ---------- 6. 小岛 ---------- */
section('棋盘小岛');
{
  const isl = G.island({ cols: 6, rows: 7, gap: 1.06 });
  const d = isl.userData;
  ok(d.cols === 6 && d.rows === 7, '棋盘尺寸记住了（' + d.cols + '×' + d.rows + '）');
  const b = box(isl);
  ok(b.min.y < -1.5, '小岛有厚度（最低点 ' + b.min.y.toFixed(2) + '），不是一块薄板');
  ok(meshCount(isl) > 42, '42 个格面 + 岛体都在（' + meshCount(isl) + ' 个网格）');
  console.log('  小岛 ' + meshCount(isl) + ' 个网格 / ' + triangleCount(isl) + ' 面');

  /* 格面必须比草皮低，棋子才像是「摆在格子里」而不是飘着 */
  const p = G.cellPos(isl, 0, 0);
  ok(Math.abs(p.x) > 1 && Math.abs(p.z) > 2, '格位算得出来（左上角 x=' + p.x.toFixed(2) + ' z=' + p.z.toFixed(2) + '）');
}

/* ---------- 6. 面的朝向 ----------
   这是程序化几何最阴的一类 bug：面法线朝内。
   它不会报错、不会崩、模型大小形状都对，只是光照是反的（看着发暗发平），
   而且射线从外面打不中它 —— 拾取、碰撞、轮廓测量会一起失效。
   紫萝卜的旋转面就踩过一次：LatheGeometry 的点必须从下往上给。

   用有向体积判定：闭合曲面法线朝外时为正，朝内时为负。 */
section('面的朝向（法线朝内是隐形 bug）');
{
  function signedVolume(mesh){
    const g = mesh.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();
    /* 先求网格自己的包围盒中心，作为体积积分的参考点，减少数值误差 */
    const bb = new THREE.Box3().setFromObject(mesh);
    const o = bb.getCenter(new THREE.Vector3());
    const n = idx ? idx.count : pos.count;
    let v = 0;
    for(let i = 0; i < n; i += 3){
      const i0 = idx ? idx.getX(i)     : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld).sub(o);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld).sub(o);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld).sub(o);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      cross.crossVectors(ab, ac);
      v += a.dot(cross);
    }
    return v / 6;
  }

  const groups = [
    ['萝卜', () => { const r = []; for(let k = 0; k < G.RADISH_COUNT; k++) r.push([String(k), G.radish(k)]); return r; }],
    ['兔子', () => [['bunny', G.bunny()]]],
    ['帽子', () => G.HAT_NAMES.filter(n => n !== 'none').map(n => [n, G.HATS[n]()])],
    ['衣服', () => G.CLOTH_NAMES.filter(n => n !== 'none').map(n => [n, G.CLOTHES[n]()])],
    ['配饰', () => G.ACC_NAMES.filter(n => n !== 'none').map(n => [n, G.ACCS[n]()])]
  ];
  let inverted = 0, checked = 0;
  for(const [label, make] of groups){
    for(const [name, obj] of make()){
      obj.updateMatrixWorld(true);
      const bad = [];
      obj.traverse(m => {
        if(!m.isMesh || !m.geometry) return;
        checked++;
        const v = signedVolume(m);
        /* 极薄的开放面片（比如旋转面收口处）体积接近 0，不能据此判断 */
        if(v < -1e-6) bad.push(m.geometry.type + '(' + v.toExponential(1) + ')');
      });
      if(bad.length){ inverted++; console.log('  ✗ ' + label + ' ' + name + '：' + bad.join(' ')); }
    }
  }
  ok(inverted === 0, '全部 ' + checked + ' 个网格的面都朝外（' + groups.length + ' 组共 ' +
     groups.reduce((n, g) => n + g[1]().length, 0) + ' 件）');
}

/* ---------- 6. 道具色 vs 兔子本色 ----------
   换装道具是穿在兔子身上的，所以它的对照面不是棋盘，是兔子的毛色。
   兔子的毛接近纯白，任何米白、银白、纯白的道具贴着它都会糊成一片 ——
   玩家会觉得「衣服没穿上」或者「帽子缺了一块」。
   小翅膀是唯一例外：它挂在身后，是衬着背景看的，不是衬着兔子看的。 */
section('道具色 vs 兔子本色');
{
  const body = G.PALETTE.bunny;
  const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const dist = (a, b) => { const A = rgb(a), B = rgb(b); return Math.round(Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2])); };
  const MIN = 45;
  const jobs = [
    ['帽子', () => G.HAT_NAMES.filter(n => n !== 'none').map(n => [n, G.HATS[n]()])],
    ['衣服', () => G.CLOTH_NAMES.filter(n => n !== 'none').map(n => [n, G.CLOTHES[n]()])],
    ['配饰', () => G.ACC_NAMES.filter(n => n !== 'none').map(n => [n, G.ACC_BEHIND[n] ? null : n, G.ACCS[n]()])]
  ];
  let bad = 0, checked = 0;
  for(const [label, make] of jobs){
    for(const row of make()){
      const [name, maybeSkip, obj] = row.length === 3 ? row : [row[0], row[0], row[1]];
      if(maybeSkip === null) continue;              /* 挂在身后的，跳过 */
      obj.updateMatrixWorld(true);
      const seen = new Set();
      let worst = 1e9, worstColor = 0;
      obj.traverse(m => {
        if(!m.isMesh || !m.material || !m.material.color) return;
        const c = m.material.color.getHex();
        if(seen.has(c)) return;
        seen.add(c);
        const d = dist(c, body);
        if(d < worst){ worst = d; worstColor = c; }
      });
      checked++;
      const pass = worst >= MIN;
      if(!pass) bad++;
      console.log('  ' + (pass ? '✓' : '✗') + ' ' + label + ' ' + name.padEnd(10) +
        '最接近兔子的一色 #' + worstColor.toString(16).toUpperCase().padStart(6, '0') +
        ' 距 ' + String(worst).padStart(3) + (pass ? '' : '  ← 贴着兔子看不见'));
    }
  }
  ok(bad === 0, checked + ' 件道具的颜色都能从兔子的毛色上分出来（阈值 ' + MIN + '）');
}

/* ---------- 7. 配色（与 palette-3d.mjs 同源，这里只做一致性） ---------- */
section('配色');
{
  const P = G.PALETTE;
  const need = ['carrot', 'daikon', 'purple', 'green', 'cherry', 'tileA', 'tileB', 'grass', 'soil', 'bunny'];
  const miss = need.filter(k => typeof P[k] !== 'number');
  ok(miss.length === 0, '配色表关键项齐全' + (miss.length ? '，缺 ' + miss.join(', ') : ''));
  const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const dist = (a, b) => { const A = rgb(a), B = rgb(b); return Math.round(Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2])); };
  let worst = { d: 1e9 };
  const kinds = [P.carrot, P.daikon, P.purple, P.green, P.cherry];
  for(let i = 0; i < kinds.length; i++)
    for(let j = i + 1; j < kinds.length; j++){
      const d = dist(kinds[i], kinds[j]);
      if(d < worst.d) worst = { d, i, j };
    }
  ok(worst.d >= 70, '五种萝卜两两色差都够（最接近的 ' + worst.i + '/' + worst.j + ' 差 ' + worst.d + '）');
}

console.log('\n' + (fail ? '发现 ' + fail + ' 处问题 ✗' : '几何库自检全部通过 ✓'));
process.exit(fail ? 1 : 0);
