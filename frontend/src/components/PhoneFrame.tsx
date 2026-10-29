import { useEffect, useRef, useState } from 'react';
import type { ChatEvent, WatchState } from '../lib/types';
import ChatBubble from './ChatBubble';

const STATUS: Record<WatchState, string> = {
  pending_input: '확인 중', watching: '감시중', awaiting_approval: '승인 대기',
  reserving: '예약 중', secured: '확보', paused: '일시정지', ended: '종료',
};
interface Props { events: ChatEvent[]; state: WatchState; onSend?: (text: string) => void;
  onApprove?: () => void; onSkip?: () => void; disabled?: boolean; readonly?: boolean; className?: string }
export default function PhoneFrame({ events, state, onSend, onApprove, onSkip, disabled, readonly, className = '' }: Props) {
  const [text, setText] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const lastId = events.at(-1)?.id;
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }, [lastId]);
  const send = () => { const value = text.trim(); if (!value || !onSend || disabled) return; onSend(value); setText(''); };
  return <section className={`phone-frame ${className}`} aria-label="취소표 에이전트 채팅 화면">
    <div className="phone-header"><div className="phone-title"><span className="mini-mark">✦</span><div><strong>취소표 에이전트</strong><small>나만의 기차표 도우미</small></div></div><span className={`status status--${state}`}><i aria-hidden="true"/>{STATUS[state]}</span></div>
    <div className="phone-thread" ref={threadRef} aria-live="polite" aria-label="대화 내역">
      <div className="thread-date">2026년 10월 29일 목요일</div>
      {events.map((event) => <ChatBubble key={event.id} event={event} actionable={!readonly && state === 'awaiting_approval' && events.filter(x => x.kind === 'alert').at(-1)?.id === event.id} onApprove={onApprove} onSkip={onSkip}/>)}
      {events.length === 0 && <div className="empty-thread"><span>✦</span><strong>지금 출발할 준비가 됐어요.</strong><p>원하는 기차를 편하게 말해 주세요.</p></div>}
    </div>
    <div className="phone-input"><div className="composer"><textarea rows={1} aria-label="채팅 메시지" placeholder={state === 'watching' ? "감시 중이에요. 취소하려면 '그만'이라고 보내세요" : '기차표 요청을 입력해 보세요'} value={text} disabled={disabled || readonly} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}/><button type="button" onClick={send} disabled={!text.trim() || disabled || readonly} aria-label="메시지 전송">↗</button></div><span>데모 화면 · 실제 조회 및 결제 없음</span></div>
  </section>;
}
