/* ============================================================
   Theme DOM —— 注入共用的暖色黄昏背景
   在 <head> 里 <script src=".../shared/theme.js"></script>
   页面 body 里不用写任何背景标签。
   ============================================================ */
(function(){
  'use strict';

  function build(){
    if(document.querySelector('.bg')) return;

    var bg = document.createElement('div');
    bg.className = 'bg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML =
      '<div class="sun"></div>' +
      '<div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>' +
      '<div class="motes"></div>' +
      '<svg class="hills" viewBox="0 0 400 170" preserveAspectRatio="none" style="height:34%">' +
        '<path d="M0,92 C46,56 84,70 124,52 C168,32 200,62 242,48 C288,32 328,58 400,42 L400,170 L0,170 Z" fill="#E4C39F"/>' +
        '<path d="M0,116 C54,92 100,108 146,90 C196,70 238,100 288,88 C334,78 366,94 400,82 L400,170 L0,170 Z" fill="#D9B189" opacity=".92"/>' +
        '<path d="M0,142 C60,124 110,138 162,124 C216,110 262,132 320,122 C356,116 380,124 400,118 L400,170 L0,170 Z" fill="#CB9F76"/>' +
        '<g fill="#C1916A" opacity=".55">' +
          '<path d="M52,126 l9,-24 l9,24 z M44,126 l17,-38 l17,38 z"/>' +
          '<path d="M292,132 l7,-19 l7,19 z M285,132 l14,-30 l14,30 z"/>' +
          '<path d="M188,124 l6,-16 l6,16 z M182,124 l12,-26 l12,26 z"/>' +
        '</g>' +
      '</svg>';

    /* 漂浮光点 */
    var motes = bg.querySelector('.motes');
    var html = '';
    for(var i = 0; i < 16; i++){
      var size = 2 + Math.random() * 4;
      html += '<span class="mote" style="width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) +
              'px;left:' + (Math.random() * 100).toFixed(2) + '%;bottom:-8vh;' +
              'animation-duration:' + (16 + Math.random() * 16).toFixed(1) + 's;' +
              'animation-delay:-' + (Math.random() * 20).toFixed(1) + 's"></span>';
    }
    motes.innerHTML = html;

    document.body.insertBefore(bg, document.body.firstChild);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', build);
  }else{
    build();
  }
})();
