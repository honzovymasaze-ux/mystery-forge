// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Classic browser scripts, not modules: load them for their side effect, by a computed path that tsc does not resolve.
require(path.join(__dirname, 'answers.js'));
require(path.join(__dirname, 'sealing.js'));
require(path.join(__dirname, 'companionLogic.js'));
const answers = globalThis.MysteryForgeAnswers;
const logic = globalThis.MysteryForgeCompanionLogic;

const SALT = 'test-salt';

/**
 * @param {string} text
 * @returns {string}
 */
function hashed(text) {
  return answers.answerHash(answers.normalizeAnswer(text, 'en'), SALT);
}

/** @returns {MysteryForgeCompanionData} */
function sampleData() {
  return {
    format_version: 1,
    title: 'The Lens of Gull Rock',
    tagline: 'The light went dark.',
    intro: 'Read me aloud.',
    language: 'en',
    salt: SALT,
    duration_minutes: 30,
    panel_verified: true,
    final_puzzle: 'B1',
    ui: { score: '{points} of {max} points' },
    stages: [
      { id: 'A', label: 'Desk', envelope: 'Envelope A', opens_with: 'start', opening_text: '' },
      { id: 'B', label: 'Box', envelope: 'Envelope B', opens_with: 'A1', opening_text: 'Inside the box.' },
    ],
    puzzles: [
      {
        code: 'A1',
        title: 'Coded line',
        stage: 'A',
        answer_format: 'one word',
        answer_hashes: [hashed('boathouse')],
        near_misses: [{ hash: hashed('yxlxqeorpb'), message: 'Count back, not forward.' }],
        unlocks: 'B',
        hints: [
          { level: 1, text: 'Look down.' },
          { level: 2, text: 'Three steps.' },
        ],
        solution: { steps: ['Shift back.'], answer: 'boathouse' },
        reveal_text: '',
      },
      {
        code: 'A2',
        title: 'Lock',
        stage: 'A',
        answer_format: 'a 4-digit code',
        answer_hashes: [hashed('0726')],
        near_misses: [],
        unlocks: null,
        hints: [{ level: 1, text: 'Receipt.' }],
        solution: { steps: ['Read it.'], answer: '0726' },
        reveal_text: '',
      },
      {
        code: 'B1',
        title: 'Tide',
        stage: 'B',
        answer_format: 'two words',
        answer_hashes: [hashed('low tide'), hashed('at low tide')],
        near_misses: [],
        unlocks: null,
        hints: [{ level: 1, text: 'The sea.' }],
        solution: { steps: ['Tide table.'], answer: 'low tide' },
        reveal_text: 'The causeway was dry.',
      },
    ],
    deduction: {
      questions: [
        {
          id: 'who',
          prompt: 'Who?',
          options: [
            { id: 'ana', text: 'Ana' },
            { id: 'felix', text: 'Felix' },
          ],
          correct_hash: answers.answerHash('who:felix', SALT),
          points: 50,
        },
        {
          id: 'why',
          prompt: 'Why?',
          options: [
            { id: 'debt', text: 'Debt' },
            { id: 'prank', text: 'Prank' },
          ],
          correct_hash: answers.answerHash('why:debt', SALT),
          points: 25,
        },
      ],
    },
    epilogues: [
      { min_score_percent: 75, title: 'Case closed', text: 'Solved.' },
      { min_score_percent: 40, title: 'Close', text: 'Partly.' },
      { min_score_percent: 10, title: 'Dark', text: 'Unsolved.' },
    ],
    reveal: ['By boat.'],
    investigation: null,
    player: false,
    archive: null,
    ending_lock: null,
  };
}

test('checkAnswer accepts the answer in any spelling and names the stage that it opens', () => {
  assert.deepEqual(logic.checkAnswer(sampleData(), 'A1', ' Boat-House '), { result: 'correct', unlocksStage: 'B' });
  assert.deepEqual(logic.checkAnswer(sampleData(), 'B1', 'At LOW tide!'), {
    result: 'correct',
    revealText: 'The causeway was dry.',
  });
});

