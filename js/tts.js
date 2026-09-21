// 발음 재생: 브라우저 내장 음성 합성(Web Speech API). 별도 서버·키가 필요 없다.
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  voice = voices.find((v) => v.lang === 'en-US' && /Samantha|Google US|Nicky|Aaron|Ava/i.test(v.name))
    || voices.find((v) => v.lang === 'en-US')
    || voices.find((v) => v.lang.startsWith('en'))
    || null;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export const canSpeak = () => Boolean(synth);

export function speak(text, rate = 0.9) {
  if (!synth || !text) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  if (voice) u.voice = voice;
  synth.speak(u);
  return true;
}
