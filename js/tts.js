// 발음 재생: 브라우저 내장 음성 합성(Web Speech API). 별도 서버·키가 필요 없다.
// 언어별로 다른 목소리를 써야 해서(영어/일본어), lang 코드별로 골라놓은 voice를 캐시해둔다.
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
const voiceCache = new Map(); // lang 코드 → SpeechSynthesisVoice

function pickVoices() {
  if (!synth) return;
  const voices = synth.getVoices();
  voiceCache.set('en-US',
    voices.find((v) => v.lang === 'en-US' && /Samantha|Google US|Nicky|Aaron|Ava/i.test(v.name))
    || voices.find((v) => v.lang === 'en-US')
    || voices.find((v) => v.lang.startsWith('en'))
    || null);
  voiceCache.set('ja-JP',
    voices.find((v) => v.lang === 'ja-JP' && /Kyoko|Google 日本語|Otoya/i.test(v.name))
    || voices.find((v) => v.lang === 'ja-JP')
    || voices.find((v) => v.lang.startsWith('ja'))
    || null);
}
if (synth) {
  pickVoices();
  synth.addEventListener?.('voiceschanged', pickVoices);
}

export const canSpeak = () => Boolean(synth);

export function speak(text, rate = 0.9, lang = 'en-US') {
  if (!synth || !text) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voice = voiceCache.get(lang);
  if (voice) u.voice = voice;
  synth.speak(u);
  return true;
}
