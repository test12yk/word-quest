// 실행: node tests/test.mjs  (의존성 없음)
import assert from 'node:assert/strict';
import { LEVELS, ALL_WORDS, WORD_BY_ID, langLevels, levelTrackPrev, levelTrackNext } from '../js/data.js';
import { makeQuestion, checkAnswer, stageQuestions, bossQuestions, reviewQuestions, retryQuestion, blankOut, spellHint } from '../js/quiz.js';
import { newRecord, recordStats, schedule, scheduleStage, isDue, nextDue, startOfDay, INTERVALS } from '../js/srs.js';
import { createStore, dateStr } from '../js/store.js';

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };

console.log('데이터');
test('언어 트랙(영어 4레벨, 일본어 1레벨 이상), 스테이지마다 단어 8개', () => {
  assert.equal(langLevels('en').length, 4);
  assert.ok(langLevels('ja').length >= 1);
  for (const lv of LEVELS) {
    assert.ok(lv.stages.length >= 4, `${lv.label} 스테이지 수`);
    for (const st of lv.stages) assert.equal(st.words.length, 8, `${st.key} 단어 수`);
  }
});
test('단어 id·뜻이 중복되지 않는다(오답 보기가 정답과 겹치지 않도록, 언어 섞여도 동일)', () => {
  assert.equal(new Set(ALL_WORDS.map((w) => w.id)).size, ALL_WORDS.length);
  assert.equal(new Set(ALL_WORDS.map((w) => w.ko)).size, ALL_WORDS.length);
});
test('예문의 *표시*가 표제어와 정확히 같다', () => {
  for (const w of ALL_WORDS) {
    const m = w.ex.match(/\*([^*]+)\*/g);
    assert.equal(m?.length, 1, `${w.id}: 표시가 정확히 1개여야 함`);
    assert.equal(m[0].slice(1, -1).toLowerCase(), w.en.toLowerCase(), `${w.id}: 예문 표시 불일치`);
    assert.ok(w.exKo && w.ko && ['n', 'v', 'adj', 'adv'].includes(w.pos), `${w.id}: 필드 누락`);
  }
});
test('일본어 단어는 읽기(후리가나)·로마자가 모두 채워져 있다', () => {
  for (const w of ALL_WORDS.filter((w) => w.lang === 'ja')) {
    assert.ok(w.reading, `${w.id}: 읽기 누락`);
    assert.ok(w.romaji, `${w.id}: 로마자 누락`);
  }
});
test('레벨 트랙 이동: 각 언어의 첫 레벨은 이전이 없고, 마지막은 다음이 없다', () => {
  assert.equal(levelTrackPrev(1), null); // 영어 첫 레벨
  assert.equal(levelTrackNext(4), null); // 영어 마지막 레벨(지금까지는)
  assert.equal(levelTrackPrev(5), null); // 일본어 첫 레벨(N5)
  assert.equal(levelTrackNext(5).id, 6); // N5 다음은 N4
  assert.equal(levelTrackPrev(6).id, 5); // N4 이전은 N5
  assert.equal(levelTrackNext(6), null); // N4가 지금까지는 일본어 마지막 레벨
});

