// @ts-check
// The decisions of the companion page: answer checks, stage progress, hints, the timer, the accusation score, and the
// saved state. Every function is pure; companionApp.js only wires them to the DOM.
// The page data comes from toolkit/src/mystery_forge/render/companion_data.py.

(function registerCompanionLogic() {
  const STATE_VERSION = 1;
  // About five lines of the intro on a phone: a longer intro pushes the clock and the envelopes off the first screen.
  const LONG_INTRO_CHARACTERS = 240;

  /** @returns {MysteryForgeCompanionState} */
  function freshState() {
    return {
      version: STATE_VERSION,
      solved: [],
      hintSteps: {},
      timer: { elapsedMs: 0, startedAt: null },
      accusation: null,
      seen: [],
    };
  }

  /**
   * @param {string} salt
   * @returns {string}
   */
  function storageKey(salt) {
    return `mystery-forge-companion:${salt}`;
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {string} code
   * @returns {MysteryForgeCompanionPuzzle | undefined}
   */
  function findPuzzle(data, code) {
    return data.puzzles.find((puzzle) => puzzle.code === code);
  }

  /**
   * Compare the hash of the normalized input with the stored hashes; the page never holds an answer in plain text
   * outside the solutions.
   * @param {MysteryForgeCompanionData} data
   * @param {string} puzzleCode
   * @param {string} input
   * @returns {MysteryForgeAnswerCheck}
   */
  function checkAnswer(data, puzzleCode, input) {
    const puzzle = findPuzzle(data, puzzleCode);
    if (puzzle === undefined) {
      return { result: 'wrong' };
    }
    const answers = globalThis.MysteryForgeAnswers;
    const hash = answers.answerHash(answers.normalizeAnswer(input, data.language), data.salt);
    if (puzzle.answer_hashes.includes(hash)) {
      /** @type {MysteryForgeAnswerCheck} */
      const check = { result: 'correct' };
      if (puzzle.unlocks !== null) {
        check.unlocksStage = puzzle.unlocks;
      }
      if (puzzle.reveal_text) {
        check.revealText = puzzle.reveal_text;
      }
      return check;
    }
    const nearMiss = puzzle.near_misses.find((candidate) => candidate.hash === hash);
    return nearMiss === undefined ? { result: 'wrong' } : { result: 'near', message: nearMiss.message };
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {string[]} solvedCodes
   * @returns {string[]}
   */
  function unlockedStages(data, solvedCodes) {
    return data.stages
      .filter((stage) => stage.opens_with === 'start' || solvedCodes.includes(stage.opens_with))
      .map((stage) => stage.id);
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {string[]} unlockedStageIds
   * @returns {MysteryForgeCompanionPuzzle[]}
   */
  function visiblePuzzles(data, unlockedStageIds) {
    return data.puzzles.filter((puzzle) => unlockedStageIds.includes(puzzle.stage));
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {string[]} solvedCodes
   * @returns {boolean}
   */
  function isGameFinished(data, solvedCodes) {
    return data.final_puzzle !== null && solvedCodes.includes(data.final_puzzle);
  }

  /**
   * Return the epilogue with the highest threshold that the percent reaches. `data.epilogues` comes sorted from the
   * highest threshold down.
   * @param {MysteryForgeCompanionData} data
   * @param {number} percent
   * @returns {MysteryForgeCompanionEpilogue | null}
   */
  function epilogueForPercent(data, percent) {
    return data.epilogues.find((epilogue) => percent >= epilogue.min_score_percent) ?? null;
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {Record<string, string>} choices
   * @returns {boolean}
   */
  function isAccusationComplete(data, choices) {
    if (data.deduction === null) {
      return false;
    }
    return data.deduction.questions.every((question) =>
      question.options.some((option) => option.id === choices[question.id]),
    );
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionQuestion} question
   * @param {string | undefined} optionId
   * @returns {boolean}
   */
  function isCorrectOption(data, question, optionId) {
    return globalThis.MysteryForgeAnswers.answerHash(`${question.id}:${optionId}`, data.salt) === question.correct_hash;
  }

  /**
   * The page shows the right option only after the group locks in its accusation.
   * @param {MysteryForgeCompanionData} data
   * @param {string} questionId
   * @returns {string | null}
   */
  function correctOptionId(data, questionId) {
    const question = data.deduction?.questions.find((candidate) => candidate.id === questionId);
    if (question === undefined) {
      return null;
    }
    return question.options.find((option) => isCorrectOption(data, question, option.id))?.id ?? null;
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {Record<string, string>} choices
   * @returns {MysteryForgeAccusationScore}
   */
  function scoreAccusation(data, choices) {
    const questions = data.deduction === null ? [] : data.deduction.questions;
    const correctQuestions = questions
      .filter((question) => isCorrectOption(data, question, choices[question.id]))
      .map((question) => question.id);
    const maxPoints = questions.reduce((sum, question) => sum + question.points, 0);
    const points = questions
      .filter((question) => correctQuestions.includes(question.id))
      .reduce((sum, question) => sum + question.points, 0);
    // Round down, so that a score just below a threshold never reaches its epilogue.
    const percent = maxPoints === 0 ? 0 : Math.floor((points * 100) / maxPoints);
    return { points, maxPoints, percent, epilogue: epilogueForPercent(data, percent), correctQuestions };
  }

  /**
   * @param {number} seconds
   * @returns {string}
   */
  function formatTimer(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(whole / 3600);
    const minutes = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
    const rest = String(whole % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`;
  }

  /**
   * @param {MysteryForgeCompanionTimer} timer
   * @param {number} nowMs
   * @returns {number}
   */
  function timerElapsedMs(timer, nowMs) {
    // A clock that moved back (a changed system time) must not make the time run backwards.
    return timer.elapsedMs + (timer.startedAt === null ? 0 : Math.max(0, nowMs - timer.startedAt));
  }

  /**
   * @param {MysteryForgeCompanionState} state
   * @param {number} nowMs
   * @returns {MysteryForgeCompanionState}
   */
  function startTimer(state, nowMs) {
    if (state.timer.startedAt !== null) {
      return state;
    }
    return { ...state, timer: { elapsedMs: state.timer.elapsedMs, startedAt: nowMs } };
  }

  /**
   * @param {MysteryForgeCompanionState} state
   * @param {number} nowMs
   * @returns {MysteryForgeCompanionState}
   */
  function pauseTimer(state, nowMs) {
    if (state.timer.startedAt === null) {
      return state;
    }
    return { ...state, timer: { elapsedMs: timerElapsedMs(state.timer, nowMs), startedAt: null } };
  }

  /**
   * Count down from the game length; after it, count the extra time up from zero.
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionTimer} timer
   * @param {number} nowMs
   * @returns {{text: string, overtime: boolean}}
   */
  function timerDisplay(data, timer, nowMs) {
    const remaining = data.duration_minutes * 60 - Math.floor(timerElapsedMs(timer, nowMs) / 1000);
    return { text: formatTimer(Math.abs(remaining)), overtime: remaining < 0 };
  }

  /**
   * @param {MysteryForgeCompanionState} state
   * @param {string} code
   * @returns {MysteryForgeCompanionState}
   */
  function withSolved(state, code) {
    return state.solved.includes(code) ? state : { ...state, solved: [...state.solved, code] };
  }

  /**
   * The hint steps of a puzzle are its hints, one level at a time, and then its answer as the last step.
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionState} state
   * @param {string} code
   * @returns {number}
   */
  function stepsLeft(data, state, code) {
    const puzzle = findPuzzle(data, code);
    if (puzzle === undefined) {
      return 0;
    }
    // The player version has no solution, so its last step is the last hint, not the answer.
    const answerStep = puzzle.solution === null ? 0 : 1;
    return puzzle.hints.length + answerStep - (state.hintSteps[code] ?? 0);
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionState} state
   * @param {string} code
   * @returns {number | null}
   */
  function nextHintLevel(data, state, code) {
    const puzzle = findPuzzle(data, code);
    const reserved = puzzle !== undefined && puzzle.solution === null ? 0 : 1;
    return stepsLeft(data, state, code) > reserved ? (state.hintSteps[code] ?? 0) + 1 : null;
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionState} state
   * @param {string} code
   * @returns {number}
   */
  function revealedHintCount(data, state, code) {
    const puzzle = findPuzzle(data, code);
    return puzzle === undefined ? 0 : Math.min(state.hintSteps[code] ?? 0, puzzle.hints.length);
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionState} state
   * @param {string} code
   * @returns {boolean}
   */
  function isAnswerShown(data, state, code) {
    const puzzle = findPuzzle(data, code);
    return puzzle !== undefined && puzzle.solution !== null && (state.hintSteps[code] ?? 0) > puzzle.hints.length;
  }

  /**
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionState} state
   * @param {string} code
   * @returns {MysteryForgeCompanionState}
   */
  function withHintStep(data, state, code) {
    if (stepsLeft(data, state, code) <= 0) {
      return state;
    }
    return { ...state, hintSteps: { ...state.hintSteps, [code]: (state.hintSteps[code] ?? 0) + 1 } };
  }

  /**
   * @param {MysteryForgeCompanionState} state
   * @param {Record<string, string>} choices
   * @returns {MysteryForgeCompanionState}
   */
  function withAccusation(state, choices) {
    return { ...state, accusation: { ...choices } };
  }

  /**
   * @param {unknown} value
   * @returns {value is Record<string, unknown>}
   */
  function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * @param {unknown} value
   * @returns {boolean}
   */
  function isCount(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  /**
   * @param {unknown} value
   * @returns {boolean}
   */
  function isTimer(value) {
    return (
      isRecord(value) && isCount(value.elapsedMs) && (value.startedAt === null || typeof value.startedAt === 'number')
    );
  }

  /**
   * @param {unknown} value
   * @returns {value is MysteryForgeCompanionState}
   */
  function isState(value) {
    return (
      isRecord(value) &&
      value.version === STATE_VERSION &&
      Array.isArray(value.solved) &&
      value.solved.every((code) => typeof code === 'string') &&
      isRecord(value.hintSteps) &&
      Object.values(value.hintSteps).every(isCount) &&
      isTimer(value.timer) &&
      (value.accusation === null ||
        (isRecord(value.accusation) && Object.values(value.accusation).every((id) => typeof id === 'string'))) &&
      (value.answers === undefined ||
        (isRecord(value.answers) && Object.values(value.answers).every((answer) => typeof answer === 'string'))) &&
      // A state from before the case tab has no `seen` list; it stays valid.
      (value.seen === undefined || (Array.isArray(value.seen) && value.seen.every((id) => typeof id === 'string')))
    );
  }

  /**
   * Read the saved state. Storage text that another version or a broken write left behind gives a fresh state, so the
   * page always starts.
   * @param {string | null} text
   * @returns {MysteryForgeCompanionState}
   */
  function stateFromStorage(text) {
    if (text === null) {
      return freshState();
    }
    try {
      const parsed = JSON.parse(text);
      return isState(parsed) ? parsed : freshState();
    } catch {
      return freshState();
    }
  }

  /**
   * @param {MysteryForgeCompanionState} state
   * @returns {string}
   */
  function stateToStorage(state) {
    return JSON.stringify(state);
  }

  /**
   * @param {string} template
   * @param {Record<string, string | number>} values
   * @returns {string}
   */
  function fillText(template, values) {
    return template.replace(/\{(\w+)\}/g, (field, name) => (name in values ? String(values[name]) : field));
  }

  /**
   * Whether a phone folds the intro to its first lines, so that the clock and the envelopes come first.
   * @param {string} intro
   * @returns {boolean}
   */
  function isLongIntro(intro) {
    return intro.length > LONG_INTRO_CHARACTERS;
  }

  /**
   * The chapters and voice messages that players have met: the entries of the open envelopes, minus the ones that
   * still wait for an unsolved puzzle. The data holds them in the order that players meet them.
   * @param {MysteryForgeCompanionData} data
   * @param {string[]} unlockedStageIds
   * @param {string[]} solvedCodes
   * @returns {MysteryForgeCompanionCaseEntry[]}
   */
  function caseEntries(data, unlockedStageIds, solvedCodes) {
    if (data.investigation === null) {
      return [];
    }
    return data.investigation.entries.filter(
      (entry) => unlockedStageIds.includes(entry.stage) && (entry.after === null || solvedCodes.includes(entry.after)),
    );
  }

  /**
   * @param {MysteryForgeCompanionCaseEntry[]} entries
   * @param {MysteryForgeCompanionState} state
   * @returns {MysteryForgeCompanionCaseEntry[]}
   */
  function unseenEntries(entries, state) {
    const seen = state.seen ?? [];
    return entries.filter((entry) => !seen.includes(entry.id));
  }

  /**
   * @param {MysteryForgeCompanionState} state
   * @param {string[]} ids
   * @returns {MysteryForgeCompanionState}
   */
  function withSeen(state, ids) {
    const seen = state.seen ?? [];
    const added = ids.filter((id) => !seen.includes(id));
    return added.length === 0 ? state : { ...state, seen: [...seen, ...added] };
  }

  /**
   * The speech voice settings of a message: a lower voice for a man, a higher one for a woman.
   * @param {'male' | 'female'} voice
   * @returns {{pitch: number, rate: number}}
   */
  function speechSettings(voice) {
    return voice === 'female' ? { pitch: 1.15, rate: 1 } : { pitch: 0.85, rate: 0.95 };
  }

  /**
   * Split a story text into its paragraphs at the blank lines.
   * @param {string} text
   * @returns {string[]}
   */
  function paragraphs(text) {
    return text
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter((part) => part !== '');
  }

  /**
   * Remember the normalized answer of a solved puzzle: it opens the sealed envelopes of the archive.
   * @param {MysteryForgeCompanionState} state
   * @param {string} code
   * @param {string} normalizedAnswer
   * @returns {MysteryForgeCompanionState}
   */
  function withAnswer(state, code, normalizedAnswer) {
    return { ...withSolved(state, code), answers: { ...(state.answers ?? {}), [code]: normalizedAnswer } };
  }

  /**
   * Open one envelope of the archive with the answers that the group found, or return null while it stays sealed.
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeArchiveStage} stage
   * @param {MysteryForgeCompanionState} state
   * @returns {MysteryForgeArchiveContent | null}
   */
  function openArchiveStage(data, stage, state) {
    if (stage.lock === null) {
      return { label: stage.label, documents: stage.documents ?? [] };
    }
    const text = globalThis.MysteryForgeSealing.openLock(stage.lock, data.salt, Object.values(state.answers ?? {}));
    return text === null ? null : JSON.parse(text);
  }

  /**
   * Open the sealed endings of the player version with the accusation and the answers, or return null.
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionState} state
   * @returns {{epilogues: MysteryForgeCompanionEpilogue[], reveal: string[]} | null}
   */
  function openEndings(data, state) {
    if (data.ending_lock === null) {
      return null;
    }
    const firstQuestion = data.deduction?.questions[0];
    const keys = [
      ...(firstQuestion !== undefined && state.accusation?.[firstQuestion.id]
        ? [state.accusation[firstQuestion.id]]
        : []),
      ...Object.values(state.answers ?? {}),
    ];
    const text = globalThis.MysteryForgeSealing.openLock(data.ending_lock, data.salt, /** @type {string[]} */ (keys));
    return text === null ? null : JSON.parse(text);
  }

  /**
   * The data with the endings and the reveal that the group has opened, so the scoring code finds every ending.
   * @param {MysteryForgeCompanionData} data
   * @param {MysteryForgeCompanionState} state
   * @returns {MysteryForgeCompanionData}
   */
  function withOpenedEndings(data, state) {
    const opened = openEndings(data, state);
    if (opened === null) {
      return data;
    }
    const epilogues = [...opened.epilogues, ...data.epilogues].sort(
      (left, right) => right.min_score_percent - left.min_score_percent,
    );
    return { ...data, epilogues, reveal: opened.reveal };
  }

  /**
   * Merge the state that the TV keeps for every device into this device's state: the solved puzzles and their
   * answers join, and the accusation of either side wins over none. Hints, the clock, and the seen list stay local.
   * @param {MysteryForgeCompanionState} local
   * @param {unknown} remote
   * @returns {MysteryForgeCompanionState}
   */
  function mergeSharedState(local, remote) {
    if (!isRecord(remote)) {
      return local;
    }
    const remoteAnswers = isRecord(remote.answers) ? remote.answers : {};
    /** @type {Record<string, string>} */
    const answers = { ...(local.answers ?? {}) };
    for (const [code, answer] of Object.entries(remoteAnswers)) {
      if (typeof answer === 'string' && answers[code] === undefined) {
        answers[code] = answer;
      }
    }
    const remoteSolved = Array.isArray(remote.solved) ? remote.solved.filter((code) => typeof code === 'string') : [];
    const solved = [...local.solved, ...remoteSolved.filter((code) => !local.solved.includes(code))];
    const remoteAccusation =
      isRecord(remote.accusation) && Object.values(remote.accusation).every((id) => typeof id === 'string')
        ? /** @type {Record<string, string>} */ (remote.accusation)
        : null;
    return { ...local, solved, answers, accusation: local.accusation ?? remoteAccusation };
  }

  /**
   * The part of the state that the TV shares with every device.
   * @param {MysteryForgeCompanionState} state
   * @returns {{solved: string[], answers: Record<string, string>, accusation: Record<string, string> | null}}
   */
  function sharedState(state) {
    return { solved: state.solved, answers: state.answers ?? {}, accusation: state.accusation };
  }

  globalThis.MysteryForgeCompanionLogic = {
    freshState,
    storageKey,
    checkAnswer,
    unlockedStages,
    visiblePuzzles,
    isGameFinished,
    epilogueForPercent,
    isAccusationComplete,
    scoreAccusation,
    correctOptionId,
    formatTimer,
    timerElapsedMs,
    startTimer,
    pauseTimer,
    timerDisplay,
    withSolved,
    nextHintLevel,
    revealedHintCount,
    isAnswerShown,
    withHintStep,
    withAccusation,
    stateFromStorage,
    stateToStorage,
    fillText,
    isLongIntro,
    caseEntries,
    unseenEntries,
    withSeen,
    speechSettings,
    paragraphs,
    withAnswer,
    openArchiveStage,
    openEndings,
    withOpenedEndings,
    mergeSharedState,
    sharedState,
  };
})();
