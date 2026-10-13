// 학습 기록 저장소. localStorage에 JSON으로 저장하고, 테스트에서는 storage/clock을 바꿔 끼운다.
import { LEVELS, STAGE_BY_KEY, levelTrackPrev } from './data.js';
import { newRecord, isDue } from './srs.js';

const KEY = 'wordquest.v1';
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');

export const dateStr = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const defaults = () => ({
  v: 1,
  xp: 0,
  streak: { count: 0, best: 0, last: '' },
  days: {},          // 'YYYY-MM-DD' → { q: 푼 문제, c: 정답, xp }
  stages: {},        // '1-1' → { cleared, stars, best }
  bosses: {},        // '1' → { cleared, best }
  words: {},         // 단어 id → srs 레코드
  settings: { goal: 20, sound: true, rate: 0.9, notify: false, notifyTime: '20:00', lang: 'en' },
  lastNotified: '',
});

export function createStore(storage = globalThis.localStorage, clock = Date.now) {
  let state = load();

  function load() {
    try {
      const raw = storage && storage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch { /* 저장소를 못 읽어도 새로 시작 */ }
    return defaults();
  }

  function normalize(saved) {
    const base = defaults();
    return { ...base, ...saved, streak: { ...base.streak, ...saved.streak }, settings: { ...base.settings, ...saved.settings } };
  }

  function save() {
    try { storage && storage.setItem(KEY, JSON.stringify(state)); } catch { /* 용량/권한 문제는 무시 */ }
  }

  const store = {
    get state() { return state; },
    save,
    now: () => clock(),
    today: () => dateStr(clock()),

    // 단어 레코드(없으면 만든다)
    rec(id) {
      if (!state.words[id]) state.words[id] = newRecord();
      return state.words[id];
    },

    // 활동 기록: 문제 수/정답 수/XP를 오늘 기록에 더하고, 문제를 풀었으면 스트릭을 갱신
    // q/c/xp는 두 언어 합산(14일 그래프 등 기존 통계용), byLang은 "오늘의 목표"를 언어별로 보여주기 위한 보조 집계.
    addActivity({ questions = 0, correct = 0, xp = 0, lang = null }) {
      const t = store.today();
      const day = (state.days[t] ||= { q: 0, c: 0, xp: 0, byLang: {} });
      day.q += questions;
      day.c += correct;
      day.xp += xp;
      if (lang && questions > 0) day.byLang[lang] = (day.byLang[lang] || 0) + questions;
      state.xp += xp;
      if (questions > 0) touchStreak(t);
      save();
    },

    // 오늘 기준으로 이어지고 있는 연속 학습일(어제까지 했으면 유지, 그 이전이면 0)
    streak() {
      const { count, last } = state.streak;
      const t = store.today();
      const y = dateStr(clock() - DAY);
      return last === t || last === y ? count : 0;
    },
    // lang을 주면 그 언어만의 오늘 문제 수, 안 주면 두 언어 합산(기존 동작 유지, 통계 화면 등에서 사용).
    todayCount: (lang = null) => {
      const day = state.days[store.today()] || { q: 0, byLang: {} };
      return lang ? (day.byLang?.[lang] || 0) : day.q;
    },

    dueIds() {
      const now = clock();
      return Object.keys(state.words).filter((id) => isDue(state.words[id], now));
    },
    noteIds: () => Object.keys(state.words).filter((id) => state.words[id].note),

    // 진행도/잠금
    stageInfo: (key) => state.stages[key] || { cleared: false, stars: 0, best: 0 },
    bossInfo: (levelId) => state.bosses[levelId] || { cleared: false, best: 0 },
    // 레벨은 언어 트랙(영어 1~4 / 일본어 N5~) 안에서만 순서대로 풀린다 — 각 트랙의 첫 레벨은 항상 열려있음.
    isLevelUnlocked(levelId) {
      const prev = levelTrackPrev(levelId);
      return !prev || Boolean(state.bosses[prev.id]?.cleared);
    },
    isStageUnlocked(key) {
      const st = STAGE_BY_KEY.get(key);
      if (!st || !store.isLevelUnlocked(st.level)) return false;
      return st.index === 0 || Boolean(state.stages[`${st.level}-${st.index}`]?.cleared);
    },
    isBossUnlocked(levelId) {
      const lv = LEVELS.find((l) => l.id === levelId);
      return Boolean(lv) && store.isLevelUnlocked(levelId) && lv.stages.every((s) => state.stages[s.key]?.cleared);
    },
    setStage(key, { pass, stars, acc }) {
      const prev = store.stageInfo(key);
      state.stages[key] = { cleared: prev.cleared || pass, stars: pass ? Math.max(prev.stars, stars) : prev.stars, best: Math.max(prev.best, acc) };
      save();
    },
    setBoss(levelId, { pass, acc }) {
      const prev = store.bossInfo(levelId);
      state.bosses[levelId] = { cleared: prev.cleared || pass, best: Math.max(prev.best, acc) };
      save();
    },

    setSetting(name, value) { state.settings[name] = value; save(); },

    exportJson: () => JSON.stringify(state),
    importJson(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.words !== 'object') throw new Error('형식이 올바르지 않은 파일입니다.');
      state = normalize(parsed);
      save();
    },
    reset() { state = defaults(); save(); },
  };

  function touchStreak(t) {
    const s = state.streak;
    if (s.last === t) return;
    s.count = s.last === dateStr(clock() - DAY) ? s.count + 1 : 1;
    s.best = Math.max(s.best, s.count);
    s.last = t;
  }

  return store;
}
