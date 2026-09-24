import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { demoContacts, demoMessages } from './demo'
import { api, post, clock, readPreference, savePreference } from './api'
import { encryptMessage, decryptMessage, destroyKeys } from './crypto.mjs'
import { DEFAULT_SETTINGS, type Settings, type User, type Keys, type Contact, type Message, type Body, type Envelope, type Page } from './types'

type ModalState = { type: string; [key: string]: any } | null
interface Store {
  user: User | null; demo: boolean; locked: boolean; online: boolean; connected: boolean;
  contacts: Contact[]; messages: Message[]; selected: string | null; setSelected: (id: string | null) => void;
  page: Page; setPage: (page: Page) => void; settings: Settings; setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  modal: ModalState; setModal: (value: ModalState) => void; toast: string; notify: (text: string) => void;
  authenticate: (user: User, keys: Keys) => void; logout: (all?: boolean) => Promise<void>; lock: () => void; resumeDemo: () => void;
  send: (body: Body) => Promise<void>; addContact: (user: User | Contact) => void; updateContact: (id: string, data: Partial<Contact>) => void;
  saved: string[]; toggleSaved: (id: string) => void; removeMessage: (message: Message) => Promise<void>;
  blockContact: (contact: Contact) => Promise<void>; verifyContact: (contact: Contact) => void;
  usage: { sent: number; received: number; saved: number; count: number }; addSavings: (bytes: number) => void;
  sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void;
}
const Context = createContext<Store | null>(null)
export const useCipher = () => useContext(Context)!
const fromUser = (u: User): Contact => ({ ...u, unread: 0, color: ['sage', 'peach', 'lavender', 'blue'][u.name.length % 4], preview: 'Say hello. Make a little connection.', time: '' })

