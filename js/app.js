// 워드퀘스트 — 화면/라우팅/세션 진행. 로직은 srs.js·quiz.js·store.js에 있고, 여기서는 그걸 화면에 연결한다.
import { LEVELS, STAGE_BY_KEY, WORD_BY_ID, POS_LABEL } from './data.js';
import { createStore, dateStr } from './store.js';
import {
  TYPE_LABEL, makeQuestion, stageQuestions, bossQuestions, reviewQuestions, retryQuestion,
  checkAnswer, blankOut, spellHint,
} from './quiz.js';
import { recordStats, schedule, scheduleStage, startOfDay, isMastered } from './srs.js';
import { speak, canSpeak } from './tts.js';
import { maybeNotify, requestNotify, notifyPermission, notifySupported, setBadge } from './notify.js';

const DAY = 86400000;
const PASS_RATE = 0.8;
const store = createStore();
const app = document.getElementById('app');
const nav = document.getElementById('nav');

let session = null;  // 진행 중인 퀴즈
let result = null;   // 방금 끝난 퀴즈의 결과
let learn = { key: null, i: 0 };

// ── 작은 도구들 ─────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mark = (ex) => esc(ex).replace(/\*([^*]+)\*/g, '<mark>$1</mark>');
const pct = (r) => Math.round(r * 100);
const say = (text) => speak(text, store.state.settings.rate);
const wordOf = (id) => WORD_BY_ID.get(id);
const stars = (n) => `<span class="stars" role="img" aria-label="별 ${n}개">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('')}</span>`;

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function navigate(path) {
  if (location.hash === `#${path}`) render();
  else location.hash = path;
}

