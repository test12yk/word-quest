// 간격 반복(라이트너 방식) — 망각곡선에 맞춰 복습 시점을 잡는다.
// box 0 = 지금 복습, 1~6 = 맞힐수록 간격이 길어짐. 틀리면 box 0으로 돌아간다.

export const INTERVALS = [0, 1, 2, 4, 7, 15, 30]; // box별 복습 간격(일)
export const MAX_BOX = INTERVALS.length - 1;
export const MASTERED_BOX = 5;

export const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// box 1 이상은 "그 날 0시"에 복습 대기로 들어간다(아침에 열면 그날 분량이 바로 보이도록).
export function nextDue(box, now) {
  if (box <= 0) return now;
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() + INTERVALS[box]);
  return d.getTime();
}

export const newRecord = () => ({
  learned: false, box: 0, due: 0, seen: 0, correct: 0, wrong: 0, clean: 0, note: false, last: 0,
});

// 정답/오답 통계와 오답노트 상태 갱신. 오답노트는 연속 3번 맞히면 졸업한다.
export function recordStats(rec, ok, now) {
  rec.seen += 1;
  rec.last = now;
  if (ok) {
    rec.correct += 1;
    rec.clean += 1;
    if (rec.clean >= 3) rec.note = false;
  } else {
    rec.wrong += 1;
    rec.clean = 0;
    rec.note = true;
  }
}

export function setBox(rec, box, now) {
  rec.learned = true;
  rec.box = Math.max(0, Math.min(MAX_BOX, box));
  rec.due = nextDue(rec.box, now);
}

// 복습/오답 세션: 맞히면 한 단계 위로, 틀리면 처음으로.
export function schedule(rec, ok, now) {
  setBox(rec, ok ? rec.box + 1 : 0, now);
}

// 스테이지/보스 세션: 처음 만난 단어는 box 1(맞힘) 또는 0(틀림)으로 시작하고,
// 이미 배운 단어는 틀렸을 때만 box 0으로 되돌린다(다시 풀었다고 간격이 늘어나지 않게).
export function scheduleStage(rec, ok, now) {
  if (!rec.learned) setBox(rec, ok ? 1 : 0, now);
  else if (!ok) setBox(rec, 0, now);
}

export const isDue = (rec, now) => Boolean(rec && rec.learned && rec.due <= now);
export const isMastered = (rec) => Boolean(rec && rec.learned && rec.box >= MASTERED_BOX);
