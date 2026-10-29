import { useEffect, useRef, useState } from 'react';
import PhoneFrame from './components/PhoneFrame';
import { demoScenario } from './data/demoScenario';
import { advanceLocal, beginLocal, clearLocal, loadLocal, localAction, localMessage } from './lib/localMock';
import { approveWatch, cancelWatch, createWatch, getWatch, sendMessage, skipWatch, subscribeEvents } from './lib/api';
import type { ChatEvent, Page, WatchSnapshot, WatchState } from './lib/types';

const PAGES: { id: Page; label: string; index: string }[] = [
  { id: 'home', label: '서비스 소개', index: '01' }, { id: 'agent', label: 'AI 에이전트', index: '02' },
  { id: 'demo', label: '데모 체험', index: '03' }, { id: 'compare', label: '버전 비교', index: '04' },
];
const VALID = new Set<Page>(PAGES.map((p) => p.id));
const pageFromHash = (): Page => { const hash = window.location.hash.slice(1) as Page; return VALID.has(hash) ? hash : 'home'; };
const demoCopy = '11월 6일 금요일 저녁에 부산에서 서울 가는 KTX 잡아줘. 6시~8시 사이, 1명. 창가면 좋고.';

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [dark, setDark] = useState(() => localStorage.getItem('ticket-theme') === 'dark');
  const [demoEvents, setDemoEvents] = useState<ChatEvent[]>(demoScenario);
  const [playing, setPlaying] = useState(false);
  const [snapshot, setSnapshot] = useState<WatchSnapshot | null>(loadLocal);
  const [mode, setMode] = useState<'offline' | 'server'>('offline');
  const [scenario, setScenario] = useState<'normal' | 'gone' | 'auth' | 'blocked' | 'aisle'>('normal');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const timers = useRef<number[]>([]);
  const [demoSelection, setDemoSelection] = useState<'approve' | 'skip' | null>(null);

  useEffect(() => { const listener = () => setPage(pageFromHash()); window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('ticket-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => {
    if (mode !== 'server' || !snapshot?.id) return;
    const unsubscribe = subscribeEvents(snapshot.id, () => { getWatch(snapshot.id).then(setSnapshot).catch(() => setHint('실시간 서버 연결을 확인해 주세요.')); });
    return unsubscribe;
  }, [mode, snapshot?.id]);
  useEffect(() => {
    if (mode !== 'offline' || snapshot?.state !== 'watching') return;
    const timer = window.setInterval(() => setSnapshot((prev) => prev ? advanceLocal(prev, scenario) : null), 5000);
    return () => window.clearInterval(timer);
  }, [mode, snapshot?.state, snapshot?.id, scenario]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const navigate = (next: Page) => {
    window.location.hash = next;
    setPage(next);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const playDemo = () => {
    timers.current.forEach(window.clearTimeout); timers.current = [];
    setDemoSelection(null);
    setPlaying(true);
    setDemoEvents([]);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDemoEvents(demoScenario); setPlaying(false); return;
    }
    demoScenario.forEach((event, index) => {
      const timer = window.setTimeout(() => { setDemoEvents((old) => [...old, event]); if (index === demoScenario.length - 1) setPlaying(false); }, (index + 1) * 1200);
      timers.current.push(timer);
    });
  };
  const send = async (text: string) => {
    setBusy(true); setHint('');
    try {
      if (mode === 'server') {
        const next = snapshot ? await sendMessage(snapshot.id, text) : await createWatch(text, scenario);
        setSnapshot(next);
      } else { setSnapshot(snapshot ? localMessage(snapshot, text) : beginLocal(text)); }
    } catch { setHint('백엔드와 연결하지 못했어요. 오프라인 Mock으로 전환해 주세요.'); }
    finally { setBusy(false); }
  };
  const act = async (action: 'approve' | 'skip' | 'cancel') => {
    if (!snapshot || busy) return;
    setBusy(true);
    try {
      if (mode === 'server') {
        const fn = action === 'approve' ? approveWatch : action === 'skip' ? skipWatch : cancelWatch;
        setSnapshot(await fn(snapshot.id));
      } else { setSnapshot(localAction(snapshot, action, scenario)); }
    } catch { setHint('처리되지 않았어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  const reset = () => { clearLocal(); setSnapshot(null); setHint('새로운 감시를 시작할 수 있어요.'); };
  const nextScenario = (value: typeof scenario) => { setScenario(value); reset(); };
  const currentState: WatchState = snapshot?.state || 'pending_input';
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={() => navigate('home')} aria-label="홈으로"><span className="brand-icon">✳</span><span>rail<span className="brand-italic">sense</span><small>AI TICKET AGENT</small></span></button>
      <nav className={`site-nav ${navOpen ? 'site-nav--open' : ''}`} aria-label="주 메뉴">
        {PAGES.map((nav) => <button key={nav.id} className={page === nav.id ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => navigate(nav.id)} aria-current={page === nav.id ? 'page' : undefined}>{nav.label}</button>)}
      </nav>
      <div className="header-actions"><span className="version-pill">프로젝트 / 두 번째 버전</span><button className="theme-toggle" onClick={() => setDark(!dark)} title="테마 전환" aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}>{dark ? '☀' : '☾'}</button><button className="mobile-menu" aria-label="메뉴 열기" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>☰</button></div>
    </div></header>

    <main key={page} className="view-enter">
      {page === 'home' && <div className="home-view"><div className="home-grid">
        <div className="home-copy"><div className="eyebrow"><span className="live-dot"/>매진에서 가능성으로 <span className="eyebrow-line"/></div>
          <h1>매진된 열차,<br/><span>기다림은</span><br/>AI에게 맡기세요<span className="headline-star">✳</span></h1>
          <p className="hero-sub">새로고침하는 시간은 줄이고, 놓치지 않는 기회는 늘리고. 내가 원하는 조건을 말하면 취소표를 지켜보는 AI 에이전트.</p>
          <div className="hero-ctas"><button className="btn-primary" onClick={() => navigate('agent')}>에이전트 시작하기 <span>↗</span></button><button className="btn-outline" onClick={() => navigate('demo')}>시연 먼저 보기 <span>▶</span></button></div>
          <div className="hero-stats"><div><strong>01</strong><span>자연어로 조건 설정</span></div><i/><div><strong>05<span>초</span></strong><span>Mock 탐색 주기</span></div><i/><div><strong>100<span>%</span></strong><span>사용자 승인 후 예약</span></div></div>
        </div>
        <div className="home-art"><div className="route-watermark">부산 <span>—</span> 서울</div><div className="art-ring art-ring-outer"/><div className="art-ring art-ring-inner"/><div className="train-illustration"><span className="train-emoji">↗</span><div className="glass-window"><div className="route-card-top"><span className="route-card-tag">취소표 감시 중</span><span className="route-card-signal">●</span></div><div className="route-card-stations"><span>BUSAN<strong>부산</strong></span><span className="route-arrow">────✦────</span><span>SEOUL<strong>서울</strong></span></div><div className="route-card-bottom"><span>좌석을 찾고 있어요</span><span>•••</span></div></div></div><div className="floating-note"><span>✦</span><div><strong>기회는 다시 옵니다.</strong><small>우리가 먼저 발견할게요.</small></div></div></div>
      </div><div className="home-bottom"><span>기다림을 바꾸는 새로운 취소표 서비스</span><span>보이지 않는 빈자리를, 가장 먼저.</span><button onClick={() => navigate('compare')}>프로젝트 비교 보기 ↗</button></div></div>}

      {page === 'agent' && <div className="workspace-view"><div className="workspace-side"><span className="section-index">02 / 개인 맞춤 에이전트</span><h2>한 번 말하면,<br/><em>계속 지켜보는 AI.</em></h2><p>원하는 구간과 시간을 채팅으로 알려주세요. 이 페이지에서는 가상 데이터로 취소표 탐색을 체험합니다.</p><div className="setting-panel"><div className="setting-title">탐색 시나리오 <span>가상 데이터 전용</span></div><label className="field-label" htmlFor="scenario">시나리오 선택</label><select id="scenario" value={scenario} onChange={(e) => nextScenario(e.target.value as typeof scenario)}><option value="normal">정상 발견 → 예약 성공</option><option value="gone">승인할 때 좌석 소멸</option><option value="aisle">선호한 창가 대신 통로석</option><option value="auth">로그인 만료</option><option value="blocked">보안문자 · 조회 차단</option></select><div className="mode-row"><span>연결 모드</span><div className="mode-switch"><button className={mode === 'offline' ? 'active' : ''} onClick={() => { setMode('offline'); setSnapshot(loadLocal()); }}>브라우저 Mock</button><button className={mode === 'server' ? 'active' : ''} onClick={() => { setMode('server'); setSnapshot(null); }}>로컬 API</button></div></div><button className="sample-button" onClick={() => send(demoCopy)} disabled={busy || Boolean(snapshot && snapshot.state !== 'ended' && snapshot.state !== 'secured')}>↗ 예시 요청 바로 보내기</button>{snapshot && <button className="reset-button" onClick={reset}>↺ 채팅 초기화</button>}{snapshot?.state === 'watching' && <button className="reset-button" onClick={() => act('cancel')}>감시 종료</button>}</div>
      <div className="workspace-note"><span className="note-icon">ⓘ</span><p>현재는 실제 KTX·SRT 서버를 조회하지 않습니다. 예약·결제도 이루어지지 않는 시연용 서비스예요.</p></div>{hint && <p role="status" className="inline-hint">{hint}</p>}</div><div className="workspace-preview"><div className="preview-title"><span>에이전트 화면</span><span className="preview-status"><i/> 실시간 체험</span></div><PhoneFrame events={snapshot?.events || []} state={currentState} onSend={send} onApprove={() => act('approve')} onSkip={() => act('skip')} disabled={busy}/><span className="preview-caption">채팅 데이터는 브라우저에 저장되어 새로고침 후에도 남아요. 실제 API 모드에서는 SQLite에 저장됩니다.</span></div></div>}

      {page === 'demo' && <div className="demo-view"><div className="demo-left"><span className="section-index">03 / 작동 시연</span><h2>취소표 한 장의<br/><em>모든 순간을.</em></h2><p>조건 요청부터 감시, 좌석 발견과 승인, 예약 완료까지. 7개 메시지가 실제 채팅처럼 차례로 재생됩니다.</p><div className="demo-controls"><button className="btn-primary" disabled={playing} onClick={playDemo}>{playing ? '재생 중…' : '▶ 데모 다시 재생'} <span>↗</span></button><div className="demo-progress"><div className="demo-progress-track"><div style={{ width: `${demoEvents.length / demoScenario.length * 100}%` }}/></div><span>{demoEvents.length.toString().padStart(2, '0')} / 07 메시지</span></div></div><div className="step-list"><div><b>01</b><span>조건을 알아듣고<small>선호와 필수를 구분해요</small></span></div><div><b>02</b><span>빈자리를 기다리고<small>실제 연동 없이 Mock으로 시연해요</small></span></div><div><b>03</b><span>승인받아 좌석 확보<small>결제는 사용자에게 남겨요</small></span></div></div></div><div className="demo-right"><div className="preview-title"><span>대화 기록 / 7단계</span><span>2026. 10 → 11</span></div><PhoneFrame events={demoEvents} state={demoEvents.some(x => x.kind === 'success') ? 'secured' : demoEvents.some(x => x.kind === 'alert') ? 'awaiting_approval' : demoEvents.length === 0 ? 'pending_input' : 'watching'} readonly className="demo-phone"/>{!playing && demoEvents.length === 7 && <div className="demo-action"><span>데모 선택 시뮬레이션</span><button className={demoSelection === 'approve' ? 'active' : ''} onClick={() => setDemoSelection('approve')}>예매 선택</button><button className={demoSelection === 'skip' ? 'active' : ''} onClick={() => setDemoSelection('skip')}>패스 선택</button>{demoSelection && <small>{demoSelection === 'approve' ? '✓ 승인 완료 흐름 — 실제 예약 없음' : '✓ 패스 선택 — 감시 지속 흐름'}</small>}</div>}</div></div>}

      {page === 'compare' && <div className="compare-view"><div className="compare-heading"><div><span className="section-index">04 / 버전별 변화</span><h2>한 단계 더 나아간<br/><em>취소표 에이전트.</em></h2></div><p>첫 번째 프로젝트는 가능성을 소개했어요. 두 번째 프로젝트는 사용자가 그 가능성을 직접 경험하게 만듭니다.</p></div><div className="comparison-board"><div className="comparison-head"><div>비교 항목</div><div>01. RAILCATCH <span>이전 버전</span></div><div>02. RAILSENSE <span>이번 버전</span></div></div>{[
        ['핵심 경험', '서비스 소개 중심 랜딩 페이지', '대화형 채팅 에이전트'],
        ['페이지 구성', '섹션을 스크롤해 이동', '버튼으로 화면 전환'],
        ['취소표 탐색', '단순 시연 애니메이션', '상태 머신 + MockRailClient'],
        ['사용자 상호작용', '조건 입력 데모', '채팅·예매 승인·패스'],
        ['대화 데이터', '브라우저 시연 중심', '로컬 저장 + SQLite 백엔드'],
        ['실시간 기능', '화면 내 시뮬레이션', 'FastAPI + SSE (로컬 모드)'],
        ['예외 대응', '간단한 안내', '좌석 소멸·로그인·차단 대응'],
        ['실제 결제', '지원 안 함', '지원 안 함 — 사용자 직접 결제'],
      ].map(([label, old, next]) => <div className="comparison-row" key={label}><strong>{label}</strong><span>{old}</span><span><i>✦</i>{next}</span></div>)}</div><div className="compare-actions"><a className="btn-outline" href="https://suming030.github.io/Rail-Catch/" target="_blank" rel="noreferrer">이전 버전 보러 가기 ↗</a><button className="btn-primary" onClick={() => navigate('agent')}>이번 버전 체험하기 <span>↗</span></button></div></div>}
    </main>
    <footer className="site-footer"><span>✳ rail<span> sense</span></span><p>AI 에이전트 창업 과제 · 2026</p><span>취소표의 순간을 놓치지 않도록.</span></footer>
  </div>;
}
