import type { ChatEvent, WatchSnapshot, SeatOption, WatchCondition, WatchState } from './types';
import { exampleCondition, exampleSeat } from '../data/demoScenario';

const KEY = 'ticket-ai-agent-local-watch-v1';
const stamp = (): string => new Date().toISOString();
const makeEvent = (kind: ChatEvent['kind'], text: string, payload?: ChatEvent['payload']): ChatEvent => ({
  id: crypto.randomUUID(), kind, text, at: stamp(), payload,
});

export function loadLocal(): WatchSnapshot | null {
  try { const data = localStorage.getItem(KEY); return data ? JSON.parse(data) as WatchSnapshot : null; }
  catch { return null; }
}
const store = (v: WatchSnapshot): WatchSnapshot => { localStorage.setItem(KEY, JSON.stringify(v)); return { ...v }; };
const withEvent = (w: WatchSnapshot, e: ChatEvent): WatchSnapshot => ({ ...w, events: [...w.events, e] });

export function beginLocal(text: string): WatchSnapshot {
  const route = text.includes('부산') && text.includes('서울');
  const date = /\d{1,2}월\s*\d{1,2}일/.test(text);
  const time = /\d{1,2}시.*\d{1,2}시/.test(text);
  const ready = route && date && time && !text.includes('이번 주말');
  const conditions: WatchCondition = { ...exampleCondition, preferences: text.includes('창가') ? ['창가'] : [] };
  const w: WatchSnapshot = {
    id: crypto.randomUUID(), state: ready ? 'watching' : 'pending_input',
    condition: ready ? conditions : null, search_count: 0,
    events: [makeEvent('user', text),
      ready ? makeEvent('bot_condition', '조건을 확인했어요. 취소표가 나오면 바로 알려드릴게요.', conditions)
        : makeEvent('bot', '출발역·도착역, 정확한 날짜와 시간 범위를 알려주세요. 예: 11월 6일 부산에서 서울 18시~20시')],
  };
  return store(w);
}

export function advanceLocal(w: WatchSnapshot, scenario: 'normal' | 'gone' | 'auth' | 'blocked' | 'aisle' = 'normal'): WatchSnapshot {
  if (w.state !== 'watching') return w;
  const n = w.search_count + 1;
  let next: WatchSnapshot = { ...w, search_count: n };
  if (n < 3) return store(next);
  if (scenario === 'blocked' || scenario === 'auth') {
    next = withEvent({ ...next, state: 'paused' }, makeEvent('bot', scenario === 'auth'
      ? '로그인이 풀렸어요. 다시 로그인해 주시면 바로 이어서 볼게요.'
      : '조회가 막혔어요. 잠시 쉬었다가 직접 확인해 주세요.'));
  } else {
    const seat: SeatOption = scenario === 'aisle' ? { ...exampleSeat, seat: '12B', features: ['통로'] } : exampleSeat;
    next = withEvent({ ...next, state: 'awaiting_approval' }, makeEvent('alert',
      scenario === 'aisle' ? '🚄 취소표가 나왔어요! 창가가 아니라 통로석이에요. 예매할까요?' : '🚄 취소표가 나왔어요! 지금 예매할까요?', seat));
  }
  return store(next);
}
export function localAction(w: WatchSnapshot, action: 'approve' | 'skip' | 'cancel', scenario: string): WatchSnapshot {
  let state: WatchState = w.state;
  let response: ChatEvent;
  if (action === 'cancel') {
    if (state === 'secured' || state === 'ended') return w;
    state = 'ended'; response = makeEvent('bot', '감시를 종료했어요.');
  } else {
    if (state !== 'awaiting_approval') return w;
    if (action === 'skip') {
      state = 'watching'; response = makeEvent('bot', '이 자리는 넘겼어요. 다른 좌석을 계속 지켜볼게요.');
    } else if (scenario === 'gone') {
      state = 'watching'; response = makeEvent('bot', '방금 그 자리는 다른 분이 먼저 가져갔어요. 계속 지켜볼게요.');
    } else {
      state = 'secured'; response = makeEvent('success', '✅ 좌석을 확보했어요. 결제 기한 안에 앱에서 결제하면 끝나요. 감시는 종료했어요.', {
        reservation_id_last4: '4821', option: exampleSeat, pay_deadline: stamp(),
      });
    }
  }
  return store(withEvent({ ...w, state }, response));
}
export function localMessage(w: WatchSnapshot, text: string): WatchSnapshot {
  if (w.state === 'pending_input') return beginLocal(w.events[0]?.text + ' ' + text);
  const user = withEvent(w, makeEvent('user', text));
  if (text.includes('그만') || text.includes('취소')) return localAction(user, 'cancel', 'normal');
  if (w.state === 'awaiting_approval') {
    if (/예매|잡아|승인/.test(text)) return localAction(user, 'approve', 'normal');
    if (/패스|넘겨/.test(text)) return localAction(user, 'skip', 'normal');
  }
  return store(withEvent(user, makeEvent('bot', '감시 중이에요. 중지하려면 “그만”이라고 알려주세요.')));
}
export function clearLocal(): void { localStorage.removeItem(KEY); }
