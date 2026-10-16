// 로마자 → 히라가나 변환(일본어 IME 없이 입력하려고). DOM에 의존하지 않아 node에서 바로 테스트할 수 있다.
// 헵번식(shi·chi·tsu·fu·ji)과 훈령식(si·ti·tu·hu·zi)을 모두 받는다.
//  - 같은 자음 두 번(kk, tt, ss, tch …) → っ
//  - n: 뒤에 모음/y가 오면 な행, 그 외(자음·끝·')는 ん. nn은 ん 하나(onna → おんな, honn → ほん)
//  - '-' → ー(장음)
const TABLE = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ', za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ', ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
  wa: 'わ', wo: 'を', we: 'うぇ', wi: 'うぃ', va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', je: 'じぇ', che: 'ちぇ', she: 'しぇ', tsa: 'つぁ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xtsu: 'っ', xtu: 'っ', ltu: 'っ', ltsu: 'っ',
};
// 요음(きゃ 등): 자음+ya/yu/yo
const YOON = { ky: 'き', gy: 'ぎ', sy: 'し', sh: 'し', zy: 'じ', jy: 'じ', j: 'じ', ty: 'ち', cy: 'ち', ch: 'ち', dy: 'ぢ', ny: 'に', hy: 'ひ', by: 'び', py: 'ぴ', my: 'み', ry: 'り' };
const SMALL = { a: 'ゃ', u: 'ゅ', o: 'ょ' };
for (const [c, k] of Object.entries(YOON)) for (const [v, s] of Object.entries(SMALL)) {
  if (!TABLE[c + v]) TABLE[c + v] = k + s;
  if (c === 'j' || c === 'ch' || c === 'sh') TABLE[c + v] = k + s; // ja·cha·sha
}
const VOWEL = /[aiueo]/;
const MAX = 4;

export function toHiragana(input) {
  const s = String(input).toLowerCase();
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const next = s[i + 1];
    if (c === 'n') {
      if (next && (VOWEL.test(next) || next === 'y')) { /* な행/にゃ 등 — 아래 표에서 처리 */ }
      else if (next === 'n') { out += 'ん'; i += (s[i + 2] && (VOWEL.test(s[i + 2]) || s[i + 2] === 'y')) ? 1 : 2; continue; }
      else { out += 'ん'; i += next === "'" ? 2 : 1; continue; }
    }
    // 촉음: 같은 자음 반복(n 제외) 또는 tch
    if (/[bcdfghjklmpqrstvwxyz]/.test(c) && (next === c || (c === 't' && next === 'c'))) { out += 'っ'; i += 1; continue; }
    if (c === '-') { out += 'ー'; i += 1; continue; }
    let hit = false;
    for (let len = MAX; len >= 1; len -= 1) {
      const kana = TABLE[s.slice(i, i + len)];
      if (kana) { out += kana; i += len; hit = true; break; }
    }
    if (!hit) { out += c; i += 1; }
  }
  return out;
}

// 가타카나 → 히라가나(채점할 때 둘을 같은 것으로 본다)
export const kataToHira = (s) => String(s).replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
export const isRomaji = (s) => /^[a-z' -]+$/i.test(String(s).trim()) && /[a-z]/i.test(s);
// 입력값을 히라가나로 정규화: 로마자면 변환, 가타카나면 히라가나로, 공백 제거
export function normalizeKana(input) {
  const t = String(input).trim().replace(/\s+/g, '');
  return kataToHira(isRomaji(t) ? toHiragana(t) : t);
}