test('checkAnswer gives the message of a near miss', () => {
  assert.deepEqual(logic.checkAnswer(sampleData(), 'A1', 'YXLXQEORPB'), {
    result: 'near',
    message: 'Count back, not forward.',
  });
});

test('checkAnswer says wrong for another answer, for the answer of another puzzle, and for an unknown code', () => {
  assert.deepEqual(logic.checkAnswer(sampleData(), 'A1', 'lighthouse'), { result: 'wrong' });
  assert.deepEqual(logic.checkAnswer(sampleData(), 'A2', 'boathouse'), { result: 'wrong' });
  assert.deepEqual(logic.checkAnswer(sampleData(), 'Z9', 'boathouse'), { result: 'wrong' });
});

test('unlockedStages opens the first stage at the start and each later stage with its puzzle', () => {
  assert.deepEqual(logic.unlockedStages(sampleData(), []), ['A']);
  assert.deepEqual(logic.unlockedStages(sampleData(), ['A2']), ['A']);
  assert.deepEqual(logic.unlockedStages(sampleData(), ['A1']), ['A', 'B']);
});

test('visiblePuzzles shows only the puzzles of the open stages', () => {
  const codes = (/** @type {string[]} */ stages) => logic.visiblePuzzles(sampleData(), stages).map((p) => p.code);
  assert.deepEqual(codes(['A']), ['A1', 'A2']);
  assert.deepEqual(codes(['A', 'B']), ['A1', 'A2', 'B1']);
});

test('isGameFinished is true once the final puzzle is solved, and never without a final puzzle', () => {
  assert.equal(logic.isGameFinished(sampleData(), ['A1']), false);
  assert.equal(logic.isGameFinished(sampleData(), ['A1', 'B1']), true);
  assert.equal(logic.isGameFinished({ ...sampleData(), final_puzzle: null }, ['B1']), false);
});

test('scoreAccusation adds the points of the right answers and picks the epilogue that the score reaches', () => {
  const full = logic.scoreAccusation(sampleData(), { who: 'felix', why: 'debt' });
  assert.deepEqual(full, {
    points: 75,
    maxPoints: 75,
    percent: 100,
    epilogue: { min_score_percent: 75, title: 'Case closed', text: 'Solved.' },
    correctQuestions: ['who', 'why'],
  });
  const partial = logic.scoreAccusation(sampleData(), { who: 'felix', why: 'prank' });
  assert.equal(partial.percent, 66);
  assert.equal(partial.epilogue?.title, 'Close');
  assert.deepEqual(partial.correctQuestions, ['who']);
});

test('scoreAccusation gives no epilogue when the score reaches none, and zero points without a deduction', () => {
  const none = logic.scoreAccusation(sampleData(), {});
  assert.equal(none.points, 0);
  assert.equal(none.epilogue, null);
  const noDeduction = logic.scoreAccusation({ ...sampleData(), deduction: null }, {});
  assert.deepEqual([noDeduction.points, noDeduction.maxPoints, noDeduction.percent], [0, 0, 0]);
});

test('epilogueForPercent picks the highest threshold that the percent reaches', () => {
  assert.equal(logic.epilogueForPercent(sampleData(), 100)?.title, 'Case closed');
  assert.equal(logic.epilogueForPercent(sampleData(), 40)?.title, 'Close');
  assert.equal(logic.epilogueForPercent(sampleData(), 5), null);
});

test('isAccusationComplete needs a valid option for every question', () => {
  assert.equal(logic.isAccusationComplete(sampleData(), { who: 'felix' }), false);
  assert.equal(logic.isAccusationComplete(sampleData(), { who: 'felix', why: 'nope' }), false);
  assert.equal(logic.isAccusationComplete(sampleData(), { who: 'ana', why: 'prank' }), true);
  assert.equal(logic.isAccusationComplete({ ...sampleData(), deduction: null }, {}), false);
});

