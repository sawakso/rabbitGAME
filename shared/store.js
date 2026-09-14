/* ============================================================
   Store —— 全站共用的本地存档
   大厅和所有小游戏共用同一份数据，键位固定，方便互相读写。
   ============================================================ */
(function(){
  'use strict';

  var KEY = 'rabbitGame.v1';
  var LEGACY_KEY = 'lastCell.v3';   /* 早期单游戏版本的存档，做一次迁移 */

  var DEFAULTS = {
    music: true,      /* 背景音乐开关 */
    sfx: true,        /* 音效开关 */
    space: true,      /* 《最后一格》的活路数字开关 */
    best: {},         /* best[gameId][子项] = 数字，例如 best.lastcell.normal = 26 */
    seen: {},         /* seen[gameId] = true，是否看过该游戏的新手引导 */
    plays: {},        /* plays[gameId] = 游玩次数 */
    last: null        /* 最后玩过的 gameId，用于大厅做「继续游戏」 */
  };

  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  function load(){
    var d = clone(DEFAULTS);
    try{
      var raw = localStorage.getItem(KEY);
      if(raw){
        var o = JSON.parse(raw);
        /* 先恢复内置字段 */
        for(var k in d){ if(o && o[k] !== undefined) d[k] = o[k]; }
        /* 再恢复各游戏自己塞进来的自定义键，否则它们的存档重载后会丢 */
        if(o && typeof o === 'object'){
          for(var k2 in o){ if(!(k2 in d)) d[k2] = o[k2]; }
        }
        if(!d.best || typeof d.best !== 'object') d.best = {};
        if(!d.seen || typeof d.seen !== 'object') d.seen = {};
        if(!d.plays || typeof d.plays !== 'object') d.plays = {};
      }else{
        migrate(d);
      }
    }catch(e){}
    return d;
  }

  function migrate(d){
    try{
      var raw = localStorage.getItem(LEGACY_KEY);
      if(!raw) return;
      var o = JSON.parse(raw);
      if(!o || typeof o !== 'object') return;
      if(typeof o.music === 'boolean') d.music = o.music;
      if(typeof o.sfx   === 'boolean') d.sfx   = o.sfx;
      if(typeof o.space === 'boolean') d.space = o.space;
      if(o.best && typeof o.best === 'object'){
        d.best.lastcell = {};
        for(var k in o.best){
          /* 旧键：normal / hard / easy / normal:daily */
          var key = k.replace(':daily', '-daily');
          d.best.lastcell[key] = o.best[k];
        }
      }
      if(o.seenGuide) d.seen.lastcell = true;
    }catch(e){}
  }

  var data = load();
  var saveTimer = null;

  function saveNow(){
    try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){}
  }
  function save(){
    if(saveTimer) return;
    saveTimer = setTimeout(function(){ saveTimer = null; saveNow(); }, 60);
  }
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', function(){ if(document.hidden) saveNow(); });

  window.Store = {
    all: function(){ return data; },

    get: function(k, dft){ return data[k] === undefined ? dft : data[k]; },
    /* 立刻落盘：存档数据不能等防抖，否则刚存的进度可能丢 */
    set: function(k, v){ data[k] = v; saveNow(); },

    /* 最高纪录：不带 sub 时返回该游戏所有子项里的最大值 */
    best: function(gameId, sub){
      var b = data.best[gameId] || {};
      if(sub !== undefined) return b[sub] || 0;
      var max = 0;
      for(var k in b){ if(b[k] > max) max = b[k]; }
      return max;
    },
    bestRaw: function(gameId){ return data.best[gameId] || {}; },
    setBest: function(gameId, sub, val){
      if(!data.best[gameId]) data.best[gameId] = {};
      var prev = data.best[gameId][sub] || 0;
      if(val > prev){ data.best[gameId][sub] = val; saveNow(); return true; }
      return false;
    },

    seen: function(gameId){ return !!data.seen[gameId]; },
    markSeen: function(gameId){ data.seen[gameId] = true; save(); },

    play: function(gameId){
      data.plays[gameId] = (data.plays[gameId] || 0) + 1;
      data.last = gameId;
      saveNow();
    },
    plays: function(gameId){ return data.plays[gameId] || 0; }
  };
})();
