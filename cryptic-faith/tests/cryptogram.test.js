/*
 * Testes do motor do criptograma.
 *
 * Rodam no navegador (abra tests/index.html) e também no Node, se houver:
 *   node tests/cryptogram.test.js
 */
(function (root) {
  'use strict';

  var isNode = typeof module === 'object' && typeof require === 'function';
  if (isNode) {
    require('../js/cryptogram.js');
    require('../js/levels.js');
  }

  var C = root.CF.Cryptogram;
  var LEVEL = root.CF.LEVELS[0];
  var results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: name, ok: true });
    } catch (err) {
      results.push({ name: name, ok: false, error: err && err.message ? err.message : String(err) });
    }
  }
  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'condição falsa');
  }
  function eq(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error((msg ? msg + ': ' : '') + 'esperado ' + JSON.stringify(expected) + ', obtido ' + JSON.stringify(actual));
    }
  }

  function newPuzzle(seed, extra) {
    var opts = {
      text: LEVEL.phrase,
      revealed: LEVEL.revealed,
      maxErrors: LEVEL.maxErrors,
      hints: LEVEL.hints,
      rng: C.seededRandom(seed || 1)
    };
    for (var k in extra || {}) opts[k] = extra[k];
    return new C.Puzzle(opts);
  }

  function wrongLetterFor(puzzle, symbol) {
    // Uma letra que não é a resposta do símbolo e não está descoberta em outro lugar.
    var answer = puzzle.letterForSymbol(symbol);
    for (var i = 0; i < C.ALPHABET.length; i++) {
      var l = C.ALPHABET[i];
      if (l !== answer && puzzle.symbolHoldingLetter(l, ['given', 'correct']) === null &&
          !(puzzle.tried[symbol] && puzzle.tried[symbol][l])) {
        return l;
      }
    }
    throw new Error('nenhuma letra errada disponível');
  }

  /* ---------------- Letras e acentos ---------------- */

  test('toBaseLetter trata acentos e cedilha', function () {
    eq(C.toBaseLetter('Ê'), 'E');
    eq(C.toBaseLetter('ê'), 'E');
    eq(C.toBaseLetter('Ã'), 'A');
    eq(C.toBaseLetter('á'), 'A');
    eq(C.toBaseLetter('Ô'), 'O');
    eq(C.toBaseLetter('ü'), 'U');
    eq(C.toBaseLetter('Ç'), 'Ç');
    eq(C.toBaseLetter('ç'), 'Ç');
    eq(C.toBaseLetter('a'), 'A');
    eq(C.toBaseLetter(','), null);
    eq(C.toBaseLetter('.'), null);
    eq(C.toBaseLetter(' '), null);
    eq(C.toBaseLetter('7'), null);
    eq(C.toBaseLetter(''), null);
  });

  test('alfabeto da cifra tem 27 letras (A–Z + Ç)', function () {
    eq(C.ALPHABET.length, 27);
    assert(C.ALPHABET.indexOf('Ç') !== -1, 'Ç ausente');
  });

  /* ---------------- Frase ---------------- */

  test('a frase é dividida preservando espaços e pontuação', function () {
    var parsed = C.parsePhrase(LEVEL.phrase);
    var letters = parsed.cells.filter(function (c) { return c.type === 'letter'; });
    var punct = parsed.cells.filter(function (c) { return c.type === 'punct'; });
    var spaces = parsed.cells.filter(function (c) { return c.type === 'space'; });
    eq(letters.length, 36, 'letras');
    eq(punct.map(function (c) { return c.char; }).join(''), ',.', 'pontuação');
    eq(spaces.length, 8, 'espaços');
    eq(parsed.words.length, 9, 'palavras');
    eq(parsed.cells.map(function (c) { return c.char; }).join(''), LEVEL.phrase, 'reconstrução');
  });

  test('a vírgula e o ponto ficam colados às palavras certas', function () {
    var parsed = C.parsePhrase(LEVEL.phrase);
    var words = parsed.words.map(function (w) {
      return w.map(function (i) { return parsed.cells[i].char; }).join('');
    });
    eq(words.join('|'), 'VOCÊ|FOI|CRIADO|POR|AMOR,|PARA|VIVER|COM|DEUS.');
  });

  /* ---------------- Cifra ---------------- */

  test('a cifra é uma bijeção (letras diferentes nunca compartilham símbolo)', function () {
    for (var seed = 1; seed <= 200; seed++) {
      var cipher = C.createCipher(27, C.seededRandom(seed));
      var seen = {};
      C.ALPHABET.forEach(function (letter) {
        var sym = cipher[letter];
        assert(sym >= 0 && sym < 27, 'símbolo fora do intervalo');
        assert(!seen[sym], 'símbolo repetido na semente ' + seed);
        seen[sym] = letter;
      });
    }
  });

  test('a mesma letra recebe sempre o mesmo símbolo em toda a frase', function () {
    var p = newPuzzle(7);
    var bySymbol = {};
    var byLetter = {};
    p.cells.forEach(function (cell) {
      if (cell.type !== 'letter') return;
      if (byLetter[cell.base] != null) eq(cell.symbol, byLetter[cell.base], 'letra ' + cell.base);
      byLetter[cell.base] = cell.symbol;
      if (bySymbol[cell.symbol] != null) eq(cell.base, bySymbol[cell.symbol], 'símbolo ' + cell.symbol);
      bySymbol[cell.symbol] = cell.base;
    });
    eq(p.symbols.length, 13, 'símbolos distintos na frase');
  });

  test('Ê usa o mesmo símbolo de E', function () {
    var p = newPuzzle(3);
    var eCircumflex = p.cells.filter(function (c) { return c.char === 'Ê'; })[0];
    var plainE = p.cells.filter(function (c) { return c.char === 'E'; });
    assert(eCircumflex, 'Ê não encontrado');
    eq(plainE.length, 2, 'quantidade de E');
    plainE.forEach(function (c) { eq(c.symbol, eCircumflex.symbol); });
  });

  test('cifras diferentes a cada partida (aleatoriedade)', function () {
    var a = newPuzzle(11).cipher;
    var b = newPuzzle(12).cipher;
    var differs = C.ALPHABET.some(function (l) { return a[l] !== b[l]; });
    assert(differs, 'as cifras deveriam variar');
  });

  /* ---------------- Partida ---------------- */

  test('letras reveladas no início aparecem em todas as posições', function () {
    var p = newPuzzle(5);
    eq(p.currentText(), '_O__ _O_ ___A_O _O_ A_O_, _A_A _____ _O_ ____.');
    eq(p.keyState('O'), 'given');
    eq(p.keyState('A'), 'given');
    eq(p.status, 'playing');
  });

  test('acertar uma letra preenche todas as posições do símbolo', function () {
    var p = newPuzzle(5);
    var symR = p.symbolForLetter('R');
    var res = p.guess(symR, 'r');
    eq(res.type, 'correct');
    eq(res.errors, 0);
    eq(p.currentText(), '_O__ _O_ _R_A_O _OR A_OR, _ARA ____R _O_ ____.');
    eq(p.keyState('R'), 'correct');
  });

  test('digitar E revela Ê com acento', function () {
    var p = newPuzzle(5);
    var symE = p.symbolForLetter('E');
    eq(p.symbolForLetter('Ê'), symE, 'Ê e E');
    eq(p.guess(symE, 'E').type, 'correct');
    eq(p.currentText(), '_O_Ê _O_ ___A_O _O_ A_O_, _A_A ___E_ _O_ _E__.');
    var cellE = p.cells.filter(function (c) { return c.char === 'Ê'; })[0];
    eq(p.cellView(cellE.index).text, 'Ê');
  });

  test('digitar ê (com acento) também é aceito como E', function () {
    var p = newPuzzle(9);
    eq(p.guess(p.symbolForLetter('E'), 'ê').type, 'correct');
  });

  test('erro conta tentativa, marca a letra em vermelho e pode ser corrigido', function () {
    var p = newPuzzle(5);
    var symV = p.symbolForLetter('V');
    var res = p.guess(symV, 'B');
    eq(res.type, 'wrong');
    eq(p.errors, 1);
    var vCell = p.cellsForSymbol(symV)[0];
    eq(p.cellView(vCell).status, 'wrong');
    eq(p.cellView(vCell).text, 'B');
    eq(p.keyState('B', symV), 'wrong', 'tecla errada no símbolo selecionado');
    eq(p.keyState('B', p.symbolForLetter('C')), 'available', 'tecla em outro símbolo');
    // repetir o mesmo erro não conta de novo
    eq(p.guess(symV, 'B').type, 'repeat-wrong');
    eq(p.errors, 1);
    // corrigir sobrescrevendo
    eq(p.guess(symV, 'V').type, 'correct');
    eq(p.cellView(vCell).status, 'correct');
    eq(p.cellView(vCell).text, 'V');
  });

  test('apagar remove apenas respostas erradas', function () {
    var p = newPuzzle(5);
    var symD = p.symbolForLetter('D');
    p.guess(symD, 'T');
    eq(p.erase(symD).type, 'erased');
    eq(p.cellView(p.cellsForSymbol(symD)[0]).status, 'empty');
    eq(p.erase(symD).type, 'empty');
    eq(p.erase(p.symbolForLetter('O')).type, 'locked', 'letra revelada é travada');
    eq(p.errors, 1, 'apagar não devolve tentativa');
  });

  test('limpar resposta remove todas as letras erradas', function () {
    var p = newPuzzle(5);
    p.guess(p.symbolForLetter('D'), 'T');
    p.guess(p.symbolForLetter('U'), 'N');
    p.guess(p.symbolForLetter('R'), 'R');
    eq(p.wrongSymbols().length, 2);
    var cleared = p.clearWrong();
    eq(cleared.length, 2);
    eq(p.wrongSymbols().length, 0);
    eq(p.keyState('R'), 'correct', 'acertos permanecem');
  });

  test('uma letra não ocupa dois símbolos ao mesmo tempo', function () {
    var p = newPuzzle(5);
    var symD = p.symbolForLetter('D');
    var symU = p.symbolForLetter('U');
    p.guess(symD, 'S'); // errado
    eq(p.entries[symD].letter, 'S');
    p.guess(symU, 'S'); // errado também, S sai de D
    assert(!p.entries[symD], 'S deveria sair do símbolo de D');
    eq(p.entries[symU].letter, 'S');
    // acertando S no lugar certo, a tentativa errada é limpa
    var res = p.guess(p.symbolForLetter('S'), 'S');
    eq(res.type, 'correct');
    assert(res.cleared.indexOf(symU) !== -1, 'S errado deveria ser limpo');
  });

  test('letra já descoberta em outro símbolo não conta erro', function () {
    var p = newPuzzle(5);
    var res = p.guess(p.symbolForLetter('V'), 'O');
    eq(res.type, 'already-used');
    eq(p.errors, 0);
  });

  test('símbolo resolvido fica travado', function () {
    var p = newPuzzle(5);
    eq(p.guess(p.symbolForLetter('O'), 'M').type, 'locked');
    eq(p.errors, 0);
  });

  test('terceiro erro encerra a fase e bloqueia novas entradas', function () {
    var p = newPuzzle(5);
    var syms = ['V', 'C', 'F'].map(function (l) { return p.symbolForLetter(l); });
    syms.forEach(function (sym) { p.guess(sym, wrongLetterFor(p, sym)); });
    eq(p.errors, 3);
    eq(p.status, 'lost');
    var symR = p.symbolForLetter('R');
    eq(p.guess(symR, 'R').type, 'blocked');
    eq(p.erase(syms[0]).type, 'blocked');
    eq(p.clearWrong().length, 0);
    eq(p.useHint().type, 'blocked');
    eq(p.keyState('R'), 'available', 'nada foi revelado após a derrota');
  });

  test('completar toda a frase vence a fase', function () {
    var p = newPuzzle(21);
    var last;
    p.symbols.forEach(function (sym) {
      if (!p.isSymbolSolved(sym)) last = p.guess(sym, p.letterForSymbol(sym));
    });
    eq(last.status, 'won');
    eq(p.status, 'won');
    eq(p.currentText(), LEVEL.phrase);
    eq(p.progress().ratio, 1);
    eq(p.guess(p.symbols[0], 'Z').type, 'blocked', 'após vencer não aceita entradas');
  });

  test('vencer com 2 erros ainda é vitória', function () {
    var p = newPuzzle(22);
    var symV = p.symbolForLetter('V');
    p.guess(symV, wrongLetterFor(p, symV));
    p.guess(symV, wrongLetterFor(p, symV));
    eq(p.errors, 2);
    p.symbols.forEach(function (sym) {
      if (!p.isSymbolSolved(sym)) p.guess(sym, p.letterForSymbol(sym));
    });
    eq(p.status, 'won');
  });

  test('a fase só termina quando toda a frase está correta', function () {
    var p = newPuzzle(23);
    var open = p.symbols.filter(function (s) { return !p.isSymbolSolved(s); });
    open.slice(0, -1).forEach(function (sym) { p.guess(sym, p.letterForSymbol(sym)); });
    eq(p.status, 'playing');
    var lastSym = open[open.length - 1];
    p.guess(lastSym, wrongLetterFor(p, lastSym));
    eq(p.status, 'playing', 'letra errada não conclui');
    p.guess(lastSym, p.letterForSymbol(lastSym));
    eq(p.status, 'won');
  });

  test('progresso conta letras resolvidas', function () {
    var p = newPuzzle(5);
    var prog = p.progress();
    eq(prog.totalLetters, 36);
    eq(prog.solvedLetters, 10, 'O(6) + A(4)');
    p.guess(p.symbolForLetter('R'), 'R');
    eq(p.progress().solvedLetters, 15, '+ R(5)');
  });

  test('dica revela um símbolo sem contar erro', function () {
    var p = newPuzzle(5);
    var symM = p.symbolForLetter('M');
    var res = p.useHint(symM);
    eq(res.type, 'hint');
    eq(res.letter, 'M');
    eq(p.hintsLeft, 1);
    eq(p.errors, 0);
    eq(p.keyState('M'), 'correct');
    var res2 = p.useHint(symM); // já resolvido: revela o próximo aberto
    eq(res2.type, 'hint');
    assert(res2.symbol !== symM, 'deveria revelar outro símbolo');
    eq(p.useHint().type, 'no-hints');
  });

  test('navegação pelas células abertas dá a volta na frase', function () {
    var p = newPuzzle(5);
    var first = p.firstOpenCell();
    eq(first, 0, 'V de VOCÊ');
    var prev = p.nextOpenCell(first, -1);
    eq(p.cells[prev].char, 'S', 'volta para o S de DEUS');
    var next = p.nextOpenCell(first, 1);
    eq(p.cells[next].char, 'C', 'C de VOCÊ (O está revelado)');
  });

  test('Ç é uma letra própria, diferente de C', function () {
    var p = new C.Puzzle({ text: 'CORAÇÃO E CÉU', rng: C.seededRandom(4), maxErrors: 3 });
    var symC = p.symbolForLetter('C');
    var symCed = p.symbolForLetter('Ç');
    assert(symC !== symCed, 'C e Ç deveriam ter símbolos diferentes');
    eq(p.guess(symCed, 'C').type, 'wrong', 'C não resolve Ç');
    eq(p.guess(symCed, 'ç').type, 'correct');
    eq(p.guess(p.symbolForLetter('A'), 'A').type, 'correct');
    eq(p.currentText(), '___AÇÃ_ _ ___', 'Ã revelado com til');
    eq(p.guess(symC, 'C').type, 'correct');
    eq(p.guess(p.symbolForLetter('E'), 'E').type, 'correct');
    eq(p.currentText(), 'C__AÇÃ_ E CÉ_', 'É revelado com acento');
  });

  test('reiniciar gera nova partida limpa', function () {
    var p = newPuzzle(5);
    p.guess(p.symbolForLetter('R'), 'X');
    p.reset(LEVEL.revealed);
    eq(p.errors, 0);
    eq(p.status, 'playing');
    eq(p.hintsLeft, LEVEL.hints);
    eq(p.progress().solvedLetters, 10);
  });

  /* ---------------- Conteúdo ---------------- */

  test('frase do desafio está correta', function () {
    eq(LEVEL.phrase, 'VOCÊ FOI CRIADO POR AMOR, PARA VIVER COM DEUS.');
  });

  test('texto do Catecismo §1 está íntegro', function () {
    var expected = 'Deus, infinitamente perfeito e bem-aventurado em Si mesmo, num desígnio de pura bondade, criou livremente o homem para o tornar participante da sua vida bem-aventurada. Por isso, sempre e em toda a parte, Ele está próximo do homem. Chama-o e ajuda-o a procurá-Lo, a conhecê-Lo e a amá-Lo com todas as suas forças. Convoca todos os homens, dispersos pelo pecado, para a unidade da sua família que é a Igreja. Para tal, enviou o seu Filho como Redentor e Salvador na plenitude dos tempos. N\'Ele e por Ele, chama os homens a tornarem-se, no Espírito Santo, seus filhos adoptivos e, portanto, herdeiros da sua vida bem-aventurada.';
    eq(LEVEL.catechism.text, expected);
    eq(LEVEL.catechism.reference, 'Catecismo da Igreja Católica, §1');
  });

  test('pergunta de reflexão está correta', function () {
    eq(LEVEL.reflection, 'Se Deus nos criou por amor, como podemos responder a esse amor no nosso dia a dia?');
  });

  /* ---------------- Saída ---------------- */

  root.CF_TEST_RESULTS = results;

  if (isNode) {
    var failed = results.filter(function (r) { return !r.ok; });
    results.forEach(function (r) {
      console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.ok ? '' : '\n      ' + r.error));
    });
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' testes passaram.');
    if (failed.length) process.exitCode = 1;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
