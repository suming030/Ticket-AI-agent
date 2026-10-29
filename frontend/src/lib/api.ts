import type { ChatEvent, WatchSnapshot } from './types';

const BASE = import.meta.env.VITE_API_BASE || '/api';
async function request<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  if (!response.ok) throw new Error(`서버 요청 실패 (${response.status})`);
  return response.json() as Promise<T>;
}
export const createWatch = (text: string, scenario = 'normal') => request<WatchSnapshot>('/watches', 'POST', { text, scenario });
export const sendMessage = (id: string, text: string) => request<WatchSnapshot>(`/watches/${id}/messages`, 'POST', { text });
export const approveWatch = (id: string) => request<WatchSnapshot>(`/watches/${id}/approve`, 'POST');
export const skipWatch = (id: string) => request<WatchSnapshot>(`/watches/${id}/skip`, 'POST');
export const cancelWatch = (id: string) => request<WatchSnapshot>(`/watches/${id}/cancel`, 'POST');
export const getWatch = (id: string) => request<WatchSnapshot>(`/watches/${id}`);
export function subscribeEvents(id: string, onEvent: (event: ChatEvent) => void): () => void {
  const source = new EventSource(`${BASE}/watches/${id}/events`);
  source.addEventListener('chat', (event: MessageEvent<string>) => onEvent(JSON.parse(event.data) as ChatEvent));
  return () => source.close();
}
