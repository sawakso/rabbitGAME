/* ============================================================
   GameAudio —— 全站共用的音频引擎
   全部为 Web Audio 实时合成，不依赖任何音频文件：
     · BGM：八音盒音色，C–G–Am–F 四小节循环，带轻混响
     · SFX：走子 / 错误 / 胜利 / 失败 / 点按 / 撤销 / 泡泡
   开关状态存在 Store 里，大厅和所有小游戏共享。
   ============================================================ */
(function(){
  'use strict';

  var ctx = null, master = null, musicBus = null, sfxBus = null;
  var delayNode = null, fbGain = null, wetGain = null;
  var timer = null, stepIdx = 0, nextTime = 0, running = false;
  var musicOn = true, sfxOn = true, ducked = false;

  /* ---------- 乐理：音名 → 频率 ---------- */
  var SEMI = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  function hz(name){
    var m = /^([A-G])(#|b)?(-?\d+)$/.exec(name);
    if(!m) return 440;
    var s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    var midi = (parseInt(m[3], 10) + 1) * 12 + s;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function midiHz(midi){ return 440 * Math.pow(2, (midi - 69) / 12); }

  /* ---------- 初始化 ---------- */
  function ensure(){
    if(ctx){ if(ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    ctx = new AC();

    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    sfxBus = ctx.createGain();   sfxBus.gain.value = 0.55; sfxBus.connect(master);

    /* 用延迟+反馈近似轻混响 */
    delayNode = ctx.createDelay(1.5); delayNode.delayTime.value = 0.33;
    fbGain = ctx.createGain(); fbGain.gain.value = 0.24;
    wetGain = ctx.createGain(); wetGain.gain.value = 0.26;
    delayNode.connect(fbGain); fbGain.connect(delayNode);
    delayNode.connect(wetGain); wetGain.connect(master);

    if(window.Store){ musicOn = Store.get('music', true); sfxOn = Store.get('sfx', true); }
  }

  /* ---------- BGM ---------- */
  var BPM = 62;
  var EIGHTH = 60 / BPM / 2;
  var BARS = 4, PER_BAR = 8, TOTAL = BARS * PER_BAR;

  var PROG = [
    { root:'C3', pad:['C4','E4','G4'], mel:['E5','G5','C6','G5'] },
    { root:'G2', pad:['G3','B3','D4'], mel:['D5','G5','B5','G5'] },
    { root:'A2', pad:['A3','C4','E4'], mel:['E5','A5','C6','A5'] },
    { root:'F2', pad:['F3','A3','C4'], mel:['F5','A5','C6','A5'] }
  ];

  /* 八音盒音色：正弦基音 + 高八度泛音，快起慢落 */
  function bell(f, t, vol, dest){
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(dest); g.connect(delayNode);
    o.start(t); o.stop(t + 1.7);

    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'sine'; o2.frequency.value = f * 2;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(vol * 0.26, t + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o2.connect(g2); g2.connect(dest);
    o2.start(t); o2.stop(t + 0.9);
  }
  function padNote(f, t, dur, vol, type){
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.9);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.06);
  }
  function bass(f, t, dur, vol){
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function playStep(i, t){
    var bar = Math.floor(i / PER_BAR) % BARS;
    var pos = i % PER_BAR;
    var P = PROG[bar];

    if(pos === 0){
      for(var k = 0; k < P.pad.length; k++) padNote(hz(P.pad[k]), t, EIGHTH * PER_BAR * 0.95, 0.020);
      bass(hz(P.root), t, 1.8, 0.050);
    }
    if(pos === 4) bass(hz(P.root), t, 1.4, 0.034);

    if(pos % 2 === 0){
      if(Math.random() < 0.88) bell(hz(P.mel[(pos / 2) % 4]), t, 0.115, musicBus);
    }else if(pos === 3 || pos === 7){
      if(Math.random() < 0.22) bell(hz(P.mel[0]) * 2, t, 0.045, musicBus);
    }
  }

  function tick(){
    if(!ctx || !running) return;
    while(nextTime < ctx.currentTime + 0.3){
      playStep(stepIdx, nextTime);
      stepIdx = (stepIdx + 1) % TOTAL;
      nextTime += EIGHTH;
    }
  }

  function startMusic(){
    ensure();
    if(!ctx || !musicOn || running) return;
    running = true;
    nextTime = ctx.currentTime + 0.08;
    tick();
    timer = setInterval(tick, 60);
  }
  function stopMusic(){
    running = false;
    if(timer){ clearInterval(timer); timer = null; }
  }

  /* ---------- 音效 ---------- */
  function blip(freq, t, vol, dur, type, dest){
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  /* 五声音阶，让走子音高随步数自然上行 */
  var SCALE = [0, 2, 4, 7, 9];

  var RECIPES = {
    move: function(t, step){
      var s = Math.max(1, step || 1);
      var deg = SCALE[(s - 1) % SCALE.length];
      var oct = 5 + Math.floor(((s - 1) % (SCALE.length * 3)) / SCALE.length);
      blip(midiHz((oct + 1) * 12 + deg), t, 0.10, 0.55);
    },
    pop: function(t, step){                       /* 泡泡 / 轻快点击，音高逐次上行 */
      var s = Math.max(1, step || 1);
      var deg = SCALE[(s - 1) % SCALE.length];
      var oct = 5 + Math.floor(((s - 1) % (SCALE.length * 2)) / SCALE.length);
      blip(midiHz((oct + 1) * 12 + deg), t, 0.085, 0.22);
    },
    drop: function(t){                            /* 方块落下：低沉的闷响 */
      blip(180, t, 0.09, 0.13, 'triangle');
      blip(120, t + 0.015, 0.06, 0.22, 'sine');
    },
    ding: function(t){ blip(1180, t, 0.055, 0.5); },
    bad: function(t){
      blip(196, t, 0.085, 0.18, 'triangle');
      blip(147, t + 0.09, 0.07, 0.24, 'triangle');
    },
    win: function(t){
      [0, 4, 7, 12, 16].forEach(function(s, i){
        blip(midiHz(7 * 12 + s), t + i * 0.1, 0.10, 0.9);
      });
    },
    lose: function(t){
      [0, -3, -7].forEach(function(s, i){
        blip(midiHz(6 * 12 + s), t + i * 0.13, 0.075, 0.7, 'triangle');
      });
    },
    ui: function(t){ blip(660, t, 0.05, 0.14); },
    undo: function(t){
      blip(520, t, 0.06, 0.2, 'triangle');
      blip(390, t + 0.07, 0.05, 0.22, 'triangle');
    }
  };

  /* ---------- 对外接口 ---------- */
  window.GameAudio = {
    /* 必须由用户手势触发一次，移动端 / 微信才会开始出声 */
    unlock: function(){ ensure(); if(musicOn) startMusic(); },

    setMusic: function(on){
      musicOn = !!on;
      if(window.Store) Store.set('music', musicOn);
      if(musicOn) startMusic(); else stopMusic();
    },
    setSfx: function(on){
      sfxOn = !!on;
      if(window.Store) Store.set('sfx', sfxOn);
    },
    musicOn: function(){ return musicOn; },
    sfxOn: function(){ return sfxOn; },

    /* 播放音效。name 见 RECIPES；第二参数是步数/连击数，用于音高上行 */
    sfx: function(name, step){
      if(!sfxOn) return;
      ensure(); if(!ctx) return;
      var t = ctx.currentTime + 0.005;
      var r = RECIPES[name];
      if(r) r(t, step);
    },

    /* 给新游戏用的通用接口：直接给音名，例如 note('C5', 0.4) */
    note: function(name, dur, vol, type){
      if(!sfxOn) return;
      ensure(); if(!ctx) return;
      dur = dur || 0.4; vol = vol || 0.08;
      blip(hz(name), ctx.currentTime + 0.005, vol, dur, type);
    },
    arpeggio: function(names, gapEach){
      if(!sfxOn) return;
      ensure(); if(!ctx) return;
      gapEach = gapEach || 0.1;
      var t0 = ctx.currentTime + 0.005;
      names.forEach(function(n, i){ blip(hz(n), t0 + i * gapEach, 0.09, 0.7); });
    },

    /* 切到后台时静音，回来后恢复 */
    pause: function(){ stopMusic(); },
    resume: function(){ if(musicOn) startMusic(); },

    /* 用户第一次交互时自动解锁，游戏内无需重复处理 */
    autoUnlock: function(){
      function once(){
        window.GameAudio.unlock();
        document.removeEventListener('pointerdown', once);
        document.removeEventListener('touchstart', once);
      }
      document.addEventListener('pointerdown', once);
      document.addEventListener('touchstart', once);
    }
  };

  /* 读取存档里的开关 */
  if(window.Store){
    musicOn = Store.get('music', true);
    sfxOn = Store.get('sfx', true);
  }

  /* 页面隐藏时停音乐，回来再续上 */
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) stopMusic();
    else if(musicOn) startMusic();
  });
})();
