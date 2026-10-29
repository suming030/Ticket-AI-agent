import type { ChatEvent, WatchCondition, SeatOption } from '../lib/types';

const condition: WatchCondition = {
  operator: 'KTX', from_station: '부산', to_station: '서울', date: '2026-11-06',
  earliest: '18:00', latest: '20:00', adults: 1, children: 0, seat_class: 'general',
  must_have: ['일반실', '1명'], preferences: ['창가'], deadline: '2026-11-06T17:00:00+09:00', missing: [],
};
export const exampleCondition = condition;
export const exampleSeat: SeatOption = {
  train_no: 'KTX 121', operator: 'KTX', depart_at: '2026-11-06T19:00:00+09:00',
  arrive_at: '2026-11-06T21:41:00+09:00', car: '7', seat: '12A', features: ['창가'], price: 59800,
};
export const demoScenario: ChatEvent[] = [
  { id: 'demo-1', kind: 'user', text: '11월 6일 금요일 저녁에 부산에서 서울 가는 KTX 잡아줘. 6시~8시 사이, 1명. 창가면 좋고.', at: '2026-10-29T21:29:00+09:00' },
  { id: 'demo-2', kind: 'bot_condition', text: '지금은 전부 매진이에요. 이 조건으로 감시를 시작할게요. 창가는 선호 조건으로 두고, 창가가 없으면 통로석도 알려드릴게요.', at: '2026-10-29T21:30:00+09:00', payload: condition },
  { id: 'demo-3', kind: 'notice', text: '· · · 6일 뒤', at: '2026-11-05T08:59:00+09:00' },
  { id: 'demo-4', kind: 'bot', text: '아직 자리가 없어요. 출발 하루 전부터 확인 주기를 2분으로 줄일게요.', at: '2026-11-05T09:00:00+09:00' },
  { id: 'demo-5', kind: 'alert', text: '🚄 취소표가 나왔어요! 지금 예매할까요?', at: '2026-11-05T17:41:00+09:00', payload: exampleSeat },
  { id: 'demo-6', kind: 'user', text: '예매', at: '2026-11-05T17:42:00+09:00' },
  { id: 'demo-7', kind: 'success', text: '✅ 좌석을 확보했어요. 결제 기한 안에 앱에서 결제하면 끝나요. 감시는 종료했어요.', at: '2026-11-05T17:42:00+09:00', payload: { reservation_id_last4: '4821', option: exampleSeat, pay_deadline: '2026-11-05T17:57:00+09:00' } },
];