test('formatTimer shows minutes and seconds, and hours only when needed', () => {
  assert.equal(logic.formatTimer(0), '00:00');
  assert.equal(logic.formatTimer(65.9), '01:05');
  assert.equal(logic.formatTimer(3600 + 62), '1:01:02');
  assert.equal(logic.formatTimer(-5), '00:00');
});

test('the timer counts while it runs, keeps its time when paused, and ignores a repeated start or pause', () => {
  let state = logic.freshState();
  assert.equal(logic.timerElapsedMs(state.timer, 5000), 0);
  state = logic.startTimer(state, 1000);
  assert.equal(logic.startTimer(state, 9000), state);
  assert.equal(logic.timerElapsedMs(state.timer, 4000), 3000);
  assert.equal(logic.timerElapsedMs(state.timer, 500), 0);
  state = logic.pauseTimer(state, 6000);
  assert.equal(logic.pauseTimer(state, 9000), state);
  assert.deepEqual(state.timer, { elapsedMs: 5000, startedAt: null });
  assert.equal(logic.timerElapsedMs(state.timer, 99000), 5000);
});

test('timerDisplay counts down from the game length, then counts the extra time', () => {
  const data = sampleData();
  assert.deepEqual(logic.timerDisplay(data, { elapsedMs: 0, startedAt: null }, 0), { text: '30:00', overtime: false });
  assert.deepEqual(logic.timerDisplay(data, { elapsedMs: 61500, startedAt: null }, 0), {
    text: '28:59',
    overtime: false,
  });
  assert.deepEqual(logic.timerDisplay(data, { elapsedMs: 1800000 + 75000, startedAt: null }, 0), {
    text: '01:15',
    overtime: true,
  });
});

test('withSolved adds a code once', () => {
  const state = logic.withSolved(logic.freshState(), 'A1');
  assert.deepEqual(state.solved, ['A1']);
  assert.equal(logic.withSolved(state, 'A1'), state);
});

test('hints open one level at a time, then the answer, then nothing more', () => {
  const data = sampleData();
  let state = logic.freshState();
  assert.equal(logic.nextHintLevel(data, state, 'A1'), 1);
  assert.equal(logic.revealedHintCount(data, state, 'A1'), 0);
  assert.equal(logic.isAnswerShown(data, state, 'A1'), false);
  state = logic.withHintStep(data, state, 'A1');
  assert.equal(logic.nextHintLevel(data, state, 'A1'), 2);
  state = logic.withHintStep(data, state, 'A1');
  assert.equal(logic.nextHintLevel(data, state, 'A1'), null);
  assert.equal(logic.revealedHintCount(data, state, 'A1'), 2);
  assert.equal(logic.isAnswerShown(data, state, 'A1'), false);
  state = logic.withHintStep(data, state, 'A1');
  assert.equal(logic.isAnswerShown(data, state, 'A1'), true);
  assert.equal(logic.revealedHintCount(data, state, 'A1'), 2);
  assert.equal(logic.withHintStep(data, state, 'A1'), state);
  assert.equal(logic.nextHintLevel(data, state, 'A2'), 1);
});

test('the hint functions treat an unknown puzzle code as having nothing to show', () => {
  const state = logic.freshState();
  assert.equal(logic.nextHintLevel(sampleData(), state, 'Z9'), null);
  assert.equal(logic.revealedHintCount(sampleData(), state, 'Z9'), 0);
  assert.equal(logic.isAnswerShown(sampleData(), state, 'Z9'), false);
});

test('withAccusation stores a copy of the choices', () => {
  const choices = { who: 'felix' };
  const state = logic.withAccusation(logic.freshState(), choices);
  choices.who = 'ana';
  assert.deepEqual(state.accusation, { who: 'felix' });
});

test('the state survives a round trip through storage text', () => {
  let state = logic.withSolved(logic.freshState(), 'A1');
  state = logic.withHintStep(sampleData(), state, 'A2');
  state = logic.startTimer(state, 1234);
  state = logic.withAccusation(state, { who: 'felix' });
  assert.deepEqual(logic.stateFromStorage(logic.stateToStorage(state)), state);
});