const ICONS = {
  learn: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  review: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  notes: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  me: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ── 라우터 ───────────────────────────────────────────────────
function render() {
  const [, name = '', arg] = location.hash.slice(1).split('/');
  const focusMode = ['learn', 'play', 'result'].includes(name);
  document.body.dataset.route = focusMode ? 'focus' : name || 'home';

  if (name === 'play' && !session) return navigate('/');
  if (name === 'result' && !result) return navigate('/');

  const views = {
    '': homeView, review: reviewView, notes: notesView, me: meView,
    stage: () => stageView(arg), learn: () => learnView(arg), play: playView, result: resultView,
  };
  app.innerHTML = (views[name] || homeView)();
  window.scrollTo(0, 0);
  renderNav(name);
  afterRender(name);
}

function renderNav(name) {
  const due = store.dueIds().length;
  const tabs = [['', 'learn', '학습'], ['review', 'review', '복습'], ['notes', 'notes', '오답노트'], ['me', 'me', '내 기록']];
  const current = ['stage'].includes(name) ? '' : name;
  nav.innerHTML = tabs.map(([path, ic, label]) => `
    <a href="#/${path}" class="tab ${current === path ? 'active' : ''}" ${current === path ? 'aria-current="page"' : ''}>
      ${icon(ic)}<span>${label}</span>${path === 'review' && due > 0 ? `<b class="badge" aria-label="복습 ${due}개">${due > 99 ? '99+' : due}</b>` : ''}
    </a>`).join('');
  setBadge(due);
}

function afterRender(name) {
  if (name === 'me') bindChart();
  if (name === 'learn') {
    const w = wordOf(currentLearnWords()[learn.i]?.id);
    if (w && store.state.settings.sound) say(w.en);
  }
  if (name === 'play' && session) {
    const q = session.queue[session.idx];
    if (session.feedback) {
      $('[data-act="next"]')?.focus();
    } else {
      if (q.type === 'listen' && store.state.settings.sound && session.spokenIdx !== session.idx) say(wordOf(q.wordId).en);
      session.spokenIdx = session.idx;
      $('.spell input')?.focus();
    }
  }
}
const $ = (sel) => app.querySelector(sel);

// ── 홈(학습 지도) ───────────────────────────────────────────
function homeView() {
  const { goal } = store.state.settings;
  const done = store.todayCount();
  const due = store.dueIds().length;
  const levels = LEVELS.map((lv) => {
    const unlocked = store.isLevelUnlocked(lv.id);
    const cleared = lv.stages.filter((s) => store.stageInfo(s.key).cleared).length;
    const boss = store.bossInfo(lv.id);
    const bossOpen = store.isBossUnlocked(lv.id);
    const rows = lv.stages.map((s) => {
      const info = store.stageInfo(s.key);
      const open = store.isStageUnlocked(s.key);
      const cls = !open ? 'locked' : info.cleared ? 'done' : 'current';
      return `<li><button class="stage ${cls}" data-act="${open ? 'open-stage' : 'locked'}" data-arg="${s.key}" ${open ? '' : 'aria-disabled="true"'}>
        <span class="node" aria-hidden="true">${info.cleared ? '✓' : open ? s.index + 1 : '🔒'}</span>
        <span class="meta"><b>${esc(s.name)}</b><small>단어 ${s.words.length}개${info.cleared ? ` · 최고 ${pct(info.best)}%` : ''}</small></span>
        <span class="right">${info.cleared ? stars(info.stars) : open ? '<span class="tag">시작</span>' : ''}</span>
      </button></li>`;
    }).join('');
    const bossCls = !bossOpen ? 'locked' : boss.cleared ? 'done' : 'current';
    const bossRow = `<li><button class="stage boss ${bossCls}" data-act="${bossOpen ? 'start-boss' : 'locked-boss'}" data-arg="${lv.id}" ${bossOpen ? '' : 'aria-disabled="true"'}>
        <span class="node" aria-hidden="true">${boss.cleared ? '✓' : bossOpen ? '👑' : '🔒'}</span>
        <span class="meta"><b>레벨 테스트</b><small>16문제 · ${pct(PASS_RATE)}% 이상이면 통과${boss.cleared ? ` · 최고 ${pct(boss.best)}%` : ''}</small></span>
        <span class="right">${boss.cleared ? '<span class="tag ok">통과</span>' : bossOpen ? '<span class="tag">도전</span>' : ''}</span>
      </button></li>`;
    const lock = unlocked ? '' : `<p class="level-lock">🔒 Lv.${lv.id - 1} 레벨 테스트를 통과하면 열려요</p>`;
    return `<section class="level ${unlocked ? '' : 'is-locked'}">
      <div class="level-head"><span class="level-icon" aria-hidden="true">${lv.icon}</span>
        <div><h2>Lv.${lv.id} ${esc(lv.name)}</h2><p>${esc(lv.desc)} · ${cleared}/${lv.stages.length} 클리어</p></div></div>
      ${lock}<ol class="stages">${rows}${bossRow}</ol></section>`;
  }).join('');

  return `<main class="view">
    <header class="top"><h1>워드퀘스트</h1>
      <div class="chips"><span class="chip streak" title="연속 학습">🔥 ${store.streak()}일</span><span class="chip xp" title="누적 경험치">⭐ ${store.state.xp} XP</span></div></header>
    <section class="card goal" aria-label="오늘의 목표">
      <div class="goal-row"><b>오늘의 목표</b><span>${done >= goal ? '달성! 🎉' : `${done} / ${goal} 문제`}</span></div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(done, goal)}"><i style="width:${Math.min(1, done / goal) * 100}%"></i></div>
      ${due > 0 ? `<button class="btn primary block" data-act="start-review">복습할 단어 ${due}개 · 지금 복습</button>` : ''}
    </section>${levels}</main>`;
}

// ── 스테이지 소개 / 단어 학습 ───────────────────────────────
function stageView(key) {
  const st = STAGE_BY_KEY.get(key);
  if (!st || !store.isStageUnlocked(key)) return homeView();
  const info = store.stageInfo(key);
  const rows = st.words.map((w) => `<li><span class="w-en">${esc(w.en)}</span><span class="w-ko">${esc(w.ko)}</span>
    <button class="icon-btn small" data-act="speak" data-arg="${esc(w.en)}" aria-label="${esc(w.en)} 발음 듣기">🔊</button></li>`).join('');
  return `<main class="view">
    <header class="bar-top"><button class="icon-btn" data-act="go" data-arg="/" aria-label="뒤로">←</button><h1>Lv.${st.level} · ${esc(st.name)}</h1></header>
    <section class="card"><p class="lead">단어 ${st.words.length}개를 익힌 뒤 퀴즈 ${st.words.length * 2}문제를 풀어요. <b>${pct(PASS_RATE)}% 이상</b> 맞히면 클리어!</p>
      ${info.cleared ? `<p class="sub">현재 기록 ${stars(info.stars)} 최고 ${pct(info.best)}%</p>` : ''}</section>
    <ul class="wordlist">${rows}</ul>
    <div class="actions sticky"><button class="btn primary" data-act="open-learn" data-arg="${key}">단어 학습하기</button>
      <button class="btn" data-act="start-stage" data-arg="${key}">바로 퀴즈 풀기</button></div></main>`;
}

const currentLearnWords = () => STAGE_BY_KEY.get(learn.key)?.words || [];

function learnView(key) {
  if (learn.key !== key) learn = { key, i: 0 };
  const st = STAGE_BY_KEY.get(key);
  if (!st || !store.isStageUnlocked(key)) return homeView();
  const w = st.words[learn.i];
  const last = learn.i === st.words.length - 1;
  return `<main class="view focus">
    <header class="quiz-top"><button class="icon-btn" data-act="go" data-arg="/stage/${key}" aria-label="닫기">✕</button>
      <div class="bar"><i style="width:${((learn.i + 1) / st.words.length) * 100}%"></i></div><span class="count">${learn.i + 1}/${st.words.length}</span></header>
    <article class="wordcard">
      <p class="pos">${POS_LABEL[w.pos]}</p>
      <h2 class="en">${esc(w.en)}</h2>
      <button class="btn ghost" data-act="speak" data-arg="${esc(w.en)}">🔊 발음 듣기</button>
      <p class="ko">${esc(w.ko)}</p>
      <div class="example"><p class="ex">${mark(w.ex)}</p><p class="exko">${esc(w.exKo)}</p>
        <button class="btn ghost small" data-act="speak" data-arg="${esc(w.ex.replace(/\*/g, ''))}">🔊 문장 듣기</button></div>
    </article>
    <div class="actions sticky"><button class="btn" data-act="learn-prev" ${learn.i === 0 ? 'disabled' : ''}>이전</button>
      <button class="btn primary" data-act="learn-next">${last ? '퀴즈 시작' : '다음 단어'}</button></div></main>`;
}

// ── 퀴즈 진행 ────────────────────────────────────────────────
const withoutListenIfMuted = (qs) => qs.map((q) => (q.type === 'listen' && !canSpeak() ? makeQuestion('meaning', wordOf(q.wordId)) : q));

function startSession({ mode, key = null, title, questions }) {
  session = {
    mode, key, title, queue: withoutListenIfMuted(questions), idx: 0, retries: {},
    firstTotal: questions.length, firstCorrect: 0, xp: 0, wrong: new Set(), feedback: null, spokenIdx: -1,
  };
  navigate('/play');
}

function playView() {
  const q = session.queue[session.idx];
  const w = wordOf(q.wordId);
  const fb = session.feedback;
  const pos = `<span class="pos">${POS_LABEL[w.pos]}</span>`;
  let prompt = '';
  if (q.type === 'meaning') {
    prompt = `<h2 class="en">${esc(w.en)}</h2>${pos}<button class="icon-btn" data-act="speak" data-arg="${esc(w.en)}" aria-label="발음 듣기">🔊</button>`;
  } else if (q.type === 'listen') {
    prompt = `<button class="speak-big" data-act="speak" data-arg="${esc(w.en)}" aria-label="단어 다시 듣기">🔊</button><p class="hint">들려주는 단어를 고르세요</p>`;
  } else if (q.type === 'cloze') {
    prompt = `<p class="sentence">${esc(blankOut(w.ex))}</p><p class="sub">${esc(w.exKo)}</p>`;
  } else {
    prompt = `<h2 class="ko-big">${esc(w.ko)}</h2>${pos}${q.type === 'spell' ? `<p class="spell-hint" aria-label="힌트">${esc(spellHint(w.en))}</p>` : ''}`;
  }

  let answerArea;
  if (q.type === 'spell') {
    const state = fb ? (fb.ok ? 'ok' : 'bad') : '';
    answerArea = `<form class="spell" data-form="spell"><input class="${state}" name="answer" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
      aria-label="영단어 입력" placeholder="영어로 써 보세요" value="${fb ? esc(fb.given) : ''}" ${fb ? 'readonly' : ''}>
      ${fb ? '' : '<button class="btn primary" type="submit">확인</button>'}</form>
      ${fb ? '' : '<button class="link" data-act="giveup">모르겠어요</button>'}`;
  } else {
    answerArea = `<div class="choices">${q.choices.map((c, i) => {
      let cls = '';
      if (fb) cls = c === q.answer ? 'correct' : c === fb.given ? 'wrong' : 'dim';
      return `<button class="choice ${cls}" data-act="choose" data-arg="${i}" ${fb ? 'disabled' : ''}><span class="key" aria-hidden="true">${i + 1}</span><span>${esc(c)}</span></button>`;
    }).join('')}</div>`;
  }

  const feedback = fb ? `<div class="feedback ${fb.ok ? 'good' : 'bad'}" role="status">
      <div class="fb-head"><span class="fb-icon" aria-hidden="true">${fb.ok ? '✓' : '✕'}</span><strong>${fb.ok ? '정답이에요!' : `아쉬워요 · 정답: ${esc(q.type === 'meaning' ? w.ko : w.en)}`}</strong></div>
      <p class="fb-word"><b>${esc(w.en)}</b> · ${esc(w.ko)}
        <button class="icon-btn small" data-act="speak" data-arg="${esc(w.en)}" aria-label="발음 듣기">🔊</button></p>
      <p class="fb-ex">${mark(w.ex)}<br><span>${esc(w.exKo)}</span></p>
      <button class="btn primary block" data-act="next">${session.idx + 1 >= session.queue.length ? '결과 보기' : '다음'}</button></div>` : '';

  return `<main class="view focus">
    <header class="quiz-top"><button class="icon-btn" data-act="quit" aria-label="그만두기">✕</button>
      <div class="bar"><i style="width:${(session.idx / session.queue.length) * 100}%"></i></div><span class="count">${session.idx + 1}/${session.queue.length}</span></header>
    <section class="question"><p class="qtype">${TYPE_LABEL[q.type]}${q.retry ? ' · 다시 도전' : ''}</p><div class="prompt">${prompt}</div></section>
    ${answerArea}${feedback}</main>`;
}

function submitAnswer(input) {
  if (!session || session.feedback) return;
  const q = session.queue[session.idx];
  const ok = checkAnswer(q, input);
  session.feedback = { ok, given: input };

  if (!q.retry) { // 첫 시도만 점수·복습 일정에 반영
    const rec = store.rec(q.wordId);
    const now = store.now();
    recordStats(rec, ok, now);
    if (session.mode === 'stage' || session.mode === 'boss') scheduleStage(rec, ok, now);
    else schedule(rec, ok, now);
    if (ok) session.firstCorrect += 1; else session.wrong.add(q.wordId);
    const xp = ok ? 10 : 0;
    session.xp += xp;
    store.addActivity({ questions: 1, correct: ok ? 1 : 0, xp });
  }
  if (!ok) { // 틀린 단어는 다른 유형으로 최대 2번까지 다시 묻는다
    const n = session.retries[q.wordId] || 0;
    if (n < 2) {
      session.retries[q.wordId] = n + 1;
      session.queue.push(withoutListenIfMuted([retryQuestion(q)])[0]);
    }
  }
  store.save();
  render();
  if (store.state.settings.sound && q.type !== 'listen') say(wordOf(q.wordId).en);
}

function nextQuestion() {
  if (!session?.feedback) return;
  session.feedback = null;
  session.idx += 1;
  if (session.idx >= session.queue.length) finishSession();
  else render();
}

function finishSession() {
  const s = session;
  const acc = s.firstTotal ? s.firstCorrect / s.firstTotal : 0;
  const pass = acc >= PASS_RATE;
  const starCount = pass ? (acc >= 1 ? 3 : acc >= 0.9 ? 2 : 1) : 0;
  let bonus = 0;
  let firstClear = false;
  let levelUp = null;

  if (s.mode === 'stage') {
    firstClear = pass && !store.stageInfo(s.key).cleared;
    store.setStage(s.key, { pass, stars: starCount, acc });
    if (firstClear) bonus = 50;
  } else if (s.mode === 'boss') {
    firstClear = pass && !store.bossInfo(s.key).cleared;
    store.setBoss(s.key, { pass, acc });
    if (firstClear) {
      bonus = 100;
      levelUp = LEVELS.find((l) => l.id === Number(s.key) + 1) || 'all';
    }
  } else if (s.firstTotal > 0) {
    bonus = 20;
  }
  if (bonus) store.addActivity({ xp: bonus });
  result = { mode: s.mode, key: s.key, title: s.title, acc, pass, stars: starCount, xp: s.xp, bonus, firstClear, levelUp, wrong: [...s.wrong], total: s.firstTotal, correct: s.firstCorrect };
  session = null;
  navigate('/result');
  maybeNotify(store);
}

function resultView() {
  const r = result;
  const isTest = r.mode === 'stage' || r.mode === 'boss';
  let headline;
  if (isTest) headline = r.pass ? (r.mode === 'boss' ? '레벨 테스트 통과!' : '스테이지 클리어!') : '아깝게 놓쳤어요';
  else headline = r.mode === 'review' ? '복습 완료!' : '오답 연습 완료!';

  const st = r.mode === 'stage' ? STAGE_BY_KEY.get(r.key) : null;
  const lv = st ? LEVELS.find((l) => l.id === st.level) : null;
  let primary = '';
  if (r.mode === 'stage') {
    if (!r.pass) primary = `<button class="btn primary" data-act="start-stage" data-arg="${r.key}">다시 도전</button>`;
    else if (lv && st.index + 1 < lv.stages.length) primary = `<button class="btn primary" data-act="go" data-arg="/stage/${lv.stages[st.index + 1].key}">다음 스테이지</button>`;
    else primary = '<button class="btn primary" data-act="go" data-arg="/">레벨 테스트 도전하러 가기</button>';
  } else if (r.mode === 'boss') {
    primary = r.pass ? '<button class="btn primary" data-act="go" data-arg="/">학습 지도로</button>' : `<button class="btn primary" data-act="start-boss" data-arg="${r.key}">다시 도전</button>`;
  } else {
    primary = '<button class="btn primary" data-act="go" data-arg="/">학습 지도로</button>';
  }
  const secondary = r.mode === 'stage' || r.mode === 'boss' ? '<button class="btn" data-act="go" data-arg="/">홈</button>' : (r.wrong.length ? '<button class="btn" data-act="go" data-arg="/notes">오답노트 보기</button>' : '');

  let celebrate = '';
  if (r.levelUp === 'all') celebrate = '<p class="banner">🏆 모든 레벨을 정복했어요!</p>';
  else if (r.levelUp) celebrate = `<p class="banner">${r.levelUp.icon} Lv.${r.levelUp.id} ${esc(r.levelUp.name)} 열림!</p>`;

  const wrongList = r.wrong.length ? `<section class="card"><h3>다시 볼 단어</h3><ul class="wordlist compact">${r.wrong.map((id) => {
    const w = wordOf(id);
    return `<li><span class="w-en">${esc(w.en)}</span><span class="w-ko">${esc(w.ko)}</span><button class="icon-btn small" data-act="speak" data-arg="${esc(w.en)}" aria-label="${esc(w.en)} 발음 듣기">🔊</button></li>`;
  }).join('')}</ul></section>` : '';

  return `<main class="view focus result">
    <section class="hero ${r.pass || !isTest ? 'good' : 'bad'}"><h1>${headline}</h1>
      ${isTest && r.pass ? `<div class="hero-stars">${stars(r.stars)}</div>` : ''}
      <p class="big">${pct(r.acc)}%</p><p class="sub">${r.total}문제 중 ${r.correct}문제를 한 번에 맞혔어요${isTest && !r.pass ? ` · 통과 기준 ${pct(PASS_RATE)}%` : ''}</p></section>
    ${celebrate}
    <section class="card stats3"><div><b>+${r.xp + r.bonus}</b><small>XP${r.bonus ? ` (보너스 ${r.bonus})` : ''}</small></div>
      <div><b>${store.streak()}일</b><small>연속 학습</small></div><div><b>${store.todayCount()}</b><small>오늘 푼 문제</small></div></section>
    ${wrongList}<div class="actions sticky">${secondary}${primary}</div></main>`;
}

// ── 복습 / 오답노트 ──────────────────────────────────────────
function reviewView() {
  const ids = store.dueIds();
  const words = store.state.words;
  const learned = Object.values(words).filter((r) => r.learned);
  let body;
  if (!learned.length) {
    body = `<section class="card empty"><h2>아직 배운 단어가 없어요</h2><p>학습 탭에서 첫 스테이지를 끝내면 복습이 자동으로 쌓여요.</p>
      <button class="btn primary" data-act="go" data-arg="/">학습하러 가기</button></section>`;
  } else if (ids.length) {
    const n = Math.min(20, ids.length);
    body = `<section class="card due"><p class="big">${ids.length}<small>개</small></p><p>지금 복습하면 좋은 단어예요.</p>
      <button class="btn primary block" data-act="start-review">복습 시작 (${n}문제)</button></section>`;
  } else {
    const now = store.now();
    const upcoming = learned.filter((r) => r.due > now);
    const first = Math.min(...upcoming.map((r) => r.due));
    const count = upcoming.filter((r) => startOfDay(r.due) === startOfDay(first)).length;
    const diff = Math.round((startOfDay(first) - startOfDay(now)) / DAY);
    const when = diff <= 1 ? '내일' : diff === 2 ? '모레' : `${diff}일 뒤`;
    body = `<section class="card empty"><h2>오늘 복습은 끝! 🎉</h2><p>다음 복습은 <b>${when}</b>, 단어 ${count}개예요.</p></section>`;
  }
  const mastered = learned.filter(isMastered).length;
  return `<main class="view"><header class="top"><h1>복습</h1></header>${body}
    <p class="note">배운 단어 ${learned.length}개 중 ${mastered}개를 완전히 외웠어요. 맞힐수록 복습 간격이 1일 → 2일 → 4일 → 7일 → 15일 → 30일로 늘어나고, 틀리면 처음부터 다시 돌아와요.</p></main>`;
}

function notesView() {
  const words = store.state.words;
  const ids = store.noteIds().sort((a, b) => words[b].last - words[a].last);
  const rows = ids.map((id) => {
    const w = wordOf(id);
    const r = words[id];
    return `<li><div class="w-main"><span class="w-en">${esc(w.en)}</span><span class="w-ko">${esc(w.ko)}</span>
      <small>틀린 횟수 ${r.wrong} · 연속 정답 ${r.clean}/3</small></div>
      <button class="icon-btn small" data-act="speak" data-arg="${esc(w.en)}" aria-label="${esc(w.en)} 발음 듣기">🔊</button></li>`;
  }).join('');
  const body = ids.length
    ? `<ul class="wordlist notes">${rows}</ul><div class="actions sticky"><button class="btn primary" data-act="start-notes">오답 연습 (최대 10문제)</button></div>`
    : '<section class="card empty"><h2>오답노트가 비어 있어요</h2><p>틀린 단어가 여기에 모이고, 연속 3번 맞히면 자동으로 졸업해요.</p></section>';
  return `<main class="view"><header class="top"><h1>오답노트</h1><span class="chip">${ids.length}개</span></header>${body}</main>`;
}

// ── 내 기록(통계 + 설정) ─────────────────────────────────────
function niceMax(v) {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function lastDays(n) {
  const now = store.now();
  return Array.from({ length: n }, (_, k) => {
    const ts = now - (n - 1 - k) * DAY;
    const d = store.state.days[dateStr(ts)] || { q: 0, c: 0 };
    return { t: dateStr(ts), label: `${new Date(ts).getMonth() + 1}/${new Date(ts).getDate()}`, q: d.q, c: d.c };
  });
}

function dailyChartSvg(days) {
  const W = 340, H = 156, L = 30, R = 6, T = 16, B = 22;
  const max = niceMax(Math.max(...days.map((d) => d.q)));
  const cw = W - L - R, ch = H - T - B, band = cw / days.length, bw = Math.min(16, band - 6);
  const y = (v) => T + ch - (v / max) * ch;
  const base = T + ch;
  const maxIdx = days.reduce((m, d, i) => (d.q > days[m].q ? i : m), 0);
  const labelIdx = new Set([days.length - 1, ...(days[maxIdx].q > 0 ? [maxIdx] : [])]);
  const ticks = [0, max / 2, max].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('');
  const bars = days.map((d, i) => {
    const x = L + i * band + (band - bw) / 2;
    if (d.q === 0) return '';
    const top = y(d.q), r = Math.min(4, base - top);
    return `<path class="bar" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>`;
  }).join('');
  const values = days.map((d, i) => (labelIdx.has(i) && d.q > 0 ? `<text class="val" x="${L + i * band + band / 2}" y="${y(d.q) - 5}" text-anchor="middle">${d.q}</text>` : '')).join('');
  const xl = [0, Math.floor(days.length / 2), days.length - 1].map((i) => `<text class="tick" x="${L + i * band + band / 2}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}">${i === days.length - 1 ? '오늘' : days[i].label}</text>`).join('');
  const hits = days.map((d, i) => `<rect class="hit" data-i="${i}" x="${L + i * band}" y="${T}" width="${band}" height="${ch}" fill="transparent"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 14일 동안 푼 문제 수 막대그래프">${ticks}<line class="axis" x1="${L}" x2="${W - R}" y1="${base}" y2="${base}"/>${bars}${values}${xl}${hits}</svg>`;
}

function meView() {
  const s = store.state;
  const learned = Object.values(s.words).filter((r) => r.learned);
  const seen = Object.values(s.words).reduce((a, r) => a + r.seen, 0);
  const correct = Object.values(s.words).reduce((a, r) => a + r.correct, 0);
  const days = lastDays(14);
  const groups = [
    ['복습 필요', (r) => r.box === 0], ['익히는 중', (r) => r.box >= 1 && r.box <= 2],
    ['기억 중', (r) => r.box >= 3 && r.box <= 4], ['완전 암기', (r) => r.box >= 5],
  ].map(([label, fn]) => ({ label, n: learned.filter(fn).length }));
  const gmax = Math.max(1, ...groups.map((g) => g.n));
  const st = s.settings;

  const table = `<details class="table-view"><summary>표로 보기</summary><table><thead><tr><th>날짜</th><th>푼 문제</th><th>정답</th></tr></thead><tbody>
    ${days.map((d) => `<tr><td>${d.label}</td><td>${d.q}</td><td>${d.c}</td></tr>`).join('')}</tbody></table></details>`;

  return `<main class="view"><header class="top"><h1>내 기록</h1></header>
    <section class="tiles">
      <div class="tile"><small>연속 학습</small><b>${store.streak()}<i>일</i></b><em>최고 ${s.streak.best}일</em></div>
      <div class="tile"><small>누적 XP</small><b>${s.xp}</b></div>
      <div class="tile"><small>배운 단어</small><b>${learned.length}<i>개</i></b></div>
      <div class="tile"><small>정답률</small><b>${seen ? pct(correct / seen) : 0}<i>%</i></b></div></section>
    <section class="card chart"><h2>최근 14일 푼 문제</h2>
      <div class="chart-wrap">${dailyChartSvg(days)}<div class="tip" id="tip" hidden></div></div>${table}</section>
    <section class="card"><h2>기억 단계</h2>${learned.length ? `<ul class="dist">${groups.map((g) => `<li><span>${g.label}</span><div class="track"><i style="width:${(g.n / gmax) * 100}%"></i></div><b>${g.n}</b></li>`).join('')}</ul>` : '<p class="sub">단어를 배우면 여기에 표시돼요.</p>'}</section>
    <section class="card settings"><h2>설정</h2>
      <label class="row"><span>하루 목표</span><select data-setting="goal">${[10, 20, 30, 50].map((n) => `<option value="${n}" ${st.goal === n ? 'selected' : ''}>${n}문제</option>`).join('')}</select></label>
      <label class="row"><span>발음 자동 재생</span><input type="checkbox" class="switch" data-setting="sound" ${st.sound ? 'checked' : ''} ${canSpeak() ? '' : 'disabled'}></label>
      <label class="row"><span>발음 속도</span><select data-setting="rate">${[[0.7, '느리게'], [0.9, '보통'], [1.1, '빠르게']].map(([v, l]) => `<option value="${v}" ${st.rate === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="row"><span>복습 알림</span><input type="checkbox" class="switch" data-setting="notify" ${st.notify && notifyPermission() === 'granted' ? 'checked' : ''} ${notifySupported() ? '' : 'disabled'}></label>
      <label class="row"><span>알림 시각</span><input type="time" data-setting="notifyTime" value="${esc(st.notifyTime)}"></label>
      <p class="note">${notifySupported() ? '알림은 앱이 열려 있거나 백그라운드에서 실행 중일 때 울려요. 홈 화면에 설치하면 더 안정적이에요.' : '이 브라우저는 알림을 지원하지 않아요.'}${notifyPermission() === 'denied' ? ' 브라우저 설정에서 알림이 차단되어 있어요.' : ''}</p>
      <div class="row buttons"><button class="btn" data-act="export">백업 내보내기</button><button class="btn" data-act="import">백업 불러오기</button>
        <input type="file" id="importFile" accept="application/json,.json" hidden></div>
      <button class="btn danger block" data-act="reset">기록 모두 지우기</button></section></main>`;
}

function bindChart() {
  const svg = app.querySelector('.chart-wrap svg');
  const tip = document.getElementById('tip');
  if (!svg || !tip) return;
  const days = lastDays(14);
  const show = (e) => {
    const hit = e.target.closest('.hit');
    if (!hit) { tip.hidden = true; return; }
    const d = days[Number(hit.dataset.i)];
    const box = svg.getBoundingClientRect();
    const r = hit.getBoundingClientRect();
    tip.hidden = false;
    tip.innerHTML = `<b>${d.label}</b> · ${d.q}문제${d.q ? ` · 정답 ${d.c}` : ''}`;
    tip.style.left = `${Math.min(Math.max(r.left - box.left + r.width / 2, 60), box.width - 60)}px`;
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
}

// ── 이벤트 ───────────────────────────────────────────────────
const actions = {
  go: (arg) => navigate(arg),
  speak: (arg) => say(arg),
  locked: () => toast('앞 스테이지를 먼저 클리어하세요.'),
  'locked-boss': () => toast('이 레벨의 스테이지를 모두 클리어하면 열려요.'),
  'open-stage': (arg) => navigate(`/stage/${arg}`),
  'open-learn': (arg) => { learn = { key: arg, i: 0 }; navigate(`/learn/${arg}`); },
  'learn-prev': () => { if (learn.i > 0) { learn.i -= 1; render(); } },
  'learn-next': () => {
    if (learn.i < currentLearnWords().length - 1) { learn.i += 1; render(); } else actions['start-stage'](learn.key);
  },
  'start-stage': (key) => {
    const st = STAGE_BY_KEY.get(key);
    startSession({ mode: 'stage', key, title: `Lv.${st.level} ${st.name}`, questions: stageQuestions(st) });
  },
  'start-boss': (levelId) => startSession({ mode: 'boss', key: String(levelId), title: `Lv.${levelId} 레벨 테스트`, questions: bossQuestions(Number(levelId)) }),
  'start-review': () => {
    const words = store.state.words;
    const ids = store.dueIds().sort((a, b) => words[a].due - words[b].due).slice(0, 20);
    if (ids.length) startSession({ mode: 'review', title: '복습', questions: reviewQuestions(ids, words) });
  },
  'start-notes': () => {
    const words = store.state.words;
    const ids = store.noteIds().slice(0, 10);
    if (ids.length) startSession({ mode: 'notes', title: '오답 연습', questions: reviewQuestions(ids, words) });
  },
  choose: (arg) => { if (session) submitAnswer(session.queue[session.idx].choices[Number(arg)]); },
  giveup: () => submitAnswer(''),
  next: nextQuestion,
  quit: () => {
    const msg = session.mode === 'stage' || session.mode === 'boss'
      ? '지금 그만두면 이번 퀴즈 결과는 저장되지 않아요. 그만둘까요?'
      : '그만둘까요? 지금까지 푼 문제는 기록돼요.';
    if (confirm(msg)) { session = null; navigate('/'); }
  },
  export: () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wordquest-backup-${store.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => document.getElementById('importFile').click(),
  reset: () => {
    if (confirm('학습 기록을 모두 지울까요? 되돌릴 수 없어요.')) { store.reset(); toast('기록을 지웠어요.'); render(); }
  },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  actions[el.dataset.act]?.(el.dataset.arg, el);
});

app.addEventListener('submit', (e) => {
  if (e.target.dataset.form !== 'spell') return;
  e.preventDefault();
  const value = new FormData(e.target).get('answer') || '';
  if (!value.trim()) return;
  submitAnswer(value);
});

app.addEventListener('change', async (e) => {
  if (e.target.id === 'importFile') {
    const file = e.target.files?.[0];
    if (!file) return;
    try { store.importJson(await file.text()); toast('백업을 불러왔어요.'); } catch (err) { toast(err.message || '불러오지 못했어요.'); }
    render();
    return;
  }
  const name = e.target.dataset.setting;
  if (!name) return;
  const el = e.target;
  let value = el.type === 'checkbox' ? el.checked : el.value;
  if (name === 'goal') value = Number(value);
  if (name === 'rate') value = Number(value);
  if (name === 'notify' && value) {
    const ok = await requestNotify();
    if (!ok) { el.checked = false; toast('알림 권한이 필요해요. 브라우저 설정을 확인해 주세요.'); value = false; }
  }
  store.setSetting(name, value);
  if (name === 'notify' || name === 'notifyTime') maybeNotify(store);
});

document.addEventListener('keydown', (e) => {
  if (!session || session.feedback || e.target.matches('input, select, textarea')) {
    if (session?.feedback && e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); nextQuestion(); }
    return;
  }
  const q = session.queue[session.idx];
  if (q.choices && /^[1-4]$/.test(e.key)) submitAnswer(q.choices[Number(e.key) - 1]);
});

window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { maybeNotify(store); renderNav(location.hash.split('/')[1] || ''); } });
setInterval(() => maybeNotify(store), 60000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.wordquest = { store }; // 개발자 도구에서 확인용
render();
maybeNotify(store);
