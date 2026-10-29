import type { ChatEvent, SeatOption, WatchCondition, Reservation } from '../lib/types';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}
const formatTime = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));

export interface BubbleProps { event: ChatEvent; actionable?: boolean; selected?: 'approve' | 'skip' | null; onApprove?: () => void; onSkip?: () => void }
export default function ChatBubble({ event, actionable = false, selected = null, onApprove, onSkip }: BubbleProps) {
  if (event.kind === 'notice') return <div className="system-notice"><span>{event.text}</span><time>{timeLabel(event.at)}</time></div>;
  const cond = event.kind === 'bot_condition' ? (event.payload as unknown as WatchCondition | undefined) : undefined;
  const seat = event.kind === 'alert' ? (event.payload as unknown as SeatOption | undefined) : undefined;
  const reserved = event.kind === 'success' ? (event.payload as unknown as Reservation | undefined) : undefined;
  return <div className={`chat-line chat-line--${event.kind}`}>
    {event.kind !== 'user' && <span className="bot-avatar" aria-hidden="true">✦</span>}
    <div className="chat-message-col">
      <div className={`chat-bubble chat-bubble--${event.kind}`}>
        <p>{event.text}</p>
        {cond && <div className="condition-box">
          <div className="condition-head">설정된 감시 조건 <span>조건 확인</span></div>
          <div className="condition-route">{cond.from_station} <span>→</span> {cond.to_station}</div>
          <div className="condition-row"><span>날짜</span><strong>{cond.date}</strong></div>
          <div className="condition-row"><span>시간</span><strong>{cond.earliest.substring(0,5)} – {cond.latest.substring(0,5)}</strong></div>
          <div className="condition-row"><span>필수</span><strong>일반실 · {cond.adults}명</strong></div>
          <div className="condition-row"><span>선호</span><strong>{cond.preferences.join(', ') || '없음'}</strong></div>
          <div className="condition-foot">감시 종료 · {cond.date.slice(5)} {cond.deadline.includes('T') ? formatTime(cond.deadline) : '17:00'}</div>
        </div>}
        {seat && <div className="ticket-result">
          <div className="ticket-result-head"><span className="ticket-icon">↗</span><strong>{seat.train_no}</strong><span className="ticket-found">취소 좌석 발견</span></div>
          <div className="ticket-stations"><div><strong>{formatTime(seat.depart_at)}</strong><span>부산</span></div><div className="ticket-line"><span>고속철도</span><i/></div><div><strong>{formatTime(seat.arrive_at)}</strong><span>서울</span></div></div>
          <div className="ticket-facts"><span>일반실</span><span>{seat.car}호차 {seat.seat}</span><span>{seat.features.join(' · ')}</span></div>
          <div className="ticket-price"><span>예상 운임</span><strong>{seat.price.toLocaleString('ko-KR')}원</strong></div>
          <div className="ticket-buttons"><button type="button" className={selected === 'approve' ? 'selected' : ''} disabled={!actionable || selected !== null} onClick={onApprove}>{selected === 'approve' ? '✓ 승인 완료' : '예매 승인'}</button><button type="button" className={selected === 'skip' ? 'selected' : ''} disabled={!actionable || selected !== null} onClick={onSkip}>{selected === 'skip' ? '✓ 패스 완료' : '이번엔 패스'}</button></div>
        </div>}
        {reserved && <div className="success-receipt"><span>예약번호 끝 4자리</span><strong>···· {reserved.reservation_id_last4}</strong><small>결제는 사용자 본인이 직접 진행해 주세요.</small></div>}
      </div>
      <time className="chat-time">{timeLabel(event.at)}</time>
    </div>
  </div>;
}
