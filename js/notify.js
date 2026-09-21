// 복습 알림. 웹앱의 한계상 "앱이 열려 있거나 백그라운드에서 살아 있을 때"만 동작한다.
// (앱이 완전히 꺼진 상태에서 정해진 시각에 울리려면 푸시 서버가 필요하다.)

export const notifySupported = () => 'Notification' in window;
export const notifyPermission = () => (notifySupported() ? Notification.permission : 'unsupported');

export async function requestNotify() {
  if (!notifySupported()) return false;
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  return p === 'granted';
}

const minutesOf = (hhmm) => {
  const [h, m] = (hhmm || '20:00').split(':').map(Number);
  return h * 60 + m;
};

// 조건: 알림 켜짐 + 권한 허용 + 설정 시각 이후 + 복습할 단어 있음 + 오늘 아직 안 보냄
export async function maybeNotify(store) {
  const { settings } = store.state;
  if (!settings.notify || notifyPermission() !== 'granted') return false;
  const due = store.dueIds().length;
  if (due === 0 || store.state.lastNotified === store.today()) return false;
  const d = new Date(store.now());
  if (d.getHours() * 60 + d.getMinutes() < minutesOf(settings.notifyTime)) return false;

  const title = `복습할 단어 ${due}개`;
  const options = { body: '잊어버리기 전에 3분만 복습해 볼까요?', icon: 'icons/icon-192.png', tag: 'wordquest-review' };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    return false;
  }
  store.state.lastNotified = store.today();
  store.save();
  return true;
}

export function setBadge(count) {
  try {
    if (count > 0) navigator.setAppBadge?.(count);
    else navigator.clearAppBadge?.();
  } catch { /* 지원하지 않는 환경 */ }
}
