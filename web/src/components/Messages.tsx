import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Search, SquarePen, Pin, ChevronDown, ChevronRight, MoreHorizontal, LockKeyhole, ArrowLeft, Info, Timer, BellOff, Bell, ImagePlus, Paperclip, Smile, Send, X, Check, Bookmark, Reply, Trash2, Leaf, ShieldCheck, Download, FileText, Users, Archive, Ban, Mic, Square, LoaderCircle, Images, ArrowUpRight } from 'lucide-react'
import { Avatar, EmptyState, IconButton, Toggle } from './ui'
import { EmojiText } from './EmojiText'
import { useCipher } from '../lib/store'
import { cleanImage, download, formatBytes, readFile } from '../lib/api'
import type { Body, Contact, Message } from '../lib/types'

export function ConversationList() {
  const { contacts, selected, setSelected, setModal, settings, demo } = useCipher()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [archived, setArchived] = useState(false)
  const list = contacts.filter(c => Boolean(c.archived) === archived && `${c.name} ${c.username}`.toLowerCase().includes(query.toLowerCase()) && (tab === 'all' || tab === 'unread' && c.unread > 0 || tab === 'groups' && c.group))
  const renderContact = (contact: Contact) => <button className={`conversation-item ${selected === contact.id ? 'selected' : ''}`} key={contact.id} onClick={() => setSelected(contact.id)}>
    <Avatar contact={contact} online={demo && contact.id === 'sofia'}/><span className="conversation-copy"><span className="conversation-title"><strong>{contact.name}</strong><time>{contact.time}</time></span><span className="conversation-preview"><span>{settings.hidePreviews ? 'Message preview hidden' : <EmojiText text={contact.preview}/>}</span>{contact.unread > 0 ? <b className="unread-count">{contact.unread}</b> : contact.muted ? <BellOff size={13}/> : contact.pinned ? <Pin size={12}/> : null}</span></span>
  </button>
  return <section className="conversation-list">
    <div className="list-heading"><div><h2>Messages<span className="heading-dot"/></h2><span className="muted">Little connections, big meaning.</span></div><IconButton icon={SquarePen} label="New conversation" onClick={() => setModal({ type: 'newChat' })}/></div>
    <div className="chat-search-input"><Search size={16}/><input aria-label="Search conversations" placeholder="Find a conversation" value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div>
    <div className="list-tabs" role="tablist" aria-label="Filter conversations">{[['all', 'All chats'], ['unread', 'Unread'], ['groups', 'Groups']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}{id === 'unread' && contacts.some(c => c.unread > 0) && <span>{contacts.filter(c => c.unread > 0).length}</span>}</button>)}</div>
    <div className="conversation-scroll">
      {list.some(c => c.pinned) && <><div className="list-section-label"><Pin size={11}/> PINNED</div>{list.filter(c => c.pinned).map(renderContact)}</>}
      {list.some(c => !c.pinned) && <><div className="list-section-label">{archived ? 'ARCHIVED' : 'ALL CONVERSATIONS'}<span>{list.filter(c => !c.pinned).length}</span></div>{list.filter(c => !c.pinned).map(renderContact)}</>}
      {!list.length && <div className="list-empty"><Search size={24}/><strong>{query ? 'No conversations found' : 'A fresh little space'}</strong><p>{query ? 'Try another name or username.' : tab === 'groups' ? demo ? 'Create a demo group to get started.' : 'Encrypted groups are not supported yet.' : tab === 'unread' ? 'You’re all caught up.' : 'Start a conversation with someone you know.'}</p>{tab === 'all' && <button className="text-button" onClick={() => setModal({ type: 'newChat' })}>Start a conversation <ArrowUpRight size={14}/></button>}</div>}
      <button className={`archive-toggle ${archived ? 'active' : ''}`} onClick={() => setArchived(v => !v)}><Archive size={15}/>{archived ? 'Back to conversations' : 'Archived conversations'}<ChevronRight size={14}/></button>
    </div>
    <div className="list-footer"><span className="mini-shield"><LockKeyhole size={15}/></span><div><strong>A little space. Just for you.</strong><p>{demo ? 'Explore freely. This is a local demo.' : 'Your messages are encrypted before sending.'}</p></div></div>
  </section>
}

