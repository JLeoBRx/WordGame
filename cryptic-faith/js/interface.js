/*
 * Cryptic Faith — interface.
 *
 * Cuida apenas do que aparece na tela: monta o tabuleiro e o teclado,
 * atualiza estados visuais, abre e fecha telas, toca efeitos visuais.
 * As decisões de jogo ficam em game.js, que recebe os eventos daqui.
 */
(function (root) {
  'use strict';

  var CF = root.CF;
  var Symbols = CF.Symbols;
  var doc = root.document;

  var KEY_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['<', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '>']
  ];

  var STATE_LABEL = {
    empty: 'letra desconhecida',
    given: 'revelada no início',
    correct: 'descoberta',
    wrong: 'errada'
  };

  var KEY_STATE_LABEL = {
    available: '',
    given: ', revelada no início',
    correct: ', já descoberta',
    wrong: ', já tentada neste símbolo'
  };

  var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var els = {};
  var cellEls = [];
  var keyEls = {};
  var listeners = {};
  var overlayStack = [];
  var lastFocus = null;
  var lastErrors = 0;
  var toastTimer = null;
  var currentScreen = 'home';

  function $(id) {
    return doc.getElementById(id);
  }

  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
  }

  function emit(evt, data) {
    (listeners[evt] || []).forEach(function (fn) {
      fn(data);
    });
  }

  function restartAnimation(el, cls, delayMs) {
    if (!el) return;
    el.classList.remove(cls);
    if (delayMs != null) el.style.setProperty('--d', delayMs + 'ms');
    // força o navegador a reiniciar a animação
    void el.offsetWidth;
    el.classList.add(cls);
    var done = function () {
      el.classList.remove(cls);
      el.removeEventListener('animationend', done);
    };
    el.addEventListener('animationend', done);
    // garantia caso o evento não dispare (movimento reduzido, aba oculta)
    setTimeout(function () {
      el.classList.remove(cls);
    }, 1600 + (delayMs || 0));
  }

  function formatTime(ms) {
    var total = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  /* ================================================================ */
  /* Construção inicial                                                */
  /* ================================================================ */

  function buildBackdrop() {
    var glyphLayer = $('floatingGlyphs');
    var count = reducedMotion ? 0 : 12;
    for (var i = 0; i < count; i++) {
      var g = doc.createElement('div');
      g.className = 'float-glyph';
      g.style.left = random(-4, 96).toFixed(1) + '%';
      g.style.setProperty('--size', Math.round(random(36, 96)) + 'px');
      var dur = random(26, 48);
      g.style.setProperty('--dur', dur.toFixed(1) + 's');
      g.style.setProperty('--delay', (-random(0, dur)).toFixed(1) + 's');
      g.style.setProperty('--rot', Math.round(random(-60, 60)) + 'deg');
      g.innerHTML = Symbols.svg(Math.floor(Math.random() * Symbols.count));
      glyphLayer.appendChild(g);
    }

    var dust = $('dust');
    var dustCount = reducedMotion ? 0 : 22;
    for (var j = 0; j < dustCount; j++) {
      var d = doc.createElement('span');
      d.className = 'dust';
      d.style.left = random(0, 100).toFixed(1) + '%';
      d.style.top = random(20, 100).toFixed(1) + '%';
      d.style.setProperty('--s', random(2, 4.5).toFixed(1) + 'px');
      var dd = random(9, 18);
      d.style.setProperty('--dur', dd.toFixed(1) + 's');
      d.style.setProperty('--delay', (-random(0, dd)).toFixed(1) + 's');
      d.style.setProperty('--dx', Math.round(random(-40, 40)) + 'px');
      dust.appendChild(d);
    }

    var emblem = $('emblemGlyphs');
    var positions = [22, 38, 50, 62, 78];
    positions.forEach(function (x, k) {
      var e = doc.createElement('span');
      e.className = 'emblem__glyph';
      e.style.setProperty('--x', x + '%');
      e.style.setProperty('--size', Math.round(random(16, 26)) + 'px');
      e.style.setProperty('--dur', random(4.5, 6.5).toFixed(1) + 's');
      e.style.setProperty('--delay', (k * 1.1).toFixed(1) + 's');
      e.style.setProperty('--rot', Math.round(random(-30, 30)) + 'deg');
      e.innerHTML = Symbols.svg((k * 7 + 3) % Symbols.count);
      emblem.appendChild(e);
    });
  }

  function buildLogo() {
    var rows = doc.querySelectorAll('.logo__row');
    Array.prototype.forEach.call(rows, function (row, r) {
      var word = row.getAttribute('data-word');
      Array.from(word).forEach(function (ch, i) {
        var glyphId = (ch.charCodeAt(0) * 7 + i * 3 + r * 5) % Symbols.count;
        var tile = doc.createElement('span');
        tile.className = 'tile';
        tile.innerHTML =
          '<span class="tile__inner">' +
          '<span class="tile__face tile__face--glyph">' + Symbols.svg(glyphId) + '</span>' +
          '<span class="tile__face tile__face--letter">' + ch + '</span>' +
          '</span>';
        row.appendChild(tile);
      });
    });
  }

  var logoTimers = [];
  function playLogo() {
    logoTimers.forEach(clearTimeout);
    logoTimers = [];
    var tiles = doc.querySelectorAll('.logo .tile');
    Array.prototype.forEach.call(tiles, function (t) {
      t.classList.remove('is-flipped');
    });
    Array.prototype.forEach.call(tiles, function (t, i) {
      logoTimers.push(setTimeout(function () {
        t.classList.add('is-flipped');
      }, reducedMotion ? 0 : 450 + i * 110));
    });
  }

  function buildKeyboard() {
    var wrap = $('keyRows');
    KEY_ROWS.forEach(function (row) {
      var rowEl = doc.createElement('div');
      rowEl.className = 'key-row';
      row.forEach(function (k) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'key';
        if (k === '<' || k === '>') {
          b.className += ' key--nav';
          b.setAttribute('data-nav', k === '<' ? '-1' : '1');
          b.setAttribute('aria-label', k === '<' ? 'Símbolo anterior' : 'Próximo símbolo');
          b.innerHTML = '<svg class="icon"><use href="#i-' + (k === '<' ? 'left' : 'right') + '"/></svg>';
        } else {
          b.setAttribute('data-key', k);
          b.setAttribute('aria-label', 'Letra ' + k);
          b.textContent = k;
          keyEls[k] = b;
        }
        rowEl.appendChild(b);
      });
      wrap.appendChild(rowEl);
    });
  }

  function buildSettings(supportsVibration) {
    var rows = [
      { name: 'music', label: 'Música', icon: 'music' },
      { name: 'sound', label: 'Sons', icon: 'sound' }
    ];
    if (supportsVibration) rows.push({ name: 'vibration', label: 'Vibração', icon: 'vibrate' });

    var boxes = doc.querySelectorAll('[data-settings]');
    Array.prototype.forEach.call(boxes, function (box, bi) {
      box.innerHTML = rows.map(function (r) {
        var id = 'set-' + r.name + '-' + bi;
        return '<div class="setting-row">' +
          '<span class="setting-row__label" id="' + id + '"><svg class="icon"><use href="#i-' + r.icon + '"/></svg>' + r.label + '</span>' +
          '<button class="switch" type="button" role="switch" aria-checked="true" aria-labelledby="' + id + '" data-setting="' + r.name + '">' +
          '<span class="switch__knob"></span></button>' +
          '</div>';
      }).join('');
    });
  }

  function buildHowto() {
    var demo = $('howtoDemoSymbols');
    demo.innerHTML =
      '<span class="mini-disk">' + Symbols.svg(9) + '</span>' +
      '<span class="mini-disk">' + Symbols.svg(1) + '</span>' +
      '<span class="mini-disk">' + Symbols.svg(9) + '</span>';
  }

  /* ================================================================ */
  /* Eventos da interface                                              */
  /* ================================================================ */

  function bindEvents() {
    doc.addEventListener('click', function (e) {
      var target = e.target;

      var keyBtn = target.closest('.key');
      if (keyBtn && els.keyboard.contains(keyBtn)) {
        if (keyBtn.hasAttribute('data-nav')) {
          emit('nav', Number(keyBtn.getAttribute('data-nav')));
        } else {
          emit('letter', keyBtn.getAttribute('data-key'));
        }
        return;
      }

      var cell = target.closest('.cell');
      if (cell && els.phrase.contains(cell)) {
        emit('cell', Number(cell.getAttribute('data-index')));
        return;
      }

      var sw = target.closest('[data-setting]');
      if (sw) {
        var value = sw.getAttribute('aria-checked') !== 'true';
        emit('setting', { name: sw.getAttribute('data-setting'), value: value });
        return;
      }

      var actionEl = target.closest('[data-action]');
      if (actionEl) {
        emit('action', { action: actionEl.getAttribute('data-action'), el: actionEl });
      }
    });

    // O contêiner do jogo nunca deve rolar (navegadores sem `overflow: clip`).
    els.app.addEventListener('scroll', function () {
      if (els.app.scrollLeft || els.app.scrollTop) {
        els.app.scrollLeft = 0;
        els.app.scrollTop = 0;
      }
    });

    var resizeQueued = false;
    root.addEventListener('resize', function () {
      if (resizeQueued) return;
      resizeQueued = true;
      root.requestAnimationFrame(function () {
        resizeQueued = false;
        fitBoard();
        resizeFx();
      });
    });
  }

  /* ================================================================ */
  /* Telas e sobreposições                                             */
  /* ================================================================ */

  function showScreen(name) {
    currentScreen = name;
    ['home', 'game', 'learn'].forEach(function (s) {
      var el = $('screen-' + s);
      var active = s === name;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
      el.inert = !active || overlayStack.length > 0;
    });
    if (name === 'home') playLogo();
    if (name === 'game') {
      root.requestAnimationFrame(fitBoard);
    }
    if (name === 'learn') {
      $('learnScroll').scrollTop = 0;
    }
  }

  function syncInert() {
    var blocked = overlayStack.length > 0;
    ['home', 'game', 'learn'].forEach(function (s) {
      var el = $('screen-' + s);
      el.inert = blocked || s !== currentScreen;
    });
  }

  function focusFirst(container) {
    var target = container.querySelector('[data-autofocus]') ||
      container.querySelector('.btn, [data-action]:not(.overlay), .switch');
    if (target) {
      try {
        target.focus({ preventScroll: true });
      } catch (e) {
        target.focus();
      }
    }
  }

  function openOverlay(name) {
    var el = $('overlay-' + name);
    if (!el || el.classList.contains('is-open')) return;
    if (!overlayStack.length) lastFocus = doc.activeElement;
    // Uma sobreposição de cada vez acima da anterior.
    overlayStack.forEach(function (n) {
      $('overlay-' + n).inert = true;
    });
    overlayStack.push(name);
    el.inert = false;
    el.classList.add('is-open');
    syncInert();
    setTimeout(function () {
      focusFirst(el);
    }, 60);
  }

  function closeOverlay(name) {
    var el = $('overlay-' + name);
    if (!el) return;
    el.classList.remove('is-open');
    var idx = overlayStack.indexOf(name);
    if (idx !== -1) overlayStack.splice(idx, 1);
    if (overlayStack.length) {
      var top = $('overlay-' + overlayStack[overlayStack.length - 1]);
      top.inert = false;
      focusFirst(top);
    }
    syncInert();
    if (!overlayStack.length && lastFocus && doc.body.contains(lastFocus) && lastFocus.offsetParent !== null) {
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (e) {
        /* ignorar */
      }
      lastFocus = null;
    }
  }

  function closeAllOverlays() {
    overlayStack.slice().forEach(closeOverlay);
  }

  function topOverlay() {
    return overlayStack.length ? overlayStack[overlayStack.length - 1] : null;
  }

  /* ================================================================ */
  /* Tabuleiro                                                         */
  /* ================================================================ */

  function renderBoard(puzzle) {
    var phrase = els.phrase;
    phrase.innerHTML = '';
    cellEls = [];
    els.board.classList.remove('is-lost');
    puzzle.words.forEach(function (word) {
      var w = doc.createElement('div');
      w.className = 'word';
      word.forEach(function (idx) {
        var cell = puzzle.cells[idx];
        if (cell.type === 'letter') {
          var b = doc.createElement('button');
          b.type = 'button';
          b.className = 'cell is-empty';
          b.setAttribute('data-index', idx);
          b.setAttribute('data-symbol', cell.symbol);
          b.tabIndex = -1;
          b.innerHTML =
            '<span class="cell__disk">' + Symbols.svg(cell.symbol, 'cell__glyph') +
            '<span class="cell__letter"></span></span>' +
            '<span class="cell__code" aria-hidden="true">' + Symbols.svg(cell.symbol) + '</span>';
          cellEls[idx] = b;
          w.appendChild(b);
        } else {
          var p = doc.createElement('span');
          p.className = 'punct';
          p.textContent = cell.char;
          w.appendChild(p);
        }
      });
      phrase.appendChild(w);
    });
    lastErrors = 0;
    fitBoard();
  }

  function updateBoard(puzzle, selectedIndex) {
    var selectedSymbol = selectedIndex != null && puzzle.cells[selectedIndex] ? puzzle.cells[selectedIndex].symbol : null;
    var focusInBoard = els.phrase.contains(doc.activeElement);
    var tabTarget = null;

    puzzle.letterCells.forEach(function (idx) {
      var el = cellEls[idx];
      if (!el) return;
      var view = puzzle.cellView(idx);
      var cell = puzzle.cells[idx];
      el.classList.toggle('is-empty', view.status === 'empty');
      el.classList.toggle('is-given', view.status === 'given');
      el.classList.toggle('is-correct', view.status === 'correct');
      el.classList.toggle('is-wrong', view.status === 'wrong');
      el.classList.toggle('is-selected', idx === selectedIndex);
      el.classList.toggle('is-peer', idx !== selectedIndex && selectedSymbol !== null && cell.symbol === selectedSymbol);
      var letterEl = el.querySelector('.cell__letter');
      if (letterEl.textContent !== view.text) letterEl.textContent = view.text;

      var label = 'Símbolo ' + Symbols.name(cell.symbol) + ': ' +
        (view.status === 'empty' ? STATE_LABEL.empty : 'letra ' + view.text + ', ' + STATE_LABEL[view.status]);
      if (idx === selectedIndex) label += ' (selecionado)';
      el.setAttribute('aria-label', label);
      el.setAttribute('aria-pressed', idx === selectedIndex ? 'true' : 'false');
      el.tabIndex = -1;
      if (idx === selectedIndex) tabTarget = el;
    });

    if (!tabTarget) {
      var first = puzzle.firstOpenCell();
      tabTarget = cellEls[first != null ? first : puzzle.letterCells[0]];
    }
    if (tabTarget) {
      tabTarget.tabIndex = 0;
      if (focusInBoard && doc.activeElement !== tabTarget && selectedIndex != null) {
        try {
          tabTarget.focus({ preventScroll: true });
        } catch (e) {
          tabTarget.focus();
        }
      }
    }

    var selectedEl = selectedIndex != null ? cellEls[selectedIndex] : null;
    if (selectedEl && els.board.scrollHeight > els.board.clientHeight + 2) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }

  function animateCells(indices, cls, stagger) {
    indices.forEach(function (idx, i) {
      restartAnimation(cellEls[idx], cls, stagger ? i * stagger : 0);
    });
  }

  function cellElement(idx) {
    return cellEls[idx] || null;
  }

  function setBoardLost(lost) {
    els.board.classList.toggle('is-lost', !!lost);
    if (lost) restartAnimation(els.board, 'anim-shake');
  }

  /**
   * Ajusta o tamanho das células para a frase caber inteira no painel,
   * sem rolagem, em qualquer tamanho de tela.
   */
  function fitBoard() {
    var board = els.board;
    var phrase = els.phrase;
    if (!board || !phrase.children.length) return;
    var cs = root.getComputedStyle(board);
    var availW = board.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 6;
    var availH = board.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 10;
    if (availW <= 0 || availH <= 0) return;

    var words = phrase.children;
    var fits = function (size) {
      phrase.style.setProperty('--cell', size + 'px');
      if (phrase.offsetHeight > availH) return false;
      for (var i = 0; i < words.length; i++) {
        if (words[i].offsetWidth > availW) return false;
      }
      return true;
    };

    var lo = 18;
    var hi = 50;
    var best = lo;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (fits(mid)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    phrase.style.setProperty('--cell', best + 'px');
  }

  /* ================================================================ */
  /* Teclado                                                           */
  /* ================================================================ */

  function updateKeyboard(puzzle, selectedSymbol) {
    Object.keys(keyEls).forEach(function (letter) {
      var el = keyEls[letter];
      var state = puzzle.keyState(letter, selectedSymbol);
      el.classList.toggle('is-correct', state === 'correct');
      el.classList.toggle('is-given', state === 'given');
      el.classList.toggle('is-wrong', state === 'wrong');
      el.setAttribute('aria-label', 'Letra ' + letter + KEY_STATE_LABEL[state]);
    });
  }

  function keyEffect(letter, cls) {
    restartAnimation(keyEls[letter], cls);
  }

  function pressVisual(el) {
    if (!el) return;
    el.classList.add('is-pressed');
    setTimeout(function () {
      el.classList.remove('is-pressed');
    }, 110);
  }

  function pressKey(letter) {
    pressVisual(keyEls[letter]);
  }

  function pressNav(dir) {
    pressVisual(els.keyboard.querySelector('[data-nav="' + (dir < 0 ? '-1' : '1') + '"]'));
  }

  function pressAction(id) {
    pressVisual($(id));
  }

  /* ================================================================ */
  /* HUD                                                               */
  /* ================================================================ */

  function updateHUD(data) {
    var lives = els.lives.querySelectorAll('.life');
    Array.prototype.forEach.call(lives, function (life, i) {
      var lost = i < data.errors;
      var wasLost = life.classList.contains('is-lost');
      life.classList.toggle('is-lost', lost);
      if (lost && !wasLost && data.errors > lastErrors) restartAnimation(life, 'is-new');
    });
    lastErrors = data.errors;
    els.lives.setAttribute('aria-label', 'Erros: ' + data.errors + ' de ' + data.maxErrors);

    var pct = Math.round(data.progress.ratio * 100);
    els.progressFill.style.width = pct + '%';
    els.progressLabel.textContent = pct + '%';
    els.progressBar.setAttribute('aria-valuenow', String(pct));
    els.progressBar.setAttribute('aria-valuetext', data.progress.solvedLetters + ' de ' + data.progress.totalLetters + ' letras descobertas');

    els.hintCount.textContent = String(data.hintsLeft);
    els.btnHint.disabled = data.hintsLeft <= 0;
    els.btnHint.setAttribute('aria-label', 'Dica: revelar o símbolo selecionado. ' + data.hintsLeft + ' restantes');
    els.btnErase.disabled = !data.canErase;
    els.btnClear.disabled = !data.canClear;
    els.btnErase.setAttribute('aria-label', 'Apagar a letra errada do símbolo selecionado');
    els.btnClear.setAttribute('aria-label', 'Limpar todas as letras erradas');
  }

  /* ================================================================ */
  /* Mensagens                                                         */
  /* ================================================================ */

  function toast(message, tone, duration) {
    var t = els.toast;
    t.textContent = message;
    t.classList.remove('is-good', 'is-bad');
    if (tone) t.classList.add('is-' + tone);
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('is-visible');
    }, duration || 1900);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    els.toast.classList.remove('is-visible');
  }

  function announce(message) {
    var a = els.announcer;
    a.textContent = '';
    setTimeout(function () {
      a.textContent = message;
    }, 30);
  }

  /* ================================================================ */
  /* Configurações                                                     */
  /* ================================================================ */

  function renderSettings(settings) {
    var switches = doc.querySelectorAll('[data-setting]');
    Array.prototype.forEach.call(switches, function (sw) {
      var name = sw.getAttribute('data-setting');
      sw.setAttribute('aria-checked', settings[name] ? 'true' : 'false');
    });
  }

  function setPauseStats(timeMs, errors, maxErrors) {
    $('pauseTime').textContent = formatTime(timeMs);
    $('pauseErrors').textContent = errors + '/' + maxErrors;
  }

  /* ================================================================ */
  /* Início, vitória, derrota e aprendizado                            */
  /* ================================================================ */

  function setHomeStatus(record) {
    var status = $('homeLevelStatus');
    var learnBtn = $('btnHomeLearn');
    if (record && record.completed) {
      var stars = '★★★'.slice(0, record.bestStars || 1) + '☆☆☆'.slice(0, 3 - (record.bestStars || 1));
      status.textContent = 'Concluída ' + stars + ' · melhor tempo ' + formatTime(record.bestTimeMs || 0);
      learnBtn.hidden = false;
    } else {
      status.textContent = 'Uma mensagem secreta espera por você.';
      learnBtn.hidden = true;
    }
  }

  function setIntro(level) {
    $('introTeaser').textContent = level.teaser;
  }

  function showVictory(data) {
    $('victoryPhrase').textContent = data.phrase;
    $('statTime').textContent = formatTime(data.timeMs);
    $('statErrors').textContent = data.errors + '/' + data.maxErrors;
    $('statHints').textContent = String(data.hints);
    var record = $('victoryRecord');
    if (data.recordText) {
      record.textContent = data.recordText;
      record.hidden = false;
    } else {
      record.hidden = true;
    }
    var starsWrap = $('victoryStars');
    starsWrap.setAttribute('aria-label', data.stars + ' de 3 estrelas');
    var stars = starsWrap.querySelectorAll('.star');
    Array.prototype.forEach.call(stars, function (s) {
      s.classList.remove('is-on');
    });
    openOverlay('victory');
    Array.prototype.forEach.call(stars, function (s, i) {
      if (i < data.stars) {
        s.style.setProperty('--d', (350 + i * 220) + 'ms');
        void s.offsetWidth;
        s.classList.add('is-on');
      }
    });
  }

  function showDefeat(data) {
    $('defeatText').textContent =
      'Você decifrou ' + data.solved + ' de ' + data.total + ' letras. ' +
      'Cada tentativa também ensina: a cifra muda e você pode recomeçar.';
    openOverlay('defeat');
  }

  function fillLearn(level) {
    $('learnReference').textContent = level.catechism.reference;
    $('catechismHeading').textContent = level.catechism.heading;
    $('catechismText').textContent = level.catechism.text;
    $('catechismCite').textContent = level.catechism.reference;
    $('recapPhrase').textContent = level.phrase;
    $('reflectQuestion').textContent = level.reflection;
  }

  /** Clarão de luz que leva da vitória ao ensinamento. */
  function revealTransition(originEl, onMiddle) {
    var flash = els.revealFlash;
    var appRect = els.app.getBoundingClientRect();
    if (originEl) {
      var r = originEl.getBoundingClientRect();
      flash.style.setProperty('--x', ((r.left + r.width / 2 - appRect.left) / appRect.width * 100).toFixed(1) + '%');
      flash.style.setProperty('--y', ((r.top + r.height / 2 - appRect.top) / appRect.height * 100).toFixed(1) + '%');
    }
    flash.classList.remove('is-on');
    void flash.offsetWidth;
    flash.classList.add('is-on');
    setTimeout(onMiddle, reducedMotion ? 0 : 650);
    setTimeout(function () {
      flash.classList.remove('is-on');
    }, reducedMotion ? 50 : 1600);
  }

  /* ================================================================ */
  /* Partículas (faíscas e confetes)                                   */
  /* ================================================================ */

  var fx = { ctx: null, particles: [], running: false, w: 0, h: 0 };
  var FX_COLORS = ['#ffd982', '#f5c75a', '#fff1c9', '#4fe08a', '#7fdcd0', '#ffffff'];

  function resizeFx() {
    var canvas = els.fx;
    var rect = els.app.getBoundingClientRect();
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    fx.w = rect.width;
    fx.h = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    fx.ctx = canvas.getContext('2d');
    if (fx.ctx) fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function centerOf(el) {
    var a = els.app.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
  }

  function startFx() {
    if (fx.running || !fx.ctx) return;
    fx.running = true;
    var last = performance.now();
    var step = function (now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      var ctx = fx.ctx;
      ctx.clearRect(0, 0, fx.w, fx.h);
      fx.particles = fx.particles.filter(function (p) {
        p.life -= dt;
        if (p.life <= 0) return false;
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        var alpha = Math.min(1, p.life / p.fade);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.kind === 'confetti') {
          var squash = Math.abs(Math.cos(p.rot * 2.3));
          ctx.fillRect(-p.size / 2, -p.size * 0.3 * squash, p.size, p.size * 0.6 * squash + 0.5);
        } else {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          // estrelinha de 4 pontas
          var s = p.size;
          ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(0, 0, s, 0);
          ctx.quadraticCurveTo(0, 0, 0, s);
          ctx.quadraticCurveTo(0, 0, -s, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });
      if (fx.particles.length) {
        root.requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, fx.w, fx.h);
        fx.running = false;
      }
    };
    root.requestAnimationFrame(step);
  }

  function sparkleCells(indices) {
    if (reducedMotion || !fx.ctx) return;
    indices.forEach(function (idx) {
      var el = cellEls[idx];
      if (!el) return;
      var c = centerOf(el.querySelector('.cell__disk'));
      for (var i = 0; i < 9; i++) {
        var ang = random(0, Math.PI * 2);
        var speed = random(60, 170);
        fx.particles.push({
          kind: 'spark',
          x: c.x,
          y: c.y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 30,
          gravity: 160,
          drag: 0.96,
          size: random(2.5, 5),
          rot: random(0, Math.PI),
          vr: random(-4, 4),
          color: FX_COLORS[Math.floor(random(0, 3))],
          life: random(0.45, 0.8),
          fade: 0.35
        });
      }
    });
    startFx();
  }

  function confetti() {
    if (!fx.ctx) return;
    var count = reducedMotion ? 0 : 150;
    for (var i = 0; i < count; i++) {
      fx.particles.push({
        kind: 'confetti',
        x: random(0, fx.w),
        y: random(-fx.h * 0.35, -10),
        vx: random(-70, 70),
        vy: random(180, 320),
        gravity: 260,
        drag: 0.99,
        size: random(7, 12),
        rot: random(0, Math.PI * 2),
        vr: random(-8, 8),
        color: FX_COLORS[Math.floor(random(0, FX_COLORS.length))],
        life: random(1.7, 2.5),
        fade: 0.6
      });
    }
    // brilho que sobe do centro do painel
    var c = centerOf(els.board);
    for (var j = 0; j < (reducedMotion ? 0 : 60); j++) {
      var ang = random(0, Math.PI * 2);
      var speed = random(120, 380);
      fx.particles.push({
        kind: 'spark',
        x: c.x,
        y: c.y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        gravity: 60,
        drag: 0.95,
        size: random(3, 6.5),
        rot: 0,
        vr: random(-3, 3),
        color: FX_COLORS[Math.floor(random(0, 3))],
        life: random(0.8, 1.5),
        fade: 0.6
      });
    }
    startFx();
  }

  function victoryWave(puzzle) {
    puzzle.letterCells.forEach(function (idx, i) {
      restartAnimation(cellEls[idx], 'anim-wave', i * 35);
    });
  }

  /* ================================================================ */
  /* Inicialização                                                     */
  /* ================================================================ */

  function init(options) {
    els.app = $('app');
    els.board = $('board');
    els.phrase = $('phrase');
    els.keyboard = $('keyboard');
    els.lives = $('lives');
    els.progressFill = $('progressFill');
    els.progressLabel = $('progressLabel');
    els.progressBar = $('progressBar');
    els.hintCount = $('hintCount');
    els.btnHint = $('btnHint');
    els.btnErase = $('btnErase');
    els.btnClear = $('btnClear');
    els.toast = $('toast');
    els.announcer = $('announcer');
    els.fx = $('fx');
    els.revealFlash = $('revealFlash');

    buildBackdrop();
    buildLogo();
    buildKeyboard();
    buildSettings(options && options.supportsVibration);
    buildHowto();
    bindEvents();
    resizeFx();
    // as sobreposições começam fora da ordem de foco
    Array.prototype.forEach.call(doc.querySelectorAll('.overlay'), function (o) {
      o.inert = true;
    });
    showScreen('home');
  }

  CF.UI = {
    init: init,
    on: on,
    formatTime: formatTime,
    showScreen: showScreen,
    screen: function () {
      return currentScreen;
    },
    openOverlay: function (name) {
      var el = $('overlay-' + name);
      if (el) el.inert = false;
      openOverlay(name);
    },
    closeOverlay: function (name) {
      closeOverlay(name);
      var el = $('overlay-' + name);
      if (el) el.inert = true;
    },
    closeAllOverlays: function () {
      overlayStack.slice().forEach(function (name) {
        CF.UI.closeOverlay(name);
      });
    },
    topOverlay: topOverlay,
    isOverlayOpen: function (name) {
      return overlayStack.indexOf(name) !== -1;
    },
    renderBoard: renderBoard,
    updateBoard: updateBoard,
    animateCells: animateCells,
    cellElement: cellElement,
    setBoardLost: setBoardLost,
    fitBoard: fitBoard,
    updateKeyboard: updateKeyboard,
    keyEffect: keyEffect,
    pressKey: pressKey,
    pressNav: pressNav,
    pressAction: pressAction,
    updateHUD: updateHUD,
    toast: toast,
    hideToast: hideToast,
    announce: announce,
    renderSettings: renderSettings,
    setPauseStats: setPauseStats,
    setHomeStatus: setHomeStatus,
    setIntro: setIntro,
    showVictory: showVictory,
    showDefeat: showDefeat,
    fillLearn: fillLearn,
    revealTransition: revealTransition,
    sparkleCells: sparkleCells,
    confetti: confetti,
    victoryWave: victoryWave
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
