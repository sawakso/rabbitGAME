/* ============================================================
   Bunny —— 纯 SVG 手绘的兔子角色，全站共用
   用法：Bunny.svg('happy', 'res')  → 返回一段 SVG 字符串
   心情：idle / happy / worry / sad
   ============================================================ */
(function(){
  'use strict';

  var EARS =
    '<ellipse cx="-7.5" cy="-25" rx="4.6" ry="13.5" transform="rotate(-11 -7.5 -25)" fill="#FFF7EE" stroke="#E8D5C2" stroke-width="1.4"/>' +
    '<ellipse cx="-7.5" cy="-24.5" rx="2.1" ry="8.6" transform="rotate(-11 -7.5 -24.5)" fill="#F7C6CE"/>' +
    '<ellipse cx="7.5" cy="-25" rx="4.6" ry="13.5" transform="rotate(11 7.5 -25)" fill="#FFF7EE" stroke="#E8D5C2" stroke-width="1.4"/>' +
    '<ellipse cx="7.5" cy="-24.5" rx="2.1" ry="8.6" transform="rotate(11 7.5 -24.5)" fill="#F7C6CE"/>';

  var FACES = {
    idle:
      '<circle cx="-8" cy="0" r="3.1" fill="#5A4B42"/><circle cx="8" cy="0" r="3.1" fill="#5A4B42"/>' +
      '<circle cx="-6.9" cy="-1.2" r="1.05" fill="#fff"/><circle cx="9.1" cy="-1.2" r="1.05" fill="#fff"/>' +
      '<path d="M-3.4 7.4 q3.4 3.6 6.8 0" fill="none" stroke="#B98591" stroke-width="1.7" stroke-linecap="round"/>',
    happy:
      '<path d="M-11.5 0 q3.4 -5 6.8 0" fill="none" stroke="#5A4B42" stroke-width="2.1" stroke-linecap="round"/>' +
      '<path d="M4.7 0 q3.4 -5 6.8 0" fill="none" stroke="#5A4B42" stroke-width="2.1" stroke-linecap="round"/>' +
      '<path d="M-3.6 7.2 q3.6 4.4 7.2 0" fill="none" stroke="#B98591" stroke-width="1.7" stroke-linecap="round"/>',
    worry:
      '<circle cx="-8" cy="0" r="3.4" fill="none" stroke="#5A4B42" stroke-width="1.9"/>' +
      '<circle cx="8" cy="0" r="3.4" fill="none" stroke="#5A4B42" stroke-width="1.9"/>' +
      '<circle cx="-8" cy="0" r="1.3" fill="#5A4B42"/><circle cx="8" cy="0" r="1.3" fill="#5A4B42"/>' +
      '<path d="M-3.4 8 q3.4 -3 6.8 0" fill="none" stroke="#B98591" stroke-width="1.7" stroke-linecap="round"/>',
    sad:
      '<path d="M-11.5 1.5 q3.4 5 6.8 0" fill="none" stroke="#5A4B42" stroke-width="2.1" stroke-linecap="round"/>' +
      '<path d="M4.7 1.5 q3.4 5 6.8 0" fill="none" stroke="#5A4B42" stroke-width="2.1" stroke-linecap="round"/>' +
      '<path d="M3 4 q1 5 2.4 6.4" fill="none" stroke="#9ED0E4" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M-3.4 8 q3.4 -3 6.8 0" fill="none" stroke="#B98591" stroke-width="1.7" stroke-linecap="round"/>'
  };

  window.Bunny = {
    svg: function(mood, uid){
      var face = FACES[mood] || FACES.idle;
      return '<svg viewBox="-24 -42 48 58" xmlns="http://www.w3.org/2000/svg" class="bunH">' +
        '<g id="bun-' + (uid || 'x') + '">' +
          EARS +
          '<circle cx="0" cy="0" r="16" fill="#FFF9F2" stroke="#E8D5C2" stroke-width="1.5"/>' +
          '<ellipse cx="-10" cy="5.2" rx="3.6" ry="2.3" fill="#F9C8D0" opacity=".82"/>' +
          '<ellipse cx="10" cy="5.2" rx="3.6" ry="2.3" fill="#F9C8D0" opacity=".82"/>' +
          face +
          '<ellipse cx="0" cy="3.4" rx="1.9" ry="1.4" fill="#E9A0AC"/>' +
        '</g></svg>';
    },
    /* 只画头，用于卡片上的小图标 */
    head: function(uid, size){
      var s = size || 40;
      return '<svg viewBox="-20 -30 40 40" width="' + s + '" height="' + s + '" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="-6.5" cy="-22" rx="4" ry="11.5" transform="rotate(-11 -6.5 -22)" fill="#FFF7EE" stroke="#E8D5C2" stroke-width="1.3"/>' +
        '<ellipse cx="6.5" cy="-22" rx="4" ry="11.5" transform="rotate(11 6.5 -22)" fill="#FFF7EE" stroke="#E8D5C2" stroke-width="1.3"/>' +
        '<circle cx="0" cy="0" r="14" fill="#FFF9F2" stroke="#E8D5C2" stroke-width="1.4"/>' +
        '<ellipse cx="-8.6" cy="4.6" rx="3.2" ry="2" fill="#F9C8D0" opacity=".85"/>' +
        '<ellipse cx="8.6" cy="4.6" rx="3.2" ry="2" fill="#F9C8D0" opacity=".85"/>' +
        '<circle cx="-7" cy="0" r="2.7" fill="#5A4B42"/><circle cx="7" cy="0" r="2.7" fill="#5A4B42"/>' +
        '<circle cx="-6" cy="-1" r=".95" fill="#fff"/><circle cx="8" cy="-1" r=".95" fill="#fff"/>' +
        '<ellipse cx="0" cy="3" rx="1.7" ry="1.2" fill="#E9A0AC"/>' +
        '<path d="M-3 6.6 q3 3.2 6 0" fill="none" stroke="#B98591" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>';
    }
  };
})();