function MessageBubble({ message, contact, onReply }: { message: Message; contact: Contact; onReply: (message: Message) => void }) {
  const { saved, toggleSaved, removeMessage, setModal, notify, demo } = useCipher()
  return <div className={`message-row ${message.mine ? 'mine' : ''}`}>
    {!message.mine && <Avatar contact={contact} size="tiny"/>}
    <div className="message-stack"><div className={`message-bubble ${message.type === 'image' ? 'photo-bubble' : ''}`}>
      {message.reply && <div className="reply-quote"><strong>{message.reply.name}</strong><span>{message.reply.text}</span></div>}
      {message.type === 'image' && <button className="message-photo" aria-label={`Open photo: ${message.name || 'shared image'}`} onClick={() => setModal({ type: 'image', src: message.data, name: message.name, text: message.text })}><img src={message.data} alt={message.name || 'Shared photo'}/><span><ImagePlus size={11}/>{formatBytes(message.size || 0)}</span></button>}
      {message.type === 'file' && <button className="file-attachment" onClick={() => { void fetch(message.data!).then(r => r.blob()).then(blob => download(blob, message.name || 'attachment')).catch(() => notify('Could not download this attachment.')) }}><span><FileText size={24}/></span><div><strong>{message.name}</strong><small>{formatBytes(message.size || 0)} · Download file</small></div><Download size={17}/></button>}
      {message.type === 'voice' && <audio controls src={message.data} preload="none"/>}
      {message.text && <p><EmojiText text={message.text}/></p>}
      <div className="message-actions"><IconButton icon={Reply} label="Reply to message" onClick={() => onReply(message)}/><IconButton icon={Bookmark} label={saved.includes(message.id) ? 'Unsave message' : 'Save message'} active={saved.includes(message.id)} onClick={() => { toggleSaved(message.id); notify(saved.includes(message.id) ? 'Removed from saved messages.' : 'Saved. A little moment to come back to.') }}/>{message.mine && <IconButton icon={Trash2} label="Delete message" onClick={() => void removeMessage(message).catch(e => notify(e.message))}/>}</div>
    </div><div className="message-meta">{saved.includes(message.id) && <Bookmark size={10}/>}<time>{message.time}</time>{message.expiresAt && <Timer size={10}/>} {message.mine && <><Check size={12}/><span>{demo ? 'Local demo' : 'Sent to relay'}</span></>}</div></div>
  </div>
}

