#!/usr/bin/env node
/* ============================================================
   3D 配色可辨性核算
   ------------------------------------------------------------
   为什么必须有这个脚本：
   2D 版里，浅色棋子（白萝卜）和浅色底格撞色时，靠的是一圈深色描边
   把轮廓立住。3D 版没有描边（描边要做后处理，成本高得多），
   所以棋子只能靠**和底面的色差**自己站住。

   而 3D 的色差又会被光照压一层：材质颜色相同，渲染出来并不同亮。
   所以数值必须留足余量，不能贴线过。

   规则：每种萝卜对每一种可能压到的表面，RGB 距离 ≥ 70。
   用法：node tests/palette-3d.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'shared', 'geom3d.js');

/* ---------- 从几何库里把配色表读出来，而不是在这里抄一份 ----------
   抄一份就会漂移：改了游戏忘了改测试，测试还全绿。 */
const html = fs.readFileSync(SRC, 'utf8');
const m = html.match(/var PALETTE = \{([\s\S]*?)\n\};/);
if(!m) throw new Error('在 shared/geom3d.js 里找不到 var PALETTE = {...} 配色表');

/* 注意：配色表里一行写了好几个键值对，所以不能用「按行拆分」去解析 ——
   那样只有每行第一个键能被读到，其余的会静默变成 undefined，
   再参与计算就全成了 0（对比出来一片 ✗）。用全局匹配。 */
const C = {};
for(const hit of m[1].matchAll(/([a-zA-Z]\w*)\s*:\s*0x([0-9A-Fa-f]{6})/g)){
  C[hit[1]] = parseInt(hit[2], 16);
}
if(!C.carrot) throw new Error('配色表解析失败，只拿到：' + Object.keys(C).join(', '));

/* ---------- 参与核算的三组 ---------- */
/* 棋子可能压到的表面 */
const SURF = {
  '格面A': C.tileA, '格面B': C.tileB, '草地': C.grass, '泥土': C.soil
};
/* 五种棋子（顺序与 KIND_BUILDERS 一致） */
const RADISH = {
  '胡萝卜': C.carrot, '白萝卜': C.daikon, '紫萝卜': C.purple,
  '青萝卜': C.green, '樱桃萝卜': C.cherry
};
/* 每株自己那两片叶子，也要能和自家根部分开 */
const SELF_LEAF = [
  ['胡萝卜', C.leaf, C.carrot], ['白萝卜', C.leaf, C.daikon],
  ['紫萝卜', C.leaf, C.purple], ['青萝卜', C.leafD, C.green],
  ['樱桃萝卜', C.leaf, C.cherry]
];

const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const dist = (a, b) => {
  const A = rgb(a), B = rgb(b);
  return Math.round(Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]));
};
const hex = h => '#' + h.toString(16).toUpperCase().padStart(6, '0');

const MIN_SURF = 70;      /* 棋子 / 叶子 × 表面 */
const MIN_PAIR = 70;      /* 棋子 × 棋子 */
const MIN_LEAF = 45;      /* 叶子 × 自家根部：允许更近，但要能看出是两样东西 */

let fail = 0;
const pad = (s, n) => String(s) + '　'.repeat(Math.max(0, n - String(s).length));

/* ---------- 1. 棋子 × 表面 ---------- */
console.log('\n【棋子 × 表面】阈值 ' + MIN_SURF + '\n');
const surfNames = Object.keys(SURF);
console.log('  ' + pad('', 5) + surfNames.map(n => pad(n, 5)).join(''));
for(const [rn, rc] of Object.entries(RADISH)){
  const cells = surfNames.map(sn => {
    const d = dist(rc, SURF[sn]);
    const ok = d >= MIN_SURF;
    if(!ok) fail++;
    return pad(d + (ok ? '' : '✗'), 5);
  });
  console.log('  ' + pad(rn, 5) + cells.join(''));
}

/* ---------- 2. 棋子 × 棋子 ---------- */
console.log('\n【棋子 × 棋子】阈值 ' + MIN_PAIR);
const rk = Object.entries(RADISH);
let worstPair = { d: 1e9, p: '' };
let near = [];
for(let i = 0; i < rk.length; i++){
  for(let j = i + 1; j < rk.length; j++){
    const d = dist(rk[i][1], rk[j][1]);
    if(d < worstPair.d) worstPair = { d, p: rk[i][0] + ' / ' + rk[j][0] };
    if(d < MIN_PAIR) near.push(rk[i][0] + ' / ' + rk[j][0] + ' → ' + d);
  }
}
if(worstPair.d < MIN_PAIR) fail++;
console.log('  最接近的一对：' + worstPair.p + ' → ' + worstPair.d +
            (worstPair.d < MIN_PAIR ? '  ✗' : '  ✓'));
near.forEach(x => console.log('  ✗ ' + x));

/* ---------- 3. 叶子 × 表面 ---------- */
console.log('\n【叶子 × 表面】阈值 ' + MIN_SURF);
for(const [name, col] of [['叶', C.leaf], ['叶深', C.leafD]]){
  const ds = surfNames.map(sn => dist(col, SURF[sn]));
  const w = Math.min(...ds);
  if(w < MIN_SURF) fail++;
  console.log('  ' + pad(name, 4) + surfNames.map((sn, i) => pad(sn + ' ' + ds[i], 9)).join('') +
              (w < MIN_SURF ? '  ✗' : '  ✓'));
}

/* ---------- 4. 叶子 × 自家根部 ---------- */
console.log('\n【叶子 × 自家根部】阈值 ' + MIN_LEAF);
for(const [name, lc, bc] of SELF_LEAF){
  const d = dist(lc, bc);
  if(d < MIN_LEAF) fail++;
  console.log('  ' + pad(name, 6) + pad(d, 5) +
              (d < MIN_LEAF ? '✗ 叶子会糊在根部上' : '✓'));
}

/* ---------- 5. 棋盘整体不能只有一种亮度区间 ---------- */
console.log('\n【整体明度分布】');
const lum = h => { const [r, g, b2] = rgb(h); return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b2); };
const lums = Object.entries({ ...RADISH, ...SURF }).map(([n, v]) => [n, lum(v)]);
lums.sort((a, b) => a[1] - b[1]);
console.log('  最暗：' + lums[0][0] + ' ' + lums[0][1] + '　最亮：' + lums[lums.length - 1][0] + ' ' + lums[lums.length - 1][1]);
if(lums[lums.length - 1][1] - lums[0][1] < 60){
  fail++;
  console.log('  ✗ 明度跨度太小，画面会发平');
} else {
  console.log('  ✓ 明度跨度 ' + (lums[lums.length - 1][1] - lums[0][1]) + '（>60 画面才有层次）');
}

console.log('\n' + (fail ? '发现 ' + fail + ' 处问题 ✗' : '配色核算全部通过 ✓'));
process.exit(fail ? 1 : 0);