test('stateFromStorage returns a fresh state for missing, corrupt, or foreign storage text', () => {
  const fresh = logic.freshState();
  const valid = JSON.parse(logic.stateToStorage(fresh));
  /** @type {(string | null)[]} */
  const broken = [
    null,
    '',
    '{not json',
    'null',
    '[]',
    '42',
    JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, solved: 'A1' }),
    JSON.stringify({ ...valid, solved: [1] }),
    JSON.stringify({ ...valid, hintSteps: null }),
    JSON.stringify({ ...valid, hintSteps: [] }),
    JSON.stringify({ ...valid, hintSteps: { A1: 'two' } }),
    JSON.stringify({ ...valid, hintSteps: { A1: -1 } }),
    JSON.stringify({ ...valid, timer: null }),
    JSON.stringify({ ...valid, timer: { elapsedMs: 'x', startedAt: null } }),
    JSON.stringify({ ...valid, timer: { elapsedMs: -1, startedAt: null } }),
    JSON.stringify({ ...valid, timer: { elapsedMs: 0, startedAt: 'now' } }),
    JSON.stringify({ ...valid, accusation: 'felix' }),
    JSON.stringify({ ...valid, accusation: { who: 3 } }),
  ];
  for (const text of broken) {
    assert.deepEqual(logic.stateFromStorage(text), fresh, String(text));
  }
});

test('storageKey depends on the salt, so two games never share progress', () => {
  assert.notEqual(logic.storageKey('one'), logic.storageKey('two'));
  assert.ok(logic.storageKey('one').includes('one'));
});

test('fillText replaces each named field and leaves an unknown field as it is', () => {
  assert.equal(logic.fillText('{points} of {max} points', { points: 50, max: 75 }), '50 of 75 points');
  assert.equal(logic.fillText('Open {envelope}', {}), 'Open {envelope}');
});

test('correctOptionId finds the option whose hash matches, and null for an unknown question', () => {
  assert.equal(logic.correctOptionId(sampleData(), 'who'), 'felix');
  assert.equal(logic.correctOptionId(sampleData(), 'why'), 'debt');
  assert.equal(logic.correctOptionId(sampleData(), 'when'), null);
  assert.equal(logic.correctOptionId({ ...sampleData(), deduction: null }, 'who'), null);
});

test('correctOptionId gives null when no option matches the stored hash', () => {
  const data = sampleData();
  const broken = { questions: data.deduction ? [{ ...data.deduction.questions[0], correct_hash: 'x' }] : [] };
  assert.equal(logic.correctOptionId({ ...data, deduction: /** @type {any} */ (broken) }, 'who'), null);
});

test('isLongIntro is true only for an intro too long to read in a glance on a phone', () => {
  assert.equal(logic.isLongIntro('Read me aloud.'), false);
  assert.equal(logic.isLongIntro('x'.repeat(240)), false);
  assert.equal(logic.isLongIntro('x'.repeat(241)), true);
});

/** @returns {MysteryForgeCompanionData} */
function caseData() {
  return {
    ...sampleData(),
    investigation: {
      narrator: { name: 'Insp. Price', role: 'Lead investigator' },
      entries: [
        { type: 'chapter', id: 'ch-a', stage: 'A', after: null, title: 'The rock', text: 'One.\n\n  Two.  \n \n' },
        {
          type: 'voice',
          id: 'vm-a',
          stage: 'A',
          after: null,
          sender: 'Hale',
          voice: 'male',
          text: 'Call me.',
          audio: '',
        },
        {
          type: 'voice',
          id: 'vm-a2',
          stage: 'A',
          after: 'A2',
          sender: 'Ruiz',
          voice: 'female',
          text: 'Lab.',
          audio: '',
        },
        { type: 'chapter', id: 'ch-b', stage: 'B', after: null, title: 'The box', text: 'Three.' },
      ],
    },
  };
}

