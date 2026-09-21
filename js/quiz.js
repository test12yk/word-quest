// 문제 생성/채점. DOM에 의존하지 않아서 node에서 그대로 테스트할 수 있다.
import { ALL_WORDS, WORD_BY_ID, levelWords } from './data.js';

export const TYPE_LABEL = {
  meaning: '뜻 고르기',
  listen: '듣고 고르기',
  cloze: '빈칸 채우기',
  reverse: '단어 고르기',
  spell: '스펠링 쓰기',
};

const RECOGNITION = ['meaning', 'listen', 'cloze']; // 보고 뜻을 떠올리는 문제
const PRODUCTION = ['reverse', 'spell'];            // 뜻을 보고 단어를 떠올리는 문제

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

// 오답 보기: 같은 레벨·같은 품사 → 같은 레벨 → 전체 순으로 채우고, 정답과 같은 문자열은 피한다.
function distractors(word, field, count, rng) {
  const used = new Set([word[field]]);
  const pool = shuffle(ALL_WORDS.filter((w) => w.id !== word.id), rng);
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

export function makeQuestion(type, word, rng = Math.random) {
  const q = { type, wordId: word.id, retry: false };
  if (type === 'meaning') {
    q.answer = word.ko;
    q.choices = shuffle([word.ko, ...distractors(word, 'ko', 3, rng)], rng);
  } else if (type === 'reverse' || type === 'listen' || type === 'cloze') {
    q.answer = word.en;
    q.choices = shuffle([word.en, ...distractors(word, 'en', 3, rng)], rng);
  } else {
    q.answer = word.en; // spell
  }
  return q;
}

export function checkAnswer(q, input) {
  if (q.type === 'spell') return normalize(input) === normalize(q.answer);
  return input === q.answer;
}

// 스펠링 힌트: 각 단어의 첫 글자만 보여준다. (wake up → w___ u_)
export const spellHint = (en) => en.split(' ').map((p) => p[0] + '_'.repeat(p.length - 1)).join(' ');

// 스테이지: 단어마다 2문제. 앞 절반은 뜻 알아보기, 뒤 절반은 뜻→단어 떠올리기.
export function stageQuestions(stage, rng = Math.random) {
  const first = shuffle(stage.words, rng).map((w, i) => makeQuestion(RECOGNITION[i % RECOGNITION.length], w, rng));
  const second = shuffle(stage.words, rng).map((w, i) => makeQuestion(PRODUCTION[i % PRODUCTION.length], w, rng));
  // 같은 단어가 앞 절반 끝과 뒤 절반 처음에 붙어 나오지 않게 한다.
  if (first.length && second.length > 1 && first[first.length - 1].wordId === second[0].wordId) {
    [second[0], second[second.length - 1]] = [second[second.length - 1], second[0]];
  }
  return [...first, ...second];
}

// 레벨 보스: 레벨 전체 단어에서 무작위로 뽑아 5가지 유형을 섞는다.
export function bossQuestions(levelId, count = 16, rng = Math.random) {
  const types = Object.keys(TYPE_LABEL);
  const questions = shuffle(levelWords(levelId), rng).slice(0, count)
    .map((w, i) => makeQuestion(types[i % types.length], w, rng));
  return shuffle(questions, rng);
}

// 복습/오답 연습: 단계가 높을수록 어려운 유형(뜻→단어, 스펠링)으로 묻는다.
export function reviewQuestions(ids, records, rng = Math.random) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return shuffle(ids, rng).map((id) => {
    const box = records[id]?.box ?? 0;
    const type = box <= 1 ? pick(RECOGNITION) : box <= 3 ? pick(['reverse', 'cloze']) : 'spell';
    return makeQuestion(type, WORD_BY_ID.get(id), rng);
  });
}

// 틀린 단어를 같은 세션에서 다른 유형으로 한 번 더 묻는다.
export function retryQuestion(q, rng = Math.random) {
  const options = ['meaning', 'reverse', 'cloze'].filter((t) => t !== q.type);
  const type = options[Math.floor(rng() * options.length)];
  return { ...makeQuestion(type, WORD_BY_ID.get(q.wordId), rng), retry: true };
}
