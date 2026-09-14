/* ============================================================
   Match3 —— 可复用的三消棋盘
   ------------------------------------------------------------
   设计取向：**只劳作，不失败**。
   步数用完就是「这一局结束了」，没有输赢，可以看广告续步继续。
   美术由调用方通过 drawTile 提供，所以这个模块本身不带任何画法。

   用法：
     var m = Match3.create(canvas, {
       cols:6, rows:7, kinds:5, moves:20,
       drawTile: function(ctx, kind, cx, cy, size, alpha){ ... },
       onMatch:  function(info){ },   // { cleared, combo, total }
       onMove:   function(left){ },   // 剩余步数变化
       onEnd:    function(total){ },  // 步数用完
       sfx:      function(name, n){ }
     });
     m.start();
   ============================================================ */
(function(){
  'use strict';

  var GRAVITY = 70;        /* 下落重力，单位：格/秒² */
  var SWAP_SPEED = 14;      /* 交换归位速度 */
  var CLEAR_TIME = 0.2;    /* 单次消除动画时长 */

  function rrect(c, x, y, w, h, r){
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function create(canvas, opt){
    opt = opt || {};
    var COLS = opt.cols || 6;
    var ROWS = opt.rows || 7;
    var KINDS = opt.kinds || 5;
    var startMoves = opt.moves || 20;
    var onMatch = opt.onMatch || function(){};
    var onMove = opt.onMove || function(){};
    var onEnd = opt.onEnd || function(){};
    var onInactiveTap = opt.onInactiveTap || null;
    var sfx = opt.sfx || function(){};
    var drawTile = opt.drawTile;

    var ctx = canvas.getContext('2d');
    var CS = 44, PAD = 0;
    var grid = [];
    var phase = 'idle';          /* idle | swap | clear | fall */
    var moves = startMoves;
    var totalCleared = 0;
    var combo = 0;
    var clearing = [];
    var pendingBack = false;
    var sel = null;
    var active = true;
    var raf = null;
    var lastT = 0;
    var frames = 0;
    var particles = [], pops = [];

    var pointer = { down:false, r:-1, c:-1, x:0, y:0, moved:false };

    /* ---------- 尺寸 ---------- */
    function resize(){
      var w = canvas.parentElement.clientWidth;
      var pad = parseFloat(getComputedStyle(canvas.parentElement).paddingLeft) || 0;
      w -= pad * 2;
      CS = Math.floor(w / COLS);
      /* 调用方可以限制棋盘高度（矮屏上保证整页放得下）。
         maxHeight 允许传函数，每次 resize 重新求值 */
      if(opt.maxHeight){
        var mh = (typeof opt.maxHeight === 'function') ? opt.maxHeight() : opt.maxHeight;
        if(mh > 0) CS = Math.min(CS, Math.floor(mh / ROWS));
      }
      CS = Math.max(24, CS);
      var size = CS * COLS;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = size + 'px';
      canvas.style.height = (CS * ROWS) + 'px';
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(CS * ROWS * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---------- 棋盘 ---------- */
    function newTile(kind){ return { kind:kind, ox:0, oy:0, vy:0, scale:1, alpha:1 }; }
    function randKind(){ return Math.floor(Math.random() * KINDS); }
    function inB(r, c){ return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

    function buildBoard(){
      grid = [];
      for(var r = 0; r < ROWS; r++){
        var row = [];
        for(var c = 0; c < COLS; c++){
          var k, guard = 0;
          do {
            k = randKind(); guard++;
          } while(guard < 50 && (
            (c >= 2 && row[c-1].kind === k && row[c-2].kind === k) ||
            (r >= 2 && grid[r-1][c].kind === k && grid[r-2][c].kind === k)
          ));
          row.push(newTile(k));
        }
        grid.push(row);
      }
      if(!findAnyMove()) buildBoard();
    }

    /* ---------- 匹配 ---------- */
    function findMatches(){
      var hit = new Set();
      var r, c, run, same;
      for(r = 0; r < ROWS; r++){
        run = 1;
        for(c = 1; c <= COLS; c++){
          same = c < COLS && grid[r][c] && grid[r][c-1] && grid[r][c].kind === grid[r][c-1].kind;
          if(same) run++;
          else {
            if(run >= 3) for(var i = c - run; i < c; i++) hit.add(r + ',' + i);
            run = 1;
          }
        }
      }
      for(c = 0; c < COLS; c++){
        run = 1;
        for(r = 1; r <= ROWS; r++){
          same = r < ROWS && grid[r][c] && grid[r-1][c] && grid[r][c].kind === grid[r-1][c].kind;
          if(same) run++;
          else {
            if(run >= 3) for(var j = r - run; j < r; j++) hit.add(j + ',' + c);
            run = 1;
          }
        }
      }
      return hit;
    }

    function wouldMatch(r1, c1, r2, c2){
      var a = grid[r1][c1], b = grid[r2][c2];
      if(!a || !b) return false;
      grid[r1][c1] = b; grid[r2][c2] = a;
      var ok = findMatches().size > 0;
      grid[r1][c1] = a; grid[r2][c2] = b;
      return ok;
    }
    function findAnyMove(){
      for(var r = 0; r < ROWS; r++){
        for(var c = 0; c < COLS; c++){
          if(c + 1 < COLS && wouldMatch(r, c, r, c + 1)) return { r1:r, c1:c, r2:r, c2:c + 1 };
          if(r + 1 < ROWS && wouldMatch(r, c, r + 1, c)) return { r1:r, c1:c, r2:r + 1, c2:c };
        }
      }
      return null;
    }

    /* ---------- 交互 ---------- */
    function cellFrom(e){
      var rect = canvas.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      var x = p.clientX - rect.left, y = p.clientY - rect.top;
      var c = Math.floor(x / CS), r = Math.floor(y / CS);
      return inB(r, c) ? { r:r, c:c, x:x, y:y } : null;
    }

    function onDown(e){
      /* 不在进行中：给调用方一个机会提示玩家，而不是静默吞掉点击 */
      if(!active){ if(onInactiveTap) onInactiveTap(); return; }
      if(phase !== 'idle') return;
      var p = cellFrom(e);
      if(!p) return;
      pointer.down = true; pointer.r = p.r; pointer.c = p.c;
      pointer.x = p.x; pointer.y = p.y; pointer.moved = false;
      if(e.cancelable) e.preventDefault();
    }
    function onMoveEvt(e){
      if(!pointer.down || phase !== 'idle' || pointer.moved) return;
      var rect = canvas.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      var dx = (p.clientX - rect.left) - pointer.x;
      var dy = (p.clientY - rect.top) - pointer.y;
      var th = CS * 0.42;
      if(Math.abs(dx) < th && Math.abs(dy) < th) return;
      pointer.moved = true;
      if(Math.abs(dx) > Math.abs(dy)) trySwap(pointer.r, pointer.c, pointer.r, pointer.c + (dx > 0 ? 1 : -1));
      else                            trySwap(pointer.r, pointer.c, pointer.r + (dy > 0 ? 1 : -1), pointer.c);
      if(e.cancelable) e.preventDefault();
    }
    function onUp(e){
      if(!pointer.down) return;
      pointer.down = false;
      if(pointer.moved || phase !== 'idle') return;
      var p = cellFrom(e);
      if(!p){ sel = null; return; }
      if(!sel){ sel = { r:p.r, c:p.c }; sfx('ui'); return; }
      if(sel.r === p.r && sel.c === p.c){ sel = null; return; }
      var d = Math.abs(sel.r - p.r) + Math.abs(sel.c - p.c);
      if(d === 1) trySwap(sel.r, sel.c, p.r, p.c);
      else { sel = { r:p.r, c:p.c }; sfx('ui'); }
    }
    function onCancel(){ pointer.down = false; }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMoveEvt);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);

    function trySwap(r1, c1, r2, c2){
      if(!inB(r2, c2) || phase !== 'idle') return;
      var a = grid[r1][c1], b = grid[r2][c2];
      if(!a || !b) return;

      grid[r1][c1] = b; grid[r2][c2] = a;
      a.ox = c2 - c1; a.oy = r2 - r1;
      b.ox = c1 - c2; b.oy = r1 - r2;

      phase = 'swap';
      sel = null;
      pendingBack = !findMatches().size;
      if(pendingBack) sfx('bad'); else sfx('ui');
    }

    /* ---------- 消除 ---------- */
    function startClear(matches){
      phase = 'clear';
      clearing = [];
      matches.forEach(function(key){
        var p = key.split(',');
        clearing.push({ r:+p[0], c:+p[1] });
      });

      var n = clearing.length;
      combo++;
      totalCleared += n;
      /* 连击加成：一次消得越多、连得越紧，收益越高 */
      var gain = n * Math.max(1, combo);

      clearing.forEach(function(cell){
        var cx = cell.c * CS + CS / 2, cy = cell.r * CS + CS / 2;
        var t = grid[cell.r][cell.c];
        for(var i = 0; i < 6; i++){
          var ang = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
          particles.push({
            x:cx, y:cy, vx:Math.cos(ang) * sp, vy:Math.sin(ang) * sp - 45,
            life:0.45 + Math.random() * 0.3, age:0, r:2 + Math.random() * 2.4, kind:t ? t.kind : 0
          });
        }
      });

      var fx = 0, fy = 0;
      clearing.forEach(function(c){ fx += c.c * CS + CS / 2; fy += c.r * CS + CS / 2; });
      if(combo >= 2){
        pops.push({
          x:fx / clearing.length, y:fy / clearing.length,
          text:'连击 x' + combo, age:0, life:0.9, combo:true
        });
      }

      onMatch({ cleared:n, combo:combo, total:totalCleared, gain:gain });
      sfx('pop', Math.min(9, combo + n - 1));
    }

    function applyGravity(){
      for(var c = 0; c < COLS; c++){
        var write = ROWS - 1;
        for(var r = ROWS - 1; r >= 0; r--){
          if(grid[r][c]){
            if(write !== r){
              var t = grid[r][c];
              grid[write][c] = t;
              grid[r][c] = null;
              t.oy = r - write;
            }
            write--;
          }
        }
        /* 顶部补新的 */
        for(var k = write; k >= 0; k--){
          var nt = newTile(randKind());
          nt.oy = -(k + 1);
          grid[k][c] = nt;
        }
      }
    }

    function shuffleBoard(){
      /* 没有可行走法时重排，不能把玩家卡死 */
      var kinds = [];
      for(var r = 0; r < ROWS; r++) for(var c = 0; c < COLS; c++) kinds.push(grid[r][c].kind);
      for(var i = kinds.length - 1; i > 0; i--){
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = kinds[i]; kinds[i] = kinds[j]; kinds[j] = tmp;
      }
      var idx = 0;
      for(var r2 = 0; r2 < ROWS; r2++) for(var c2 = 0; c2 < COLS; c2++){
        grid[r2][c2].kind = kinds[idx++];
        grid[r2][c2].scale = 0.6;
      }
      if(!findAnyMove() || findMatches().size) shuffleBoard();
    }

    /* ---------- 每帧 ---------- */
    function step(dt){
      var r, c, t, moving = false;

      for(r = 0; r < ROWS; r++){
        for(c = 0; c < COLS; c++){
          t = grid[r][c];
          if(!t) continue;
          if(t.oy !== 0){
            t.vy += GRAVITY * dt;
            t.oy += t.vy * dt;
            if(t.oy >= 0){
              t.oy = 0;
              if(Math.abs(t.vy) > 3.4){ t.vy = -t.vy * 0.2; t.oy = t.vy * dt; }
              else t.vy = 0;
            }
            moving = true;
          }
          if(t.ox !== 0){
            /* 线性按时间推进，而不是「每帧衰减一个比例」：
               这样动画时长与帧率无关，低帧率设备上不会拖十几帧才归位 */
            var stepLen = SWAP_SPEED * dt;
            if(Math.abs(t.ox) <= stepLen) t.ox = 0;
            else t.ox -= (t.ox > 0 ? stepLen : -stepLen);
            moving = true;
          }
          /* 注意：消除阶段在把 scale 往下压，这里就不能再往上抬，
             否则两个速率会互相抵消，消除永远结束不了 */
          if(t.scale < 1 && phase !== 'clear'){
            t.scale = Math.min(1, t.scale + dt * 4);
            moving = true;
          }
        }
      }

      /* 粒子与飘字 */
      for(var i = particles.length - 1; i >= 0; i--){
        var p = particles[i];
        p.age += dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 320 * dt;
        if(p.age >= p.life) particles.splice(i, 1);
      }
      for(var j = pops.length - 1; j >= 0; j--){
        pops[j].age += dt;
        if(pops[j].age >= pops[j].life) pops.splice(j, 1);
      }

      if(phase === 'clear'){
        var done = true;
        clearing.forEach(function(cell){
          var tt = grid[cell.r][cell.c];
          if(tt){
            tt.scale = Math.max(0, tt.scale - dt / CLEAR_TIME);
            tt.alpha = Math.max(0, tt.alpha - dt / CLEAR_TIME);
          }
          if(tt && tt.scale > 0) done = false;
        });
        if(done){
          clearing.forEach(function(cell){ grid[cell.r][cell.c] = null; });
          applyGravity();
          phase = 'fall';
        }
        return;
      }

      if(phase === 'swap' && !moving){
        if(pendingBack){
          pendingBack = false;
          phase = 'idle';
        } else {
          /* 有效交换才扣步数 */
          moves--;
          combo = 0;
          onMove(Math.max(0, moves));
          startClear(findMatches());
        }
        return;
      }

      if(phase === 'fall' && !moving){
        var m = findMatches();
        if(m.size){
          startClear(m);
        } else {
          combo = 0;
          phase = 'idle';
          if(!findAnyMove()) shuffleBoard();
          if(moves <= 0){
            phase = 'end';
            onEnd(totalCleared);
          }
        }
        return;
      }
    }

    /* ---------- 画 ---------- */
    function paint(){
      var W = CS * COLS, H = CS * ROWS;
      ctx.clearRect(0, 0, W, H);

      /* 底格 */
      for(var r = 0; r < ROWS; r++){
        for(var c = 0; c < COLS; c++){
          ctx.fillStyle = (r + c) % 2 ? 'rgba(255,252,246,.72)' : 'rgba(250,244,235,.72)';
          rrect(ctx, c * CS + 1.6, r * CS + 1.6, CS - 3.2, CS - 3.2, 8);
          ctx.fill();
        }
      }

      /* 选中提示 */
      if(sel){
        ctx.strokeStyle = 'rgba(230,139,156,.85)';
        ctx.lineWidth = 2.6;
        rrect(ctx, sel.c * CS + 2.4, sel.r * CS + 2.4, CS - 4.8, CS - 4.8, 9);
        ctx.stroke();
      }

      /* 棋子：按下落高度排序，低的后画 */
      var list = [];
      for(var r2 = 0; r2 < ROWS; r2++)
        for(var c2 = 0; c2 < COLS; c2++)
          if(grid[r2][c2]) list.push({ t:grid[r2][c2], r:r2, c:c2 });
      list.sort(function(a, b){ return (a.r + a.t.oy) - (b.r + b.t.oy); });

      list.forEach(function(item){
        var t = item.t;
        var cx = (item.c + t.ox) * CS + CS / 2;
        var cy = (item.r + t.oy) * CS + CS / 2;
        if(t.scale <= 0.01) return;
        drawTile(ctx, t.kind, cx, cy, CS * 0.86 * t.scale, t.alpha);
      });

      /* 粒子 */
      particles.forEach(function(p){
        var a = 1 - p.age / p.life;
        ctx.globalAlpha = Math.max(0, a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = opt.particleColor ? opt.particleColor(p.kind) : '#F2C14E';
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      /* 飘字 */
      ctx.textAlign = 'center';
      pops.forEach(function(p){
        var a = 1 - p.age / p.life;
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = '800 ' + (p.combo ? 20 : 17) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillStyle = p.combo ? '#C4697B' : '#7C6A5C';
        ctx.fillText(p.text, p.x, p.y - p.age * 40);
      });
      ctx.globalAlpha = 1;
    }

    function loop(now){
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      frames++;
      if(active){
        step(dt);
        paint();
      }
      raf = requestAnimationFrame(loop);
    }

    /* ---------- 对外 ---------- */
    return {
      start: function(){
        resize();
        buildBoard();
        moves = startMoves;
        totalCleared = 0;
        combo = 0;
        phase = 'idle';
        particles = []; pops = [];
        sel = null;
        onMove(moves);
        if(!raf){ lastT = performance.now(); raf = requestAnimationFrame(loop); }
      },
      stop: function(){
        if(raf){ cancelAnimationFrame(raf); raf = null; }
        grid = []; particles = []; pops = []; sel = null;
        phase = 'idle';
      },
      resize: function(){
        resize();
        /* 改画布尺寸会清空内容，这里补画一帧，否则调用方会看到空白棋盘 */
        if(grid.length) paint();
      },
      setActive: function(v){
        active = !!v;
        /* 从后台回来时把时间基准重置，避免一次巨量 dt */
        if(active){
          lastT = performance.now();
        } else if(grid.length){
          /* 停下来时补画一帧：主循环只在 active 时绘制，
             未开始时如果一帧都不画，调用方看到的就是一块空白棋盘 */
          paint();
        }
      },
      addMoves: function(n){
        moves += n;
        phase = 'idle';
        onMove(Math.max(0, moves));
      },
      movesLeft: function(){ return Math.max(0, moves); },
      cleared: function(){ return totalCleared; },
      isEnded: function(){ return phase === 'end'; },
      isBusy: function(){ return phase !== 'idle' && phase !== 'end'; },

      /* 手动推进若干时间。低帧率环境或自动化测试里用它替代 rAF */
      tick: function(dt){
        dt = dt || 1 / 60;
        frames++;
        step(dt);
        paint();
      },

      /* 找一个可行的交换。后面做「提示」功能直接用这个 */
      findMove: function(){
        var m = findAnyMove();
        return m ? { r1:m.r1, c1:m.c1, r2:m.r2, c2:m.c2 } : null;
      },
      /* 只读快照，方便调试与自动化测试 */
      state: function(){
        var g = [];
        for(var r = 0; r < ROWS; r++){
          var row = [];
          for(var c = 0; c < COLS; c++) row.push(grid[r] && grid[r][c] ? grid[r][c].kind : -1);
          g.push(row);
        }
        return {
          cols:COLS, rows:ROWS, cell:CS,
          phase:phase, moves:moves, cleared:totalCleared, combo:combo,
          active:active, frames:frames, lastDt:lastT,
          grid:g
        };
      }
    };
  }

  window.Match3 = { create: create };
})();