export function ChatPanel() {
  const { contacts, selected, setSelected, messages, demo, setModal, updateContact, notify, settings, send, addSavings } = useCipher()
  const contact = contacts.find(c => c.id === selected)
  const selectedRef = useRef(selected); selectedRef.current = selected
  const contactTimer = contact?.timer ?? settings.defaultTimer
  const [details, setDetails] = useState(() => window.innerWidth > 1250)
  const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [text, setText] = useState('')
  const drafts = useRef<Record<string, string>>({})
  const previousChat = useRef(selected)
  const [reply, setReply] = useState<Message | null>(null)
  const [pending, setPending] = useState<Partial<Body> | null>(null)
  const [emoji, setEmoji] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const recordStream = useRef<MediaStream | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const currentMessages = messages.filter(m => m.chatId === selected && (!query || m.text.toLowerCase().includes(query.toLowerCase()) || m.name?.toLowerCase().includes(query.toLowerCase())))
  useEffect(() => {
    drafts.current[previousChat.current || ''] = text
    setText(drafts.current[selected || ''] || ''); previousChat.current = selected
    setPending(null); setReply(null); setQuery(''); setSearching(false); setMenu(false); setEmoji(false)
    if (recorder.current?.state === 'recording') { recorder.current.ondataavailable = null; recorder.current.stop(); recordStream.current?.getTracks().forEach(track => track.stop()); setRecording(false) }
    // Drafts only live in memory, and are scoped to each conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'instant', block: 'end' }) }, [selected, currentMessages.length, pending])
  useEffect(() => { if (input.current) { input.current.style.height = 'auto'; input.current.style.height = `${Math.min(input.current.scrollHeight, 110)}px` } }, [text])
  useEffect(() => {
    if (!recording) return
    setSeconds(0)
    const timer = setInterval(() => setSeconds(v => { if (v >= 119) recorder.current?.stop(); return v + 1 }), 1000)
    return () => clearInterval(timer)
  }, [recording])
  useEffect(() => () => { if (recorder.current?.state === 'recording') { recorder.current.ondataavailable = null; recorder.current.stop() } recordStream.current?.getTracks().forEach(track => track.stop()) }, [])
  if (!contact) return <section className="chat-empty"><EmptyState icon={LockKeyhole} title="Your next little connection." text={demo ? 'Choose a conversation, or start a new one. Your demo messages never leave this device.' : 'Find someone by username and start an encrypted conversation. No phone numbers needed.'}><button className="button primary" onClick={() => setModal({ type: 'newChat' })}><SquarePen size={17}/>Start a conversation</button></EmptyState><div className="empty-chat-art"><span/><span/><span/></div></section>
  async function attach(event: ChangeEvent<HTMLInputElement>, image: boolean) {
    const attachmentChat = selected
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      if (image) {
        const blob = await cleanImage(file, settings.lowData)
        if (blob.size > 1400000) throw new Error('Photo is still too large. Turn on low-data mode or choose another photo.')
        const data = await readFile(blob)
        if (selectedRef.current !== attachmentChat) return
        setPending({ type: 'image', data, size: blob.size, name: `${file.name.replace(/\.[^.]+$/, '')}.jpg` })
        addSavings(file.size - blob.size)
        notify('Photo ready. Location and EXIF metadata removed.')
      } else {
        if (file.size > 1048576) throw new Error('Files can be up to 1 MB in this low-data prototype.')
        const data = await readFile(new Blob([await file.arrayBuffer()], { type: 'application/octet-stream' }))
        if (selectedRef.current !== attachmentChat) return
        setPending({ type: 'file', data, size: file.size, name: file.name })
      }
    } catch (error) { notify((error as Error).message) }
    finally { setBusy(false) }
  }
  async function sendMessage() {
    if ((!text.trim() && !pending) || busy || !contact) return
    setBusy(true)
    try {
      const body: Body = { type: pending?.type || 'text', text: text.trim(), ...pending }
      if (reply) body.reply = { name: reply.mine ? 'You' : contact.name, text: reply.text || reply.name || 'Attachment' }
      await send(body)
      drafts.current[contact.id] = ''
      if (selectedRef.current === contact.id) { setText(''); setPending(null); setReply(null); setEmoji(false); input.current?.focus() }
    } catch (error) { notify((error as Error).message) }
    finally { setBusy(false) }
  }
  async function record() {
    if (recording) { recorder.current?.stop(); return }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Voice recording is unavailable in this browser. Try Chrome over HTTPS.')
      const recordingChat = selected
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (selectedRef.current !== recordingChat) { stream.getTracks().forEach(track => track.stop()); return }
      recordStream.current = stream
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 })
      const chunks: Blob[] = []
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(track => track.stop()); setRecording(false)
        if (selectedRef.current !== recordingChat) return
        const blob = new Blob(chunks, { type: rec.mimeType })
        if (blob.size && blob.size <= 1048576) setPending({ type: 'voice', data: await readFile(blob), size: blob.size, name: 'Voice note' })
        else if (blob.size > 1048576) notify('Voice note is too long. Keep recordings under two minutes.')
      }
      recorder.current = rec; rec.start(); setRecording(true)
    } catch (error) { notify((error as Error).message || 'Microphone access was denied.') }
  }
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === 'Enter' && !event.shiftKey && settings.sendOnEnter && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage() } }
  return <>
    <section className={`chat-panel ${settings.compact ? 'compact' : ''}`}>
      <header className="chat-header"><IconButton className="back-to-list" icon={ArrowLeft} label="Back to conversations" onClick={() => setSelected(null)}/><Avatar contact={contact} online={demo && contact.id === 'sofia'}/><button className="chat-person" onClick={() => setDetails(v => !v)}><strong>{contact.name}{contact.verified && <ShieldCheck size={16}/>}</strong><span>{contact.group ? `${contact.members?.length || 0} members · demo group` : demo ? <><i className="online-dot"/>Demo contact</> : contact.verified ? 'Identity verified on this browser' : 'Identity not yet verified'}</span></button><div className="chat-header-actions"><IconButton icon={Search} label="Search this conversation" active={searching} onClick={() => setSearching(v => !v)}/><IconButton icon={Info} label="Conversation details" active={details} onClick={() => setDetails(v => !v)}/><div className="menu-anchor"><IconButton icon={MoreHorizontal} label="Conversation menu" active={menu} onClick={() => setMenu(v => !v)}/>{menu && <div className="dropdown"><button onClick={() => { updateContact(contact.id, { pinned: !contact.pinned }); setMenu(false) }}><Pin size={15}/>{contact.pinned ? 'Unpin conversation' : 'Pin conversation'}</button><button onClick={() => { updateContact(contact.id, { muted: !contact.muted }); setMenu(false) }}><BellOff size={15}/>{contact.muted ? 'Unmute' : 'Mute'} conversation</button><button onClick={() => { updateContact(contact.id, { archived: true }); setSelected(null); setMenu(false); notify('Conversation archived. Find it in Archived conversations.') }}><Archive size={15}/>Archive conversation</button><button onClick={() => { setModal({ type: 'tool', tool: 'notes', initial: currentMessages.map(m => `${m.time} · ${m.mine ? 'You' : contact.name}: ${m.text || m.name || 'Attachment'}`).join('\n') }); setMenu(false) }}><Download size={15}/>Encrypted text export</button><button className="danger-text" onClick={() => { setModal({ type: 'block', contact }); setMenu(false) }}><Ban size={15}/>{contact.blocked ? 'Unblock' : 'Block'} contact</button></div>}</div></div></header>
      {searching && <div className="in-chat-search"><Search size={15}/><input autoFocus aria-label="Search messages" placeholder="Search in this conversation…" value={query} onChange={e => setQuery(e.target.value)}/><span>{currentMessages.length} found</span><IconButton icon={X} label="Close message search" onClick={() => { setSearching(false); setQuery('') }}/></div>}
      <button className="encryption-banner" onClick={() => setModal({ type: 'privacy' })}><LockKeyhole size={13}/><span>{demo ? 'Just a little preview. Demo messages stay on this device.' : 'Encrypted before sending. Your words stay between you.'}</span><ChevronRight size={13}/></button>
      <div className="chat-body"><div className="date-divider"><span>{demo ? 'TODAY' : 'YOUR CONVERSATION'}</span></div>
        {currentMessages.map(message => <MessageBubble key={message.id} message={message} contact={contact} onReply={message => { setReply(message); input.current?.focus() }}/>) }
        {!currentMessages.length && <div className="conversation-beginning"><Leaf size={28}/><p>{query ? 'No messages match your search.' : 'Every good conversation starts with hello.'}</p>{!demo && <button className="text-button" onClick={() => setModal({ type: 'verify', contact })}>Verify their identity first <ShieldCheck size={14}/></button>}</div>}
        <div ref={bottom}/>
      </div>
      <div className="composer-wrap">{contactTimer ? <button className="timer-notice" onClick={() => setModal({ type: 'timer', contact })}><Timer size={12}/>New messages disappear after {contactTimer === 3600 ? '1 hour' : contactTimer === 86400 ? '24 hours' : '7 days'}<ChevronDown size={12}/></button> : null}
        {contact.blocked ? <div className="blocked-composer"><Ban size={17}/>You’ve blocked this contact.<button className="text-button" onClick={() => setModal({ type: 'block', contact })}>Unblock</button></div> : <div className="composer">
          {reply && <div className="composer-reply"><Reply size={15}/><div><strong>Replying to {reply.mine ? 'yourself' : contact.name}</strong><span>{reply.text || reply.name}</span></div><IconButton icon={X} label="Cancel reply" onClick={() => setReply(null)}/></div>}
          {pending && <div className="attachment-preview">{pending.type === 'image' ? <img src={pending.data} alt="Attachment preview"/> : pending.type === 'voice' ? <Mic size={22}/> : <FileText size={22}/>}<div><strong>{pending.name}</strong><span>{formatBytes(pending.size || 0)} · {demo ? 'Local demo attachment' : 'Encrypted before sending'}</span></div><IconButton icon={X} label="Remove attachment" onClick={() => setPending(null)}/></div>}
          <div className="compose-input"><textarea ref={input} aria-label="Message" rows={1} placeholder="Write a little something…" value={text} maxLength={10000} onChange={e => setText(e.target.value)} onKeyDown={onKey}/><div className="emoji-anchor"><IconButton icon={Smile} label="Add an emoji" active={emoji} onClick={() => setEmoji(v => !v)}/>{emoji && <div className="emoji-picker">{['😊', '🌿', '🤍', '✨', '👍', '☕', '🎉', '🙌', '🌻', '😂', '💚', '🏔️', '👋', '🤝', '💬', '🌱'].map(e => <button key={e} onClick={() => { setText(t => t + e); setEmoji(false); input.current?.focus() }}><EmojiText text={e}/></button>)}</div>}</div></div>
          <div className="composer-tools"><div className="attachment-tools"><IconButton icon={Paperclip} label="Attach a file" disabled={busy || recording} onClick={() => fileInput.current?.click()}/><IconButton icon={ImagePlus} label="Attach a photo" disabled={busy || recording} onClick={() => imageInput.current?.click()}/><IconButton icon={recording ? Square : Mic} label={recording ? 'Stop recording' : 'Record a voice note'} active={recording} disabled={busy} onClick={() => void record()}/><span className="toolbar-divider"/><IconButton icon={Timer} label="Disappearing messages" active={Boolean(contactTimer)} onClick={() => setModal({ type: 'timer', contact })}/>{recording && <span className="recording"><i/>{seconds}s</span>}</div><button className="send-button" aria-label="Send message" disabled={busy || recording || (!text.trim() && !pending)} onClick={() => void sendMessage()}>{busy ? <LoaderCircle className="spin" size={17}/> : <><span>Send</span><Send size={16}/></>}</button></div>
        </div>}
        <div className="composer-footnote"><span><LockKeyhole size={10}/>{demo ? 'Demo mode · nothing is sent' : 'libsodium encrypted'}</span><span>{settings.sendOnEnter ? 'Enter to send' : 'Click Send to send'}<span className="desktop-only"> · Shift + Enter for a new line</span></span></div>
        <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => void attach(e, true)}/><input ref={fileInput} type="file" hidden onChange={e => void attach(e, false)}/>
      </div>
    </section>
    {details && <ConversationDetails contact={contact} close={() => setDetails(false)}/>}
  </>
}

