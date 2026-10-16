// 문제 생성/채점. DOM에 의존하지 않아서 node에서 그대로 테스트할 수 있다.
import { ALL_WORDS, WORD_BY_ID, levelWords } from './data.js';
import { normalizeKana, isRomaji } from './kana.js';
import { verbClass, conjugate, wrongForms, FORM_KEYS } from './conj.js';

export const TYPE_LABEL = {
  meaning: '뜻 고르기',
  listen: '듣고 고르기',
  cloze: '빈칸 채우기',
  reverse: '단어 고르기',
  spell: '스펠링 쓰기',
  write: '빈칸 쓰기',   // 말해보카식: 예문 빈칸에 단어를 직접 입력
  kanji: '한자 읽기',   // 일본어: 한자 표기를 보고 읽는 법 고르기
  conj: '활용형',       // 일본어 동사: ます·て·ない·た형 고르기
};

const RECOGNITION = ['meaning', 'listen', 'cloze']; // 보고 뜻을 떠올리는 문제
const PRODUCTION = ['reverse', 'spell', 'write'];   // 뜻을 보고 단어를 떠올리는 문제

// 일본어 전용 유형은 해당하는 단어에만 붙인다(한자 읽기: 표기≠읽기, 활용형: 동사).
export const hasKanji = (w) => w.lang === 'ja' && w.reading !== w.en;
export const isJaVerb = (w) => w.lang === 'ja' && !!verbClass(w);
export const recognitionTypes = (w) => (hasKanji(w) ? [...RECOGNITION, 'kanji'] : RECOGNITION);
export const productionTypes = (w) => (isJaVerb(w) ? [...PRODUCTION, 'conj'] : PRODUCTION);
export const typesFor = (w) => [...recognitionTypes(w), ...productionTypes(w)];

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const blankOut = (ex) => ex.replace(/\*[^*]+\*/, '_____');
export const plainText = (ex) => ex.replace(/\*/g, '');
export const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// 오답 보기: 같은 레벨·같은 품사 → 같은 레벨 → 같은 언어 전체 순으로 채우고, 정답과 같은 문자열은 피한다.
// (영어 문제에 일본어 보기가 섞이지 않도록 언어는 항상 같게)
function distractors(word, field, count, rng) {
  const used = new Set([word[field]]);
  const pool = shuffle(ALL_WORDS.filter((w) => w.id !== word.id && w.lang === word.lang), rng);
  const tiers = [
    (w) => w.level === word.level && w.pos === word.pos,
    (w) => w.level === word.level,
    () => true,
  ];
  const out = [];
  for (const tier of tiers) {
    for (const w of pool) {
      if (out.length >= count) return out;
      if (tier(w) && !used.has(w[field])) {
        used.add(w[field]);
        out.push(w[field]);
      }
    }
  }
  return out;
}

// 한자 읽기 오답 보기: 같은 언어의 다른 단어 읽기 중 글자 수가 비슷한 것부터.
function readingDistractors(word, rng) {
  const used = new Set([word.reading]);
  const pool = shuffle(ALL_WORDS.filter((w) => w.lang === 'ja' && w.id !== word.id), rng);
  const n = word.reading.length;
  const out = [];
  for (const tier of [(w) => Math.abs(w.reading.length - n) <= 1 && w.reading[0] === word.reading[0], (w) => Math.abs(w.reading.length - n) <= 1, () => true]) {
    for (const w of pool) {
      if (out.length >= 3) return out;
      if (tier(w) && !used.has(w.reading)) { used.add(w.reading); out.push(w.reading); }
    }
  }
  return out;
}

export function makeQuestion(type, word, rng = Math.random) {
  if (type === 'kanji' && !hasKanji(word)) type = 'meaning';
  if (type === 'conj' && !isJaVerb(word)) type = 'reverse';
  const q = { type, wordId: word.id, retry: false };
  if (type === 'kanji') {
    q.answer = word.reading;
    q.choices = shuffle([word.reading, ...readingDistractors(word, rng)], rng);
  } else if (type === 'conj') {
    q.form = FORM_KEYS[Math.floor(rng() * FORM_KEYS.length)];
    const c = conjugate(word, q.form);
    q.answer = c.form;
    q.answerReading = c.reading;
    q.rule = c.rule;
    q.choices = shuffle([c.form, ...wrongForms(word, q.form)], rng);
  } else if (type === 'write') {
    q.answer = word.en; // 일본어는 표기·히라가나·로마자 모두 정답으로 본다(checkAnswer)
  } else if (type === 'meaning') {
    q.answer = word.ko;
    q.choices = shuffle([word.ko, ...distractors(word, 'ko', 3, rng)], rng);
  } else if (type === 'reverse' || type === 'listen' || type === 'cloze') {
    q.answer = word.en;
    q.choices = shuffle([word.en, ...distractors(word, 'en', 3, rng)], rng);
  } else {
    q.answer = word.romaji || word.en; // spell: 일본어는 로마자로, 영어는 그대로
  }
  return q;
}