test('case entries follow the open envelopes and the solved puzzles', () => {
  assert.deepEqual(logic.caseEntries(sampleData(), ['A'], []), []);
  const ids = (/** @type {MysteryForgeCompanionCaseEntry[]} */ entries) => entries.map((entry) => entry.id);
  assert.deepEqual(ids(logic.caseEntries(caseData(), ['A'], [])), ['ch-a', 'vm-a']);
  assert.deepEqual(ids(logic.caseEntries(caseData(), ['A', 'B'], ['A1', 'A2'])), ['ch-a', 'vm-a', 'vm-a2', 'ch-b']);
});

test('seen entries are remembered once, and an old state without them still loads', () => {
  const entries = logic.caseEntries(caseData(), ['A'], []);
  let state = logic.freshState();
  assert.equal(logic.unseenEntries(entries, state).length, 2);
  state = logic.withSeen(state, ['ch-a', 'vm-a']);
  assert.equal(logic.unseenEntries(entries, state).length, 0);
  assert.equal(logic.withSeen(state, ['ch-a']), state);
  const { seen, ...old } = logic.freshState();
  assert.deepEqual(seen, []);
  const loaded = logic.stateFromStorage(JSON.stringify(old));
  assert.equal(loaded.seen, undefined);
  assert.equal(logic.unseenEntries(entries, loaded).length, 2);
  assert.deepEqual(logic.withSeen(loaded, ['vm-a']).seen, ['vm-a']);
  assert.deepEqual(logic.stateFromStorage(JSON.stringify({ ...old, seen: [1] })), logic.freshState());
  assert.deepEqual(logic.stateFromStorage(JSON.stringify({ ...old, seen: 'x' })), logic.freshState());
});

test('a female voice speaks higher than a male voice', () => {
  assert.ok(logic.speechSettings('female').pitch > logic.speechSettings('male').pitch);
});

test('a story text splits into its paragraphs', () => {
  assert.deepEqual(logic.paragraphs('One.\n\n  Two.  \n \n'), ['One.', 'Two.']);
});

const fs = require('node:fs');
const sealingContract = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', 'contracts', 'sealing-vectors.json'), 'utf8'),
);
const sealedStage = sealingContract.vectors[0];

/** @returns {MysteryForgeCompanionData} */
function playerData() {
  const data = sampleData();
  return {
    ...data,
    salt: sealingContract.salt,
    player: true,
    puzzles: data.puzzles.map((puzzle) => ({ ...puzzle, solution: null })),
    archive: {
      css: '',
      body_class: '',
      stages: [
        { id: 'A', envelope: 'Envelope A', label: 'Desk', documents: [], lock: null },
        { id: 'B', envelope: 'Envelope B', label: '', documents: null, lock: sealedStage.lock },
      ],
    },
  };
}

test('the player version has no answer step: the last hint is the last step', () => {
  const data = playerData();
  let state = logic.freshState();
  assert.equal(logic.nextHintLevel(data, state, 'A1'), 1);
  state = logic.withHintStep(data, state, 'A1');
  state = logic.withHintStep(data, state, 'A1');
  assert.equal(logic.nextHintLevel(data, state, 'A1'), null);
  assert.equal(logic.isAnswerShown(data, state, 'A1'), false);
  assert.equal(logic.withHintStep(data, state, 'A1'), state);
  assert.equal(logic.nextHintLevel(data, state, 'Z9'), null);
});

