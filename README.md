# 兔子小游戏

一个**竖屏小游戏合集**，纯静态零依赖。点开即玩，不用下载、不用注册，进度存在本机。

---

## 在线试玩

> GitHub Pages 开启后把地址填到这里，例如 `https://sawakso.github.io/rabbitGAME/`

---

## 已收录

### 兔子的衣橱　`games/bunnycloset.html`　放松 · 收集

抽服装给兔子换装，攒得越多越好玩。

**四个驱动力是咬合在一起的，不是并排放了四个功能：**

| 驱动力 | 机制 | 作用 |
| --- | --- | --- |
| 每日回访 | 兔子在家种胡萝卜，离线也产，上限 8 小时 | 留存 |
| 收集欲 | 开盲盒抽服装，普通 / 稀有 / 传说三档 | 长线目标 |
| 表达欲 | 衣橱自由搭配，点已穿的可脱下 | 停留时长 |
| 传播欲 | 一键生成形象卡，可保存分享 | 拉新 |
| 变现 | 看广告免费抽（5 分钟一次） | IAA |

- 16 件可收集道具：帽子 4 / 衣服 4 / 配饰 4 / 背景 4
- 开盲盒 30 胡萝卜，抽到自动穿上，立刻看到效果
- **兔子、16 件道具、全部由 Canvas 代码绘制，没有任何图片文件**
- 未解锁的道具会淡显并标出稀有度——看得见、想要，但还不是你的

### 最后一格　`games/lastcell.html`　烧脑

在棋盘上走一条**不能回头**的路，别把自己困住。

- 上下左右相邻走子，走过的格子不能回头
- 黄 / 米 / 灰三色预告未来三步，格子角上还标着 1 / 2 / 3
- **每个黄格右下角的数字** = 走那里之后还剩多少互通空地，越大越安全
- 三档难度：轻松 6×6 / 18 步　标准 8×8 / 26 步　挑战 8×8 / 30 步
- 每日挑战、悔棋、提示、最高分记录
- 键盘：方向键走子、`U` 悔棋、`H` 提示、`R` 换局

---

## 上架前必须知道的事

**这两个游戏都只能走「纯广告变现（IAA）」路线。**

- 微信小游戏**个人主体无法开通虚拟支付**，想要内购必须企业主体 + 游戏版号，没有豁免
- 好消息是：轻休闲类走纯广告变现，**平台准入层面免版号**
- 个人主体需要的材料：**软件著作权**（或电子版权认证）、游戏自审自查报告、小程序备案
- 抖音小游戏支持**电子版权认证**替代纸质软著，3~5 个工作日就能下证，比纸质软著快很多
- 微信小游戏主包限制 **4MB**，本项目每个游戏都在 60KB 以内，余量极大

> ⚠️ **软著 2026 年新政**：从形式审查转为有限实质审查 + 诚信监管，补正率 60% 以上，
> **纯 AI 生成代码会被认定"无独创性"驳回**。申请时要点：
> 保留真实开发痕迹、设计文档与流程图自己确认过、核心玩法决策自己做、
> 说明书自己写，不要拿整包生成物直接去申请。

---

## 目录结构

```
index.html              合集大厅（开始界面），也是部署入口
games/
  bunnycloset.html      兔子的衣橱
  lastcell.html         最后一格
shared/                 所有页面共用的模块
  theme.css             设计变量 / 暖色黄昏背景 / 通用按钮、弹层、开关
  theme.js              注入背景 DOM（页面里不写任何背景标签）
  store.js              全局存档：开关、最高分、游玩次数、已看引导
  audio.js              音频引擎：合成的八音盒 BGM + 音效
  bunny.js              兔子角色 SVG（大厅与《最后一格》用）
lab/
  surf-proto.html       3D 海上冲浪原型（暂停，未接进大厅）
preview/                效果截图
alt/index.html          另一个实现版本，留档备查
```

大厅和游戏都是 `<script src>` 引共用模块的普通页面，没有构建步骤。
**每个游戏页面都能单独打开、单独分享**，不依赖大厅。

## 怎么加一个新游戏

1. 复制一份 `games/lastcell.html` 当骨架，改掉里面的玩法和样式。
   必须改的地方：
   - 页面左上角的返回键 `<a class="backBtn" href="../index.html">`
   - 游戏 id（存档用），例如 `var GAME_ID = 'mygame';`
   - `<head>` 里引 `../shared/theme.css`，底部引 `../shared/{store,audio,bunny,theme}.js`
2. 在 `index.html` 的 `GAMES` 数组里加一条：

```js
{
  id: 'mygame',                 // 唯一标识，也是存档键
  name: '我的游戏',
  desc: '一句话说明，别超过 14 个字',
  tags: ['relax'],              // relax 放松 / brain 烧脑 / collect 收集
  url: 'games/mygame.html',
  ready: true,                  // false 会显示成「筹备中」虚线卡
  unit: '分',                   // 最高纪录的单位
  icon: ICONS.mygame,           // 缩略图 SVG，加在 ICONS 里
  accent: '#F1F6F3'             // 缩略图底色
}
```

新标签只要往 `TAG_MAP` 里加一条就行。

## 共用模块能给你什么

| 模块 | 用法 |
| --- | --- |
| 存档 | `Store.get(k, 默认值)` / `Store.set(k, v)` / `Store.setBest(id, 子项, n)` / `Store.best(id)` / `Store.play(id)` |
| 任意自定义键 | 直接 `Store.set('myKey', obj)` 就能存，重载会自动恢复 |
| 音效 | `GameAudio.sfx('pop', 连击数)` —— `move / pop / drop / ding / bad / win / lose / ui / undo` |
| 任意音高 | `GameAudio.note('C5', 0.4)` / `GameAudio.arpeggio(['C5','E5','G5'])` |
| 兔子 | `Bunny.svg('happy', 'res')`（`idle / happy / worry / sad`）、`Bunny.head('x', 44)` |
| 背景 | 引了 `theme.js` 就自动有，不用写任何标签 |

音频**全部是 Web Audio 实时合成**，没有任何音频文件：零版权风险、断网可用、不增加包体。
BGM 是 C–G–Am–F 四小节循环的八音盒。

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

- **零外部依赖**：没有 CDN、外链字体、图片文件、音频文件，全部内联或代码绘制
- 竖屏优先，适配 `env(safe-area-inset-*)` 安全区
- 存档统一在 `localStorage` 的 `rabbitGame.v1` 键下，旧版《最后一格》的记录会自动迁移
- 微信小游戏适配时，把 `GameAudio` 的音频解锁和 `showAd()` 里的激励视频接上 `wx` 接口即可
  （`games/bunnycloset.html` 里已留好接入点，浏览器环境下会直接给奖励方便调试）
