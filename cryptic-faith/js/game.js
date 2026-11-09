/*
 * Cryptic Faith — controle do jogo.
 *
 * Liga o motor do criptograma (cryptogram.js) à interface (interface.js):
 * recebe os toques e teclas, aplica as regras, controla o tempo, a pausa,
 * a vitória, a derrota e salva preferências e recordes no LocalStorage.
 */
(function (root) {
  'use strict';

  var CF = root.CF;
  var UI = CF.UI;
  var Audio = CF.Audio;
  var Cryptogram = CF.Cryptogram;
  var LEVEL = CF.LEVELS[0];

  var STORAGE_SETTINGS = 'crypticFaith.settings.v1';
  var STORAGE_PROGRESS = 'crypticFaith.progress.v1';

  /* ---------------- Armazenamento local (opcional) ---------------- */
  var Store = {
    get: function (key, fallback) {
      try {
        var raw = root.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        root.localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* modo privado ou armazenamento bloqueado: o jogo segue sem salvar */
      }
    },
    remove: function (key) {
      try {
        root.localStorage.removeItem(key);
      } catch (e) {
        /* ignorar */
      }
    }
  };

  var canVibrate = typeof root.navigator !== 'undefined' && typeof root.navigator.vibrate === 'function';

  var settings = Object.assign({ sound: true, music: true, vibration: true }, Store.get(STORAGE_SETTINGS, {}));
  var progress = Store.get(STORAGE_PROGRESS, {}) || {};

  /*
   * Fases da partida:
   *   idle     fora da fase (menu, aprendizado)
   *   intro    cartão "LEVEL 1" aberto
   *   playing  jogando
   *   paused   pausa ou "como jogar" aberto durante a fase
   *   won      frase descoberta
   *   lost     terceiro erro
   */
  var game = {
    puzzle: null,
    selected: null,
    phase: 'idle',
    elapsed: 0,
    startedAt: null,
    pausedByHelp: false,
    timers: []
  };

  /* ---------------- Utilidades ---------------- */

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    game.timers.push(id);
    return id;
  }

  function clearTimers() {
    game.timers.forEach(clearTimeout);
    game.timers = [];
  }

  function haptic(pattern) {
    if (!settings.vibration || !canVibrate) return;
    try {
      root.navigator.vibrate(pattern);
    } catch (e) {
      /* ignorar */
    }
  }

  function timerStart() {
    if (game.startedAt == null) game.startedAt = performance.now();
  }

  function timerStop() {
    if (game.startedAt != null) {
      game.elapsed += performance.now() - game.startedAt;
      game.startedAt = null;
    }
  }

  function elapsedMs() {
    return game.elapsed + (game.startedAt != null ? performance.now() - game.startedAt : 0);
  }

  function selectedSymbol() {
    if (game.selected == null || !game.puzzle) return null;
    var cell = game.puzzle.cells[game.selected];
    return cell ? cell.symbol : null;
  }

  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  /* ---------------- Atualização da tela ---------------- */

  function refresh() {
    var p = game.puzzle;
    if (!p) return;
    var sym = selectedSymbol();
    var entry = sym != null ? p.entries[sym] : null;
    var playing = game.phase === 'playing';
    UI.updateBoard(p, playing ? game.selected : null);
    UI.updateKeyboard(p, playing ? sym : null);
    UI.updateHUD({
      errors: p.errors,
      maxErrors: p.maxErrors,
      progress: p.progress(),
      hintsLeft: p.hintsLeft,
      canErase: playing && !!entry && entry.status === 'wrong',
      canClear: playing && p.wrongSymbols().length > 0
    });
  }

  function updateHome() {
    UI.setHomeStatus(progress[LEVEL.id]);
  }

  /* ---------------- Ciclo da fase ---------------- */

  function createPuzzle() {
    clearTimers();
    game.puzzle = new Cryptogram.Puzzle({
      text: LEVEL.phrase,
      revealed: LEVEL.revealed,
      maxErrors: LEVEL.maxErrors,
      hints: LEVEL.hints,
      symbolCount: CF.Symbols.count
    });
    game.selected = game.puzzle.firstOpenCell();
    game.elapsed = 0;
    game.startedAt = null;
    game.pausedByHelp = false;
    UI.hideToast();
    UI.renderBoard(game.puzzle);
  }

  /** Abre a fase do zero, com o cartão de abertura. */
  function startLevel() {
    UI.closeAllOverlays();
    createPuzzle();
    game.phase = 'intro';
    refresh();
    UI.setIntro(LEVEL);
    UI.showScreen('game');
    Audio.play('whoosh');
    later(function () {
      UI.openOverlay('intro');
    }, 250);
  }

  /** Fecha o cartão de abertura e começa a contar o tempo. */
  function beginPlay() {
    if (game.phase !== 'intro') return;
    UI.closeOverlay('intro');
    game.phase = 'playing';
    timerStart();
    Audio.play('select');
    refresh();
    UI.fitBoard();
    UI.announce('Fase iniciada. Selecione um símbolo e escolha uma letra.');
  }

  /** Reinicia a fase na hora, com uma cifra nova. */
  function restartLevel() {
    UI.closeAllOverlays();
    createPuzzle();
    game.phase = 'playing';
    timerStart();
    refresh();
    UI.showScreen('game');
    Audio.play('whoosh');
    later(function () {
      UI.toast('Nova cifra gerada. Boa sorte!', 'good');
    }, 200);
    UI.announce('Fase reiniciada com uma nova cifra.');
  }

  function goToMenu() {
    clearTimers();
    timerStop();
    game.phase = 'idle';
    UI.closeAllOverlays();
    updateHome();
    UI.showScreen('home');
    Audio.play('whoosh');
  }

  function pause() {
    if (game.phase !== 'playing') return;
    game.phase = 'paused';
    timerStop();
    UI.setPauseStats(elapsedMs(), game.puzzle.errors, game.puzzle.maxErrors);
    UI.openOverlay('pause');
    Audio.play('tap');
    refresh();
  }

  function resume() {
    if (game.phase !== 'paused') return;
    UI.closeOverlay('pause');
    UI.closeOverlay('howto');
    game.pausedByHelp = false;
    game.phase = 'playing';
    timerStart();
    Audio.play('tap');
    refresh();
  }

  function openHowto() {
    if (game.phase === 'playing') {
      game.phase = 'paused';
      game.pausedByHelp = true;
      timerStop();
      refresh();
    }
    UI.openOverlay('howto');
    Audio.play('tap');
  }

  function closeTopOverlay() {
    var top = UI.topOverlay();
    if (!top) return;
    if (top === 'pause') {
      resume();
      return;
    }
    if (top === 'intro') {
      beginPlay();
      return;
    }
    if (top === 'victory' || top === 'defeat') return; // exigem uma escolha
    UI.closeOverlay(top);
    Audio.play('tap');
    if (top === 'howto' && game.pausedByHelp && game.phase === 'paused' && !UI.isOverlayOpen('pause')) {
      game.pausedByHelp = false;
      game.phase = 'playing';
      timerStart();
      refresh();
    }
  }

  /* ---------------- Jogadas ---------------- */

  function selectCell(index) {
    var p = game.puzzle;
    var cell = p.cells[index];
    if (!cell || cell.type !== 'letter') return;
    if (p.isSymbolSolved(cell.symbol)) {
      UI.animateCells(p.cellsForSymbol(cell.symbol), 'anim-nudge');
      Audio.play('tap');
      return;
    }
    if (game.selected === index) return;
    game.selected = index;
    Audio.play('select');
    refresh();
  }

  function moveSelection(dir) {
    if (game.phase !== 'playing') return;
    var next = game.puzzle.nextOpenCell(game.selected, dir);
    if (next == null || next === game.selected) return;
    game.selected = next;
    Audio.play('select');
    refresh();
  }

  function guess(letter) {
    if (game.phase !== 'playing') return;
    var p = game.puzzle;
    if (game.selected == null) game.selected = p.firstOpenCell();
    if (game.selected == null) return;

    var sym = selectedSymbol();
    var result = p.guess(sym, letter);
    var cells;

    switch (result.type) {
      case 'correct':
        cells = p.cellsForSymbol(sym);
        Audio.play('correct');
        haptic(15);
        refresh();
        UI.animateCells(cells, 'anim-reveal', 80);
        UI.sparkleCells(cells);
        UI.keyEffect(result.letter, 'anim-bounce');
        UI.announce('Correto! A letra ' + result.letter + ' foi revelada em ' + cells.length + ' ' +
          plural(cells.length, 'posição', 'posições') + '.');
        if (result.status === 'won') {
          onWin();
        } else {
          game.selected = p.nextOpenCell(game.selected, 1);
          refresh();
        }
        break;

      case 'wrong':
        Audio.play('wrong');
        haptic([40, 40, 60]);
        refresh();
        UI.animateCells(p.cellsForSymbol(sym), 'anim-shake');
        UI.keyEffect(result.letter, 'anim-shake');
        if (result.status === 'lost') {
          UI.announce('A letra ' + result.letter + ' não é a correta. Terceiro erro.');
          onLose();
        } else {
          var left = p.maxErrors - result.errors;
          UI.toast('Não é ' + result.letter + '! Restam ' + left + ' ' + plural(left, 'tentativa', 'tentativas') + '.', 'bad');
          UI.announce('A letra ' + result.letter + ' não é a correta. Erros: ' + result.errors + ' de ' + p.maxErrors + '.');
        }
        break;

      case 'repeat-wrong':
        Audio.play('nope');
        UI.keyEffect(result.letter, 'anim-shake');
        UI.toast('Você já tentou ' + result.letter + ' neste símbolo.');
        break;

      case 'already-used':
        Audio.play('nope');
        UI.keyEffect(result.letter, 'anim-shake');
        UI.animateCells(p.cellsForSymbol(p.symbolForLetter(result.letter)), 'anim-nudge');
        UI.toast('A letra ' + result.letter + ' já foi descoberta.');
        break;

      case 'locked':
        Audio.play('nope');
        UI.toast('Este símbolo já foi decifrado.');
        break;

      default:
        break;
    }
  }

  function erase() {
    if (game.phase !== 'playing') return;
    var sym = selectedSymbol();
    if (sym == null) return;
    var p = game.puzzle;
    var result = p.erase(sym);
    if (result.type === 'erased') {
      Audio.play('erase');
      refresh();
      UI.animateCells(p.cellsForSymbol(sym), 'anim-nudge');
      UI.announce('Letra ' + result.letter + ' apagada.');
    } else if (result.type === 'locked') {
      Audio.play('nope');
      UI.toast('Letras corretas ficam travadas.');
    } else {
      Audio.play('nope');
      UI.toast('Nada para apagar neste símbolo.');
    }
  }

  function clearWrong() {
    if (game.phase !== 'playing') return;
    var p = game.puzzle;
    var cleared = p.clearWrong();
    if (!cleared.length) {
      Audio.play('nope');
      UI.toast('Não há letras erradas para limpar.');
      return;
    }
    Audio.play('erase');
    refresh();
    var cells = [];
    cleared.forEach(function (sym) {
      cells = cells.concat(p.cellsForSymbol(sym));
    });
    UI.animateCells(cells, 'anim-nudge');
    UI.toast(cleared.length + ' ' + plural(cleared.length, 'símbolo limpo', 'símbolos limpos') + '.', 'good');
    UI.announce('Letras erradas removidas.');
  }

  function useHint() {
    if (game.phase !== 'playing') return;
    var p = game.puzzle;
    var result = p.useHint(selectedSymbol());
    if (result.type === 'no-hints') {
      Audio.play('nope');
      UI.toast('Você já usou todas as dicas desta fase.');
      return;
    }
    if (result.type !== 'hint') return;
    var cells = p.cellsForSymbol(result.symbol);
    Audio.play('hint');
    haptic(20);
    refresh();
    UI.animateCells(cells, 'anim-reveal', 80);
    UI.sparkleCells(cells);
    UI.keyEffect(result.letter, 'anim-bounce');
    UI.announce('Dica: o símbolo era a letra ' + result.letter + '.');
    if (result.status === 'won') {
      onWin();
      return;
    }
    UI.toast('Luz acesa: é a letra ' + result.letter + '!', 'good');
    if (p.isSymbolSolved(selectedSymbol())) {
      game.selected = p.nextOpenCell(game.selected, 1);
    }
    refresh();
  }

  /* ---------------- Vitória e derrota ---------------- */

  function onWin() {
    var p = game.puzzle;
    game.phase = 'won';
    timerStop();
    var time = elapsedMs();
    game.selected = null;
    refresh();
    UI.hideToast();

    var stars = Math.max(1, 3 - p.errors);
    var prev = progress[LEVEL.id] || {};
    var isFirst = !prev.completed;
    var isFaster = !isFirst && time < (prev.bestTimeMs || Infinity);
    progress[LEVEL.id] = {
      completed: true,
      bestTimeMs: Math.min(time, prev.bestTimeMs || Infinity),
      bestStars: Math.max(stars, prev.bestStars || 0),
      wins: (prev.wins || 0) + 1
    };
    Store.set(STORAGE_PROGRESS, progress);

    later(function () {
      Audio.play('win');
      haptic([30, 40, 30, 40, 90]);
      UI.victoryWave(p);
    }, 250);
    later(function () {
      UI.confetti();
    }, 350);
    later(function () {
      UI.showVictory({
        phrase: LEVEL.phrase,
        timeMs: time,
        errors: p.errors,
        maxErrors: p.maxErrors,
        hints: p.hintsUsed,
        stars: stars,
        recordText: isFirst ? 'Primeira vez decifrada!' : (isFaster ? 'Novo recorde de tempo!' : '')
      });
    }, 2000);
    UI.announce('Mensagem descoberta! ' + LEVEL.phrase);
  }

  function onLose() {
    var p = game.puzzle;
    game.phase = 'lost';
    timerStop();
    game.selected = null;
    refresh();
    UI.hideToast();
    UI.setBoardLost(true);
    later(function () {
      Audio.play('lose');
    }, 250);
    haptic([80, 60, 120]);
    var prog = p.progress();
    later(function () {
      UI.showDefeat({ solved: prog.solvedLetters, total: prog.totalLetters });
    }, 1200);
  }

  function revealTeaching(buttonEl) {
    if (game.phase !== 'won') return;
    Audio.play('reveal');
    UI.revealTransition(buttonEl, function () {
      UI.closeOverlay('victory');
      UI.fillLearn(LEVEL);
      game.phase = 'idle';
      UI.showScreen('learn');
    });
  }

  function openLearnFromHome() {
    var record = progress[LEVEL.id];
    if (!record || !record.completed) return;
    Audio.play('reveal');
    UI.fillLearn(LEVEL);
    UI.showScreen('learn');
  }

  /* ---------------- Configurações ---------------- */

  function applySettings() {
    Audio.setSound(settings.sound);
    Audio.setMusic(settings.music);
    UI.renderSettings(settings);
  }

  var resetArmed = null;
  function resetProgress(btn) {
    var label = btn.querySelector('span');
    if (!resetArmed) {
      label.textContent = 'TOQUE DE NOVO PARA CONFIRMAR';
      resetArmed = setTimeout(function () {
        label.textContent = 'APAGAR PROGRESSO SALVO';
        resetArmed = null;
      }, 3500);
      Audio.play('nope');
      return;
    }
    clearTimeout(resetArmed);
    resetArmed = null;
    progress = {};
    Store.remove(STORAGE_PROGRESS);
    updateHome();
    label.textContent = 'PROGRESSO APAGADO';
    Audio.play('erase');
    setTimeout(function () {
      label.textContent = 'APAGAR PROGRESSO SALVO';
    }, 2200);
  }

  /* ---------------- Eventos ---------------- */

  function onAction(data) {
    switch (data.action) {
      case 'play':
        Audio.play('tap');
        startLevel();
        break;
      case 'start-level':
        beginPlay();
        break;
      case 'open-howto':
        openHowto();
        break;
      case 'open-settings':
        UI.openOverlay('settings');
        Audio.play('tap');
        break;
      case 'close-overlay':
        closeTopOverlay();
        break;
      case 'pause':
        pause();
        break;
      case 'resume':
        resume();
        break;
      case 'restart':
        restartLevel();
        break;
      case 'menu':
        goToMenu();
        break;
      case 'replay':
        startLevel();
        break;
      case 'reveal':
        revealTeaching(data.el);
        break;
      case 'open-learn':
        openLearnFromHome();
        break;
      case 'hint':
        useHint();
        break;
      case 'clear':
        clearWrong();
        break;
      case 'erase':
        erase();
        break;
      case 'reset-progress':
        resetProgress(data.el);
        break;
      default:
        break;
    }
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key;

    if (key === 'Escape') {
      e.preventDefault();
      if (UI.topOverlay()) {
        closeTopOverlay();
      } else if (game.phase === 'playing') {
        pause();
      }
      return;
    }

    if (game.phase === 'intro' && (key === 'Enter' || key === ' ')) {
      e.preventDefault();
      beginPlay();
      return;
    }

    if (UI.screen() !== 'game' || game.phase !== 'playing' || UI.topOverlay()) return;

    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      UI.pressAction('btnErase');
      erase();
      return;
    }
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      e.preventDefault();
      UI.pressNav(1);
      moveSelection(1);
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      e.preventDefault();
      UI.pressNav(-1);
      moveSelection(-1);
      return;
    }
    if (key && key.length === 1) {
      var base = Cryptogram.toBaseLetter(key);
      if (base) {
        e.preventDefault();
        if (e.repeat) return;
        UI.pressKey(base);
        guess(base);
      }
    }
  }

  function unlockAudioOnce() {
    Audio.unlock();
    root.removeEventListener('pointerdown', unlockAudioOnce, true);
    root.removeEventListener('keydown', unlockAudioOnce, true);
  }

  function init() {
    UI.init({ supportsVibration: canVibrate });
    applySettings();
    updateHome();

    UI.on('action', onAction);
    UI.on('letter', function (letter) {
      guess(letter);
    });
    UI.on('nav', moveSelection);
    UI.on('cell', function (index) {
      if (game.phase === 'playing') selectCell(index);
    });
    UI.on('setting', function (data) {
      settings[data.name] = data.value;
      Store.set(STORAGE_SETTINGS, settings);
      applySettings();
      if (data.name === 'vibration' && data.value) haptic(30);
      if (data.name === 'sound' && data.value) Audio.play('tap');
      if (data.name === 'music' && data.value) Audio.unlock();
    });

    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerdown', unlockAudioOnce, true);
    root.addEventListener('keydown', unlockAudioOnce, true);

    root.document.addEventListener('visibilitychange', function () {
      if (root.document.hidden) {
        if (game.phase === 'playing') pause();
        Audio.suspend();
      } else {
        Audio.resume();
      }
    });

    // Acesso para depuração e testes automatizados (somente leitura do estado).
    CF.debug = {
      state: function () {
        return {
          phase: game.phase,
          selected: game.selected,
          errors: game.puzzle ? game.puzzle.errors : 0,
          status: game.puzzle ? game.puzzle.status : null,
          text: game.puzzle ? game.puzzle.currentText() : null,
          elapsedMs: elapsedMs()
        };
      },
      puzzle: function () {
        return game.puzzle;
      }
    };
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
