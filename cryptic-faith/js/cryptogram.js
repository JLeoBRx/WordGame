/*
 * Cryptic Faith — motor do criptograma.
 *
 * Este arquivo não depende do DOM: contém apenas a lógica da cifra por
 * substituição e o estado de uma partida. Funciona no navegador (expõe
 * `CF.Cryptogram`) e também pode ser carregado em testes automatizados.
 *
 * Regras de letras:
 *  - O alfabeto da cifra tem 27 letras: A–Z e Ç.
 *  - Vogais acentuadas (Á, À, Â, Ã, É, Ê, Í, Ó, Ô, Õ, Ú, Ü) usam o mesmo
 *    símbolo da letra base. O jogador digita "E" e as posições com "Ê"
 *    são reveladas com o acento original.
 *  - Ç é uma letra própria, com símbolo próprio e tecla própria.
 *  - Espaços e pontuação são preservados e nunca são cifrados.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.CF = root.CF || {};
  root.CF.Cryptogram = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat('Ç');

  /**
   * Converte um caractere qualquer na letra-base da cifra.
   * Retorna null quando não é uma letra do alfabeto da cifra.
   *   'ê' -> 'E', 'Ã' -> 'A', 'ç' -> 'Ç', ',' -> null
   */
  function toBaseLetter(ch) {
    if (typeof ch !== 'string' || ch.length === 0) return null;
    var up = ch.toUpperCase();
    if (up === 'Ç') return 'Ç';
    // Remove diacríticos (Ê -> E + U+0302 -> E).
    var stripped = up.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (stripped.length !== 1) return null;
    return ALPHABET.indexOf(stripped) !== -1 ? stripped : null;
  }

  /** Gerador pseudoaleatório com semente (usado nos testes). */
  function seededRandom(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Gera uma cifra de substituição completa: cada letra do alfabeto recebe
   * um símbolo diferente (bijeção). `symbolCount` precisa ser >= 27.
   * Retorna um objeto { 'A': 12, 'B': 3, ... }.
   */
  function createCipher(symbolCount, rng) {
    if (symbolCount < ALPHABET.length) {
      throw new Error('São necessários pelo menos ' + ALPHABET.length + ' símbolos.');
    }
    var pool = [];
    for (var i = 0; i < symbolCount; i++) pool.push(i);
    pool = shuffle(pool, rng || Math.random);
    var cipher = {};
    ALPHABET.forEach(function (letter, idx) {
      cipher[letter] = pool[idx];
    });
    return cipher;
  }

  /**
   * Divide a frase em células. Cada caractere vira uma célula:
   *   { index, char, type: 'letter' | 'punct' | 'space', base }
   * `words` agrupa os índices das células de cada palavra (com a
   * pontuação colada a ela), para que a interface nunca quebre uma palavra
   * no meio.
   */
  function parsePhrase(text) {
    var cells = [];
    var words = [];
    var current = null;
    Array.from(text).forEach(function (ch) {
      var index = cells.length;
      if (/\s/.test(ch)) {
        cells.push({ index: index, char: ch, type: 'space', base: null });
        current = null;
        return;
      }
      var base = toBaseLetter(ch);
      cells.push({
        index: index,
        char: ch,
        type: base ? 'letter' : 'punct',
        base: base
      });
      if (!current) {
        current = [];
        words.push(current);
      }
      current.push(index);
    });
    return { cells: cells, words: words };
  }

  /* ------------------------------------------------------------------ */
  /* Partida                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * options:
   *   text         frase a ser descoberta (obrigatório)
   *   revealed     letras já reveladas no início, ex.: ['O', 'A']
   *   maxErrors    erros permitidos (padrão 3)
   *   hints        dicas disponíveis (padrão 0)
   *   symbolCount  quantidade de símbolos disponíveis (padrão 27)
   *   rng          função aleatória (padrão Math.random)
   */
  function Puzzle(options) {
    if (!options || typeof options.text !== 'string' || !options.text.trim()) {
      throw new Error('A frase do desafio é obrigatória.');
    }
    var rng = options.rng || Math.random;
    var parsed = parsePhrase(options.text);

    this.text = options.text;
    this.maxErrors = options.maxErrors != null ? options.maxErrors : 3;
    this.hintsTotal = options.hints != null ? options.hints : 0;
    this.cipher = createCipher(options.symbolCount || ALPHABET.length, rng);
    this.cells = parsed.cells;
    this.words = parsed.words;

    this.solution = {}; // símbolo -> letra-base
    this.symbols = []; // símbolos usados na frase, na ordem em que aparecem
    this.letterCells = []; // índices das células que são letras

    var self = this;
    this.cells.forEach(function (cell) {
      if (cell.type !== 'letter') return;
      cell.symbol = self.cipher[cell.base];
      self.solution[cell.symbol] = cell.base;
      self.letterCells.push(cell.index);
      if (self.symbols.indexOf(cell.symbol) === -1) self.symbols.push(cell.symbol);
    });

    this.reset(options.revealed || []);
  }

  Puzzle.prototype.reset = function (revealed) {
    var self = this;
    this.entries = {}; // símbolo -> { letter, status: 'given' | 'correct' | 'wrong', hinted }
    this.tried = {}; // símbolo -> { letra: true } (tentativas erradas)
    this.errors = 0;
    this.hintsLeft = this.hintsTotal;
    this.hintsUsed = 0;
    this.status = 'playing';
    this.revealedLetters = [];
    (revealed || []).forEach(function (raw) {
      var base = toBaseLetter(raw);
      if (!base) return;
      var sym = self.cipher[base];
      if (self.solution[sym] === base) {
        self.entries[sym] = { letter: base, status: 'given' };
        self.revealedLetters.push(base);
      }
    });
    if (this.isSolved()) this.status = 'won';
  };

  Puzzle.prototype.letterForSymbol = function (symbol) {
    return this.solution[symbol] || null;
  };

  Puzzle.prototype.symbolForLetter = function (letter) {
    var base = toBaseLetter(letter);
    return base ? this.cipher[base] : null;
  };

  Puzzle.prototype.isSymbolSolved = function (symbol) {
    var entry = this.entries[symbol];
    return !!entry && (entry.status === 'given' || entry.status === 'correct');
  };

  Puzzle.prototype.isSolved = function () {
    var self = this;
    return this.symbols.every(function (sym) {
      return self.isSymbolSolved(sym);
    });
  };

  /** Símbolo em que a letra está colocada (qualquer estado), ou null. */
  Puzzle.prototype.symbolHoldingLetter = function (letter, statuses) {
    for (var key in this.entries) {
      if (!Object.prototype.hasOwnProperty.call(this.entries, key)) continue;
      var entry = this.entries[key];
      if (entry.letter === letter && (!statuses || statuses.indexOf(entry.status) !== -1)) {
        return Number(key);
      }
    }
    return null;
  };

  Puzzle.prototype._clearWrongHolding = function (letter, exceptSymbol) {
    var cleared = [];
    for (var key in this.entries) {
      if (!Object.prototype.hasOwnProperty.call(this.entries, key)) continue;
      var sym = Number(key);
      var entry = this.entries[key];
      if (sym !== exceptSymbol && entry.status === 'wrong' && entry.letter === letter) {
        delete this.entries[key];
        cleared.push(sym);
      }
    }
    return cleared;
  };

  Puzzle.prototype._finishIfSolved = function () {
    if (this.isSolved()) this.status = 'won';
  };

  /**
   * Tenta colocar `rawLetter` no `symbol`.
   * Retorna { type, symbol, letter, cleared, errors, status } onde type é:
   *   'correct'       a letra está certa e foi revelada em todas as posições
   *   'wrong'         a letra está errada: conta um erro
   *   'repeat-wrong'  essa letra já foi tentada (errada) nesse símbolo: sem novo erro
   *   'already-used'  a letra já foi descoberta em outro símbolo: sem novo erro
   *   'locked'        o símbolo já foi resolvido
   *   'invalid'       entrada não é uma letra do alfabeto ou símbolo inexistente
   *   'blocked'       a partida não está em andamento (vitória ou derrota)
   */
  Puzzle.prototype.guess = function (symbol, rawLetter) {
    var result = { type: 'invalid', symbol: symbol, letter: null, cleared: [] };
    if (this.status !== 'playing') {
      result.type = 'blocked';
      return this._withState(result);
    }
    var letter = toBaseLetter(rawLetter);
    result.letter = letter;
    if (!letter || !Object.prototype.hasOwnProperty.call(this.solution, symbol)) {
      return this._withState(result);
    }
    if (this.isSymbolSolved(symbol)) {
      result.type = 'locked';
      return this._withState(result);
    }
    if (this.symbolHoldingLetter(letter, ['given', 'correct']) !== null) {
      result.type = 'already-used';
      return this._withState(result);
    }
    var tried = this.tried[symbol] || (this.tried[symbol] = {});
    if (tried[letter]) {
      result.type = 'repeat-wrong';
      return this._withState(result);
    }

    if (this.solution[symbol] === letter) {
      result.cleared = this._clearWrongHolding(letter, symbol);
      this.entries[symbol] = { letter: letter, status: 'correct' };
      result.type = 'correct';
      this._finishIfSolved();
    } else {
      // Uma letra só pode ocupar um símbolo por vez.
      result.cleared = this._clearWrongHolding(letter, symbol);
      tried[letter] = true;
      this.entries[symbol] = { letter: letter, status: 'wrong' };
      this.errors += 1;
      result.type = 'wrong';
      if (this.errors >= this.maxErrors) this.status = 'lost';
    }
    return this._withState(result);
  };

  /** Apaga a resposta errada de um símbolo. Letras corretas ficam travadas. */
  Puzzle.prototype.erase = function (symbol) {
    if (this.status !== 'playing') return { type: 'blocked', symbol: symbol };
    var entry = this.entries[symbol];
    if (!entry) return { type: 'empty', symbol: symbol };
    if (entry.status !== 'wrong') return { type: 'locked', symbol: symbol };
    delete this.entries[symbol];
    return { type: 'erased', symbol: symbol, letter: entry.letter };
  };

  /** Limpa todas as respostas erradas da frase. Retorna os símbolos limpos. */
  Puzzle.prototype.clearWrong = function () {
    if (this.status !== 'playing') return [];
    var cleared = [];
    for (var key in this.entries) {
      if (!Object.prototype.hasOwnProperty.call(this.entries, key)) continue;
      if (this.entries[key].status === 'wrong') {
        delete this.entries[key];
        cleared.push(Number(key));
      }
    }
    return cleared;
  };

  Puzzle.prototype.wrongSymbols = function () {
    var list = [];
    for (var key in this.entries) {
      if (Object.prototype.hasOwnProperty.call(this.entries, key) && this.entries[key].status === 'wrong') {
        list.push(Number(key));
      }
    }
    return list;
  };

  /**
   * Usa uma dica: revela o símbolo indicado (ou o primeiro ainda não
   * resolvido, na ordem da frase). Não conta como erro.
   */
  Puzzle.prototype.useHint = function (symbol) {
    if (this.status !== 'playing') return { type: 'blocked' };
    if (this.hintsLeft <= 0) return { type: 'no-hints' };
    var target = symbol;
    if (target == null || !Object.prototype.hasOwnProperty.call(this.solution, target) || this.isSymbolSolved(target)) {
      target = null;
      for (var i = 0; i < this.symbols.length; i++) {
        if (!this.isSymbolSolved(this.symbols[i])) {
          target = this.symbols[i];
          break;
        }
      }
    }
    if (target == null) return { type: 'nothing' };
    var letter = this.solution[target];
    var cleared = this._clearWrongHolding(letter, target);
    this.entries[target] = { letter: letter, status: 'correct', hinted: true };
    this.hintsLeft -= 1;
    this.hintsUsed += 1;
    this._finishIfSolved();
    return this._withState({ type: 'hint', symbol: target, letter: letter, cleared: cleared });
  };

  Puzzle.prototype._withState = function (result) {
    result.errors = this.errors;
    result.status = this.status;
    return result;
  };

  /**
   * O que mostrar em uma célula:
   *   { text, status: 'empty' | 'given' | 'correct' | 'wrong' | 'punct' | 'space' }
   * Letras resolvidas mostram o caractere original (com acento).
   */
  Puzzle.prototype.cellView = function (index) {
    var cell = this.cells[index];
    if (!cell) return null;
    if (cell.type !== 'letter') return { text: cell.char, status: cell.type };
    var entry = this.entries[cell.symbol];
    if (!entry) return { text: '', status: 'empty' };
    if (entry.status === 'wrong') return { text: entry.letter, status: 'wrong' };
    return { text: cell.char.toUpperCase(), status: entry.status, hinted: !!entry.hinted };
  };

  /**
   * Estado de uma tecla do teclado virtual:
   *   'given'     letra revelada no início da fase
   *   'correct'   letra descoberta pelo jogador
   *   'wrong'     letra já tentada (errada) no símbolo selecionado
   *   'available' letra disponível
   */
  Puzzle.prototype.keyState = function (rawLetter, selectedSymbol) {
    var letter = toBaseLetter(rawLetter);
    if (!letter) return 'available';
    var holder = this.symbolHoldingLetter(letter, ['given', 'correct']);
    if (holder !== null) return this.entries[holder].status;
    if (selectedSymbol != null && this.tried[selectedSymbol] && this.tried[selectedSymbol][letter]) {
      return 'wrong';
    }
    return 'available';
  };

  Puzzle.prototype.progress = function () {
    var self = this;
    var solvedLetters = this.letterCells.filter(function (idx) {
      return self.isSymbolSolved(self.cells[idx].symbol);
    }).length;
    var solvedSymbols = this.symbols.filter(function (sym) {
      return self.isSymbolSolved(sym);
    }).length;
    var total = this.letterCells.length;
    return {
      solvedLetters: solvedLetters,
      totalLetters: total,
      solvedSymbols: solvedSymbols,
      totalSymbols: this.symbols.length,
      ratio: total ? solvedLetters / total : 1
    };
  };

  /** Células de letra que usam o símbolo. */
  Puzzle.prototype.cellsForSymbol = function (symbol) {
    var self = this;
    return this.letterCells.filter(function (idx) {
      return self.cells[idx].symbol === symbol;
    });
  };

  /**
   * Próxima célula de letra ainda não resolvida, a partir de `fromIndex`,
   * na direção `dir` (+1 ou -1), dando a volta na frase.
   * Retorna null se não houver nenhuma.
   */
  Puzzle.prototype.nextOpenCell = function (fromIndex, dir) {
    var step = dir < 0 ? -1 : 1;
    var list = this.letterCells;
    if (!list.length) return null;
    var startPos = list.indexOf(fromIndex);
    if (startPos === -1) startPos = step > 0 ? -1 : list.length;
    for (var n = 1; n <= list.length; n++) {
      var pos = (((startPos + step * n) % list.length) + list.length) % list.length;
      var idx = list[pos];
      if (!this.isSymbolSolved(this.cells[idx].symbol)) return idx;
    }
    return null;
  };

  Puzzle.prototype.firstOpenCell = function () {
    for (var i = 0; i < this.letterCells.length; i++) {
      var idx = this.letterCells[i];
      if (!this.isSymbolSolved(this.cells[idx].symbol)) return idx;
    }
    return null;
  };

  /** Texto atual da frase como o jogador vê (útil para depuração/testes). */
  Puzzle.prototype.currentText = function (blank) {
    var self = this;
    return this.cells.map(function (cell) {
      var view = self.cellView(cell.index);
      if (view.status === 'empty') return blank || '_';
      return view.text;
    }).join('');
  };

  return {
    ALPHABET: ALPHABET,
    toBaseLetter: toBaseLetter,
    seededRandom: seededRandom,
    shuffle: shuffle,
    createCipher: createCipher,
    parsePhrase: parsePhrase,
    Puzzle: Puzzle
  };
});
