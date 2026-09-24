export interface User { id: string; name: string; username: string; publicKey: string }
export interface Keys { publicKey: Uint8Array; privateKey: Uint8Array }
export interface Envelope { id: string; sender: string; recipient: string; nonce: string; ciphertext: string; createdAt: number; expiresAt: number | null }
export interface Body { type: 'text' | 'image' | 'file' | 'voice'; text: string; data?: string; name?: string; size?: number; reply?: { name: string; text: string } }
export interface Message extends Body { id: string; chatId: string; mine: boolean; time: string; timestamp: number; status?: 'local' | 'sent'; expiresAt?: number | null }
export interface Contact { id: string; name: string; username: string; publicKey?: string; avatar?: string; color: string; group?: boolean; members?: string[]; unread: number; pinned?: boolean; preview: string; time: string; muted?: boolean; timer?: number; archived?: boolean; blocked?: boolean; verified?: boolean }
export interface Settings { lowData: boolean; autoLock: boolean; hidePreviews: boolean; compact: boolean; notifications: boolean; sound: boolean; sendOnEnter: boolean; defaultTimer: number }
export type Page = 'messages' | 'contacts' | 'saved' | 'toolkit' | 'security' | 'data' | 'settings'
export const DEFAULT_SETTINGS: Settings = { lowData: true, autoLock: true, hidePreviews: false, compact: false, notifications: false, sound: false, sendOnEnter: true, defaultTimer: 0 }