export function checkAnswer(q, input) {
  const w = WORD_BY_ID.get(q.wordId);
  if (q.type === 'spell') {
    if (normalize(input) === normalize(q.answer)) return true;
    // 일본어 스펠링: 로마자 표기 차이(si/shi, tu/tsu 등)는 가나로 바꿔 비교
    return w?.lang === 'ja' && isRomaji(input) && normalizeKana(input) === normalizeKana(w.reading);
  }
  if (q.type === 'write') {
    if (w?.lang !== 'ja') return normalize(input) === normalize(w.en);
    const t = String(input).trim().replace(/\s+/g, '');
    return t === w.en || normalizeKana(t) === normalizeKana(w.reading);
  }
  return input === q.answer;
}

// 빈칸 쓰기 힌트: 영어는 첫 글자(b_____), 일본어는 읽기 첫 글자 + 글자 수(た＿＿)
export const writeHint = (w) => (w.lang === 'ja' ? w.reading[0] + '＿'.repeat(w.reading.length - 1) : spellHint(w.en));

// 스펠링 힌트: 각 단어의 첫 글자만 보여준다. (wake up → w___ u_)
export const spellHint = (en) => en.split(' ').map((p) => p[0] + '_'.repeat(p.length - 1)).join(' ');

// 스테이지: 단어마다 2문제. 앞 절반은 뜻 알아보기, 뒤 절반은 뜻→단어 떠올리기.
export function stageQuestions(stage, rng = Math.random) {
  const pickOf = (types, i) => types[i % types.length];
  const first = shuffle(stage.words, rng).map((w, i) => makeQuestion(pickOf(recognitionTypes(w), i), w, rng));
  const second = shuffle(stage.words, rng).map((w, i) => makeQuestion(pickOf(productionTypes(w), i), w, rng));
  // 같은 단어가 앞 절반 끝과 뒤 절반 처음에 붙어 나오지 않게 한다.
  if (first.length && second.length > 1 && first[first.length - 1].wordId === second[0].wordId) {
    [second[0], second[second.length - 1]] = [second[second.length - 1], second[0]];
  }
  return [...first, ...second];
}

// 레벨 보스: 레벨 전체 단어에서 무작위로 뽑아 단어에 맞는 유형을 고루 섞는다.
export function bossQuestions(levelId, count = 16, rng = Math.random) {
  const questions = shuffle(levelWords(levelId), rng).slice(0, count)
    .map((w, i) => { const types = typesFor(w); return makeQuestion(types[i % types.length], w, rng); });
  return shuffle(questions, rng);
}

// 복습/오답 연습: 단계가 높을수록 어려운 유형(뜻→단어, 스펠링)으로 묻는다.
export function reviewQuestions(ids, records, rng = Math.random) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return shuffle(ids, rng).map((id) => {
    const w = WORD_BY_ID.get(id);
    const box = records[id]?.box ?? 0;
    const mid = ['reverse', 'cloze', 'write', ...(hasKanji(w) ? ['kanji'] : []), ...(isJaVerb(w) ? ['conj'] : [])];
    const type = box <= 1 ? pick(recognitionTypes(w)) : box <= 3 ? pick(mid) : pick(['spell', 'write']);
    return makeQuestion(type, w, rng);
  });
}

// 틀린 단어를 같은 세션에서 다른 유형으로 한 번 더 묻는다.
export function retryQuestion(q, rng = Math.random) {
  const options = ['meaning', 'reverse', 'cloze'].filter((t) => t !== q.type);
  const type = options[Math.floor(rng() * options.length)];
  return { ...makeQuestion(type, WORD_BY_ID.get(q.wordId), rng), retry: true };
}