console.log('문제 생성');
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
test('모든 단어·모든 유형에서 정답이 보기에 있고 보기가 4개·중복 없음', () => {
  for (const w of ALL_WORDS) {
    for (const type of ['meaning', 'listen', 'cloze', 'reverse']) {
      const q = makeQuestion(type, w, seeded(w.id.length));
      assert.equal(q.choices.length, 4, `${w.id}/${type}`);
      assert.equal(new Set(q.choices).size, 4, `${w.id}/${type} 중복`);
      assert.ok(q.choices.includes(q.answer));
    }
  }
});
test('채점: 보기는 정확 일치, 스펠링은 대소문자·공백 무시', () => {
  const w = WORD_BY_ID.get('wake up');
  assert.ok(checkAnswer(makeQuestion('spell', w), '  Wake   UP '));
  assert.ok(!checkAnswer(makeQuestion('spell', w), 'wakeup'));
  const q = makeQuestion('meaning', w);
  assert.ok(checkAnswer(q, w.ko));
  assert.ok(!checkAnswer(q, q.choices.find((c) => c !== w.ko)));
});
test('빈칸 문제와 스펠링 힌트', () => {
  assert.equal(blankOut(WORD_BY_ID.get('borrow').ex), 'Can I _____ your pen?');
  assert.equal(spellHint('wake up'), 'w___ u_');
});
test('일본어 스펠링 문제는 로마자로 채점한다', () => {
  const w = WORD_BY_ID.get('食べる');
  const q = makeQuestion('spell', w);
  assert.equal(q.answer, 'taberu');
  assert.ok(checkAnswer(q, '  Taberu '));
  assert.ok(!checkAnswer(q, '食べる'));
});
test('스테이지는 16문제, 모든 단어가 2번씩 나온다', () => {
  const st = LEVELS[0].stages[0];
  const qs = stageQuestions(st, seeded(7));
  assert.equal(qs.length, 16);
  for (const w of st.words) assert.equal(qs.filter((q) => q.wordId === w.id).length, 2);
});
test('보스는 16문제, 해당 레벨 단어만 나온다', () => {
  const qs = bossQuestions(2, 16, seeded(3));
  assert.equal(qs.length, 16);
  assert.ok(qs.every((q) => WORD_BY_ID.get(q.wordId).level === 2));
});
test('복습은 단계에 따라 유형이 달라지고, 재도전은 다른 유형이다', () => {
  const recs = { borrow: { box: 0 }, carry: { box: 5 } };
  const qs = reviewQuestions(['borrow', 'carry'], recs, seeded(5));
  assert.equal(qs.find((q) => q.wordId === 'carry').type, 'spell');
  assert.ok(['meaning', 'listen', 'cloze'].includes(qs.find((q) => q.wordId === 'borrow').type));
  const q = makeQuestion('meaning', WORD_BY_ID.get('borrow'));
  const r = retryQuestion(q);
  assert.ok(r.retry && r.type !== 'meaning' && r.wordId === 'borrow');
});

console.log('간격 반복');
test('맞히면 다음 단계·간격이 늘고, 틀리면 처음으로', () => {
  const now = new Date(2026, 8, 21, 15, 30).getTime();
  const rec = newRecord();
  schedule(rec, true, now);
  assert.equal(rec.box, 1);
  assert.equal(rec.due, new Date(2026, 8, 22, 0, 0).getTime());
  schedule(rec, true, now);
  assert.equal(rec.box, 2);
  assert.equal(rec.due, new Date(2026, 8, 23, 0, 0).getTime());
  schedule(rec, false, now);
  assert.equal(rec.box, 0);
  assert.equal(rec.due, now);
});
test('마지막 단계(30일)를 넘지 않는다', () => {
  const rec = newRecord();
  for (let i = 0; i < 10; i += 1) schedule(rec, true, 0);
  assert.equal(rec.box, INTERVALS.length - 1);
});
test('스테이지 채점: 처음 본 단어는 1/0로 시작, 이미 배운 단어는 맞혀도 간격이 안 늘어난다', () => {
  const now = Date.now();
  const a = newRecord(); scheduleStage(a, true, now); assert.equal(a.box, 1);
  const b = newRecord(); scheduleStage(b, false, now); assert.equal(b.box, 0);
  scheduleStage(a, true, now); assert.equal(a.box, 1);
  scheduleStage(a, false, now); assert.equal(a.box, 0);
});
test('복습 대기 판정: 배운 단어만, 시각이 지나야', () => {
  const now = Date.now();
  const rec = newRecord();
  assert.ok(!isDue(rec, now));
  schedule(rec, true, now);
  assert.ok(!isDue(rec, now));
  assert.ok(isDue(rec, startOfDay(now) + 2 * 86400000));
});
test('오답노트: 틀리면 등록, 연속 3번 맞히면 졸업', () => {
  const rec = newRecord();
  recordStats(rec, false, 1); assert.ok(rec.note);
  recordStats(rec, true, 2); recordStats(rec, true, 3); assert.ok(rec.note);
  recordStats(rec, true, 4); assert.ok(!rec.note);
  recordStats(rec, false, 5); recordStats(rec, true, 6); recordStats(rec, false, 7);
  assert.equal(rec.clean, 0);
});
test('nextDue는 box 0이면 지금', () => assert.equal(nextDue(0, 123), 123));

