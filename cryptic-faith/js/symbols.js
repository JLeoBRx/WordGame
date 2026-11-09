/*
 * Cryptic Faith — símbolos da cifra.
 *
 * 27 glifos desenhados em SVG (um para cada letra do alfabeto da cifra).
 * São vetoriais e não dependem de fontes, então aparecem iguais em
 * qualquer aparelho. Foram escolhidos para não parecerem letras latinas.
 */
(function (root) {
  'use strict';
  root.CF = root.CF || {};

  var DOT = ' fill="currentColor" stroke="none"';

  var GLYPHS = [
    { name: 'sol', svg: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"' + DOT + '/>' },
    { name: 'triângulo', svg: '<path d="M12 4 L20.5 19 H3.5 Z"/>' },
    { name: 'triângulo invertido', svg: '<path d="M3.5 5 H20.5 L12 20 Z"/><circle cx="12" cy="10" r="1.9"' + DOT + '/>' },
    { name: 'quadrado', svg: '<rect x="5" y="5" width="14" height="14" rx="1.2"/>' },
    { name: 'losango', svg: '<path d="M12 3 L21 12 L12 21 L3 12 Z"/>' },
    { name: 'coroa', svg: '<path d="M4 18.5 V8 L8.5 12.5 L12 5.5 L15.5 12.5 L20 8 V18.5 Z"/>' },
    { name: 'ampulheta', svg: '<path d="M6 4 H18 L6 20 H18 Z"/>' },
    { name: 'três barras', svg: '<path d="M7 5 V19 M12 5 V19 M17 5 V19"/>' },
    { name: 'setas duplas', svg: '<path d="M5 12 L12 5 L19 12 M5 19 L12 12 L19 19"/>' },
    { name: 'estrela', svg: '<path d="M12 3 L14.2 9.8 L21 12 L14.2 14.2 L12 21 L9.8 14.2 L3 12 L9.8 9.8 Z"/>' },
    { name: 'arco', svg: '<path d="M5 20 V12 A7 7 0 0 1 19 12 V20"/><circle cx="12" cy="14" r="1.9"' + DOT + '/>' },
    { name: 'raio', svg: '<path d="M14.5 3 L8 12.5 H16 L9.5 21"/>' },
    { name: 'ondas', svg: '<path d="M3 9 Q7.5 4 12 9 T21 9 M3 16 Q7.5 11 12 16 T21 16"/>' },
    { name: 'quadrado cortado', svg: '<rect x="5" y="5" width="14" height="14" rx="1.2"/><path d="M5 19 L19 5"/>' },
    { name: 'meia-lua', svg: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5 A7.5 7.5 0 0 1 12 19.5 Z"' + DOT + '/>' },
    { name: 'três pontos', svg: '<circle cx="12" cy="6.5" r="2.3"' + DOT + '/><circle cx="6.5" cy="16.5" r="2.3"' + DOT + '/><circle cx="17.5" cy="16.5" r="2.3"' + DOT + '/>' },
    { name: 'olho', svg: '<path d="M2.5 12 Q12 3.5 21.5 12 Q12 20.5 2.5 12 Z"/><circle cx="12" cy="12" r="2.3"' + DOT + '/>' },
    { name: 'seta', svg: '<path d="M12 20 V4.5 M6 10.5 L12 4.5 L18 10.5"/>' },
    { name: 'janela', svg: '<rect x="5" y="5" width="14" height="14" rx="1.2"/><path d="M12 5 V19 M5 12 H19"/>' },
    { name: 'laço', svg: '<path d="M4 6 L20 18 V6 L4 18 Z"/>' },
    { name: 'fechadura', svg: '<circle cx="12" cy="8.5" r="4"/><path d="M10.2 12 L8.5 20 H15.5 L13.8 12"/>' },
    { name: 'hexágono', svg: '<path d="M12 3 L19.8 7.5 V16.5 L12 21 L4.2 16.5 V7.5 Z"/>' },
    { name: 'livro', svg: '<path d="M12 7 V19.5 M12 7 C9.5 5 6 4.5 3.5 5.5 V18 C6 17 9.5 17.5 12 19.5 C14.5 17.5 18 17 20.5 18 V5.5 C18 4.5 14.5 5 12 7 Z"/>' },
    { name: 'infinito', svg: '<path d="M12 12 C9.5 8 4 8 4 12 C4 16 9.5 16 12 12 C14.5 8 20 8 20 12 C20 16 14.5 16 12 12 Z"/>' },
    { name: 'escada', svg: '<path d="M4 20 V15 H9 V10 H14 V5 H20"/>' },
    { name: 'gota', svg: '<path d="M12 3.5 C15.5 8.5 18 11.5 18 15 A6 6 0 0 1 6 15 C6 11.5 8.5 8.5 12 3.5 Z"/>' },
    { name: 'montanha', svg: '<path d="M3 19 L9 8.5 L13 15 L16 10.5 L21 19 Z"/>' }
  ];

  function glyphSVG(id, className) {
    var g = GLYPHS[id];
    if (!g) return '';
    return '<svg class="' + (className || 'glyph') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"' +
      ' fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
      g.svg + '</svg>';
  }

  root.CF.Symbols = {
    count: GLYPHS.length,
    list: GLYPHS,
    name: function (id) {
      return GLYPHS[id] ? GLYPHS[id].name : '';
    },
    svg: glyphSVG
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
