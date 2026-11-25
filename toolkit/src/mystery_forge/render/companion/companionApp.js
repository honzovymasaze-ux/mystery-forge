// @ts-check
// The DOM glue of the companion page. It holds no game decision: companionLogic.js decides, this file draws the
// views and saves the state. The browser test (toolkit/tests/test_companion_browser.py) covers this file.

(function startCompanionApp() {
  const logic = globalThis.MysteryForgeCompanionLogic;
  const dataElement = /** @type {HTMLElement} */ (document.getElementById('companion-data'));
  /** @type {MysteryForgeCompanionData} */
  const data = JSON.parse(dataElement.textContent ?? '{}');
  const appElement = /** @type {HTMLElement} */ (document.getElementById('app'));
  const key = logic.storageKey(data.salt);

  /** @typedef {'start' | 'case' | 'evidence' | 'board' | 'check' | 'hints' | 'accuse' | 'solutions'} TabId */
  /** @typedef {{message: string, yes: string, strong: boolean, onYes: () => void}} ConfirmRequest */

  let storageWorks = true;
  let state = loadState();
  const session = {
    /** @type {TabId} */
    tab: 'start',
    /** @type {string | null} */
    checkCode: null,
    draftAnswer: '',
    /** @type {{code: string, check: MysteryForgeAnswerCheck} | null} */
    lastCheck: null,
    solutionsOpen: false,
    /** @type {string[]} */
    shownSolutions: [],
    /** @type {Record<string, string>} */
    draftChoices: {},
    accuseIncomplete: false,
    /** @type {ConfirmRequest | null} */
    confirm: null,
    introOpen: false,
  };

  /** @returns {MysteryForgeCompanionState} */
  function loadState() {
    try {
      return logic.stateFromStorage(window.localStorage.getItem(key));
    } catch {
      storageWorks = false;
      return logic.freshState();
    }
  }

  /** @param {MysteryForgeCompanionState} nextState */
  function saveState(nextState) {
    state = nextState;
    try {
      window.localStorage.setItem(key, logic.stateToStorage(state));
    } catch {
      storageWorks = false;
    }
  }

  /**
   * @param {string} name
   * @param {Record<string, string | number>} [values]
   * @returns {string}
   */
  function ui(name, values = {}) {
    return logic.fillText(data.ui[name] ?? name, values);
  }

  /**
   * @param {string} tag
   * @param {{className?: string, text?: string, attrs?: Record<string, string>}} [options]
   * @param {(Node | null)[]} [children]
   * @returns {HTMLElement}
   */
  function el(tag, options = {}, children = []) {
    const element = document.createElement(tag);
    if (options.className) {
      element.className = options.className;
    }
    if (options.text !== undefined) {
      element.textContent = options.text;
    }
    for (const [name, value] of Object.entries(options.attrs ?? {})) {
      element.setAttribute(name, value);
    }
    for (const child of children) {
      if (child !== null) {
        element.append(child);
      }
    }
    return element;
  }

  /**
   * @param {string} label
   * @param {string} className
   * @param {() => void} onClick
   * @param {Record<string, string>} [attrs]
   * @returns {HTMLElement}
   */
  function button(label, className, onClick, attrs = {}) {
    const element = el('button', { className, text: label, attrs: { type: 'button', ...attrs } });
    element.addEventListener('click', onClick);
    return element;
  }

  /** @param {ConfirmRequest} request */
  function askConfirm(request) {
    session.confirm = request;
    render();
  }

  /** @param {boolean} accepted */
  function closeConfirm(accepted) {
    const request = session.confirm;
    session.confirm = null;
    if (accepted && request !== null) {
      request.onYes();
    }
    render();
  }

  /** @param {TabId} tab */
  function showTab(tab) {
    session.tab = tab;
    render();
    window.scrollTo(0, 0);
  }

  function solvedCodes() {
    return state.solved;
  }

  function openStages() {
    return logic.unlockedStages(data, solvedCodes());
  }

  function openPuzzles() {
    return logic.visiblePuzzles(data, openStages());
  }

  function hasSealedStages() {
    return openStages().length < data.stages.length;
  }

  function metEntries() {
    return logic.caseEntries(data, openStages(), solvedCodes());
  }

  function unseenCount() {
    return logic.unseenEntries(metEntries(), state).length;
  }

  // ---------- Header, navigation, and the confirm dialog ----------

  function renderTopBar() {
    const timer = el('span', { className: 'topbar-timer', attrs: { 'data-timer-text': '', 'aria-hidden': 'true' } });
    return el('header', { className: 'topbar' }, [
      el('span', { className: 'topbar-kicker', text: ui('page_label') }),
      el('span', { className: 'topbar-title', text: data.title }),
      timer,
    ]);
  }

  /** @returns {[TabId, string, string][]} */
  function tabs() {
    /** @type {[TabId, string, string][]} */
    const list = [['start', ui('tab_start'), 'M4 5h16v14H4zM4 9h16']];
    if (data.investigation !== null) {
      list.push(['case', ui('tab_case'), 'M4 7h6l2 2h8v10H4zM8 13h8M8 16h5']);
    }
    if (data.archive !== null) {
      list.push(['evidence', ui('tab_evidence'), 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7']);
      list.push(['board', ui('tab_board'), 'M3 5h18v13H3zM7 9h4v4H7zM14 9h4M14 12h3M8 18l-2 3M16 18l2 3']);
    }
    list.push(
      ['check', ui('tab_check'), 'M5 12l4 4 10-10'],
      [
        'hints',
        ui('tab_hints'),
        'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
      ],
    );
    if (data.deduction !== null) {
      list.push(['accuse', ui('tab_accuse'), 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5']);
    }
    // The player version holds no solution, so it has no solutions tab.
    if (!data.player) {
      list.push(['solutions', ui('tab_solutions'), 'M12 3l9 16H3zM12 10v4M12 17v.5']);
    }
    return list;
  }

  function renderNav() {
    const nav = el('nav', { className: 'tabs', attrs: { 'aria-label': data.title } });
    for (const [id, label, iconPath] of tabs()) {
      const tabButton = button('', `tab${session.tab === id ? ' is-active' : ''}`, () => showTab(id), {
        'data-tab': id,
        'aria-current': session.tab === id ? 'page' : 'false',
      });
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('class', 'tab-icon');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', iconPath);
      icon.append(path);
      tabButton.append(icon, el('span', { className: 'tab-label', text: label }));
      const unseen = id === 'case' && session.tab !== 'case' ? unseenCount() : 0;
      if (unseen > 0) {
        tabButton.append(el('span', { className: 'tab-badge', text: String(unseen), attrs: { id: 'case-badge' } }));
      }
      nav.append(tabButton);
    }
    return nav;
  }

  function renderConfirm() {
    const request = session.confirm;
    if (request === null) {
      return null;
    }
    const noButton = button(ui('confirm_no'), 'button button-quiet', () => closeConfirm(false), { id: 'confirm-no' });
    const yesButton = button(
      request.yes,
      `button ${request.strong ? 'button-danger' : 'button-primary'}`,
      () => closeConfirm(true),
      {
        id: 'confirm-yes',
      },
    );
    const dialog = el(
      'div',
      {
        className: `dialog paper${request.strong ? ' dialog-strong' : ''}`,
        attrs: {
          role: 'alertdialog',
          'aria-modal': 'true',
          'aria-labelledby': 'confirm-message',
          id: 'confirm-dialog',
        },
      },
      [
        el('p', { className: 'dialog-message', text: request.message, attrs: { id: 'confirm-message' } }),
        el('div', { className: 'dialog-actions' }, [noButton, yesButton]),
      ],
    );
    const overlay = el('div', { className: 'overlay' }, [dialog]);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeConfirm(false);
      }
    });
    return overlay;
  }

  // ---------- Start ----------

  function renderTimerCard() {
    const running = state.timer.startedAt !== null;
    const started = running || state.timer.elapsedMs > 0;
    const label = running ? ui('timer_pause') : started ? ui('timer_resume') : ui('timer_start');
    const toggle = button(
      label,
      `button ${running ? 'button-quiet' : 'button-primary'} timer-toggle`,
      () => {
        const now = Date.now();
        saveState(running ? logic.pauseTimer(state, now) : logic.startTimer(state, now));
        render();
      },
      { id: 'timer-toggle' },
    );
    return el('section', { className: `timer-card${running ? ' is-running' : ''}` }, [
      el('p', { className: 'timer-label', attrs: { 'data-timer-label': '' } }),
      el('p', { className: 'timer-digits', attrs: { 'data-timer-text': '', id: 'timer-text', role: 'timer' } }),
      el('p', { className: 'timer-length', text: ui('game_length', { minutes: data.duration_minutes }) }),
      toggle,
    ]);
  }

  function renderEnvelopes() {
    const open = openStages();
    const list = el('ul', { className: 'envelopes' });
    for (const stage of data.stages) {
      const isOpen = open.includes(stage.id);
      list.append(
        el('li', { className: `envelope${isOpen ? ' is-open' : ''}`, attrs: { 'data-stage': stage.id } }, [
          el('span', { className: 'envelope-flap', attrs: { 'aria-hidden': 'true' } }),
          el('span', { className: 'envelope-name', text: stage.envelope }),
          el('span', {
            className: `chip ${isOpen ? 'chip-open' : 'chip-sealed'}`,
            text: isOpen ? ui('envelope_open') : ui('envelope_sealed'),
          }),
          // A sealed envelope shows only its letter: its label could hint at what comes next.
          isOpen ? el('span', { className: 'envelope-label', text: stage.label }) : null,
        ]),
      );
    }
    return el('section', { className: 'section' }, [
      el('h2', { className: 'section-title', text: ui('envelopes_heading') }),
      list,
    ]);
  }

  function renderEnding() {
    if (data.deduction !== null || !logic.isGameFinished(data, solvedCodes())) {
      return null;
    }
    const epilogue = logic.epilogueForPercent(logic.withOpenedEndings(data, state), 100);
    return el('section', { className: 'paper ending reveal-in', attrs: { id: 'ending' } }, [
      el('p', { className: 'stamp', text: ui('final_solved') }),
      el('h2', { className: 'paper-title', text: epilogue ? epilogue.title : ui('ending_heading') }),
      epilogue ? el('p', { text: epilogue.text }) : null,
    ]);
  }

  function renderHelp() {
    const steps = el('ol', { className: 'help-steps' });
    for (const name of ['help_1', 'help_2', 'help_3', 'help_4', 'help_5']) {
      steps.append(el('li', { text: ui(name) }));
    }
    return el('details', { className: 'help paper' }, [el('summary', { text: ui('tab_help') }), steps]);
  }

  // A phone folds a long intro (companion.css), so that the clock and the envelopes fit on the first screen.
  function renderIntro() {
    const folded = logic.isLongIntro(data.intro) && !session.introOpen;
    const more = folded
      ? button(
          ui('intro_more'),
          'button button-link intro-more',
          () => {
            session.introOpen = true;
            render();
          },
          { id: 'intro-more' },
        )
      : null;
    return el('section', { className: `paper intro${folded ? ' is-folded' : ''}`, attrs: { id: 'intro' } }, [
      el('p', { className: 'paper-kicker', text: ui('read_aloud') }),
      el('p', { className: 'intro-text', text: data.intro }),
      more,
      data.intro_audio || canSpeak()
        ? playButton(
            { type: 'chapter', id: 'intro', stage: '', after: null, text: data.intro, audio: data.intro_audio },
            ui('read_for_me'),
          )
        : null,
    ]);
  }

  function renderStart() {
    const reset = button(ui('reset'), 'button button-link', () =>
      askConfirm({
        message: ui('reset_confirm'),
        yes: ui('reset'),
        strong: true,
        onYes: startOver,
      }),
    );
    return el('div', { className: 'view' }, [
      el('div', { className: 'hero' }, [
        el('p', { className: 'kicker', text: ui('page_label') }),
        el('h1', { className: 'hero-title', text: data.title }),
        data.tagline ? el('p', { className: 'hero-tagline', text: data.tagline }) : null,
      ]),
      storageWorks ? null : el('p', { className: 'notice', text: ui('storage_off'), attrs: { id: 'storage-off' } }),
      renderHistory(),
      renderEnding(),
      renderFinish(),
      renderConnect(),
      renderIntro(),
      renderTimerCard(),
      renderEnvelopes(),
      renderHelp(),
      el('p', { className: 'reset-row' }, [reset]),
    ]);
  }

  // ---------- Case: the investigator's story and the voice messages ----------

  /** The entry that plays now, with its recording when it has one. The speech voice needs no element. */
  const playback = {
    /** @type {string | null} */
    id: null,
    /** @type {HTMLAudioElement | null} */
    audio: null,
  };

  // The TV app (tv-app/) gives the page the device's own speech engine: Android's WebView has no speechSynthesis.
  function nativeSpeech() {
    const bridge = window.MysteryForgeTts;
    return bridge !== undefined && bridge.available() ? bridge : null;
  }

  function browserSpeech() {
    return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  }

  function canSpeak() {
    return nativeSpeech() !== null || browserSpeech();
  }

  function stopPlayback() {
    playback.audio?.pause();
    nativeSpeech()?.stop();
    if (browserSpeech()) {
      window.speechSynthesis.cancel();
    }
    playback.id = null;
    playback.audio = null;
  }

  // Name hints of common system voices. A voice that matches none of them still speaks, with a lower or higher pitch.
  const FEMALE_VOICE = /female|woman|žena|zuzana|iveta|vlasta|eliška|hana|laura|samantha|victoria|google/i;
  const MALE_VOICE = /\bmale\b|\bman\b|muž|jakub|antonín|antonin|tomáš|ondřej|daniel|alex/i;

  /**
   * @param {'male' | 'female'} voice
   * @returns {SpeechSynthesisVoice | null}
   */
  function pickVoice(voice) {
    const language = data.language.toLowerCase();
    const voices = window.speechSynthesis
      .getVoices()
      .filter((candidate) => candidate.lang.toLowerCase().startsWith(language));
    const hint = voice === 'female' ? FEMALE_VOICE : MALE_VOICE;
    return voices.find((candidate) => hint.test(candidate.name)) ?? voices[0] ?? null;
  }

  /** @type {AudioContext | null} */
  let audioContext = null;

  /**
   * Make a recording sound like a phone call: a band from 300 to 3400 Hz, as a phone line carries it. It works only
   * when the page and the recording share an origin (the TV app); elsewhere the recording plays as it is.
   * @param {HTMLAudioElement} audio
   */
  function phoneFilter(audio) {
    try {
      audioContext = audioContext ?? new AudioContext();
      const source = audioContext.createMediaElementSource(audio);
      const low = audioContext.createBiquadFilter();
      low.type = 'highpass';
      low.frequency.value = 300;
      const high = audioContext.createBiquadFilter();
      high.type = 'lowpass';
      high.frequency.value = 3400;
      source.connect(low).connect(high).connect(audioContext.destination);
      void audioContext.resume();
    } catch {
      // No Web Audio here: the recording plays without the filter.
    }
  }

  /**
   * Ovládání videa přes celou obrazovku. Honza 25. 11.: „nejde to pauznout a ve chvíli, kdy do toho někdo hrábne,
   * video zmizí“. OK = pauza/pokračovat, šipky do stran = posun o 10 s, Zpět = přeskočit. Ostatní klávesy video
   * jen spolkne, aby se nehýbalo nic pod ním. Na mobilu stejná tlačítka dotykem, klepnutí do videa = pauza.
   * @param {HTMLElement} overlay
   * @param {HTMLMediaElement} media
   * @param {() => void} skip
   * @returns {() => void} odpojení ovládání
   */
  function mediaControls(overlay, media, skip) {
    const bar = document.createElement('div');
    bar.style.cssText =
      'position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;justify-content:center;align-items:center;' +
      'padding:14px 16px 18px;background:linear-gradient(transparent,rgba(0,0,0,.75));transition:opacity .4s';
    const big = document.createElement('div');
    big.textContent = '❚❚';
    big.style.cssText =
      'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:700 72px system-ui;color:#f0e6d2;' +
      'background:rgba(0,0,0,.55);border:2px solid #c9a24a;border-radius:50%;width:140px;height:140px;display:none;' +
      'align-items:center;justify-content:center;pointer-events:none';
    /** @param {string} label @param {() => void} action */
    const make = (label, action) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.textContent = label;
      b.style.cssText =
        'background:rgba(20,16,12,.85);color:#f0e6d2;border:1px solid #c9a24a;border-radius:10px;padding:10px 20px;' +
        'font:600 20px system-ui;cursor:pointer';
      b.addEventListener('click', (event) => {
        event.stopPropagation();
        action();
        wake();
      });
      bar.append(b);
      return b;
    };
    const seek = (/** @type {number} */ d) => {
      const end = Number.isFinite(media.duration) ? media.duration - 0.5 : media.currentTime + d;
      media.currentTime = Math.max(0, Math.min(end, media.currentTime + d));
    };
    const toggle = () => {
      if (media.paused) {
        void media.play().catch(() => {});
      } else {
        media.pause();
      }
    };
    make('◀◀ 10 s', () => seek(-10));
    const pauseButton = make('❚❚ Pauza', toggle);
    make('10 s ▶▶', () => seek(10));
    make('Přeskočit ▶▏', skip);
    const hint = document.createElement('span');
    hint.textContent = tvMode ? 'OK = pauza · ◀ ▶ = posun · Zpět = přeskočit' : '';
    hint.style.cssText = 'margin-left:14px;color:#c9a24a;font:600 17px system-ui;opacity:.9';
    bar.append(hint);
    overlay.append(big, bar);
    const sync = () => {
      pauseButton.textContent = media.paused ? '▶ Pokračovat' : '❚❚ Pauza';
      big.style.display = media.paused && !media.ended ? 'flex' : 'none';
      if (media.paused) wake();
    };
    media.addEventListener('play', sync);
    media.addEventListener('pause', sync);
    /** @type {number | undefined} */
    let fade;
    const wake = () => {
      bar.style.opacity = '1';
      window.clearTimeout(fade);
      fade = window.setTimeout(() => {
        if (!media.paused) bar.style.opacity = '0';
      }, 4000);
    };
    wake();
    media.addEventListener('click', () => {
      toggle();
      wake();
    });
    /** @param {KeyboardEvent} event */
    const key = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat && (event.key === 'Enter' || event.key === ' ')) return;
      wake();
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'MediaPlayPause') toggle();
      else if (event.key === 'ArrowLeft' || event.key === 'MediaRewind') seek(-10);
      else if (event.key === 'ArrowRight' || event.key === 'MediaFastForward') seek(10);
      else if (event.key === 'Escape' || event.key === 'Backspace' || event.key === 'MediaStop') skip();
    };
    document.addEventListener('keydown', key, true);
    // Tlačítko Zpět na ovladači TV jde přes appku (MainActivity), ne jako klávesa – přeskočí video.
    /** @type {any} */ (window).__mfBack = () => {
      skip();
      return true;
    };
    return () => {
      document.removeEventListener('keydown', key, true);
      window.clearTimeout(fade);
      /** @type {any} */ (window).__mfBack = null;
    };
  }
  /** @type {any} */ (window).MysteryForgeVideoControls = mediaControls;

  /**
   * Honza 25. 11.: každá kapitola má video (hlas vypravěče, fotky, hudba). Na TV/přes server se pustí přes celou
   * obrazovku; když video chybí, přehraje se jen nahrávka.
   * @param {MysteryForgeCompanionCaseEntry} entry
   * @returns {boolean}
   */
  function playChapterVideo(entry) {
    if (!String(entry.id).startsWith('kap-') || !window.location.protocol.startsWith('http')) {
      return false;
    }
    stopPlayback();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000';
    const video = document.createElement('video');
    video.src = `/video/${entry.id}.mp4`;
    video.autoplay = true;
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000';
    overlay.append(video);
    document.body.append(overlay);
    /** @type {any} */ (window).__mfVideo = true;
    /** @type {() => void} */
    let detach = () => {};
    const close = () => {
      if (!overlay.isConnected) return;
      video.pause();
      overlay.remove();
      detach();
      /** @type {any} */ (window).__mfVideo = false;
      render();
      // Ovladač TV: focus zpět na tlačítko, kterým se video pustilo.
      /** @type {HTMLElement | null} */ (document.querySelector(`[data-play="${entry.id}"]`))?.focus();
    };
    detach = mediaControls(overlay, video, close);
    video.addEventListener('ended', close);
    video.addEventListener('error', () => {
      close();
      // Bez videa aspoň nahrávka.
      if (entry.audio) {
        const audio = new Audio(entry.audio);
        playback.id = entry.id;
        playback.audio = audio;
        audio.addEventListener('ended', () => { playback.id = null; playback.audio = null; render(); });
        audio.play().catch(() => {});
        render();
      }
    });
    video.play().catch(() => {});
    return true;
  }

  /** @param {MysteryForgeCompanionCaseEntry} entry */
  function togglePlayback(entry) {
    if (playback.id === entry.id && playback.audio && String(entry.id).startsWith('vypoved-')) {
      if (playback.audio.paused) {
        void playback.audio.play().catch(() => {});
      } else {
        playback.audio.pause();
      }
      render();
      return;
    }
    if (playback.id !== entry.id && playChapterVideo(entry)) {
      return;
    }
    const wasPlaying = playback.id === entry.id;
    stopPlayback();
    if (!wasPlaying) {
      const done = () => {
        if (playback.id === entry.id) {
          playback.id = null;
          playback.audio = null;
          render();
        }
      };
      if (entry.audio) {
        const audio = new Audio(entry.audio);
        // From file:// a filtered recording can turn silent, so the filter runs only when the TV serves the page.
        if (entry.type === 'voice' && window.location.protocol.startsWith('http')) {
          phoneFilter(audio);
        }
        audio.addEventListener('ended', done);
        playback.id = entry.id;
        playback.audio = audio;
        audio.play().catch(done);
      } else if (nativeSpeech() !== null) {
        const settings = logic.speechSettings(entry.voice ?? 'male');
        playback.id = entry.id;
        window.MysteryForgeTtsDone = (id) => {
          if (id === entry.id) {
            done();
          }
        };
        nativeSpeech()?.speak(entry.id, entry.text, data.language, settings.pitch, settings.rate);
      } else if (browserSpeech()) {
        const voice = entry.voice ?? 'male';
        const utterance = new window.SpeechSynthesisUtterance(entry.text);
        utterance.lang = data.language;
        const chosen = pickVoice(voice);
        if (chosen !== null) {
          utterance.voice = chosen;
        }
        const settings = logic.speechSettings(voice);
        utterance.pitch = settings.pitch;
        utterance.rate = settings.rate;
        utterance.addEventListener('end', done);
        utterance.addEventListener('error', done);
        playback.id = entry.id;
        window.speechSynthesis.speak(utterance);
      }
    }
    render();
  }

  /**
   * @param {MysteryForgeCompanionCaseEntry} entry
   * @param {string} label
   * @returns {HTMLElement}
   */
  function playButton(entry, label) {
    const playing = playback.id === entry.id;
    return button(
      playing ? `■ ${ui('voice_stop')}` : `▶ ${label}`,
      `button ${playing ? 'button-quiet' : 'button-primary'} play-button${playing ? ' is-playing' : ''}`,
      () => togglePlayback(entry),
      { 'data-play': entry.id, 'aria-pressed': playing ? 'true' : 'false' },
    );
  }

  /**
   * @param {MysteryForgeCompanionCaseEntry} entry
   * @param {boolean} isNew
   * @returns {HTMLElement}
   */
  function renderChapter(entry, isNew) {
    const stage = data.stages.find((candidate) => candidate.id === entry.stage);
    const text = el('div', { className: 'chapter-text' });
    for (const paragraph of logic.paragraphs(entry.text)) {
      text.append(el('p', { text: paragraph }));
    }
    return el('article', { className: 'paper chapter reveal-in', attrs: { 'data-entry': entry.id } }, [
      el('p', { className: 'paper-kicker' }, [
        el('span', { text: `${ui('chapter_kicker')} · ${stage ? stage.envelope : entry.stage}` }),
        isNew ? el('span', { className: 'chip chip-new', text: ui('entry_new') }) : null,
      ]),
      el('h3', { className: 'paper-title', text: entry.title ?? '' }),
      el('p', { className: 'chapter-read-aloud', text: ui('read_aloud') }),
      text,
      canSpeak() ? playButton(entry, ui('read_for_me')) : null,
    ]);
  }

  /**
   * @param {MysteryForgeCompanionCaseEntry} entry
   * @param {boolean} isNew
   * @returns {HTMLElement}
   */
  function renderVoice(entry, isNew) {
    const sender = entry.sender ?? '';
    const initials = sender
      .split(/\s+/)
      .filter((part) => part !== '')
      .slice(-2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
    const playable = Boolean(entry.audio) || canSpeak();
    const bars = el('span', { className: 'voice-bars', attrs: { 'aria-hidden': 'true' } });
    for (let index = 0; index < 18; index += 1) {
      bars.append(el('span'));
    }
    return el(
      'article',
      {
        className: `voice${playback.id === entry.id ? ' is-playing' : ''} reveal-in`,
        attrs: { 'data-entry': entry.id },
      },
      [
        el('span', { className: `voice-avatar voice-${entry.voice ?? 'male'}`, text: initials }),
        el('div', { className: 'voice-bubble' }, [
          el('p', { className: 'voice-head' }, [
            el('span', { className: 'voice-sender', text: sender }),
            entry.role ? el('span', { className: 'voice-role', text: entry.role }) : null,
            isNew ? el('span', { className: 'chip chip-new', text: ui('entry_new') }) : null,
          ]),
          el('p', { className: 'voice-kicker', text: ui('voice_kicker') }),
          el('div', { className: 'voice-player' }, [playable ? playButton(entry, ui('voice_play')) : null, bars]),
          playable ? null : el('p', { className: 'notice', text: ui('no_speech') }),
          el('details', { className: 'voice-transcript', attrs: { open: playable ? '' : 'open' } }, [
            el('summary', { text: ui('voice_transcript') }),
            el('p', { text: entry.text }),
          ]),
        ]),
      ],
    );
  }

  function renderCase() {
    const investigation = data.investigation;
    const entries = metEntries();
    const unseen = logic.unseenEntries(entries, state).map((entry) => entry.id);
    const view = el('div', { className: 'view view-case' }, [
      el('h2', { className: 'view-title', text: ui('case_heading') }),
      investigation
        ? el('p', {
            className: 'view-intro case-narrator',
            text: `${investigation.narrator.name} · ${investigation.narrator.role}`,
          })
        : null,
    ]);
    if (entries.length === 0) {
      view.append(el('p', { className: 'empty', text: ui('case_empty') }));
    }
    for (const entry of entries) {
      const isNew = unseen.includes(entry.id);
      view.append(entry.type === 'chapter' ? renderChapter(entry, isNew) : renderVoice(entry, isNew));
    }
    // The "new" chips show on this visit only: the group has now seen these entries.
    if (unseen.length > 0) {
      saveState(logic.withSeen(state, unseen));
    }
    return view;
  }

  /** After a correct answer: say that the case has new chapters or voice messages, and offer the case tab. */
  function renderCaseNotice() {
    const count = data.investigation === null ? 0 : unseenCount();
    if (count === 0) {
      return null;
    }
    return el('div', { className: 'case-notice', attrs: { id: 'case-notice' } }, [
      el('p', { className: 'case-notice-text', text: ui('new_entries', { count }) }),
      button(ui('new_entries_open'), 'button button-primary', () => showTab('case')),
    ]);
  }

  // ---------- Evidence: the archive of every printed document ----------

  /** @type {Map<string, MysteryForgeOpenStage | null>} */
  const openedStages = new Map();

  /**
   * The content of an envelope of the archive, or null while it stays sealed. Opening costs many hashes, so the page
   * keeps each result until the group finds a new answer.
   * @param {MysteryForgeArchiveStage} stage
   * @returns {MysteryForgeOpenStage | null}
   */
  function archiveContent(stage) {
    const key = `${stage.id}:${Object.keys(state.answers ?? {}).join(',')}`;
    if (!openedStages.has(key)) {
      openedStages.set(key, logic.openArchiveStage(data, stage, state));
    }
    return openedStages.get(key) ?? null;
  }

  /** The document viewer: the list that it pages through, and how it shows the current document. */
  const viewer = {
    /** @type {MysteryForgeArchiveDocument[]} */
    list: [],
    index: -1,
    zoom: 1,
    paper: false,
  };

  function viewerOpen() {
    return viewer.index >= 0;
  }

  /**
   * @param {MysteryForgeArchiveDocument[]} list
   * @param {number} index
   */
  function openViewer(list, index) {
    viewer.list = list;
    viewer.index = index;
    viewer.zoom = 1;
    viewer.paper = /** @type {MysteryForgeArchiveDocument} */ (list[index]).screen === null;
    render();
    document.getElementById('viewer-close')?.focus();
  }

  /** @param {number} step */
  function moveViewerFocus(step) {
    const buttons = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.viewer-bar button')]).filter(
      (b) => !(/** @type {HTMLButtonElement} */ (b).disabled),
    );
    if (buttons.length === 0) {
      moveViewer(step);
      return;
    }
    const at = buttons.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    const next = at === -1 ? buttons.length - 1 : (at + step + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  function closeViewer() {
    if (String(playback.id ?? '').startsWith('vypoved-')) {
      stopPlayback();
    }
    const id = viewer.list[viewer.index]?.id;
    viewer.index = -1;
    render();
    if (id !== undefined) {
      /** @type {HTMLElement | null} */ (document.querySelector(`[data-document="${id}"]`))?.focus();
    }
  }

  /** @param {number} step */
  function moveViewer(step) {
    const next = viewer.index + step;
    if (next >= 0 && next < viewer.list.length) {
      // Focus zůstane na šipce, kterou se listuje – další stisk OK listuje dál (na TV ovladačem).
      const stay = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
      openViewer(viewer.list, next);
      if (stay === 'viewer-prev' || stay === 'viewer-next') {
        document.getElementById(stay)?.focus();
      }
    }
  }

  /** @param {number} step */
  function zoomViewer(step) {
    viewer.zoom = Math.min(3, Math.max(0.5, Math.round((viewer.zoom + step) * 10) / 10));
    render();
  }

  /** @param {number} pixels */
  function scrollViewer(pixels) {
    const frame = document.getElementById('viewer-frame');
    if (frame instanceof HTMLIFrameElement) {
      frame.contentWindow?.scrollBy(0, pixels);
    } else {
      document.getElementById('viewer-body')?.scrollBy(0, pixels);
    }
  }

  /**
   * @param {MysteryForgeOpenStage} content
   * @returns {HTMLElement | null}
   */
  function waitingNote(content) {
    return content.waiting.length > 0
      ? el('p', { className: 'locked-note', text: ui('evidence_waiting', { count: content.waiting.length }) })
      : null;
  }

  /** @param {string} text */
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
  }

  /**
   * Honza 25. 11.: „v telefonu dát možnost vytisknout všechny důkazy po jednotlivých kapitolách, aby to bylo
   * nachystané, ale aby se to nezamíchalo – i se seznamem důkazů a požadavkem splnění úkolu na kapitolu“.
   * Každá obálka = krycí list (seznam důkazů, úkoly obálky, co otevře další obálku) + její dokumenty v pořadí.
   * Tisknout jde jen otevřené obálky – zapečetěné jsou zašifrované, dokud skupina nevyřeší úkol.
   * @param {string[]} stageIds
   */
  function printEnvelopes(stageIds) {
    const archive = /** @type {MysteryForgeArchive} */ (data.archive);
    const parts = [];
    for (const stage of archive.stages) {
      if (!stageIds.includes(stage.id)) continue;
      const content = archiveContent(stage);
      if (content === null) continue;
      const info = data.stages.find((candidate) => candidate.id === stage.id);
      const puzzles = data.puzzles.filter((puzzle) => puzzle.stage === stage.id);
      const solved = solvedCodes();
      const rows = content.documents
        .map(
          (doc, index) =>
            `<tr><td>${index + 1}.</td><td class="c-id">${escapeHtml(doc.id === 'characters' ? '—' : doc.id)}</td>` +
            `<td>${escapeHtml(doc.title)}</td><td class="c-n">${doc.sheets.length}</td><td class="c-box">☐</td></tr>`,
        )
        .join('');
      const tasks = puzzles
        .map((puzzle) => {
          const next = puzzle.unlocks ? data.stages.find((candidate) => candidate.id === puzzle.unlocks) : null;
          return (
            `<li><b>${escapeHtml(puzzle.code)} · ${escapeHtml(puzzle.title)}</b>${solved.includes(puzzle.code) ? ' <span class="c-ok">✓ vyřešeno</span>' : ''}` +
            `<br><span class="c-muted">Hledaná odpověď: ${escapeHtml(puzzle.answer_format)}</span>` +
            (next ? `<br><span class="c-key">Po vyřešení se otevře ${escapeHtml(next.envelope)} – ${escapeHtml(next.label)}.</span>` : '') +
            '</li>'
          );
        })
        .join('');
      const opens = info && info.opens_with && info.opens_with !== 'start' ? `Otevírá se po vyřešení úkolu ${escapeHtml(info.opens_with)}.` : 'Otevírá se na začátku hry.';
      const waiting = content.waiting.length > 0 ? `<p class="c-muted">Další ${content.waiting.length} dokument(y) této obálky se odemknou až po vyřešení dalšího úkolu – vytiskněte je pak zvlášť.</p>` : '';
      const total = content.documents.reduce((sum, doc) => sum + doc.sheets.length, 0);
      parts.push(
        `<section class="mf-cover"><p class="c-kicker">${escapeHtml(data.title)} · spis</p>` +
          `<h1>${escapeHtml(stage.envelope)}</h1><h2>${escapeHtml(content.label || info?.label || '')}</h2>` +
          `<p class="c-muted">${opens} Dokumentů: ${content.documents.length}, listů: ${total}.</p>` +
          `<h3>Seznam důkazů v obálce</h3><table><thead><tr><th>#</th><th>Ozn.</th><th>Dokument</th><th>Listů</th><th>✓</th></tr></thead><tbody>${rows}</tbody></table>` +
          waiting +
          `<h3>Úkoly této obálky</h3><ol class="c-tasks">${tasks}</ol>` +
          `<p class="c-stamp">${escapeHtml(stage.envelope)}</p></section>` +
          content.documents.map((doc) => doc.sheets.join('')).join(''),
      );
    }
    if (parts.length === 0) return;
    const html =
      `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${escapeHtml(data.title)} – tisk obálek</title><style>${archive.css}` +
      `@page{size:A4;margin:10mm}body{background:#fff}.sheet{margin:0 auto;break-after:page}` +
      `.mf-cover{break-after:page;break-before:page;position:relative;max-width:180mm;margin:0 auto;padding:6mm 2mm;font-family:Georgia,'Times New Roman',serif;color:#222}` +
      `.mf-cover h1{font-size:30pt;margin:2mm 0 0;letter-spacing:.04em;text-transform:uppercase}.mf-cover h2{font-size:16pt;margin:0 0 4mm;font-weight:400;font-style:italic}` +
      `.mf-cover h3{font-size:12pt;margin:7mm 0 2mm;text-transform:uppercase;letter-spacing:.08em;border-bottom:1.5pt solid #222;padding-bottom:1mm}` +
      `.mf-cover table{width:100%;border-collapse:collapse;font-size:10.5pt}.mf-cover th,.mf-cover td{border-bottom:.5pt solid #999;padding:1.6mm 2mm;text-align:left;vertical-align:top}` +
      `.mf-cover .c-id{font-family:'Courier New',monospace;font-weight:700;white-space:nowrap}.mf-cover .c-n,.mf-cover .c-box{text-align:center;width:12mm}` +
      `.c-kicker{font-family:'Courier New',monospace;font-size:9pt;letter-spacing:.15em;text-transform:uppercase;margin:0}.c-muted{color:#555;font-size:10pt}` +
      `.c-tasks li{margin:0 0 3mm;font-size:11pt}.c-key{color:#8e2a1e;font-size:10pt}.c-ok{color:#2f7a4c}` +
      `.c-stamp{position:absolute;right:4mm;top:6mm;margin:0;border:2.5pt solid #b33a2b;color:#b33a2b;padding:1mm 4mm;font:700 14pt 'Courier New',monospace;text-transform:uppercase;transform:rotate(6deg);opacity:.85}` +
      `@media screen{body{background:#555}.mf-cover{background:#fff;margin:8mm auto;padding:10mm}}</style></head>` +
      `<body class="${archive.body_class} output-materials">${parts.join('')}<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},600)})<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      return;
    }
    // Zablokované okno: tisk přes skrytý rámeček.
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    frame.srcdoc = html.replace(/<script>[\s\S]*?<\/script>/, '');
    frame.addEventListener('load', () => {
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 60000);
    });
    document.body.append(frame);
  }

  function renderEvidence() {
    const archive = /** @type {MysteryForgeArchive} */ (data.archive);
    const view = el('div', { className: 'view view-evidence' }, [
      el('h2', { className: 'view-title', text: ui('evidence_heading') }),
    ]);
    // Tisk z mobilu – na TV nemá smysl.
    const printable = archive.stages.filter((stage) => archiveContent(stage) !== null).map((stage) => stage.id);
    if (!tvMode && printable.length > 0) {
      view.append(
        el('p', { className: 'print-row' }, [
          button(`🖨 Vytisknout všechny otevřené obálky (${printable.length})`, 'button button-quiet print-all', () =>
            printEnvelopes(printable),
          ),
        ]),
      );
    }
    /** @type {MysteryForgeArchiveDocument[]} */
    const all = [];
    for (const stage of archive.stages) {
      const content = archiveContent(stage);
      if (content === null) {
        view.append(
          el('section', { className: 'evidence-stage is-sealed', attrs: { 'data-stage': stage.id } }, [
            el('h3', { className: 'section-title', text: stage.envelope }),
            el('p', { className: 'locked-note', text: ui('evidence_sealed') }),
          ]),
        );
        continue;
      }
      const list = el('ul', { className: 'evidence-list' });
      for (const documentEntry of content.documents) {
        const index = all.length;
        all.push(documentEntry);
        list.append(
          el('li', {}, [
            button(
              documentEntry.title,
              `evidence-item${documentEntry.screen !== null ? ' is-digital' : ''}`,
              () => openViewer(all, index),
              { 'data-document': documentEntry.id, 'data-kind': documentEntry.kind },
            ),
          ]),
        );
      }
      view.append(
        el('section', { className: 'evidence-stage', attrs: { 'data-stage': stage.id } }, [
          el('h3', {
            className: 'section-title',
            text: content.label ? `${stage.envelope} · ${content.label}` : stage.envelope,
          }),
          list,
          waitingNote(content),
          tvMode
            ? null
            : button(`🖨 Vytisknout ${stage.envelope.replace(/^Obálka/, "obálku")}`, 'button button-link print-stage', () => printEnvelopes([stage.id])),
        ]),
      );
    }
    return view;
  }

  /**
   * The printed look: the sheets of the document in an isolated frame with the theme of the materials. A sheet is
   * as wide as the paper, so the frame zooms it to the screen width first.
   * @param {MysteryForgeArchiveDocument} documentEntry
   * @returns {HTMLElement}
   */
  function renderPaper(documentEntry) {
    const archive = /** @type {MysteryForgeArchive} */ (data.archive);
    const fit = Math.min(1.4, Math.max(0.3, (window.innerWidth - 24) / 820));
    const zoom = Math.round(fit * viewer.zoom * 100) / 100;
    const frame = el('iframe', {
      className: 'viewer-frame',
      attrs: { id: 'viewer-frame', title: documentEntry.title, tabindex: '-1' },
    });
    frame.setAttribute(
      'srcdoc',
      `<!doctype html><html><head><meta charset="utf-8"><style>${archive.css}
html{zoom:${zoom}}body{background:#2b2721;padding:12px 0}.sheet{margin:0 auto 16px}</style></head>` +
        `<body class="${archive.body_class} output-materials">${documentEntry.sheets.join('')}</body></html>`,
    );
    return frame;
  }

  /**
   * @param {string} html
   * @param {string} className
   * @returns {HTMLElement}
   */
  function htmlBlock(html, className) {
    const block = el('div', { className });
    // The toolkit builds this HTML from the game files and escapes every text in it, like the printed materials.
    block.innerHTML = html;
    return block;
  }

  /**
   * A digital document as the screen of the device that holds it: a phone chat, a call log, a mail client, a camera.
   * @param {MysteryForgeScreen} screen
   * @param {string} title
   * @returns {HTMLElement}
   */
  function renderScreen(screen, title) {
    const fields = screen.fields;
    if (screen.type === 'chat') {
      const contact = fields.contact ?? title;
      const thread = el('div', { className: 'chat-thread' });
      for (const message of screen.messages ?? []) {
        if (!message.speaker) {
          thread.append(htmlBlock(message.html, 'chat-note'));
          continue;
        }
        const incoming = contact.toLowerCase().includes(message.speaker.toLowerCase());
        thread.append(
          el('div', { className: `chat-bubble ${incoming ? 'is-in' : 'is-out'}` }, [
            el('span', { className: 'chat-speaker', text: message.speaker }),
            htmlBlock(message.html, 'chat-text'),
          ]),
        );
      }
      return el('div', { className: 'device phone' }, [
        el('div', { className: 'phone-bar' }, [
          el('span', { className: 'phone-avatar', text: contact.slice(0, 1).toUpperCase() }),
          el('span', { className: 'phone-contact', text: contact }),
          el('span', { className: 'phone-meta', text: fields.date ?? '' }),
        ]),
        thread,
      ]);
    }
    if (screen.type === 'calls') {
      const list = el('ol', { className: 'call-list' });
      const header = screen.header ?? [];
      for (const row of screen.rows ?? []) {
        const kind = row.join(' ').toLowerCase();
        const direction = /odchoz|outgoing|saliente|sortant|ausgehend|uscente|efectuad/.test(kind) ? 'out' : 'in';
        list.append(
          el('li', { className: `call call-${direction}` }, [
            el('span', {
              className: 'call-icon',
              text: direction === 'out' ? '↗' : '↙',
              attrs: { 'aria-hidden': 'true' },
            }),
            el('span', { className: 'call-main', text: row.slice(1).join(' · ') }),
            el('span', { className: 'call-time', text: row[0] ?? '' }),
          ]),
        );
      }
      return el('div', { className: 'device phone' }, [
        el('div', { className: 'phone-bar' }, [
          el('span', { className: 'phone-contact', text: fields.subscriber ?? title }),
          el('span', { className: 'phone-meta', text: fields.phone_number ?? '' }),
        ]),
        header.length > 0 ? el('p', { className: 'call-header', text: header.join(' · ') }) : null,
        list,
      ]);
    }
    if (screen.type === 'email') {
      return el('div', { className: 'device mail' }, [
        el('div', { className: 'mail-head' }, [
          el('p', { className: 'mail-subject', text: fields.subject ?? title }),
          el('p', { className: 'mail-line', text: `${ui('mail_from')}: ${fields.from ?? ''}` }),
          el('p', { className: 'mail-line', text: `${ui('mail_to')}: ${fields.to ?? ''}` }),
          fields.cc ? el('p', { className: 'mail-line', text: `Cc: ${fields.cc}` }) : null,
          el('p', { className: 'mail-date', text: fields.date ?? '' }),
        ]),
        htmlBlock(screen.html ?? '', 'mail-body'),
      ]);
    }
    return el('div', { className: 'device camera' }, [
      el('div', { className: 'camera-screen' }, [
        el('span', { className: 'camera-rec', text: '● REC' }),
        el('span', { className: 'camera-name', text: fields.camera ?? '' }),
        htmlBlock(screen.html ?? '', 'camera-picture'),
        el('span', { className: 'camera-place', text: fields.location ?? '' }),
        el('span', { className: 'camera-time', text: `${fields.date ?? ''} ${fields.time ?? ''}`.trim() }),
      ]),
      el('div', { className: 'camera-controls', attrs: { 'aria-hidden': 'true' } }, [
        el('span', { text: '⏮' }),
        el('span', { text: '▶' }),
        el('span', { className: 'camera-track' }),
        el('span', { text: fields.evidence_number ?? '' }),
      ]),
    ]);
  }

  function renderViewer() {
    if (!viewerOpen()) {
      return null;
    }
    const documentEntry = /** @type {MysteryForgeArchiveDocument} */ (viewer.list[viewer.index]);
    const screen = documentEntry.screen;
    const showPaper = viewer.paper || screen === null;
    const body = showPaper
      ? renderPaper(documentEntry)
      : el('div', { className: 'viewer-screen', attrs: { style: `zoom:${viewer.zoom}` } }, [
          renderScreen(/** @type {MysteryForgeScreen} */ (screen), documentEntry.title),
        ]);
    const bar = el('div', { className: 'viewer-bar' }, [
      el('p', { className: 'viewer-title', text: documentEntry.title }),
      el('span', { className: 'viewer-count', text: `${viewer.index + 1} / ${viewer.list.length}` }),
      button('‹', 'button button-quiet viewer-button', () => moveViewer(-1), {
        'aria-label': ui('viewer_prev'),
        id: 'viewer-prev',
      }),
      button('›', 'button button-quiet viewer-button', () => moveViewer(1), {
        'aria-label': ui('viewer_next'),
        id: 'viewer-next',
      }),
      button('−', 'button button-quiet viewer-button', () => zoomViewer(-0.2), { 'aria-label': ui('viewer_zoom_out') }),
      button('+', 'button button-quiet viewer-button', () => zoomViewer(0.2), { 'aria-label': ui('viewer_zoom_in') }),
      screen !== null
        ? button(
            showPaper ? ui('viewer_screen') : ui('viewer_paper'),
            'button button-quiet',
            () => {
              viewer.paper = !showPaper;
              render();
            },
            { id: 'viewer-toggle' },
          )
        : null,
      // Namluvené výslechy (ElevenLabs): TV je servíruje z assets jako /audio/vypoved-<id>.mp3.
      documentEntry.kind === 'transcript' && window.location.protocol.startsWith('http')
        ? button(
            playback.id === `vypoved-${documentEntry.id}` ? (playback.audio?.paused ? '▶ Pokračovat' : '❚❚ Pauza') : '▶ Výpověď',
            'button button-quiet',
            () =>
              togglePlayback(
                /** @type {MysteryForgeCompanionCaseEntry} */ (
                  /** @type {unknown} */ ({ id: `vypoved-${documentEntry.id}`, type: 'chapter', audio: `/audio/vypoved-${documentEntry.id}.mp3`, text: '' })
                ),
              ),
            { id: 'viewer-voice' },
          )
        : null,
      button(ui('close'), 'button button-primary', closeViewer, { id: 'viewer-close' }),
    ]);
    // Klíč dokumentu: render() podle něj pozná, že stačí vyměnit lištu a dokument (rámeček) nechat, jak je.
    const viewerKey = `${documentEntry.id}|${showPaper}|${viewer.zoom}`;
    return el('div', { className: 'viewer', attrs: { role: 'dialog', 'aria-modal': 'true', id: 'viewer', 'data-key': viewerKey } }, [
      bar,
      el('div', { className: 'viewer-body', attrs: { id: 'viewer-body', tabindex: '-1' } }, [body]),
    ]);
  }

  // ---------- Evidence board ----------

  // The board is the group's own work, like cards and notes on a real wall. The page never checks it.
  const PERSON_STATUSES = ['suspect', 'unsure', 'cleared', 'witness'];
  const QUICK_LABELS = ['motive', 'alibi_ok', 'alibi_weak', 'lies', 'conflict'];
  const PICTURE_KINDS = ['person-photo', 'cctv-still', 'photo'];
  const LONG_PRESS_MS = 550;
  const NOTES_ON_CARD = 2;
  const boardSession = {
    /** @type {{type: 'card' | 'person', id: string, page: 'main' | 'assign' | 'labels'} | null} */
    menu: null,
    /** @type {{target: string, noteId: string | null, draft: string} | null} */
    note: null,
    /** @type {{target: string, at: number, handled: boolean} | null} */
    press: null,
  };

  /** @returns {{stage: MysteryForgeArchiveStage, content: MysteryForgeOpenStage}[]} */
  function openEnvelopes() {
    const archive = /** @type {MysteryForgeArchive} */ (data.archive);
    /** @type {{stage: MysteryForgeArchiveStage, content: MysteryForgeOpenStage}[]} */
    const open = [];
    for (const stage of archive.stages) {
      const content = archiveContent(stage);
      if (content !== null) {
        open.push({ stage, content });
      }
    }
    return open;
  }

  /** @returns {Map<string, MysteryForgeArchiveDocument>} */
  function documentsById() {
    const byId = new Map();
    for (const { content } of openEnvelopes()) {
      for (const documentEntry of content.documents) {
        byId.set(documentEntry.id, documentEntry);
      }
    }
    return byId;
  }

  /** @param {string} id */
  function personById(id) {
    return /** @type {MysteryForgeArchive} */ (data.archive).people.find((person) => person.id === id);
  }

  /**
   * The first drawing or photo of a document, for the card of a photo or a camera still.
   * @param {MysteryForgeArchiveDocument} documentEntry
   * @returns {string}
   */
  function cardPicture(documentEntry) {
    if (!PICTURE_KINDS.includes(documentEntry.kind)) {
      return '';
    }
    const match = /<svg[\s\S]*?<\/svg>/.exec(documentEntry.sheets.join(''));
    return match ? match[0] : '';
  }

  /** @param {(next: MysteryForgeCompanionState) => MysteryForgeCompanionState} change */
  function changeBoard(change) {
    saveState(change(state));
    pushShared();
    render();
  }

  /**
   * The quick labels and the first sticky notes of a card or a person.
   * @param {string} target
   * @returns {(HTMLElement | null)[]}
   */
  function boardMarks(target) {
    const board = logic.boardOf(state);
    const labels = board.labels[target] ?? [];
    const notes = board.notes[target] ?? [];
    return [
      labels.length > 0
        ? el(
            'span',
            { className: 'card-labels' },
            labels.map((label) =>
              el('span', { className: `card-label label-${label}`, text: ui(`board_label_${label}`) }),
            ),
          )
        : null,
      ...notes.slice(0, NOTES_ON_CARD).map((note) => el('span', { className: 'sticky', text: note.text })),
      notes.length > NOTES_ON_CARD
        ? el('span', { className: 'sticky sticky-more', text: `+${notes.length - NOTES_ON_CARD}` })
        : null,
    ];
  }

  /**
   * @param {HTMLElement} element
   * @param {'card' | 'person'} type
   * @param {string} id
   */
  function wirePress(element, type, id) {
    element.addEventListener('click', () => {
      if (boardSession.press === null) {
        if (type === 'card') {
          openCard(id);
        } else {
          openBoardMenu('person', id);
        }
      }
    });
    element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openBoardMenu(type, id);
    });
  }

  /**
   * @param {MysteryForgeArchiveDocument} documentEntry
   * @param {boolean} pinned
   * @returns {HTMLElement}
   */
  function boardCard(documentEntry, pinned) {
    const board = logic.boardOf(state);
    const picture = cardPicture(documentEntry);
    const linked = (board.links[documentEntry.id] ?? []).map((id) => personById(id)?.name ?? id);
    const card = el(
      'button',
      {
        className: `board-card${pinned ? ' is-pinned' : ''}`,
        attrs: { type: 'button', 'data-card': documentEntry.id, 'data-kind': documentEntry.kind },
      },
      [
        pinned ? el('span', { className: 'pin', attrs: { 'aria-hidden': 'true' } }) : null,
        picture
          ? htmlBlock(picture, 'card-picture')
          : el('span', {
              className: 'card-glyph',
              text: documentEntry.screen ? '▯' : '▤',
              attrs: { 'aria-hidden': 'true' },
            }),
        el('span', { className: 'card-title', text: documentEntry.title }),
        linked.length > 0 ? el('span', { className: 'card-links', text: `→ ${linked.join(', ')}` }) : null,
        ...boardMarks(documentEntry.id),
      ],
    );
    wirePress(card, 'card', documentEntry.id);
    return card;
  }

  /**
   * @param {{id: string, name: string, role: string, portrait: string, victim: boolean}} person
   * @returns {HTMLElement}
   */
  function personCard(person) {
    const board = logic.boardOf(state);
    const status = board.people[person.id] ?? '';
    const linked = logic.linkedDocuments(board, person.id).length;
    const card = el(
      'button',
      {
        className: `board-person${person.victim ? ' is-victim' : ''}${status ? ` status-${status}` : ''}`,
        attrs: { type: 'button', 'data-person': person.id },
      },
      [
        person.portrait
          ? htmlBlock(person.portrait, 'person-picture')
          : el('span', { className: 'person-picture is-empty' }),
        status === 'cleared' ? el('span', { className: 'person-stamp', text: ui('board_status_cleared') }) : null,
        el('span', { className: 'person-name', text: person.name }),
        el('span', {
          className: 'person-role',
          text: person.victim ? ui('board_victim') : status ? ui(`board_status_${status}`) : person.role,
        }),
        linked > 0 ? el('span', { className: 'person-links', text: ui('board_linked', { count: linked }) }) : null,
        ...boardMarks(person.id),
      ],
    );
    wirePress(card, 'person', person.id);
    return card;
  }

  /** @param {string} id */
  function openCard(id) {
    const byId = documentsById();
    const pinned = logic
      .boardOf(state)
      .pinned.map((pinnedId) => byId.get(pinnedId))
      .filter((entry) => entry !== undefined);
    const list = pinned.some((entry) => entry.id === id) ? pinned : Array.from(byId.values());
    openViewer(
      list,
      Math.max(
        0,
        list.findIndex((entry) => entry.id === id),
      ),
    );
  }

  /**
   * @param {'card' | 'person'} type
   * @param {string} id
   * @param {'main' | 'assign' | 'labels'} [page]
   */
  function openBoardMenu(type, id, page = 'main') {
    boardSession.menu = { type, id, page };
    boardSession.note = null;
    render();
    /** @type {HTMLElement | null} */ (document.querySelector('#board-menu button'))?.focus();
  }

  function closeBoardMenu() {
    const menu = boardSession.menu;
    boardSession.menu = null;
    boardSession.note = null;
    render();
    if (menu !== null) {
      const selector = menu.type === 'card' ? `[data-card="${menu.id}"]` : `[data-person="${menu.id}"]`;
      /** @type {HTMLElement | null} */ (document.querySelector(selector))?.focus();
    }
  }

  /**
   * @param {string} target
   * @param {string | null} noteId
   * @param {string} draft
   */
  function editNote(target, noteId, draft) {
    boardSession.note = { target, noteId, draft };
    render();
    const field = document.getElementById('note-input');
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
    }
  }

  function renderNoteEditor() {
    const note = /** @type {{target: string, noteId: string | null, draft: string}} */ (boardSession.note);
    const field = el('textarea', {
      className: 'note-input',
      attrs: { id: 'note-input', rows: '4', maxlength: '240', placeholder: ui('board_note_placeholder') },
    });
    /** @type {HTMLTextAreaElement} */ (field).value = note.draft;
    field.addEventListener('input', () => {
      note.draft = /** @type {HTMLTextAreaElement} */ (field).value;
    });
    /** @param {string} text */
    const save = (text) => {
      changeBoard((next) => logic.withNote(next, note.target, note.noteId, text, Date.now()));
      boardSession.note = null;
      render();
      /** @type {HTMLElement | null} */ (document.querySelector('#board-menu button'))?.focus();
    };
    return el('div', { className: 'note-editor' }, [
      field,
      el('div', { className: 'board-menu-actions' }, [
        button(ui('board_note_save'), 'button button-primary', () => save(note.draft), { id: 'note-save' }),
        note.noteId !== null ? button(ui('board_note_delete'), 'button button-danger-quiet', () => save('')) : null,
        button(ui('board_back'), 'button button-quiet', () => {
          boardSession.note = null;
          render();
        }),
      ]),
    ]);
  }

  function renderBoardMenu() {
    const menu = boardSession.menu;
    if (menu === null) {
      return null;
    }
    const board = logic.boardOf(state);
    const documentEntry = menu.type === 'card' ? documentsById().get(menu.id) : undefined;
    const person = menu.type === 'person' ? personById(menu.id) : undefined;
    if (documentEntry === undefined && person === undefined) {
      return null;
    }
    const id = menu.id;
    /**
     * @param {string} label
     * @param {(next: MysteryForgeCompanionState) => MysteryForgeCompanionState} change
     * @param {boolean} [active]
     */
    const toggle = (label, change, active = false) =>
      button(`${active ? '✓ ' : ''}${label}`, `button ${active ? 'button-primary' : 'button-quiet'}`, () =>
        changeBoard(change),
      );
    /** @param {'main' | 'assign' | 'labels'} page */
    const goTo = (page) => openBoardMenu(menu.type, id, page);
    /** @type {(HTMLElement | null)[]} */
    let actions = [];
    if (boardSession.note !== null) {
      actions = [renderNoteEditor()];
    } else if (menu.page === 'assign') {
      const linked = board.links[id] ?? [];
      actions = [
        .../** @type {MysteryForgeArchive} */ (data.archive).people.map((candidate) =>
          toggle(
            candidate.name,
            (next) => logic.withLink(next, id, candidate.id, Date.now()),
            linked.includes(candidate.id),
          ),
        ),
        button(ui('board_back'), 'button button-quiet', () => goTo('main')),
      ];
    } else if (menu.page === 'labels') {
      const labels = board.labels[id] ?? [];
      actions = [
        ...QUICK_LABELS.map((label) =>
          toggle(
            ui(`board_label_${label}`),
            (next) => logic.withLabel(next, id, label, Date.now()),
            labels.includes(label),
          ),
        ),
        button(ui('board_back'), 'button button-quiet', () => goTo('main')),
      ];
    } else {
      const notes = board.notes[id] ?? [];
      const noteButtons = notes.map((note) =>
        button(`✎ ${note.text}`, 'button button-quiet sticky-button', () => editNote(id, note.id, note.text)),
      );
      if (documentEntry !== undefined) {
        const pinned = board.pinned.includes(id);
        const group = openEnvelopes()
          .filter(({ content }) => content.documents.some((entry) => entry.id === id))
          .flatMap(({ content }) => content.documents.map((entry) => entry.id));
        actions = [
          button(ui('board_open'), 'button button-primary', () => {
            boardSession.menu = null;
            openCard(id);
          }),
          pinned
            ? toggle(ui('board_unpin'), (next) => logic.withUnpinned(next, id, Date.now()))
            : toggle(ui('board_pin'), (next) => logic.withPinned(next, [id], Date.now())),
          pinned ? toggle(ui('board_move_earlier'), (next) => logic.withMoved(next, id, group, -1, Date.now())) : null,
          pinned ? toggle(ui('board_move_later'), (next) => logic.withMoved(next, id, group, 1, Date.now())) : null,
          button(ui('board_assign'), 'button button-quiet', () => goTo('assign')),
          button(ui('board_labels'), 'button button-quiet', () => goTo('labels')),
          button(ui('board_note_add'), 'button button-quiet', () => editNote(id, null, '')),
          ...noteButtons,
        ];
      } else {
        const status = board.people[id] ?? '';
        const byId = documentsById();
        // Honza 25. 11.: oběti nejde dát nálepku podezřelého ani štítky typu „lže“ – role musí sedět.
        const isVictim = Boolean(/** @type {{victim?: boolean}} */ (person).victim);
        actions = [
          ...(isVictim
            ? []
            : PERSON_STATUSES.map((option) =>
                toggle(
                  ui(`board_status_${option}`),
                  (next) => logic.withPersonStatus(next, id, status === option ? '' : option, Date.now()),
                  status === option,
                ),
              )),
          isVictim ? null : button(ui('board_labels'), 'button button-quiet', () => goTo('labels')),
          button(ui('board_note_add'), 'button button-quiet', () => editNote(id, null, '')),
          ...noteButtons,
          ...logic.linkedDocuments(board, id).map((documentId) => {
            const linkedEntry = byId.get(documentId);
            return linkedEntry === undefined
              ? null
              : button(`▤ ${linkedEntry.title}`, 'button button-quiet', () => {
                  boardSession.menu = null;
                  openViewer([linkedEntry], 0);
                });
          }),
        ];
      }
      actions.push(button(ui('close'), 'button button-quiet', closeBoardMenu));
    }
    const title = documentEntry !== undefined ? documentEntry.title : /** @type {{name: string}} */ (person).name;
    // Honza 25. 11.: po kliknutí na osobu se má hlavně zvětšit fotka a nabídka vyjet pod ní.
    const photo =
      person !== undefined && person.portrait
        ? el('div', { className: 'board-menu-photo' }, [htmlBlock(person.portrait, 'person-picture')])
        : null;
    const role = person !== undefined && person.role ? el('p', { className: 'board-menu-role', text: person.role }) : null;
    const dialog = el(
      'div',
      {
        className: `dialog paper board-menu${photo ? ' is-person' : ''}`,
        attrs: { role: 'dialog', 'aria-modal': 'true', id: 'board-menu' },
      },
      [photo, el('p', { className: 'dialog-message', text: title }), role, el('div', { className: 'board-menu-actions' }, actions)].filter(
        (node) => node !== null,
      ),
    );
    const overlay = el('div', { className: 'overlay' }, [dialog]);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeBoardMenu();
      }
    });
    return overlay;
  }

  function renderBoard() {
    const archive = /** @type {MysteryForgeArchive} */ (data.archive);
    const board = logic.boardOf(state);
    const people = el('div', { className: 'board-people' }, archive.people.map(personCard));
    const columns = el('div', { className: 'board-columns' });
    /** @type {MysteryForgeArchiveDocument[]} */
    const unpinned = [];
    for (const { stage, content } of openEnvelopes()) {
      const byId = new Map(content.documents.map((entry) => [entry.id, entry]));
      const cards = el('div', { className: 'board-cards' });
      for (const id of board.pinned) {
        const documentEntry = byId.get(id);
        if (documentEntry !== undefined) {
          cards.append(boardCard(documentEntry, true));
        }
      }
      unpinned.push(...content.documents.filter((entry) => !board.pinned.includes(entry.id)));
      columns.append(
        el('section', { className: 'board-column', attrs: { 'data-stage': stage.id } }, [
          el('h3', {
            className: 'board-heading',
            text: content.label ? `${stage.envelope} · ${content.label}` : stage.envelope,
          }),
          cards.childElementCount > 0 ? cards : el('p', { className: 'board-empty', text: ui('board_empty') }),
          waitingNote(content),
        ]),
      );
    }
    return el('div', { className: 'view view-board' }, [
      el('div', { className: 'board' }, [
        people,
        columns,
        unpinned.length > 0
          ? el('section', { className: 'board-tray' }, [
              el('div', { className: 'board-tray-head' }, [
                el('h3', { className: 'board-heading', text: ui('board_tray') }),
                button(
                  ui('board_pin_all'),
                  'button button-primary',
                  () =>
                    changeBoard((next) =>
                      logic.withPinned(
                        next,
                        unpinned.map((entry) => entry.id),
                        Date.now(),
                      ),
                    ),
                  { id: 'pin-all' },
                ),
              ]),
              el(
                'div',
                { className: 'board-cards board-tray-cards' },
                unpinned.map((entry) => boardCard(entry, false)),
              ),
            ])
          : null,
        el('p', { className: 'board-help', text: ui('board_help') }),
      ]),
    ]);
  }

  /**
   * OK on a card opens it, on a person opens its menu; a long press of OK (the remote repeats the key while it is
   * held) or the menu key opens the menu of a card.
   * @param {KeyboardEvent} event
   * @returns {boolean}
   */
  function boardKey(event) {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = focused?.closest('[data-card], [data-person]');
    if (!(target instanceof HTMLElement) || boardSession.menu !== null || viewerOpen()) {
      return false;
    }
    const type = target.dataset.card !== undefined ? 'card' : 'person';
    const id = /** @type {string} */ (target.dataset.card ?? target.dataset.person);
    if (event.key === 'ContextMenu' || event.key === 'm') {
      if (event.type === 'keydown') {
        openBoardMenu(type, id);
      }
      return true;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return false;
    }
    if (event.type === 'keydown') {
      if (boardSession.press === null) {
        boardSession.press = { target: id, at: Date.now(), handled: false };
      } else if (!boardSession.press.handled && Date.now() - boardSession.press.at >= LONG_PRESS_MS) {
        boardSession.press.handled = true;
        openBoardMenu(type, id);
      }
      return true;
    }
    const press = boardSession.press;
    boardSession.press = null;
    if (press !== null && !press.handled) {
      if (type === 'card') {
        openCard(press.target);
      } else {
        openBoardMenu('person', press.target);
      }
    }
    return true;
  }

  // ---------- The TV and the phones share one game ----------

  // The TV app serves this page over the local network. Every device then keeps the solved puzzles of the group.
  const sharedGame = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const connection = {
    /** @type {string | null} */
    url: null,
    renderWaiting: false,
  };

  function pushShared() {
    if (!sharedGame) {
      return;
    }
    fetch('api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logic.sharedState(state)),
    }).catch(() => undefined);
  }

  async function pullShared() {
    try {
      const response = await fetch('api/state', { cache: 'no-store' });
      if (!response.ok) {
        return;
      }
      const merged = logic.mergeSharedState(state, await response.json());
      if (JSON.stringify(logic.sharedState(merged)) !== JSON.stringify(logic.sharedState(state))) {
        saveState(merged);
        // A new render would reset the document that someone reads, so it waits until the viewer closes.
        if (viewerOpen() || document.activeElement instanceof HTMLInputElement) {
          connection.renderWaiting = true;
        } else {
          render();
        }
      }
    } catch {
      // The TV is out of reach for a moment; the next poll tries again.
    }
  }

  async function loadConnection() {
    try {
      const response = await fetch('api/info', { cache: 'no-store' });
      const info = response.ok ? await response.json() : null;
      if (info !== null && typeof info.url === 'string') {
        connection.url = info.url;
        render();
      }
    } catch {
      connection.url = null;
    }
  }

  function renderConnect() {
    if (connection.url === null) {
      return null;
    }
    const code = globalThis.MysteryForgeQrCode(0, 'M');
    code.addData(connection.url);
    code.make();
    const picture = el('div', { className: 'qr-code', attrs: { 'aria-hidden': 'true' } });
    // The vendored encoder builds this SVG from the URL alone.
    picture.innerHTML = code.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    // Honza 25. 11.: „nad QR kódem chybí fotka, celý QR kód bych udělal ve spisovém stylu“ – otevřená spisová
    // deska: vlevo fotka se sponkou (TV ji servíruje jako /img/titul.jpg, bez ní se nezobrazí), vpravo lístek s QR.
    const photo = el('img', { className: 'dossier-photo-img', attrs: { src: 'img/titul.jpg', alt: '' } });
    const figure = el('figure', { className: 'dossier-photo' }, [
      el('span', { className: 'dossier-clip', attrs: { 'aria-hidden': 'true' } }),
      photo,
      el('figcaption', { className: 'dossier-caption', text: 'Příloha č. 1' }),
      el('p', { className: 'dossier-stamp', text: 'Vyšetřování zahájeno', attrs: { 'aria-hidden': 'true' } }),
    ]);
    photo.addEventListener('error', () => figure.remove());
    return el('section', { className: 'connect-card dossier', attrs: { id: 'connect' } }, [
      el('div', { className: 'dossier-tab', text: `Spis · ${data.title}` }),
      el('div', { className: 'dossier-inner' }, [
        figure,
        el('div', { className: 'dossier-card' }, [
          el('h2', { className: 'dossier-title', text: ui('connect_heading') }),
          picture,
          el('p', { className: 'connect-text', text: ui('connect_text') }),
          el('p', { className: 'connect-url', text: connection.url }),
        ]),
      ]),
    ]);
  }

  // ---------- The remote control of a TV ----------

  // In the TV app the arrow keys of the remote move the focus to the nearest button in that direction.
  const tvMode = window.MysteryForgeTts !== undefined;
  const FOCUSABLE = 'button, input, summary, [tabindex="0"]';

  /** @param {'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'} key */
  function moveFocus(key) {
    const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const candidates = Array.from(document.querySelectorAll(FOCUSABLE)).filter(
      (element) => element instanceof HTMLElement && element.offsetParent !== null && element !== current,
    );
    if (current === null || current === document.body) {
      /** @type {HTMLElement | undefined} */ (candidates[0])?.focus();
      return;
    }
    const from = current.getBoundingClientRect();
    let best = null;
    let bestScore = Infinity;
    for (const element of candidates) {
      const to = element.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const ahead = key === 'ArrowUp' ? -dy : key === 'ArrowDown' ? dy : key === 'ArrowLeft' ? -dx : dx;
      if (ahead <= 1) {
        continue;
      }
      const side = key === 'ArrowUp' || key === 'ArrowDown' ? Math.abs(dx) : Math.abs(dy);
      const score = ahead + side * 2;
      if (score < bestScore) {
        bestScore = score;
        best = element;
      }
    }
    if (best instanceof HTMLElement) {
      best.focus();
      best.scrollIntoView({ block: 'nearest' });
    }
  }

  // The TV app asks the page first when the Back button is pressed: it closes the viewer or a dialog.
  window.MysteryForgeBack = () => {
    if (boardSession.menu !== null) {
      closeBoardMenu();
      return true;
    }
    if (viewerOpen()) {
      closeViewer();
      return true;
    }
    if (session.confirm !== null) {
      closeConfirm(false);
      return true;
    }
    return false;
  };

  // ---------- A finished game: record it and start again ----------

  const history = {
    /** @type {MysteryForgeFinishedGame[]} */
    games: [],
  };

  function loadLocalHistory() {
    try {
      history.games = logic.readHistory(window.localStorage.getItem(logic.historyKey(data.salt)));
    } catch {
      history.games = [];
    }
  }

  async function loadSharedHistory() {
    try {
      const response = await fetch('api/history', { cache: 'no-store' });
      if (response.ok) {
        history.games = logic.readHistory(await response.json());
        render();
      }
    } catch {
      // The TV is out of reach: the local record stays.
    }
  }

  /** @param {number} percent */
  function recordFinishedGame(percent) {
    const entry = { at: Date.now(), percent };
    history.games = [...history.games, entry];
    try {
      window.localStorage.setItem(logic.historyKey(data.salt), JSON.stringify(history.games));
    } catch {
      storageWorks = false;
    }
    if (sharedGame) {
      fetch('api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => undefined);
    }
  }

  function startOver() {
    stopPlayback();
    saveState(logic.freshState());
    session.lastCheck = null;
    session.draftChoices = {};
    session.shownSolutions = [];
    session.solutionsOpen = false;
    openedStages.clear();
    if (sharedGame) {
      fetch('api/reset', { method: 'POST' }).catch(() => undefined);
    }
  }

  function renderHistory() {
    const last = history.games[history.games.length - 1];
    if (last === undefined) {
      return null;
    }
    const date = new Date(last.at).toLocaleDateString(data.language);
    return el('p', {
      className: 'notice done-summary',
      text: `✓ ${ui('done_summary', { count: history.games.length, date, percent: last.percent })}`,
      attrs: { id: 'done-summary' },
    });
  }

  function renderFinish() {
    const percent = logic.finishedPercent(data, state);
    if (percent === null) {
      return null;
    }
    return el('section', { className: 'paper done-card', attrs: { id: 'done-card' } }, [
      el('h2', { className: 'paper-title', text: ui('done_heading') }),
      button(
        ui('done_button'),
        'button button-primary',
        () =>
          askConfirm({
            message: ui('done_confirm'),
            yes: ui('done_button'),
            strong: false,
            onYes: () => {
              recordFinishedGame(percent);
              startOver();
              showTab('start');
            },
          }),
        { id: 'done-button' },
      ),
    ]);
  }

  // ---------- Check an answer ----------

  /**
   * @param {MysteryForgeCompanionPuzzle[]} puzzles
   * @returns {string | null}
   */
  function selectedCheckCode(puzzles) {
    if (puzzles.some((puzzle) => puzzle.code === session.checkCode)) {
      return session.checkCode;
    }
    const unsolved = puzzles.find((puzzle) => !solvedCodes().includes(puzzle.code));
    return (unsolved ?? puzzles[0])?.code ?? null;
  }

  /** @param {string} code */
  function submitAnswer(code) {
    if (session.draftAnswer.trim() === '') {
      return;
    }
    const check = logic.checkAnswer(data, code, session.draftAnswer);
    // Keep this puzzle selected: after a correct answer, its result card holds the call to open the next envelope.
    session.checkCode = code;
    session.lastCheck = { code, check };
    if (check.result === 'correct') {
      const normalized = globalThis.MysteryForgeAnswers.normalizeAnswer(session.draftAnswer, data.language);
      saveState(logic.withAnswer(state, code, normalized));
      pushShared();
      session.draftAnswer = '';
    }
    render();
    const input = document.getElementById('answer-input');
    if (input instanceof HTMLInputElement && check.result !== 'correct') {
      input.focus();
      input.select();
    }
    // On a phone, the result card sits below the keyboard and the form; bring it into view.
    document.getElementById('answer-result')?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * @param {MysteryForgeAnswerCheck} check
   * @returns {HTMLElement}
   */
  function renderResult(check) {
    if (check.result === 'wrong') {
      return el('div', { className: 'result result-wrong', attrs: { id: 'answer-result', 'data-result': 'wrong' } }, [
        el('p', { className: 'result-title', text: ui('result_wrong') }),
      ]);
    }
    if (check.result === 'near') {
      return el('div', { className: 'result result-near', attrs: { id: 'answer-result', 'data-result': 'near' } }, [
        el('p', { className: 'result-title', text: ui('result_near') }),
        el('p', { className: 'result-message', text: check.message ?? '' }),
      ]);
    }
    const stage = data.stages.find((candidate) => candidate.id === check.unlocksStage);
    const finished = logic.isGameFinished(data, solvedCodes());
    return el('div', { className: 'result result-correct', attrs: { id: 'answer-result', 'data-result': 'correct' } }, [
      el('p', { className: 'stamp stamp-ok', text: ui('result_correct') }),
      check.revealText ? el('p', { className: 'result-reveal', text: check.revealText }) : null,
      stage
        ? el('div', { className: 'unlock', attrs: { id: 'unlock-call' } }, [
            el('span', { className: 'unlock-envelope', attrs: { 'aria-hidden': 'true' } }),
            el('p', { className: 'unlock-title', text: ui('unlock_call', { envelope: stage.envelope }) }),
            stage.opening_text ? el('p', { className: 'unlock-text', text: stage.opening_text }) : null,
          ])
        : null,
      renderCaseNotice(),
      finished && data.deduction !== null
        ? button(ui('accuse_heading'), 'button button-primary', () => showTab('accuse'))
        : null,
      finished && data.deduction === null
        ? button(ui('ending_heading'), 'button button-primary', () => showTab('start'))
        : null,
    ]);
  }

  function renderCheck() {
    const puzzles = openPuzzles();
    const view = el('div', { className: 'view' }, [el('h2', { className: 'view-title', text: ui('check_heading') })]);
    const code = selectedCheckCode(puzzles);
    if (code === null) {
      view.append(el('p', { className: 'empty', text: ui('no_puzzles') }));
      return view;
    }
    const picker = el('div', {
      className: 'puzzle-picker',
      attrs: { role: 'group', 'aria-label': ui('check_puzzle_label') },
    });
    for (const puzzle of puzzles) {
      const solved = solvedCodes().includes(puzzle.code);
      const pick = button(
        '',
        `puzzle-chip${puzzle.code === code ? ' is-selected' : ''}${solved ? ' is-solved' : ''}`,
        () => {
          session.checkCode = puzzle.code;
          session.lastCheck = null;
          render();
        },
        { 'data-puzzle': puzzle.code, 'aria-pressed': String(puzzle.code === code) },
      );
      pick.append(
        el('span', { className: 'puzzle-code', text: puzzle.code }),
        el('span', { className: 'puzzle-title', text: puzzle.title }),
      );
      if (solved) {
        pick.append(el('span', { className: 'puzzle-solved', text: `✓ ${ui('result_solved')}` }));
      }
      picker.append(pick);
    }
    view.append(el('p', { className: 'field-label', text: ui('check_puzzle_label') }), picker);
    if (hasSealedStages()) {
      view.append(el('p', { className: 'locked-note', text: ui('locked_note') }));
    }
    const puzzle = /** @type {MysteryForgeCompanionPuzzle} */ (puzzles.find((candidate) => candidate.code === code));
    const input = /** @type {HTMLInputElement} */ (
      el('input', {
        className: 'answer-input',
        attrs: {
          id: 'answer-input',
          type: 'text',
          autocomplete: 'off',
          autocapitalize: 'off',
          spellcheck: 'false',
          enterkeyhint: 'done',
        },
      })
    );
    input.value = session.draftAnswer;
    input.addEventListener('input', () => {
      session.draftAnswer = input.value;
    });
    const form = el('form', { className: 'answer-form paper', attrs: { id: 'answer-form' } }, [
      el('label', {
        className: 'paper-kicker',
        text: `${puzzle.code} · ${ui('check_answer_label')}`,
        attrs: { for: 'answer-input' },
      }),
      el('p', { className: 'answer-format', text: puzzle.answer_format }),
      input,
      el('button', {
        className: 'button button-primary button-wide',
        text: ui('check_submit'),
        attrs: { type: 'submit', id: 'answer-submit' },
      }),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitAnswer(puzzle.code);
    });
    view.append(form);
    const live = el('div', { className: 'result-slot', attrs: { 'aria-live': 'polite' } });
    if (session.lastCheck !== null && session.lastCheck.code === puzzle.code) {
      live.append(renderResult(session.lastCheck.check));
    }
    view.append(live);
    return view;
  }

  // ---------- Hints ----------

  /** @param {MysteryForgeCompanionPuzzle} puzzle */
  function renderHintCard(puzzle) {
    const revealed = logic.revealedHintCount(data, state, puzzle.code);
    const nextLevel = logic.nextHintLevel(data, state, puzzle.code);
    const answerShown = logic.isAnswerShown(data, state, puzzle.code);
    const list = el('ol', { className: 'hint-list' });
    for (const hint of puzzle.hints.slice(0, revealed)) {
      list.append(
        el('li', { className: 'hint reveal-in', attrs: { 'data-hint-level': String(hint.level) } }, [
          el('span', { className: 'hint-label', text: ui('hint_label', { level: hint.level }) }),
          el('span', { className: 'hint-text', text: hint.text }),
        ]),
      );
    }
    const solved = solvedCodes().includes(puzzle.code);
    const card = el('article', { className: 'paper hint-card', attrs: { 'data-hint-card': puzzle.code } }, [
      el('p', { className: 'paper-kicker' }, [
        el('span', { className: 'code-badge', text: puzzle.code }),
        el('span', { className: 'card-title', text: puzzle.title }),
        solved ? el('span', { className: 'chip chip-solved', text: `✓ ${ui('result_solved')}` }) : null,
      ]),
      revealed > 0 ? list : null,
    ]);
    if (answerShown) {
      card.append(
        el('p', { className: 'answer-box reveal-in', attrs: { 'data-answer': puzzle.code } }, [
          document.createTextNode(ui('solution_answer', { answer: '' })),
          el('strong', { text: puzzle.solution?.answer ?? '' }),
        ]),
      );
    } else if (nextLevel !== null) {
      card.append(
        button(
          ui('hint_show', { level: nextLevel }),
          'button button-primary',
          () =>
            askConfirm({
              message: ui('hint_confirm', { level: nextLevel, code: puzzle.code }),
              yes: ui('confirm_yes'),
              strong: false,
              onYes: () => saveState(logic.withHintStep(data, state, puzzle.code)),
            }),
          { 'data-hint-button': puzzle.code },
        ),
      );
    } else {
      card.append(
        button(
          ui('answer_show'),
          'button button-danger-quiet',
          () =>
            askConfirm({
              message: ui('answer_confirm', { code: puzzle.code }),
              yes: ui('confirm_yes'),
              strong: true,
              onYes: () => saveState(logic.withHintStep(data, state, puzzle.code)),
            }),
          { 'data-hint-button': puzzle.code },
        ),
      );
    }
    return card;
  }

  function renderHints() {
    const view = el('div', { className: 'view' }, [
      el('h2', { className: 'view-title', text: ui('hints_heading') }),
      el('p', { className: 'view-intro', text: ui('hints_intro') }),
    ]);
    const puzzles = openPuzzles();
    if (puzzles.length === 0) {
      view.append(el('p', { className: 'empty', text: ui('no_puzzles') }));
    }
    for (const puzzle of puzzles) {
      view.append(renderHintCard(puzzle));
    }
    if (hasSealedStages()) {
      view.append(el('p', { className: 'locked-note', text: ui('locked_note') }));
    }
    return view;
  }

  // ---------- Accusation ----------

  /**
   * @param {{questions: MysteryForgeCompanionQuestion[]}} deduction
   * @param {Record<string, string>} choices
   */
  function renderAccusationResult(deduction, choices) {
    // The player version seals the endings: the correct accusation opens them.
    const scoring = logic.withOpenedEndings(data, state);
    const score = logic.scoreAccusation(scoring, choices);
    const answersList = el('ol', { className: 'verdicts' });
    for (const question of deduction.questions) {
      const right = score.correctQuestions.includes(question.id);
      const chosen = question.options.find((option) => option.id === choices[question.id]);
      const correctId = logic.correctOptionId(data, question.id);
      const correct = question.options.find((option) => option.id === correctId);
      answersList.append(
        el('li', { className: `verdict ${right ? 'is-right' : 'is-wrong'}` }, [
          el('span', { className: 'verdict-mark', text: right ? ui('question_right') : ui('question_wrong') }),
          el('span', { className: 'verdict-prompt', text: question.prompt }),
          el('span', { className: 'verdict-choice', text: chosen ? chosen.text : '' }),
          !right && correct ? el('span', { className: 'verdict-correct', text: `→ ${correct.text}` }) : null,
        ]),
      );
    }
    const reveal = el('ol', { className: 'reveal-steps' });
    for (const step of scoring.reveal) {
      reveal.append(el('li', { text: step }));
    }
    return el('div', { className: 'view', attrs: { id: 'accuse-result' } }, [
      el('h2', { className: 'view-title', text: ui('accuse_heading') }),
      el('section', { className: 'paper score-card reveal-in' }, [
        el('p', {
          className: 'score-points',
          text: ui('score', { points: score.points, max: score.maxPoints }),
          attrs: { id: 'accuse-score' },
        }),
        el('p', { className: 'score-percent', text: `${score.percent}%` }),
        score.epilogue
          ? el('p', { className: 'stamp stamp-rank', text: score.epilogue.title, attrs: { id: 'accuse-rank' } })
          : null,
        score.epilogue
          ? el('p', { className: 'epilogue-text', text: score.epilogue.text, attrs: { id: 'accuse-epilogue' } })
          : null,
        score.epilogue && (score.epilogue.audio || canSpeak())
          ? playButton(
              {
                type: 'chapter',
                id: 'epilogue',
                stage: '',
                after: null,
                text: score.epilogue.text,
                audio: score.epilogue.audio ?? '',
              },
              ui('read_for_me'),
            )
          : null,
      ]),
      answersList,
      scoring.reveal.length > 0
        ? el('section', { className: 'paper reveal-card' }, [
            el('h3', { className: 'paper-title', text: ui('reveal_heading') }),
            reveal,
          ])
        : null,
      renderFinish(),
    ]);
  }

  /** @param {{questions: MysteryForgeCompanionQuestion[]}} deduction */
  function renderAccusationForm(deduction) {
    const form = el('form', { className: 'accuse-form', attrs: { id: 'accuse-form' } });
    for (const question of deduction.questions) {
      const fieldset = el('fieldset', { className: 'paper question' }, [
        el('legend', { className: 'question-prompt', text: question.prompt }),
      ]);
      for (const option of question.options) {
        const radio = /** @type {HTMLInputElement} */ (
          el('input', { attrs: { type: 'radio', name: `question-${question.id}`, value: option.id } })
        );
        radio.checked = session.draftChoices[question.id] === option.id;
        radio.addEventListener('change', () => {
          session.draftChoices = { ...session.draftChoices, [question.id]: option.id };
          session.accuseIncomplete = false;
        });
        fieldset.append(
          el('label', { className: 'option' }, [radio, el('span', { className: 'option-text', text: option.text })]),
        );
      }
      form.append(fieldset);
    }
    form.append(
      el('p', {
        className: `notice notice-quiet${session.accuseIncomplete ? '' : ' is-hidden'}`,
        text: ui('accuse_incomplete'),
        attrs: { id: 'accuse-incomplete' },
      }),
      el('button', {
        className: 'button button-primary button-wide',
        text: ui('accuse_submit'),
        attrs: { type: 'submit', id: 'accuse-submit' },
      }),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!logic.isAccusationComplete(data, session.draftChoices)) {
        session.accuseIncomplete = true;
        render();
        return;
      }
      const choices = session.draftChoices;
      askConfirm({
        message: ui('accuse_confirm'),
        yes: ui('accuse_submit'),
        strong: false,
        onYes: () => {
          saveState(logic.withAccusation(state, choices));
          pushShared();
          window.scrollTo(0, 0);
        },
      });
    });
    return el('div', { className: 'view' }, [
      el('h2', { className: 'view-title', text: ui('accuse_heading') }),
      el('p', { className: 'view-intro', text: ui('accuse_intro') }),
      logic.isGameFinished(data, solvedCodes())
        ? null
        : el('p', { className: 'notice notice-quiet', text: ui('accuse_early') }),
      form,
    ]);
  }

  function renderAccuse() {
    if (data.deduction === null) {
      return renderStart();
    }
    return state.accusation === null
      ? renderAccusationForm(data.deduction)
      : renderAccusationResult(data.deduction, state.accusation);
  }

  // ---------- Solutions ----------

  function renderSolutions() {
    if (!session.solutionsOpen) {
      return el('div', { className: 'view warning-view', attrs: { id: 'solutions-warning' } }, [
        el('p', { className: 'warning-sign', text: '!', attrs: { 'aria-hidden': 'true' } }),
        el('h2', { className: 'view-title', text: ui('solutions_warning_title') }),
        el('p', { className: 'warning-text', text: ui('solutions_warning_text') }),
        button(
          ui('solutions_enter'),
          'button button-danger button-wide',
          () => {
            session.solutionsOpen = true;
            render();
          },
          { id: 'solutions-enter' },
        ),
      ]);
    }
    const view = el('div', { className: 'view' }, [el('h2', { className: 'view-title', text: ui('tab_solutions') })]);
    for (const puzzle of openPuzzles()) {
      const shown = session.shownSolutions.includes(puzzle.code);
      const card = el('article', { className: 'paper solution-card', attrs: { 'data-solution-card': puzzle.code } }, [
        el('p', { className: 'paper-kicker' }, [
          el('span', { className: 'code-badge', text: puzzle.code }),
          el('span', { className: 'card-title', text: puzzle.title }),
        ]),
      ]);
      if (shown && puzzle.solution !== null) {
        const steps = el('ol', { className: 'solution-steps reveal-in' });
        for (const step of puzzle.solution.steps) {
          steps.append(el('li', { text: step }));
        }
        card.append(
          steps,
          el('p', { className: 'answer-box reveal-in' }, [
            document.createTextNode(ui('solution_answer', { answer: '' })),
            el('strong', { text: puzzle.solution.answer }),
          ]),
        );
      } else {
        card.append(
          button(
            ui('solution_show', { code: puzzle.code }),
            'button button-danger-quiet',
            () => {
              session.shownSolutions = [...session.shownSolutions, puzzle.code];
              render();
            },
            { 'data-solution-button': puzzle.code },
          ),
        );
      }
      view.append(card);
    }
    if (hasSealedStages()) {
      view.append(el('p', { className: 'locked-note', text: ui('locked_note') }));
    }
    return view;
  }

  // ---------- Render loop ----------

  /** @type {Record<TabId, () => HTMLElement>} */
  const VIEWS = {
    start: renderStart,
    case: renderCase,
    evidence: renderEvidence,
    board: renderBoard,
    check: renderCheck,
    hints: renderHints,
    accuse: renderAccuse,
    solutions: renderSolutions,
  };

  function updateTimers() {
    const display = logic.timerDisplay(data, state.timer, Date.now());
    for (const element of document.querySelectorAll('[data-timer-text]')) {
      element.textContent = display.overtime ? `+${display.text}` : display.text;
      element.classList.toggle('is-overtime', display.overtime);
    }
    for (const element of document.querySelectorAll('[data-timer-label]')) {
      element.textContent = display.overtime ? ui('timer_overtime') : ui('timer_label');
    }
  }

  function render() {
    // Honza 25. 11.: po „▶ Výpověď“ se lišta překreslila, focus z ovladače zmizel a dokument (iframe) se načetl
    // znovu od začátku – na TV pak „nejde ovládat ani posouvat“. Stejný otevřený dokument se proto nepřekresluje,
    // vymění se jen jeho lišta, a focus se vrátí na tlačítko se stejným id.
    const focusId = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
    const oldViewer = document.getElementById('viewer');
    const main = el('main', { className: `main main-${session.tab}`, attrs: { id: 'main' } }, [VIEWS[session.tab]()]);
    connection.renderWaiting = false;
    const shown = renderViewer();
    const keep =
      shown !== null && oldViewer !== null && oldViewer.parentElement === appElement && oldViewer.dataset.key === shown.dataset.key
        ? oldViewer
        : null;
    if (keep !== null) {
      [...appElement.children].forEach((child) => {
        if (child !== keep) {
          child.remove();
        }
      });
      appElement.prepend(renderTopBar(), main, renderNav());
      const oldBar = keep.querySelector('.viewer-bar');
      const newBar = shown?.querySelector('.viewer-bar');
      if (oldBar && newBar) {
        oldBar.replaceWith(newBar);
      }
    } else {
      appElement.replaceChildren(renderTopBar(), main, renderNav());
      if (shown !== null) {
        appElement.append(shown);
      }
    }
    const menu = renderBoardMenu();
    if (menu !== null) {
      appElement.append(menu);
    }
    document.body.classList.toggle('has-viewer', shown !== null);
    const overlay = renderConfirm();
    if (overlay !== null) {
      appElement.append(overlay);
      document.getElementById('confirm-no')?.focus();
    }
    document.body.classList.toggle('has-dialog', overlay !== null);
    if (focusId && (document.activeElement === document.body || document.activeElement === null)) {
      document.getElementById(focusId)?.focus({ preventScroll: true });
    }
    updateTimers();
  }

  document.addEventListener('keyup', (event) => {
    if (boardSession.press === null) {
      return;
    }
    if (boardKey(event)) {
      event.preventDefault();
    } else {
      // The long press opened a menu: its release must not count as a new press.
      boardSession.press = null;
    }
  });
  document.addEventListener('keydown', (event) => {
    if (boardKey(event)) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && boardSession.menu !== null) {
      closeBoardMenu();
      return;
    }
    if (event.key === 'Escape' && session.confirm !== null) {
      closeConfirm(false);
      return;
    }
    if (viewerOpen() && session.confirm === null) {
      /** @type {Record<string, () => void>} */
      const keys = {
        Escape: closeViewer,
        Backspace: closeViewer,
        // Honza 25. 11.: šipky do stran mají chodit po tlačítkách horní lišty (‹ › − + Výpověď Zavřít),
        // jinak se na „▶ Výpověď“ ovladačem nedostane. Listování dokumenty je pod tlačítky ‹ ›.
        ArrowLeft: () => moveViewerFocus(-1),
        ArrowRight: () => moveViewerFocus(1),
        ArrowUp: () => scrollViewer(-240),
        ArrowDown: () => scrollViewer(240),
        PageUp: () => scrollViewer(-600),
        PageDown: () => scrollViewer(600),
        '+': () => zoomViewer(0.2),
        '-': () => zoomViewer(-0.2),
      };
      const action = keys[event.key];
      if (action !== undefined) {
        event.preventDefault();
        action();
      }
      return;
    }
    const arrow = /** @type {'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'} */ (event.key);
    const typing =
      document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
    if (tvMode && !typing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(arrow)) {
      event.preventDefault();
      moveFocus(arrow);
    }
  });
  window.addEventListener('focusout', () => {
    if (connection.renderWaiting && !viewerOpen()) {
      window.setTimeout(() => {
        if (connection.renderWaiting && !(document.activeElement instanceof HTMLInputElement)) {
          render();
        }
      }, 0);
    }
  });
  if (sharedGame) {
    void loadConnection();
    void loadSharedHistory();
    void pullShared();
    window.setInterval(() => void pullShared(), 4000);
  }
  window.setInterval(updateTimers, 1000);
  loadLocalHistory();
  render();
})();