console.log('저장소');
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
test('오늘의 목표는 언어별로 따로 집계되고, 인자 없이 부르면 합산이다', () => {
  const s = createStore(memory());
  s.addActivity({ questions: 3, correct: 2, xp: 10, lang: 'en' });
  s.addActivity({ questions: 2, correct: 1, xp: 10, lang: 'ja' });
  assert.equal(s.todayCount('en'), 3);
  assert.equal(s.todayCount('ja'), 2);
  assert.equal(s.todayCount(), 5);
});
test('복습 대기·오답노트도 언어별로 따로 걸러진다', () => {
  const now = Date.now();
  const s = createStore(memory(), () => now);
  const en = s.rec('borrow'); schedule(en, true, now); en.note = true;
  const ja = s.rec('食べる'); schedule(ja, true, now); ja.note = true;
  const due = now + 2 * 86400000; // 둘 다 복습 시점이 지나도록
  const s2 = createStore({ getItem: () => JSON.stringify({ v: 1, words: { borrow: en, 食べる: ja } }), setItem: () => {} }, () => due);
  assert.ok(s2.dueIds('en').includes('borrow') && !s2.dueIds('en').includes('食べる'));
  assert.ok(s2.dueIds('ja').includes('食べる') && !s2.dueIds('ja').includes('borrow'));
  assert.ok(s2.noteIds('en').includes('borrow') && !s2.noteIds('en').includes('食べる'));
  assert.ok(s2.noteIds('ja').includes('食べる') && !s2.noteIds('ja').includes('borrow'));
});
test('byLang 도입 전에 저장된 오늘 기록(필드 없음)이어도 addActivity가 에러 없이 동작한다', () => {
  const storage = memory();
  const t = dateStr(Date.now());
  storage.setItem('wordquest.v1', JSON.stringify({
    v: 1, xp: 0, streak: { count: 0, best: 0, last: '' },
    days: { [t]: { q: 3, c: 2, xp: 30 } }, // byLang 없는 구버전 기록
    stages: {}, bosses: {}, words: {}, settings: {}, lastNotified: '',
  }));
  const s = createStore(storage);
  assert.doesNotThrow(() => s.addActivity({ questions: 1, correct: 1, xp: 10, lang: 'ja' }));
  assert.equal(s.todayCount('ja'), 1);
  assert.equal(s.todayCount(), 4);
});
test('스트릭: 연속일은 늘고, 하루 걸러면 1로 돌아간다', () => {
  let t = new Date(2026, 8, 1, 10).getTime();
  const s = createStore(memory(), () => t);
  s.addActivity({ questions: 1 });
  s.addActivity({ questions: 1 });
  assert.equal(s.streak(), 1);
  t += 86400000; s.addActivity({ questions: 1 });
  assert.equal(s.streak(), 2);
  t += 2 * 86400000;
  assert.equal(s.streak(), 0, '이틀 쉬면 표시상 0');
  s.addActivity({ questions: 1 });
  assert.equal(s.streak(), 1);
  assert.equal(s.state.streak.best, 2);
});
test('잠금: 스테이지 순서대로, 보스는 4개 클리어 후, 다음 레벨은 보스 이후', () => {
  const s = createStore(memory());
  assert.ok(s.isStageUnlocked('1-1') && !s.isStageUnlocked('1-2') && !s.isLevelUnlocked(2));
  ['1-1', '1-2', '1-3'].forEach((k) => s.setStage(k, { pass: true, stars: 2, acc: 0.9 }));
  assert.ok(s.isStageUnlocked('1-4') && !s.isBossUnlocked(1));
  s.setStage('1-4', { pass: true, stars: 3, acc: 1 });
  assert.ok(s.isBossUnlocked(1) && !s.isStageUnlocked('2-1'));
  s.setBoss(1, { pass: true, acc: 0.9 });
  assert.ok(s.isStageUnlocked('2-1') && !s.isStageUnlocked('2-2'));
});
test('잠금: 언어 트랙이 분리되어, 영어 레벨과 상관없이 일본어 첫 레벨(N5)은 항상 열려있다', () => {
  const s = createStore(memory());
  assert.ok(s.isLevelUnlocked(5) && s.isStageUnlocked('5-1') && !s.isStageUnlocked('5-2'));
});
test('저장 후 다시 불러오기, 백업 가져오기, 초기화', () => {
  const storage = memory();
  const a = createStore(storage);
  a.addActivity({ questions: 3, correct: 2, xp: 20 });
  a.rec('borrow').learned = true; a.save();
  const b = createStore(storage);
  assert.equal(b.state.xp, 20);
  assert.ok(b.state.words.borrow.learned);
  const c = createStore(memory());
  c.importJson(b.exportJson());
  assert.equal(c.state.xp, 20);
  assert.throws(() => c.importJson('{"x":1}'));
  c.reset();
  assert.equal(c.state.xp, 0);
});
test('dateStr 형식', () => assert.equal(dateStr(new Date(2026, 0, 5).getTime()), '2026-01-05'));

console.log(`\n${passed}개 통과`);
