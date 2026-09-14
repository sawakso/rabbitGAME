/* ============================================================
   程序化 3D 几何库 —— Geom3D
   ------------------------------------------------------------
   这个文件里没有一行模型数据。没有一个 .glb / .obj / 贴图文件。
   兔子、五种萝卜、全部换装道具、棋盘小岛、云和天空，
   顶点全部是运行时代码算出来的。

   为什么这个项目适合程序化几何：
     · 低多边形扁平着色不需要贴图、法线、PBR 材质
     · flatShading 一开就有「面」的分明感，正是这种画风要的
     · 换装道具都是小件（帽子/衣服/配饰），每件几个几何体拼出来
     · 包体只多一个 three.js，24 件道具不占一个字节的网络传输

   依赖：three.js（全局 THREE），需在本文件之前加载。
   用法：
     var stage = Geom3D.createStage({ canvas: cv, cols: 6, rows: 7 });
     stage.scene.add(Geom3D.radish(0));
     Geom3D.dress(stage.bunny, { hat:'crown', cloth:'overall', acc:'glass' });
   ============================================================ */
;(function(root){
'use strict';

/* ============================================================
   配色
   ------------------------------------------------------------
   这些值不是随手调出来的，是用 tests/palette-3d.mjs 核算过的：
   每种萝卜对每种可能压到的表面（格面 A/B、草地、泥土），
   RGB 距离都要 ≥ 70，目前最小余量是 88。

   为什么 3D 比 2D 更要卡数值：
   2D 里浅色棋子是靠一圈深色描边立住轮廓的；3D 没有描边
   （描边要做后处理，成本高得多），棋子只能靠色差自己站住。
   而 3D 的色差还会被光照再压一层，所以余量必须留足。
   ============================================================ */
var PALETTE = {
  carrot:0xF5851F, daikon:0xF2F5E4, purple:0x8A5BD8, green:0x4FC08A, cherry:0xE2304F,
  cherryD:0xB52643,
  leaf:0x5CB038, leafD:0x479934,
  tileA:0xDCC19C, tileB:0xD2B58E,
  grass:0x9ED46A, grassD:0x77B850, soil:0xC19568, soilD:0xA0764C,
  bunny:0xFFFCF6, bunnyEar:0xF8C1CB, ink:0x4E3E36, blush:0xF9C0D0,
  cloud:0xFFFEFB, skyTop:0x86C6E8, skyLow:0xE8F5F8, fog:0xDCEFF6,
  /* 换装道具用色 */
  denim:0x5B82DD, denimD:0x4468BA, rose:0xE68B9C, roseD:0xC96E80,
  butter:0xEFD9A8, roseLight:0xED93B1, sun:0xF2C14E, sunD:0xD19E2C, mint:0x6CC0A8,
  silver:0xB9CBE0, silverD:0x93AAC4, night:0x6C8FD8,
  wood:0xA87E55, gold:0xF2C14E, magic:0x8A5BD8
};
var C = PALETTE;

/* ============================================================
   材质缓存
   ------------------------------------------------------------
   42 个棋子共用几个材质实例。不缓存的话每次建棋子都会新建
   MeshStandardMaterial，编译几十个着色器程序，起手就卡。
   ============================================================ */
var matCache = {};
function mat(color, rough){
  var r = (rough === undefined) ? 0.82 : rough;
  var key = color + '|' + r;
  if(!matCache[key]){
    matCache[key] = new THREE.MeshStandardMaterial({
      color: color, flatShading: true, roughness: r, metalness: 0
    });
  }
  return matCache[key];
}

/* 小工具：建一个网格并挂到父节点上 */
function add(parent, geo, color, rough, x, y, z){
  var m = new THREE.Mesh(geo, mat(color, rough));
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/* ============================================================
   1. 五种萝卜
   ------------------------------------------------------------
   和 2D 版同一套原则：五种必须在「颜色」和「轮廓」两个维度同时拉开。
   只换颜色的话色弱玩家分不清，只换形状的话扫盘又主要靠颜色。
     0 胡萝卜   最细最长的锥形     1 白萝卜   最宽的胖柱
     2 紫萝卜   上宽下尖的水滴     3 青萝卜   最宽最矮的扁蛋
     4 樱桃萝卜 最小的小球 + 细尾
   ============================================================ */

/* 叶子：几片朝外斜的小锥体，便宜又够用 */
function leaves(count, scale, color){
  var g = new THREE.Group();
  for(var i = 0; i < count; i++){
    var a = (i / count) * Math.PI * 2;
    var lf = add(g, new THREE.ConeGeometry(0.07 * scale, 0.32 * scale, 4), color, 0.9,
                 Math.cos(a) * 0.09 * scale, 0.14 * scale, Math.sin(a) * 0.09 * scale);
    lf.rotation.z = -Math.cos(a) * 0.55;
    lf.rotation.x =  Math.sin(a) * 0.55;
  }
  return g;
}

var RADISH_BUILDERS = [
  function(){                              /* 0 胡萝卜 */
    var g = new THREE.Group();
    /* CylinderGeometry(顶半径, 底半径)：上粗下尖就是胡萝卜 */
    add(g, new THREE.CylinderGeometry(0.24, 0.04, 0.88, 7), C.carrot, 0.82, 0, 0.44, 0);
    var lv = leaves(3, 1.0, C.leaf);
    lv.position.y = 0.84;
    g.add(lv);
    return g;
  },
  function(){                              /* 1 白萝卜 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.34, 0.25, 0.56, 8), C.daikon, 0.72, 0, 0.36, 0);
    var tip = add(g, new THREE.ConeGeometry(0.12, 0.18, 6), C.daikon, 0.72, 0, 0.09, 0);
    tip.rotation.x = Math.PI;                /* 尖头朝下 */
    add(g, new THREE.CylinderGeometry(0.342, 0.29, 0.14, 8), C.leaf, 0.82, 0, 0.62, 0);
    var lv = leaves(3, 0.7, C.leaf);
    lv.position.y = 0.67;
    g.add(lv);
    return g;
  },
  function(){                              /* 2 紫萝卜 */
    var g = new THREE.Group();
    var pts = [];
    /* i 从小到大 = 从底部尖头到顶部肩部。顺序反了法线就会朝内 */
    for(var i = 0; i <= 8; i++){
      var t = i / 8;
      var radius = 0.205 * Math.sin(Math.pow(t, 0.62) * Math.PI * 0.6);
      pts.push(new THREE.Vector2(Math.max(0.012, radius), 0.05 + t * 0.9));
    }
    add(g, new THREE.LatheGeometry(pts, 9), C.purple, 0.82, 0, 0, 0);
    var lv = leaves(3, 0.8, C.leaf);
    lv.position.y = 0.84;
    g.add(lv);
    return g;
  },
  function(){                              /* 3 青萝卜 */
    var g = new THREE.Group();
    var body = add(g, new THREE.SphereGeometry(0.33, 9, 6), C.green, 0.82, 0, 0.24, 0);
    body.scale.set(1, 0.72, 1);
    var lv = leaves(2, 1.15, C.leafD);
    lv.position.y = 0.42;
    g.add(lv);
    return g;
  },
  function(){                              /* 4 樱桃萝卜 */
    var g = new THREE.Group();
    add(g, new THREE.SphereGeometry(0.255, 9, 6), C.cherry, 0.82, 0, 0.44, 0);
    var tail = add(g, new THREE.ConeGeometry(0.045, 0.3, 5), C.cherryD, 0.85, 0, 0.16, 0);
    tail.rotation.x = Math.PI;
    var lv = leaves(2, 1.2, C.leaf);
    lv.position.y = 0.66;
    g.add(lv);
    return g;
  }
];
var RADISH_COUNT = RADISH_BUILDERS.length;

/* 各品种高度不一，统一按实际包围盒把最低点对齐到 y=0，省得逐个手调基准 */
function radish(kind){
  var inner = RADISH_BUILDERS[kind % RADISH_COUNT]();
  var wrap = new THREE.Group();
  wrap.add(inner);
  var box = new THREE.Box3().setFromObject(inner);
  inner.position.y -= box.min.y;
  return wrap;
}

/* ============================================================
   2. 兔子
   ------------------------------------------------------------
   身体各部件挂在一个可按部位归组的结构里，换装只需要往对应的
   slot 里塞一个 Group，不用动身体本身。
   ============================================================ */
function bunny(){
  var g = new THREE.Group();

  var body = add(g, new THREE.SphereGeometry(0.46, 10, 8), C.bunny, 0.75, 0, 0.46, 0);
  body.scale.set(0.92, 1, 0.86);

  add(g, new THREE.SphereGeometry(0.38, 10, 8), C.bunny, 0.75, 0, 1.02, 0);

  [-1, 1].forEach(function(s){
    var ear = add(g, new THREE.CapsuleGeometry(0.1, 0.4, 3, 6), C.bunny, 0.75, s * 0.15, 1.46, -0.02);
    ear.rotation.z = s * 0.2;
    var inner = add(g, new THREE.CapsuleGeometry(0.05, 0.3, 3, 6), C.bunnyEar, 0.8, s * 0.15, 1.47, 0.055);
    inner.rotation.z = s * 0.2;
  });

  [-1, 1].forEach(function(s){
    add(g, new THREE.SphereGeometry(0.055, 6, 5), C.ink, 0.5, s * 0.14, 1.05, 0.335);
    var bl = add(g, new THREE.SphereGeometry(0.062, 6, 5), C.blush, 0.9, s * 0.27, 0.95, 0.26);
    bl.scale.z = 0.4;
  });
  add(g, new THREE.SphereGeometry(0.042, 6, 5), 0xE9A0AC, 0.9, 0, 0.99, 0.375);

  [-1, 1].forEach(function(s){
    var foot = add(g, new THREE.SphereGeometry(0.12, 6, 5), C.bunny, 0.75, s * 0.2, 0.075, 0.12);
    foot.scale.set(1, 0.7, 1.25);
  });

  /* 换装挂点。帽子必须坐在头顶之上：头顶在 y=1.40，
     挂点如果低于它，整顶帽子会陷进脑袋里 */
  var slots = {
    back:  new THREE.Group(),                 /* 身后的部件（翅膀） */
    cloth: new THREE.Group(),
    hat:   new THREE.Group(),
    acc:   new THREE.Group()
  };
  slots.hat.position.y = 1.43;
  Object.keys(slots).forEach(function(k){
    slots[k].name = k + 'Slot';
    g.add(slots[k]);
  });
  return g;
}

/* ============================================================
   3. 换装道具（对应衣橱里的 24 件）
   ------------------------------------------------------------
   全部是「几个基础几何体拼起来」的量级：帽子平均 3 个网格，
   衣服 4 个，配饰 2 个。这是程序化几何最划算的地方 ——
   一件道具十几行代码，没有美术资产要管。
   ============================================================ */
var HATS = {
  none: function(){ return new THREE.Group(); },

  beret: function(){                          /* 贝雷帽 */
    var g = new THREE.Group();
    var dome = add(g, new THREE.SphereGeometry(0.27, 9, 6), C.denim, 0.9, 0, 0, 0);
    dome.scale.set(1, 0.6, 1);
    add(g, new THREE.SphereGeometry(0.045, 6, 5), C.denimD, 0.9, 0, 0.175, 0);
    return g;
  },
  straw: function(){                          /* 草莓帽 */
    var g = new THREE.Group();
    /* 帽檐从 0.45 收到 0.36：俯视镜头下帽檐一大就把脸整个盖住，
       而这个角色全部的信息量都在脸上 */
    add(g, new THREE.SphereGeometry(0.24, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xF2A0B0, 0.88, 0, 0, 0);
    add(g, new THREE.CylinderGeometry(0.36, 0.36, 0.05, 11), C.rose, 0.88, 0, -0.015, 0);
    add(g, new THREE.ConeGeometry(0.07, 0.16, 4), C.leaf, 0.9, 0, 0.28, 0);
    return g;
  },
  crown: function(){                          /* 小皇冠 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.25, 0.27, 0.13, 9), C.gold, 0.35, 0, 0, 0);
    for(var i = 0; i < 5; i++){
      var a = (i / 5) * Math.PI * 2;
      add(g, new THREE.ConeGeometry(0.06, 0.19, 4), C.gold, 0.35,
          Math.cos(a) * 0.21, 0.15, Math.sin(a) * 0.21);
    }
    return g;
  },
  magic: function(){                          /* 魔法帽 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.045, 11), C.magic, 0.85, 0, 0, 0);
    add(g, new THREE.ConeGeometry(0.21, 0.62, 8), C.magic, 0.85, 0, 0.32, 0);
    var st = add(g, new THREE.ConeGeometry(0.075, 0.11, 4), C.gold, 0.4, 0.14, 0.2, 0.15);
    st.rotation.z = -0.5;
    return g;
  },
  night: function(){                          /* 睡帽 */
    var g = new THREE.Group();
    var cap = add(g, new THREE.ConeGeometry(0.26, 0.5, 8), C.night, 0.9, 0, 0.2, 0);
    cap.rotation.z = 0.34;
    add(g, new THREE.SphereGeometry(0.075, 6, 5), 0xF7D98A, 0.9, 0.18, 0.44, 0);
    add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.09, 10), 0xF7D98A, 0.9, 0, -0.02, 0);
    return g;
  },
  wreath: function(){                         /* 花环 */
    var g = new THREE.Group();
    var ring = add(g, new THREE.TorusGeometry(0.3, 0.045, 6, 14), C.leaf, 0.9, 0, 0.03, 0);
    ring.rotation.x = Math.PI / 2;
    var blooms = [C.rose, C.sun, C.roseLight, C.butter];
    for(var i = 0; i < 6; i++){
      var a = (i / 6) * Math.PI * 2;
      add(g, new THREE.SphereGeometry(0.058, 6, 5), blooms[i % blooms.length], 0.85,
          Math.cos(a) * 0.3, 0.075, Math.sin(a) * 0.3);
    }
    return g;
  }
};

/* 衣服都挂在身体上。身体是半径 0.46、按 (0.92,1,0.86) 压过的球，
   腰部在 y≈0.35、肩在 y≈0.72，这几个数决定了下面所有衣服的高度 */
var CLOTHES = {
  none: function(){ return new THREE.Group(); },

  overall: function(){                        /* 背带裤 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.44, 0.46, 0.42, 10), C.denim, 0.9, 0, 0.32, 0);
    [-1, 1].forEach(function(s){
      var st = add(g, new THREE.BoxGeometry(0.09, 0.4, 0.06), C.denim, 0.9, s * 0.16, 0.68, 0.34);
      st.rotation.x = -0.12;
    });
    add(g, new THREE.BoxGeometry(0.34, 0.22, 0.06), C.denimD, 0.9, 0, 0.42, 0.39);
    return g;
  },
  stripe: function(){                         /* 条纹衫 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.44, 0.47, 0.46, 10), C.butter, 0.9, 0, 0.4, 0);
    for(var i = 0; i < 3; i++){
      add(g, new THREE.CylinderGeometry(0.445 + i * 0.008, 0.448 + i * 0.008, 0.06, 10), C.rose, 0.9,
          0, 0.25 + i * 0.14, 0);
    }
    return g;
  },
  dress: function(){                          /* 小裙子 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), C.rose, 0.9, 0, 0.5, 0);
    add(g, new THREE.CylinderGeometry(0.44, 0.62, 0.4, 12, 1, true), C.roseD, 0.9, 0, 0.2, 0);
    return g;
  },
  scarf: function(){                          /* 围巾 */
    var g = new THREE.Group();
    var ring = add(g, new THREE.TorusGeometry(0.32, 0.09, 7, 14), C.rose, 0.92, 0, 0.8, 0);
    ring.rotation.x = Math.PI / 2;
    var tail = add(g, new THREE.BoxGeometry(0.13, 0.34, 0.07), C.roseD, 0.92, 0.2, 0.62, 0.26);
    tail.rotation.z = 0.2;
    return g;
  },
  raincoat: function(){                       /* 小雨衣 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.47, 0.55, 0.66, 10), C.sun, 0.88, 0, 0.36, 0);
    add(g, new THREE.ConeGeometry(0.34, 0.3, 10), C.sunD, 0.88, 0, 0.98, -0.06);
    return g;
  },
  sweater: function(){                        /* 毛衣 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.45, 0.48, 0.5, 10), C.mint, 0.95, 0, 0.38, 0);
    var collar = add(g, new THREE.TorusGeometry(0.24, 0.07, 6, 12), C.mint, 0.95, 0, 0.74, 0.05);
    collar.rotation.x = Math.PI / 2;
    return g;
  },
  space: function(){                          /* 太空服 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.48, 0.5, 0.56, 10), C.silver, 0.55, 0, 0.36, 0);
    add(g, new THREE.BoxGeometry(0.3, 0.2, 0.1), C.silverD, 0.5, 0, 0.46, 0.4);
    add(g, new THREE.SphereGeometry(0.09, 7, 6), C.sun, 0.4, 0.14, 0.46, 0.42);
    add(g, new THREE.SphereGeometry(0.07, 7, 6), 0xE24B4A, 0.4, -0.02, 0.5, 0.42);
    return g;
  }
};

/* 配饰。翅膀要挂在身体后面，所以它进 backSlot 而不是 accSlot */
var ACCS = {
  none: function(){ return new THREE.Group(); },

  glass: function(){                          /* 圆眼镜 */
    var g = new THREE.Group();
    [-1, 1].forEach(function(s){
      var ring = add(g, new THREE.TorusGeometry(0.115, 0.026, 6, 12), C.ink, 0.5, s * 0.145, 1.03, 0.31);
      ring.rotation.y = 0.28;
    });
    add(g, new THREE.BoxGeometry(0.09, 0.022, 0.022), C.ink, 0.5, 0, 1.06, 0.35);
    return g;
  },
  bow: function(){                            /* 蝴蝶结 */
    var g = new THREE.Group();
    [-1, 1].forEach(function(s){
      var wing = add(g, new THREE.SphereGeometry(0.11, 7, 6), C.rose, 0.85, 0.34 + 0, 1.3, s * 0.1);
      wing.scale.set(0.62, 0.8, 1);
    });
    add(g, new THREE.SphereGeometry(0.055, 6, 5), C.roseD, 0.85, 0.34, 1.3, 0);
    return g;
  },
  star: function(){                           /* 小星星徽章 */
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 5), C.gold, 0.4, 0.18, 0.5, 0.4)
      .rotation.x = Math.PI / 2;
    return g;
  },
  necklace: function(){                       /* 项链 */
    var g = new THREE.Group();
    var ring = add(g, new THREE.TorusGeometry(0.3, 0.022, 6, 16), C.gold, 0.35, 0, 0.7, 0);
    ring.rotation.x = Math.PI / 2;
    add(g, new THREE.SphereGeometry(0.052, 7, 6), C.cherry, 0.4, 0, 0.66, 0.3);
    return g;
  },
  backpack: function(){                       /* 小背包 */
    var g = new THREE.Group();
    var b = add(g, new THREE.BoxGeometry(0.34, 0.36, 0.22), C.wood, 0.95, 0, 0.44, -0.44);
    add(g, new THREE.BoxGeometry(0.24, 0.12, 0.06), C.sun, 0.9, 0, 0.34, -0.56);
    [-1, 1].forEach(function(s){
      var strap = add(g, new THREE.BoxGeometry(0.05, 0.34, 0.05), C.wood, 0.95, s * 0.12, 0.62, -0.2);
      strap.rotation.x = 0.35;
    });
    return g;
  },
  wing: function(){                           /* 小翅膀 */
    var g = new THREE.Group();
    [-1, 1].forEach(function(s){
      var w = add(g, new THREE.SphereGeometry(0.26, 8, 6), 0xFFFFFF, 0.6, s * 0.34, 0.6, -0.3);
      w.scale.set(1.15, 0.42, 0.7);
      w.rotation.z = s * 0.45;
    });
    return g;
  }
};

var ITEM_KIND = { hat: HATS, cloth: CLOTHES, acc: ACCS };
/* 翅膀挂身后：它是唯一一个需要「在身体后面」的配饰 */
var ACC_BEHIND = { wing: true };

function propName(kind, name){ return (name && name !== 'none') ? name : 'none'; }

/* 换装：worn = { hat:'crown', cloth:'overall', acc:'glass' } */
function dress(b, worn){
  worn = worn || {};
  ['back', 'cloth', 'hat', 'acc'].forEach(function(slot){
    var g = b.getObjectByName(slot + 'Slot');
    while(g.children.length) g.remove(g.children[0]);
  });
  if(worn.cloth){
    var cg = (CLOTHES[worn.cloth] || CLOTHES.none)();
    b.getObjectByName('clothSlot').add(cg);
  }
  if(worn.acc){
    var behind = ACC_BEHIND[worn.acc];
    var ag = (ACCS[worn.acc] || ACCS.none)();
    b.getObjectByName((behind ? 'back' : 'acc') + 'Slot').add(ag);
  }
  if(worn.hat){
    b.getObjectByName('hatSlot').add((HATS[worn.hat] || HATS.none)());
  }
  return b;
}

/* ============================================================
   4. 棋盘小岛
   ------------------------------------------------------------
   这一层比看起来重要。用一块方形板子当棋盘，画面永远像一张表格；
   换成草皮 + 两层泥土 + 前沿露台，棋盘就变成了「一个地方」——
   这是 Q 版场景最关键的观感差别。
   ============================================================ */
function island(opt){
  opt = opt || {};
  var COLS = opt.cols || 6, ROWS = opt.rows || 7, GAP = opt.gap || 1.06;
  var W = COLS * GAP, H = ROWS * GAP;
  var g = new THREE.Group();
  g.userData = { cols: COLS, rows: ROWS, gap: GAP, W: W, H: H };

  function slab(w, h, d, color, y, x, z){
    var m = add(g, new THREE.BoxGeometry(w, h, d), color, 1, x || 0, y, z || 0);
    m.castShadow = false;
    m.receiveShadow = true;
    return m;
  }
  slab(W + 0.88, 0.34, H + 0.88, C.grass, -0.21);        /* 草皮 */
  slab(W + 0.54, 0.66, H + 0.54, C.soil, -0.71);         /* 泥土 */
  slab(W - 0.22, 0.62, H - 0.22, C.soilD, -1.35);
  slab(W - 1.15, 0.50, H - 1.15, C.soil, -1.90);

  /* 前沿露台：兔子站的地方。没有它，兔子只能飘在岛外，比例怎么调都别扭 */
  var deckZ = H / 2 + 1.02;
  slab(3.70, 0.34, 1.94, C.grass, -0.21, 0, deckZ);
  slab(3.36, 0.62, 1.66, C.soil, -0.69, 0, deckZ);
  g.userData.deckZ = deckZ;

  /* 格面：刻意留浅，颜色越浅棋子在上面越跳 */
  var cellGeo = new THREE.BoxGeometry(GAP * 0.9, 0.16, GAP * 0.9);
  for(var r = 0; r < ROWS; r++){
    for(var c = 0; c < COLS; c++){
      var p = cellPos(g, r, c);
      var cell = add(g, cellGeo, (r + c) % 2 ? C.tileA : C.tileB, 0.95, p.x, -0.02, p.z);
      cell.castShadow = false;
    }
  }

  /* 岛缘冒几棵小苗：破掉「几何体拼的」那股机械感。
     位置都在格子范围之外的草皮边上，不会挡住棋子 */
  var spots = [[-3.44, -3.10], [3.44, -3.10], [-3.44, 0.4], [3.44, 0.4], [-2.6, 3.98], [2.6, 3.98]];
  spots.forEach(function(p, i){
    var st = add(g, new THREE.ConeGeometry(0.1, 0.44, 5), C.grassD, 0.95, p[0], 0.13, p[1]);
    st.rotation.z = (i % 2 ? 1 : -1) * 0.17;
    add(g, new THREE.SphereGeometry(0.07, 6, 5), i % 3 === 0 ? C.cherry : C.carrot, 0.9,
        p[0] + (i % 2 ? 0.07 : -0.07), 0.33, p[1] + 0.03);
  });
  return g;
}

function cellPos(board, r, c){
  var d = board.userData;
  return { x: (c - (d.cols - 1) / 2) * d.gap, z: (r - (d.rows - 1) / 2) * d.gap };
}

/* ============================================================
   5. 场景（天空、云、光、正交相机）
   ------------------------------------------------------------
   正交而不是透视：透视会让后排棋子变小、还会被前排挡住，
   而三消要求 42 个格子同样清晰。立体感靠俯角和光影给。
   这是三消这类游戏的标准做法。
   ============================================================ */
var ELEV = 60 * Math.PI / 180;      /* 俯角：太高会看到侧面，太低又读不出格子 */

function createStage(opt){
  opt = opt || {};
  var canvas = opt.canvas;
  var COLS = opt.cols || 6, ROWS = opt.rows || 7;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  /* 密度 0.010：再浓就会把棋盘漂白成灰绿（0.021 时在 28 单位处吃掉 29% 颜色）。
     天空已经是渐变球，雾只需负责远景衔接。 */
  scene.fog = new THREE.FogExp2(C.fog, 0.010);

  /* 天空：反面渲染的大球做垂直渐变，比纯色 background 层次好很多 */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(70, 16, 10), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(C.skyTop) }, uLow: { value: new THREE.Color(C.skyLow) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 uTop; uniform vec3 uLow; varying vec3 vP;',
      'void main(){',
      '  float h = clamp((normalize(vP).y + 0.25) / 0.9, 0.0, 1.0);',
      '  gl_FragColor = vec4(mix(uLow, uTop, pow(h, 0.8)), 1.0);',
      '}'
    ].join('\n')
  })));

  /* 地面反弹色偏暖：Q 版场景的暖度基本都来自这一步 */
  scene.add(new THREE.HemisphereLight(0xEDF7FF, 0xB99A6E, 1.02));
  var sun = new THREE.DirectionalLight(0xFFF3D8, 1.85);
  sun.position.set(-5.5, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 8;   sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 2;  sun.shadow.camera.far = 34;
  sun.shadow.bias = -0.0013;
  scene.add(sun);
  scene.add(sun.target);

  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

  /* 云的位置是由投影反推出来的，不是「又高又远」。
     正交俯视下屏幕纵向坐标 ≈ 0.5·y − 0.86·z，想让云落在棋盘远端
     上方的天空带里，z 只能取 −5 ~ −6、y 取 0.4 ~ 1.6。
     按常识放到高空反而会飞出画面。 */
  [[-3.6, 0.7, -5.6, 1.00], [3.9, 0.4, -5.3, 0.82],
   [-0.4, 1.5, -6.0, 1.18], [6.6, 1.1, -5.8, 0.70]].forEach(function(p){
    var cl = new THREE.Group();
    for(var j = 0; j < 3; j++){
      var b = add(cl, new THREE.SphereGeometry(0.42 + (j % 2) * 0.18, 7, 5), C.cloud, 1,
                  j * 0.42 - 0.42, (j % 2) * 0.11, (j % 3) * 0.14);
      b.castShadow = false;
      b.scale.y = 0.7;
    }
    cl.position.set(p[0], p[1], p[2]);
    cl.scale.setScalar(p[3]);
    scene.add(cl);
  });

  var board = island({ cols: COLS, rows: ROWS, gap: opt.gap });
  scene.add(board);
  var base = board.userData;

  var b = bunny();
  b.scale.setScalar(opt.bunnyScale || 1.3);
  b.position.set(0, -0.045, base.H / 2 + 1.0);
  /* 先偏航再俯仰：默认的 XYZ 顺序会让抬头把朝向也带偏 */
  b.rotation.order = 'YXZ';
  b.rotation.y = -0.26;
  /* 抬头看向棋盘。62° 俯角下平视的脸基本看不到，
     只有把下巴抬起来，眼睛才会进入镜头 */
  b.rotation.x = -0.2;
  b.userData.baseY = b.position.y;
  scene.add(b);

  var api = {
    THREE: THREE, renderer: renderer, scene: scene, camera: camera,
    board: board, bunny: b, sun: sun, canvas: canvas,
    clock: 0,
    resize: function(){ fitCamera(camera, renderer, { cols: COLS, rows: ROWS, gap: opt.gap }); },
    render: function(){ renderer.render(scene, camera); },
    /* 兔子呼吸，帽子跟着晃。基准高度记在 userData 里 ——
       直接从 0 起算会把站在露台上的兔子拉回岛面高度 */
    idle: function(dt){
      api.clock += dt;
      b.position.y = b.userData.baseY + Math.sin(api.clock * 1.7) * 0.035;
      var hs = b.getObjectByName('hatSlot');
      if(hs) hs.rotation.z = Math.sin(api.clock * 0.9) * 0.045;
    }
  };
  api.resize();
  return api;
}

