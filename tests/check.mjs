/* ============================================================
   结构校验：语法、引用、资源、用词
   ------------------------------------------------------------
   用法（在仓库根目录）：
     node tests/check.mjs
   退出码非 0 表示有问题。

   为什么需要它：这几项都属于「不跑起来看不出来，跑起来又很难查」的问题。
   尤其是脚本语法错误 —— 内联脚本里一个语法错会让整页静默停在初始状态，
   不报错、不白屏，最难查。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const ok = [], problems = [];

/* ---------- 工具 ---------- */
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));

function inlineScripts(src){
  return [...src.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(m => m[1])
    .filter(code => code.trim());
}
function checkScript(rel, code, i){
  try{ new Function(code); ok.push(rel + ' 脚本#' + i + ' 语法通过（' + code.split('\n').length + ' 行）'); }
  catch(e){ problems.push(rel + ' 脚本#' + i + ' 语法错误: ' + e.message); }
}

/* ---------- 1. 共用模块 ---------- */
/* geom3d.js 是程序化几何库，跑在浏览器里但语法检查一样适用。
   它依赖全局 THREE，所以只能用 new Function 验语法，不能直接 import。 */
for(const f of ['shared/store.js', 'shared/audio.js', 'shared/bunny.js',
                'shared/theme.js', 'shared/match3.js', 'shared/geom3d.js']){
  if(!exists(f)){ problems.push('缺少共用模块: ' + f); continue; }
  checkScript(f, read(f), 0);
}

/* ---------- 2. 页面：语法 / id 引用 / id 查重 / 资源 / CSS 括号 ---------- */
const PAGES = ['index.html', 'games/lastcell.html', 'games/bunnycloset.html',
               'lab/match3-3d.html', 'lab/surf-proto.html'];

for(const rel of PAGES){
  if(!exists(rel)){ problems.push('缺少页面: ' + rel); continue; }
  const src = read(rel), dir = path.dirname(path.join(ROOT, rel));

  inlineScripts(src).forEach((code, i) => checkScript(rel, code, i));

  /* $('xxx') 引用的 id 必须真的存在 */
  const used = new Set([...src.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]));
  const miss = [...used].filter(id =>
    !new RegExp('id="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"').test(src));
  if(miss.length) problems.push(rel + ' 引用了不存在的 id: ' + miss.join(', '));
  else ok.push(rel + ' ' + used.size + ' 个 $() id 引用全部存在');

  /* id 不能重复 */
  const ids = [...src.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if(dup.length) problems.push(rel + ' id 重复: ' + dup.join(', '));
  else ok.push(rel + ' ' + ids.length + ' 个 id 无重复');

  /* 本地资源必须存在 */
  const refs = [...src.matchAll(/(?:src|href)="([^"#][^"]*)"/g)]
    .map(m => m[1]).filter(u => !/^(https?:|data:|mailto:|#)/.test(u));
  const badRef = refs.filter(r => !fs.existsSync(path.resolve(dir, r.split('?')[0])));
  if(badRef.length) problems.push(rel + ' 资源不存在: ' + badRef.join(', '));
  else ok.push(rel + ' ' + refs.length + ' 个本地资源引用存在');

  /* CSS 花括号配平 */
  const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const ob = (css.match(/{/g) || []).length, cb = (css.match(/}/g) || []).length;
  if(ob !== cb) problems.push(rel + ' CSS 花括号不配平: ' + ob + ' vs ' + cb);
}

/* ---------- 3. 大厅清单里的游戏文件必须存在 ---------- */
if(exists('index.html')){
  const urls = [...read('index.html').matchAll(/\burl:\s*'([^']*)'/g)].map(m => m[1]).filter(Boolean);
  const miss = urls.filter(u => !exists(u));
  if(miss.length) problems.push('大厅清单里指向了不存在的文件: ' + miss.join(', '));
  else ok.push('大厅清单 ' + urls.length + ' 个游戏文件都存在');
}

/* ---------- 4. 测试页也要能解析 ---------- */
/* 这一项单独列出来：功能测试跑不起来时，页面只会静默停在初始文案上，
   不看这一条会以为是游戏坏了，其实是测试脚本自己的语法错。 */
for(const rel of ['tests/closet-regression.html', 'tests/lastcell-compat.html',
                  'tests/readability.html', 'tests/screenshot-3d.html',
                  'tests/screenshot-host.html', 'tests/dressup-3d.html']){
  if(!exists(rel)) continue;
  inlineScripts(read(rel)).forEach((code, i) => {
    try{ new Function(code); ok.push(rel + ' 脚本#' + i + ' 语法通过'); }
    catch(e){ problems.push(rel + ' 脚本#' + i + ' 语法错误（测试会静默停住）: ' + e.message); }
  });
}

/* ---------- 5. 用词检查 ---------- */
/* 「劳作」这类容易读出使唤意味的说法在改过一次之后很容易又被写回来 */
if(exists('games/bunnycloset.html')){
  const src = read('games/bunnycloset.html');
  ['劳作', '辛苦', '加油'].forEach(w => {
    if(src.includes(w)) problems.push('games/bunnycloset.html 又出现了不该用的措辞: ' + w);
  });
  if(!problems.some(p => /不该用的措辞/.test(p))) ok.push('台词措辞检查通过（无「劳作 / 辛苦 / 加油」）');
}

/* ---------- 输出 ---------- */
console.log('=== 通过 ===');
ok.forEach(o => console.log('  ✓ ' + o));
if(problems.length){
  console.log('\n=== 问题 ===');
  problems.forEach(p => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log('\n结构校验全部通过 ✓');