function ConversationDetails({ contact, close }: { contact: Contact; close: () => void }) {
  const { demo, setModal, updateContact, settings, setSetting, messages, setPage } = useCipher()
  const [mediaTab, setMediaTab] = useState('media')
  const effectiveTimer = contact.timer ?? settings.defaultTimer
  const photos = messages.filter(m => m.chatId === contact.id && m.type === 'image')
  const gallery = demo && contact.id === 'sofia' ? [...photos, { id: 'sample2', data: '/images/alpine-meadow.jpg', name: 'Mountain days.jpg' }, { id: 'sample3', data: '/images/lakeside.jpg', name: 'Lakeside.jpg' }] : photos
  const files = messages.filter(m => m.chatId === contact.id && m.type === 'file')
  return <aside className="conversation-details">
    <div className="details-heading"><span>CONVERSATION INFO</span><IconButton icon={X} label="Close conversation details" onClick={close}/></div>
    <div className="contact-card"><div className="profile-halo"><Avatar contact={contact} size="xl"/>{contact.verified && <span className="avatar-verified"><ShieldCheck size={14}/></span>}</div><h2>{contact.name}</h2><span className="contact-username">{contact.group ? `${contact.members?.length} members` : `@${contact.username}`}</span><button className="identity-badge" onClick={() => setModal({ type: 'verify', contact })}><ShieldCheck size={13}/>{demo ? 'Demo identity' : contact.verified ? 'Verified identity' : 'Verify identity'}<ChevronRight size={12}/></button>
      <div className="contact-quick-actions"><button onClick={() => updateContact(contact.id, { muted: !contact.muted })}><span>{contact.muted ? <BellOff size={17}/> : <Bell size={17}/>}</span>{contact.muted ? 'Unmute' : 'Mute'}</button><button onClick={() => setModal({ type: 'timer', contact })}><span><Timer size={18}/></span>Timer</button><button onClick={() => setModal({ type: 'verify', contact })}><span><ShieldCheck size={18}/></span>Verify</button></div>
    </div>
    <div className="details-section"><h3>Make it your space</h3><button className="detail-setting" onClick={() => setModal({ type: 'timer', contact })}><Timer size={16}/><span>Disappearing messages</span><b>{effectiveTimer ? effectiveTimer === 3600 ? '1h' : effectiveTimer === 86400 ? '24h' : '7d' : 'Off'}</b><ChevronRight size={13}/></button><div className="detail-setting"><BellOff size={16}/><span>Mute notifications</span><Toggle checked={Boolean(contact.muted)} label="Mute this conversation" onChange={() => updateContact(contact.id, { muted: !contact.muted })}/></div></div>
    <div className="shared-section"><div className="shared-heading"><h3>Shared moments</h3><span>{gallery.length + files.length}</span></div><div className="media-tabs"><button className={mediaTab === 'media' ? 'selected' : ''} onClick={() => setMediaTab('media')}>Media</button><button className={mediaTab === 'files' ? 'selected' : ''} onClick={() => setMediaTab('files')}>Files</button><button className={mediaTab === 'links' ? 'selected' : ''} onClick={() => setMediaTab('links')}>Links</button></div>
      {mediaTab === 'media' && (gallery.length ? <div className="media-grid">{gallery.slice(0, 6).map(photo => <button key={photo.id} onClick={() => setModal({ type: 'image', src: photo.data, name: photo.name })}><img src={photo.data} alt={photo.name || 'Shared image'}/></button>)}</div> : <p className="media-empty">The moments you share will live here.</p>)}
      {mediaTab === 'files' && (files.length ? files.map(file => <button key={file.id} className="shared-file" onClick={() => { void fetch(file.data!).then(r => r.blob()).then(blob => download(blob, file.name || 'attachment')) }}><FileText size={20}/><span>{file.name}<small>{formatBytes(file.size || 0)}</small></span><Download size={15}/></button>) : <p className="media-empty">No files here yet. Send one with the paperclip.</p>)}
      {mediaTab === 'links' && <p className="media-empty">Links aren’t fetched automatically. Use the <button className="inline-link" onClick={() => setModal({ type: 'tool', tool: 'links' })}>link inspector</button> to check a URL privately.</p>}
      {demo && gallery.length > 0 && mediaTab === 'media' && <span className="sample-caption">A few moments from the demo</span>}
    </div>
    <div className="low-data-card"><div className="low-data-icon"><Leaf size={21} strokeWidth={1.6}/><span/></div><strong>Less data. More connection.</strong><p>All the little moments.<br/>A much lighter footprint.</p><div><span>Low-data mode</span><Toggle checked={settings.lowData} label="Low-data mode" onChange={() => setSetting('lowData', !settings.lowData)}/></div><button className="text-button" onClick={() => setPage('data')}>See your data usage <ArrowUpRight size={13}/></button></div>
    <div className="details-footer"><LockKeyhole size={13}/><span>Private is a feeling.<br/><strong>Let’s keep it that way.</strong></span></div>
  </aside>
}

export default function Messages() {
  const { selected } = useCipher()
  return <div className={`messenger-card ${selected ? 'has-selection' : ''}`}><ConversationList/><ChatPanel/></div>
}
