// 일본어 동사 활용(ます형·て형·ない형·た형). 활용형 퀴즈와 단어 카드의 활용표에 쓴다.
// 동사 종류: 5단(godan) / 1단(ichidan) / する / 来る. る로 끝나고 앞이 い·え단이면 1단이지만, 예외(帰る·入る 등)는 5단.

export const FORMS = {
  masu: { label: 'ます형', desc: '정중하게 (~합니다)' },
  te: { label: 'て형', desc: '연결 (~하고, ~해서)' },
  nai: { label: 'ない형', desc: '부정 (~하지 않는다)' },
  ta: { label: 'た형', desc: '과거 (~했다)' },
};
export const FORM_KEYS = Object.keys(FORMS);

// る로 끝나고 앞이 い·え단인데도 5단인 동사(자주 쓰는 것 위주)
const GODAN_RU = new Set(['帰る', '入る', '走る', '知る', '切る', '要る', '減る', '喋る', '滑る', '蹴る', '参る', '限る', '握る', '照る', '焦る', '散る']);
const I_E_ROW = /[いきしちにひみりぎじびぴえけせてねへめれげぜでべぺ]$/;

const ROW = { // 5단 어미 → [い단, あ단, て형 어미, た형 어미]
  う: ['い', 'わ', 'って', 'った'], つ: ['ち', 'た', 'って', 'った'], る: ['り', 'ら', 'って', 'った'],
  む: ['み', 'ま', 'んで', 'んだ'], ぶ: ['び', 'ば', 'んで', 'んだ'], ぬ: ['に', 'な', 'んで', 'んだ'],
  く: ['き', 'か', 'いて', 'いた'], ぐ: ['ぎ', 'が', 'いで', 'いだ'], す: ['し', 'さ', 'して', 'した'],
};

export function verbClass(w) {
  if (w.pos !== 'v') return null;
  const r = w.reading || w.en;
  if (r === 'くる') return 'kuru';
  if (r.endsWith('する')) return 'suru';
  if (r.endsWith('る') && !GODAN_RU.has(w.en) && I_E_ROW.test(r.slice(0, -1))) return 'ichidan';
  return ROW[r.slice(-1)] ? 'godan' : null;
}

export const CLASS_LABEL = { godan: '5단 동사', ichidan: '1단 동사', suru: 'する 동사', kuru: '불규칙 동사(来る)' };

// 표기(head)와 읽기(read)에 같은 규칙을 적용한다. 반환: { form, reading, rule }
export function conjugate(w, form) {
  const cls = verbClass(w);
  if (!cls) return null;
  const head = w.en;
  const read = w.reading || w.en;
  const both = (fn) => ({ form: fn(head), reading: fn(read) });
  if (cls === 'kuru') {
    const r = { masu: 'きます', te: 'きて', nai: 'こない', ta: 'きた' }[form];
    const f = head === 'くる' ? r : `来${r.slice(1)}`;
    return { form: f, reading: r, rule: `불규칙: 来る → ${f}(${r})` };
  }
  if (cls === 'suru') {
    const end = { masu: 'します', te: 'して', nai: 'しない', ta: 'した' }[form];
    return { ...both((s) => s.slice(0, -2) + end), rule: `する → ${end}` };
  }
  if (cls === 'ichidan') {
    const end = { masu: 'ます', te: 'て', nai: 'ない', ta: 'た' }[form];
    return { ...both((s) => s.slice(0, -1) + end), rule: `る를 떼고 + ${end}` };
  }
  const last = read.slice(-1);
  const [iRow, aRow, teEnd, taEnd] = ROW[last];
  if (w.en === '行く' && (form === 'te' || form === 'ta')) { // 예외: 行いて(X) → 行って
    const end = form === 'te' ? 'って' : 'った';
    return { ...both((s) => s.slice(0, -1) + end), rule: `예외: 行く는 く → ${end}` };
  }
  if (read === 'ある' && form === 'nai') return { form: 'ない', reading: 'ない', rule: '예외: ある의 부정은 ない' };
  const end = { masu: `${iRow}ます`, te: teEnd, nai: `${aRow}ない`, ta: taEnd }[form];
  return { ...both((s) => s.slice(0, -1) + end), rule: `${last} → ${end}` };
}

// 학습자가 자주 틀리는 형태를 오답 보기로 만든다(정답과 겹치지 않는 것만 3개).
// 부족하면 같은 동사의 다른 활용형(맞는 말이지만 묻는 형태가 아님)으로 채운다.
export function wrongForms(w, form) {
  const cls = verbClass(w);
  const right = conjugate(w, form).form;
  const h = w.en;
  const stem = h.slice(0, -1);
  const suffix = { masu: 'ます', te: 'て', nai: 'ない', ta: 'た' }[form];
  const godanRu = { masu: 'ります', te: 'って', nai: 'らない', ta: 'った' }[form];
  let cand = [];
  if (cls === 'godan') {
    const last = h.slice(-1);
    const [iRow, aRow, teEnd, taEnd] = ROW[last];
    if (form === 'masu') cand = [stem + suffix, `${stem + aRow}ます`, `${h}ます`];
    if (form === 'nai') cand = [...(last === 'う' ? [`${stem}あない`] : []), `${stem + iRow}ない`, stem + suffix, `${h}ない`];
    if (form === 'te' || form === 'ta') {
      const ends = form === 'te' ? ['いて', 'って', 'んで', 'して', 'いで'] : ['いた', 'った', 'んだ', 'した', 'いだ'];
      const correctEnd = form === 'te' ? teEnd : taEnd;
      cand = [...(h === '行く' ? [stem + correctEnd] : []), ...ends.filter((e) => e !== correctEnd).slice(0, 2).map((e) => stem + e), `${stem + iRow}${suffix}`, stem + suffix];
    }
    if (h === 'ある' && form === 'nai') cand = ['あらない', 'あるない', 'ありない'];
  } else if (cls === 'ichidan') {
    cand = [stem + godanRu, h + suffix, `${stem}い${suffix}`];
  } else if (cls === 'suru') {
    const base = h.slice(0, -2);
    cand = {
      masu: ['するます', 'さます', 'すます'], nai: ['さない', 'すない', 'せない'],
      te: ['すて', 'しって', 'さて'], ta: ['すた', 'しった', 'さた'],
    }[form].map((e) => base + e);
  } else if (cls === 'kuru') {
    const k = h === 'くる' ? 'く' : '来';
    cand = { masu: ['ります', 'るます', 'らます'], nai: ['らない', 'るない', 'りない'], te: ['って', 'るて', 'いて'], ta: ['った', 'るた', 'いた'] }[form].map((e) => k + e);
  }
  const others = FORM_KEYS.filter((f) => f !== form).map((f) => conjugate(w, f).form);
  const out = [];
  for (const c of [...cand, ...others]) if (c !== right && !out.includes(c)) out.push(c);
  return out.slice(0, 3);
}