test('an archive envelope opens only with an answer that the group found', () => {
  const data = playerData();
  const archive = /** @type {MysteryForgeArchive} */ (data.archive);
  const sealed = /** @type {MysteryForgeArchiveStage} */ (archive.stages[1]);
  assert.deepEqual(
    logic.openArchiveStage(data, /** @type {MysteryForgeArchiveStage} */ (archive.stages[0]), logic.freshState()),
    {
      label: 'Desk',
      documents: [],
    },
  );
  assert.equal(logic.openArchiveStage(data, sealed, logic.freshState()), null);
  const state = logic.withAnswer(logic.freshState(), 'A1', sealedStage.answers[1]);
  assert.deepEqual(state.solved, ['A1']);
  // The vector seals a plain text, so a JSON stage of its own checks the parse.
  assert.throws(() => logic.openArchiveStage(data, sealed, state));
  const noDocuments = { ...sealed, lock: null, documents: null, label: 'X' };
  assert.deepEqual(logic.openArchiveStage(data, noDocuments, state), { label: 'X', documents: [] });
});

test('sealed endings open with the right accusation and join the readable ones', () => {
  const ending = sealingContract.vectors.find((/** @type {{label: string}} */ vector) => vector.label === 'epilogue');
  const data = { ...playerData(), ending_lock: ending.lock };
  assert.equal(logic.openEndings({ ...data, ending_lock: null }, logic.freshState()), null);
  assert.equal(logic.withOpenedEndings(data, logic.freshState()), data);
  assert.equal(logic.openEndings(data, logic.withAccusation(logic.freshState(), { who: 'ana' })), null);
  const noQuestions = { ...data, deduction: null };
  assert.equal(logic.openEndings(noQuestions, logic.freshState()), null);
  assert.throws(() => logic.openEndings(data, logic.withAccusation(logic.freshState(), { who: ending.answers[0] })));
});

test('opened endings are sorted with the readable ones', () => {
  const lockText = JSON.stringify({
    epilogues: [{ min_score_percent: 75, title: 'Top', text: 'All.' }],
    reveal: ['R'],
  });
  const data = { ...playerData(), epilogues: [{ min_score_percent: 0, title: 'Low', text: 'None.' }] };
  const sealingApi = globalThis.MysteryForgeSealing;
  const original = sealingApi.openLock;
  sealingApi.openLock = () => lockText;
  try {
    const opened = logic.withOpenedEndings({ ...data, ending_lock: sealedStage.lock }, logic.freshState());
    assert.deepEqual(
      opened.epilogues.map((epilogue) => epilogue.title),
      ['Top', 'Low'],
    );
    assert.deepEqual(opened.reveal, ['R']);
  } finally {
    sealingApi.openLock = original;
  }
});

test('the shared state of the TV merges into a device without losing anything local', () => {
  let local = logic.withAnswer(logic.freshState(), 'A1', 'boathouse');
  assert.equal(logic.mergeSharedState(local, null), local);
  const merged = logic.mergeSharedState(local, {
    solved: ['A1', 'A2', 7],
    answers: { A1: 'other', A2: '0726', B1: 5 },
    accusation: { who: 'felix' },
  });
  assert.deepEqual(merged.solved, ['A1', 'A2']);
  assert.deepEqual(merged.answers, { A1: 'boathouse', A2: '0726' });
  assert.deepEqual(merged.accusation, { who: 'felix' });
  const odd = logic.mergeSharedState(logic.freshState(), { solved: 'x', answers: 'y', accusation: { who: 3 } });
  assert.deepEqual(odd.solved, []);
  assert.deepEqual(odd.answers, {});
  assert.equal(odd.accusation, null);
  local = logic.withAccusation(local, { who: 'ana' });
  assert.deepEqual(logic.mergeSharedState(local, { accusation: { who: 'felix' } }).accusation, { who: 'ana' });
  assert.deepEqual(logic.sharedState(logic.freshState()), { solved: [], answers: {}, accusation: null });
});

test('stored answers must be texts for a saved state to load', () => {
  const { seen, ...old } = logic.freshState();
  assert.deepEqual(seen, []);
  assert.deepEqual(logic.stateFromStorage(JSON.stringify({ ...old, answers: { A1: 'x' } })).answers, { A1: 'x' });
  assert.deepEqual(logic.stateFromStorage(JSON.stringify({ ...old, answers: { A1: 2 } })), logic.freshState());
});
