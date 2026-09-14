# 兔子小游戏

一个**竖屏小游戏合集**，纯静态零依赖。点开即玩，不用下载、不用注册，进度存在本机。

目标很简单：**放松一下**。每个游戏都应该能一只手、不用看说明就上手。

---

## 在线试玩

> GitHub Pages 开启后把地址填到这里，例如 `https://sawakso.github.io/rabbitGAME/`

---

## 已收录

### 最后一格　`games/lastcell.html`　烧脑

在棋盘上走一条**不能回头**的路，别把自己困住。

- 上下左右相邻走子，走过的格子不能回头
- 黄 / 米 / 灰三色预告未来三步，格子角上还标着 1 / 2 / 3
- **每个黄格右下角的数字** = 走那里之后还剩多少互通空地，**越大越安全**，这是核心判断依据
- 三档难度：轻松 6×6 / 18 步　标准 8×8 / 26 步　挑战 8×8 / 30 步
- 每日挑战（同一天全站同一张图）、悔棋、提示、最高分记录
- 键盘也能玩：方向键走子、`U` 悔棋、`H` 提示、`R` 换局

---

## 目录结构

```
index.html              合集大厅（开始界面），也是部署入口
games/
  lastcell.html         最后一格
shared/                 所有页面共用的模块
  theme.css             设计变量 / 暖色黄昏背景 / 通用按钮、弹层、开关
  theme.js              注入背景 DOM（页面里不写任何背景标签）
  store.js              全局存档：开关、最高分、游玩次数、已看引导
  audio.js              音频引擎：合成的八音盒 BGM + 音效
  bunny.js              兔子角色（纯 SVG，四种表情）
preview/overview.png    效果截图
alt/index.html          另一个实现版本，留档备查
```

大厅和游戏都是 `<script src>` 引共用模块的普通页面，没有构建步骤。
**每个游戏页面都能单独打开、单独分享**，不依赖大厅。

## 怎么加一个新游戏

1. 复制一份 `games/lastcell.html` 当骨架，改掉里面的棋盘逻辑和样式。
   三个必须改的地方：
   - 页面左上角的返回键 `<a class="backBtn" href="../index.html">`
   - 游戏 id（存档用），例如 `var GAME_ID = 'stack';`
   - `<head>` 里引 `../shared/theme.css`，底部引 `../shared/{store,audio,bunny,theme}.js`
2. 在 `index.html` 的 `GAMES` 数组里加一条：

```js
{
  id: 'stack',                  // 唯一标识，也是存档键
  name: '叠高高',
  desc: '一块一块往上堆',
  tags: ['relax'],              // relax = 放松 / brain = 烧脑
  url: 'games/stack.html',
  ready: true,                  // false 会显示成「筹备中」虚线卡
  unit: '层',                   // 最高纪录的单位
  icon: ICONS.stack,            // 缩略图 SVG，加在 ICONS 里
  accent: '#E7F4EE'             // 缩略图底色
}
```

就这么两步。大厅会自动渲染卡片、读取最高纪录、渲染「继续游戏」入口。

## 共用模块能给你什么

| 模块 | 用法 |
| --- | --- |
| 存档 | `Store.get('space', true)` / `Store.setBest('stack', 'normal', 42)` / `Store.best('stack')` / `Store.play('stack')` |
| 音效 | `GameAudio.sfx('pop', 连击数)` —— 名字有 `move / pop / drop / ding / bad / win / lose / ui / undo` |
| 任意音高 | `GameAudio.note('C5', 0.4)` / `GameAudio.arpeggio(['C5','E5','G5'])` |
| 兔子 | `Bunny.svg('happy', 'res')`（表情 `idle / happy / worry / sad`）、`Bunny.head('x', 44)` |
| 背景 | 引了 `theme.js` 就自动有，不用写标签 |

音频**全部是 Web Audio 实时合成**，没有任何音频文件：零版权风险、断网可用、不增加包体。
BGM 是 C–G–Am–F 四小节循环的八音盒，走到哪里都在放。

## 本地运行

直接双击 `index.html` 就能玩（`file://` 下外部脚本可以正常加载）。

要手机同局域网调试就起个静态服务：

```bash
python -m http.server 8000
```

## 部署

### GitHub Pages

`Settings` → `Pages` → Source 选 **Deploy from a branch** → 分支 `main`、目录 `/ (root)`。
然后访问 `https://sawakso.github.io/rabbitGAME/`。

### Cloudflare Pages

连接本仓库，构建命令**留空**，输出目录填 `/`。

> `github.io` 和 `pages.dev` 在国内访问都不太稳定。面向国内用户建议改用
> 腾讯云 COS + CDN、EdgeOne Pages 或阿里云 OSS。

## 技术说明

- **零外部依赖**：没有 CDN、外链字体、图片文件、音频文件，全部内联或实时合成
- 竖屏优先，适配 `env(safe-area-inset-*)` 安全区，`390×844` 与 `360×780` 实测无溢出、无遮挡
- 存档统一在 `localStorage` 的 `rabbitGame.v1` 键下，旧版《最后一格》的记录会自动迁移
- 游戏页返回大厅用普通链接跳转，共用脚本体积很小，切换基本无感
