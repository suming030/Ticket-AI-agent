export type WatchState = 'pending_input' | 'watching' | 'awaiting_approval' | 'reserving' | 'secured' | 'paused' | 'ended';
export type EventKind = 'user' | 'bot' | 'bot_condition' | 'alert' | 'success' | 'notice';
export interface WatchCondition {
  operator: 'KTX' | 'SRT' | 'ANY'; from_station: string; to_station: string; date: string;
  earliest: string; latest: string; adults: number; children: number;
  seat_class: 'general' | 'first' | 'any'; must_have: string[]; preferences: string[];
  deadline: string; missing: string[];
}
export interface SeatOption {
  train_no: string; operator: string; depart_at: string; arrive_at: string;
  car: string; seat: string; features: string[]; price: number;
}
export interface Reservation { reservation_id_last4: string; option: SeatOption; pay_deadline: string }
export interface ChatEvent { id: string; kind: EventKind; text: string; at: string; payload?: Record<string, unknown> | WatchCondition | SeatOption | Reservation | null }
export interface WatchSnapshot { id: string; state: WatchState; condition: WatchCondition | null; search_count: number; events: ChatEvent[] }
export type Page = 'home' | 'agent' | 'demo' | 'compare';