/* 正交取景：竖屏的瓶颈是宽度，所以半宽按「棋盘宽 + 边距」定，
   半高再按画面比例推出来。这样无论什么屏幕，棋盘都刚好铺满横向。
   边距 1.18 不是随手给的：小岛草皮比格子各宽 0.44，留少了草皮会被裁掉。 */
function fitCamera(camera, renderer, opt){
  opt = opt || {};
  var COLS = opt.cols || 6, ROWS = opt.rows || 7, GAP = opt.gap || 1.06;
  var w = renderer.domElement.clientWidth || window.innerWidth;
  var h = renderer.domElement.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  var aspect = w / h;
  var halfW = (COLS * GAP + (opt.margin === undefined ? 1.18 : opt.margin)) / 2;
  var halfH = halfW / aspect;
  camera.left = -halfW;  camera.right = halfW;
  camera.top = halfH;    camera.bottom = -halfH;
  var dir = new THREE.Vector3(0, Math.tan(ELEV), 1).normalize();
  camera.position.copy(dir.multiplyScalar(30));
  /* 视点在棋盘与小岛露台之间：棋盘落到画面偏上，前沿的兔子正好在下方 */
  camera.lookAt(0, 0.35, opt.lookZ === undefined ? 2.72 : opt.lookZ);
  camera.updateProjectionMatrix();
  return { halfW: halfW, halfH: halfH };
}

root.Geom3D = {
  PALETTE: PALETTE,
  mat: mat,
  /* 几何 */
  radish: radish,
  RADISH_COUNT: RADISH_COUNT,
  bunny: bunny,
  island: island,
  cellPos: cellPos,
  /* 换装 */
  dress: dress,
  HATS: HATS, CLOTHES: CLOTHES, ACCS: ACCS,
  HAT_NAMES: Object.keys(HATS),
  CLOTH_NAMES: Object.keys(CLOTHES),
  ACC_NAMES: Object.keys(ACCS),
  ACC_BEHIND: ACC_BEHIND,
  /* 场景 */
  createStage: createStage,
  fitCamera: fitCamera,
  ELEV: ELEV
};

})(typeof window !== 'undefined' ? window : this);