export function CipherProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [keys, setKeys] = useState<Keys | null>(null)
  const [locked, setLocked] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [connected, setConnected] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>(demoContacts.map(c => ({ ...c })))
  const [messages, setMessages] = useState<Message[]>(demoMessages.map(m => ({ ...m })))
  const [selected, select] = useState<string | null>(window.innerWidth < 761 ? null : 'sofia')
  const selectedRef = useRef(selected); selectedRef.current = selected
  const userRef = useRef(user); userRef.current = user
  const [page, changePage] = useState<Page>('messages')
  const [settings, updateSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...readPreference('cipher-preferences', {}) }))
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState('')
  const [saved, setSaved] = useState<string[]>(['s3'])
  const [usage, setUsage] = useState(() => readPreference('cipher-usage', { sent: 0, received: 0, saved: 0, count: 0 }))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const seen = useRef(new Set<string>())
  const pins = useRef<Record<string, string>>({})
  const notify = useCallback((text: string) => setToast(text), [])
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t) } }, [toast])
  useEffect(() => { savePreference('cipher-preferences', settings) }, [settings])
  useEffect(() => { savePreference('cipher-usage', usage) }, [usage])
  useEffect(() => {
    let active = true
    void api<{ user: User }>('/auth/me').then(data => {
      if (!active || userRef.current) return
      setUser(data.user); setContacts([]); setMessages([]); select(null); setLocked(true)
    }).catch(() => { /* No cookie or offline build: keep the local demo. */ })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => {
    const timer = setInterval(() => setMessages(list => {
      const expired = list.filter(m => m.expiresAt && m.expiresAt <= Date.now())
      if (!expired.length) return list
      const remaining = list.filter(m => !m.expiresAt || m.expiresAt > Date.now())
      const affected = new Set(expired.map(m => m.chatId))
      setContacts(items => items.map(contact => {
        if (!affected.has(contact.id)) return contact
        const last = remaining.filter(m => m.chatId === contact.id).at(-1)
        return { ...contact, preview: last ? last.type === 'text' ? last.text : 'Shared an attachment' : 'Messages have expired', time: last?.time || '' }
      }))
      return remaining
    }), 5000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!user || !keys) return
    let cancelled = false
    const verified = readPreference<Record<string, string>>(`cipher-verified:${user.id}`, {})
    const preferences = readPreference<Record<string, Partial<Contact>>>(`cipher-contacts:${user.id}`, {})
    const acceptPeer = (peer: User) => {
      if (pins.current[peer.id] && pins.current[peer.id] !== peer.publicKey) throw new Error(`Security warning: ${peer.name}’s identity key changed. Messages were not opened.`)
      pins.current[peer.id] = peer.publicKey
      savePreference(`cipher-pins:${user.id}`, pins.current)
      setContacts(list => list.some(c => c.id === peer.id) ? list : [...list, { ...fromUser(peer), ...preferences[peer.id], verified: verified[peer.id] === peer.publicKey }])
    }
    const acceptMessage = async (envelope: Envelope, peer: User, count = false) => {
      if (cancelled || (envelope.expiresAt && envelope.expiresAt <= Date.now())) return
      const expectedPeer = envelope.sender === user.id ? envelope.recipient : envelope.sender
      if (peer.id !== expectedPeer || (envelope.sender !== user.id && envelope.recipient !== user.id)) throw new Error('Invalid message participants.')
      acceptPeer(peer)
      const body = await decryptMessage(envelope, keys.privateKey, peer.publicKey) as Body
      if (cancelled) return
      const message: Message = { ...body, id: envelope.id, chatId: peer.id, mine: envelope.sender === user.id, timestamp: envelope.createdAt, time: clock(envelope.createdAt), expiresAt: envelope.expiresAt, status: 'sent' }
      const fresh = !seen.current.has(message.id)
      seen.current.add(message.id)
      setMessages(list => list.some(m => m.id === message.id) ? list : [...list, message].sort((a, b) => a.timestamp - b.timestamp))
      if (fresh) {
        setContacts(list => list.map(c => c.id === peer.id ? { ...c, preview: body.type === 'text' ? body.text : `Sent ${body.type === 'image' ? 'a photo' : body.type === 'voice' ? 'a voice note' : 'a file'}`, time: message.time, unread: count && !message.mine && selectedRef.current !== c.id ? c.unread + 1 : c.unread } : c))
        if (count && !message.mine) {
          setUsage(v => ({ ...v, received: v.received + envelope.ciphertext.length }))
          if (settings.notifications && !readPreference<Record<string, Partial<Contact>>>(`cipher-contacts:${user.id}`, {})[peer.id]?.muted && 'Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('Cipher', { body: 'You have a new encrypted message.', icon: '/icon.svg' })
        }
      }
    }
    let refreshInProgress = false
    const refresh = async () => {
      if (refreshInProgress) return
      refreshInProgress = true
      try {
        const data = await api<{ messages: Envelope[]; peers: User[] }>('/messages')
        if (cancelled) return
        data.peers.forEach(acceptPeer)
        for (const message of data.messages) {
          const peer = data.peers.find(p => p.id === (message.sender === user.id ? message.recipient : message.sender))
          if (peer) await acceptMessage(message, peer)
        }
      } catch (error) { if (!cancelled) notify((error as Error).message) }
      finally { refreshInProgress = false }
    }
    // Connect first, then synchronize on every connection to close reconnect gaps.
    const source = new EventSource('/api/events')
    source.addEventListener('connected', () => { setConnected(true); void refresh() })
    source.addEventListener('message', event => {
      try { const data = JSON.parse((event as MessageEvent).data); void acceptMessage(data.message, data.peer, true).catch(error => notify(error.message)) }
      catch { notify('An invalid relay event was discarded.') }
    })
    source.addEventListener('session-ended', () => {
      source.close(); destroyKeys(keys); setKeys(null); setMessages([]); setContacts([]); setLocked(true); setModal(null); notify('This login session was revoked or expired. Unlock to continue.')
    })
    source.addEventListener('deleted', event => {
      try { const { id } = JSON.parse((event as MessageEvent).data); setMessages(list => list.filter(m => m.id !== id)) } catch { /* ignore malformed relay events */ }
    })
    source.onerror = () => setConnected(false)
    return () => { cancelled = true; source.close(); setConnected(false) }
  }, [user, keys, notify, settings.notifications])

  const lock = useCallback(() => {
    destroyKeys(keys)
    setKeys(null); setLocked(true); setModal(null)
    if (user) { setMessages([]); setContacts([]) }
  }, [keys, user])
  useEffect(() => {
    if (!settings.autoLock || !user || locked) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => { clearTimeout(timer); timer = setTimeout(lock, document.hidden ? 30000 : 300000) }
    document.addEventListener('visibilitychange', reset)
    window.addEventListener('pointerdown', reset); window.addEventListener('keydown', reset)
    reset()
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', reset); window.removeEventListener('pointerdown', reset); window.removeEventListener('keydown', reset) }
  }, [settings.autoLock, user, locked, lock])

  useEffect(() => {
    const nativeLock = () => { if (settings.autoLock && user && !locked) lock() }
    window.addEventListener('cipher:native-lock', nativeLock)
    return () => window.removeEventListener('cipher:native-lock', nativeLock)
  }, [settings.autoLock, user, locked, lock])
  useEffect(() => {
    window.cipherBack = () => {
      if (modal) { setModal(null); return true }
      if (sidebarOpen) { setSidebarOpen(false); return true }
      if (page !== 'messages') { changePage('messages'); return true }
      if (selected) { select(null); return true }
      return false
    }
    return () => { delete window.cipherBack }
  }, [modal, sidebarOpen, page, selected])

  function setSelected(id: string | null) {
    select(id)
    if (id) setContacts(list => list.map(c => c.id === id ? { ...c, unread: 0 } : c))
  }
  function setPage(value: Page) { changePage(value); setSidebarOpen(false) }
  async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (key === 'notifications' && value) {
      if (!('Notification' in window) || await Notification.requestPermission() !== 'granted') return notify('Notifications are not permitted by this browser.')
    }
    updateSettings(v => ({ ...v, [key]: value }))
  }
  function authenticate(account: User, pair: Keys) {
    destroyKeys(keys)
    setMessages([]); setContacts([]); seen.current.clear()
    pins.current = readPreference(`cipher-pins:${account.id}`, {})
    setSaved(readPreference(`cipher-saved:${account.id}`, []))
    setUser(account); setKeys(pair); setLocked(false); setModal(null); select(null); changePage('messages')
    notify(`Welcome${user ? ' back' : ''}, ${account.name.split(' ')[0]}. Your space is ready.`)
  }
  async function logout(all = false) {
    try { if (user) await post(all ? '/auth/logout-all' : '/auth/logout', {}) }
    catch { notify('Local keys cleared. The relay could not revoke your cookie; it will expire within 24 hours.') }
    destroyKeys(keys)
    setKeys(null); setUser(null); setLocked(false); setModal(null); setMessages(demoMessages.map(m => ({ ...m }))); setContacts(demoContacts.map(c => ({ ...c }))); select('sofia'); setSaved(['s3']); changePage('messages'); seen.current.clear()
  }
  function updateContact(id: string, data: Partial<Contact>) {
    setContacts(list => list.map(c => c.id === id ? { ...c, ...data } : c))
    if (user) {
      const current = readPreference<Record<string, Partial<Contact>>>(`cipher-contacts:${user.id}`, {})
      const { pinned, muted, timer, archived, blocked, verified } = data
      const flags = Object.fromEntries(Object.entries({ pinned, muted, timer, archived, blocked, verified }).filter(([, value]) => value !== undefined))
      savePreference(`cipher-contacts:${user.id}`, { ...current, [id]: { ...current[id], ...flags } })
    }
  }
  function addContact(value: User | Contact) {
    const contact = 'color' in value ? value : fromUser(value)
    setContacts(list => list.some(c => c.id === contact.id) ? list.map(c => c.id === contact.id ? { ...c, archived: false } : c) : [contact, ...list])
    setSelected(contact.id); changePage('messages'); setModal(null)
  }
  async function send(body: Body) {
    const contact = contacts.find(c => c.id === selected)
    if (!contact || contact.blocked) throw new Error('Choose an available conversation first.')
    if (body.text.length > 10000) throw new Error('Messages can be up to 10,000 characters.')
    const id = crypto.randomUUID(), now = Date.now()
    const timer = contact.timer ?? settings.defaultTimer
    const expiresAt = timer ? now + timer * 1000 : null
    if (user) {
      if (!keys || !contact.publicKey) throw new Error('Unlock your identity to send.')
      if (!online) throw new Error('You’re offline. Your draft will stay here until you reconnect.')
      const encrypted = await encryptMessage(body, { id, sender: user.id, recipient: contact.id, expiresAt }, keys.privateKey, contact.publicKey)
      await post('/messages', encrypted)
      setUsage(v => ({ ...v, sent: v.sent + encrypted.ciphertext.length, count: v.count + 1 }))
    }
    const message: Message = { ...body, id, chatId: contact.id, mine: true, time: clock(now), timestamp: now, status: user ? 'sent' : 'local', expiresAt }
    setMessages(list => list.some(m => m.id === id) ? list : [...list, message])
    updateContact(contact.id, { preview: body.type === 'text' ? `You: ${body.text}` : `You sent ${body.type === 'image' ? 'a photo' : 'an attachment'}`, time: clock(now) })
  }
  function toggleSaved(id: string) {
    setSaved(current => {
      const next = current.includes(id) ? current.filter(i => i !== id) : [...current, id]
      if (user) savePreference(`cipher-saved:${user.id}`, next)
      return next
    })
  }
  async function removeMessage(message: Message) {
    if (user && message.mine) await api(`/messages/${message.id}`, { method: 'DELETE' })
    setMessages(list => list.filter(m => m.id !== message.id))
    notify(user && message.mine ? 'Removed from the relay. Recipients may have kept a copy.' : 'Message hidden in this session.')
  }
  async function blockContact(contact: Contact) {
    if (user) await api(`/blocks/${contact.id}`, { method: contact.blocked ? 'DELETE' : 'POST' })
    updateContact(contact.id, { blocked: !contact.blocked })
    notify(contact.blocked ? 'Contact unblocked.' : 'Contact blocked. New messages will not be accepted.')
  }
  function verifyContact(contact: Contact) {
    if (!user || !contact.publicKey) return notify('Demo contacts don’t have real cryptographic identities.')
    const current = readPreference<Record<string, string>>(`cipher-verified:${user.id}`, {})
    pins.current[contact.id] = contact.publicKey
    savePreference(`cipher-pins:${user.id}`, pins.current)
    savePreference(`cipher-verified:${user.id}`, { ...current, [contact.id]: contact.publicKey })
    updateContact(contact.id, { verified: true }); setModal(null); notify('Identity marked as verified on this browser.')
  }
  const value: Store = {
    user, demo: !user, locked, online, connected, contacts, messages, selected, setSelected, page, setPage, settings, setSetting, modal, setModal, toast, notify,
    authenticate, logout, lock, resumeDemo: () => setLocked(false), send, addContact, updateContact, saved, toggleSaved, removeMessage, blockContact, verifyContact,
    usage, addSavings: bytes => setUsage(v => ({ ...v, saved: v.saved + Math.max(0, bytes) })), sidebarOpen, setSidebarOpen,
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}
