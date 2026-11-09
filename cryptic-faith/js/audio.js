/*
 * Cryptic Faith — áudio.
 *
 * Todos os sons e a música ambiente são sintetizados em tempo real com a
 * Web Audio API: nenhum arquivo de áudio precisa ser baixado e o jogo
 * continua funcionando offline e direto do disco.
 *
 * Os navegadores só liberam áudio depois de uma interação do usuário, por
 * isso o contexto é criado no primeiro toque/clique/tecla.
 */
(function (root) {
  'use strict';
  root.CF = root.CF || {};

  var AC = root.AudioContext || root.webkitAudioContext;
  var ctx = null;
  var master = null;
  var sfxBus = null;
  var musicBus = null;
  var musicDelay = null;

  var state = {
    sound: true,
    music: true,
    musicPlaying: false,
    musicTimer: null,
    nextChordAt: 0,
    chordIndex: 0
  };

  var MUSIC_LEVEL = 0.55;

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function ensureContext() {
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.7;
      sfxBus.connect(master);

      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(master);

      // Eco suave para dar sensação de espaço à música.
      musicDelay = ctx.createDelay(2);
      musicDelay.delayTime.value = 0.42;
      var feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      var damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2200;
      musicDelay.connect(damp);
      damp.connect(feedback);
      feedback.connect(musicDelay);
      damp.connect(musicBus);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  /* -------------------- Efeitos sonoros -------------------- */

  function tone(freq, opts) {
    var c = ensureContext();
    if (!c) return;
    opts = opts || {};
    var t0 = c.currentTime + (opts.delay || 0);
    var dur = opts.duration || 0.2;
    var attack = opts.attack != null ? opts.attack : 0.005;
    var peak = opts.gain != null ? opts.gain : 0.2;

    var osc = c.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    }
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    var node = osc;
    if (opts.lowpass) {
      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = opts.lowpass;
      osc.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(opts.dest || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function bell(freq, delay, gain, dest) {
    tone(freq, { delay: delay, duration: 0.9, gain: gain || 0.16, type: 'sine', dest: dest });
    tone(freq * 2.01, { delay: delay, duration: 0.45, gain: (gain || 0.16) * 0.28, type: 'sine', dest: dest });
    tone(freq * 3.0, { delay: delay, duration: 0.25, gain: (gain || 0.16) * 0.12, type: 'triangle', dest: dest });
  }

  function noiseBurst(opts) {
    var c = ensureContext();
    if (!c) return;
    opts = opts || {};
    var dur = opts.duration || 0.4;
    var t0 = c.currentTime + (opts.delay || 0);
    var len = Math.floor(c.sampleRate * dur);
    var buffer = c.createBuffer(1, len, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(opts.from || 400, t0);
    filter.frequency.exponentialRampToValueAtTime(opts.to || 3000, t0 + dur);
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.gain || 0.12, t0 + dur * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  var SFX = {
    tap: function () {
      tone(740, { duration: 0.07, gain: 0.08, type: 'triangle', slideTo: 620 });
    },
    select: function () {
      tone(520, { duration: 0.08, gain: 0.09, type: 'sine', slideTo: 600 });
    },
    correct: function () {
      bell(midiToFreq(88), 0, 0.17); // E6
      bell(midiToFreq(95), 0.09, 0.15); // B6
    },
    wrong: function () {
      tone(180, { duration: 0.32, gain: 0.2, type: 'sawtooth', slideTo: 95, lowpass: 900 });
      tone(120, { duration: 0.2, gain: 0.16, type: 'square', lowpass: 500, delay: 0.02 });
    },
    nope: function () {
      tone(300, { duration: 0.09, gain: 0.08, type: 'triangle', slideTo: 240 });
    },
    erase: function () {
      tone(560, { duration: 0.12, gain: 0.09, type: 'sine', slideTo: 300 });
    },
    hint: function () {
      [84, 88, 91, 96].forEach(function (m, i) {
        bell(midiToFreq(m), i * 0.06, 0.11);
      });
    },
    win: function () {
      [72, 76, 79, 84, 88, 91].forEach(function (m, i) {
        bell(midiToFreq(m), i * 0.09, 0.15);
      });
      [60, 64, 67, 72].forEach(function (m) {
        tone(midiToFreq(m), { delay: 0.55, duration: 2.2, attack: 0.08, gain: 0.06, type: 'triangle', lowpass: 1800 });
      });
    },
    lose: function () {
      [67, 63, 60].forEach(function (m, i) {
        tone(midiToFreq(m), { delay: i * 0.22, duration: 0.6, attack: 0.02, gain: 0.12, type: 'triangle', lowpass: 1400 });
      });
    },
    reveal: function () {
      noiseBurst({ duration: 0.9, from: 300, to: 5000, gain: 0.07 });
      [79, 84, 88].forEach(function (m, i) {
        bell(midiToFreq(m), 0.35 + i * 0.12, 0.1);
      });
    },
    whoosh: function () {
      noiseBurst({ duration: 0.35, from: 600, to: 2600, gain: 0.05 });
    }
  };

  function play(name) {
    if (!state.sound || !SFX[name]) return;
    try {
      SFX[name]();
    } catch (e) {
      /* áudio é opcional: falhas não devem travar o jogo */
    }
  }

  /* -------------------- Música ambiente -------------------- */

  // Acordes (MIDI): Cmaj7, Am7, Fmaj7, G(add9)
  var CHORDS = [
    [48, 55, 59, 64],
    [45, 52, 55, 60],
    [41, 48, 52, 57],
    [43, 50, 55, 57, 59]
  ];
  var BELL_NOTES = [72, 74, 76, 79, 81, 84, 86, 88];
  var CHORD_LEN = 8;

  function padVoice(freq, t0, len) {
    var c = ctx;
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.045, t0 + 2.6);
    gain.gain.setValueAtTime(0.045, t0 + len - 0.4);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + len + 2.4);
    [
      { type: 'triangle', detune: -5 },
      { type: 'sine', detune: 6 }
    ].forEach(function (v) {
      var osc = c.createOscillator();
      osc.type = v.type;
      osc.frequency.value = freq;
      osc.detune.value = v.detune;
      osc.connect(lp);
      osc.start(t0);
      osc.stop(t0 + len + 2.6);
    });
    lp.connect(gain);
    gain.connect(musicBus);
  }

  function musicBell(freq, t0) {
    var c = ctx;
    var osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.03, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    osc.connect(gain);
    gain.connect(musicBus);
    gain.connect(musicDelay);
    osc.start(t0);
    osc.stop(t0 + 2.3);
  }

  function scheduleMusic() {
    if (!ctx || !state.musicPlaying) return;
    while (state.nextChordAt < ctx.currentTime + 1.5) {
      var t0 = state.nextChordAt;
      var chord = CHORDS[state.chordIndex % CHORDS.length];
      chord.forEach(function (m) {
        padVoice(midiToFreq(m), t0, CHORD_LEN);
      });
      var bells = 2 + Math.floor(Math.random() * 3);
      for (var i = 0; i < bells; i++) {
        var note = BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)];
        musicBell(midiToFreq(note), t0 + 0.8 + Math.random() * (CHORD_LEN - 1.6));
      }
      state.chordIndex += 1;
      state.nextChordAt += CHORD_LEN;
    }
  }

  function startMusic() {
    if (!state.music || state.musicPlaying) return;
    var c = ensureContext();
    if (!c) return;
    state.musicPlaying = true;
    state.nextChordAt = c.currentTime + 0.1;
    musicBus.gain.cancelScheduledValues(c.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
    musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, c.currentTime + 1.5);
    scheduleMusic();
    state.musicTimer = setInterval(scheduleMusic, 400);
  }

  function stopMusic() {
    if (!state.musicPlaying) return;
    state.musicPlaying = false;
    clearInterval(state.musicTimer);
    state.musicTimer = null;
    if (ctx) {
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    }
  }

  /* -------------------- API pública -------------------- */

  root.CF.Audio = {
    supported: !!AC,
    /** Deve ser chamado dentro de um evento de interação do usuário. */
    unlock: function () {
      ensureContext();
      if (state.music) startMusic();
    },
    play: play,
    setSound: function (on) {
      state.sound = !!on;
    },
    setMusic: function (on) {
      state.music = !!on;
      if (on) {
        if (ctx) startMusic();
      } else {
        stopMusic();
      }
    },
    /** Suspende tudo quando a aba fica oculta (economiza bateria). */
    suspend: function () {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(function () {});
    },
    resume: function () {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    },
    isMusicPlaying: function () {
      return state.musicPlaying;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
