import { useEffect, useState } from 'react'
import { MessageCircle, Users, Bookmark, Shapes, ShieldCheck, Leaf, Settings, ChevronRight, ArrowUpRight, LockKeyhole, Menu, X, FlaskConical, Bell, Check, HelpCircle, LogOut, ArrowRight, WifiOff, Circle, Sparkles } from 'lucide-react'
import { CipherProvider, useCipher } from './lib/store'
import type { Page } from './lib/types'
import { Avatar, IconButton, Logo } from './components/ui'
import Messages from './components/Messages'
import { ToolkitPage } from './components/Tools'
import { ContactsPage, SavedPage, SecurityPage, DataPage, SettingsPage } from './components/Pages'
import { Dialogs } from './components/Dialogs'
import { Auth } from './components/Auth'

const NAV = [
  { id: 'messages' as Page, label: 'Messages', icon: MessageCircle },
  { id: 'contacts' as Page, label: 'Your contacts', icon: Users },
  { id: 'saved' as Page, label: 'Saved messages', icon: Bookmark },
  { id: 'toolkit' as Page, label: 'Privacy toolkit', icon: Shapes },
]
const PREFERENCES = [
  { id: 'security' as Page, label: 'Privacy center', icon: ShieldCheck },
  { id: 'data' as Page, label: 'Data & storage', icon: Leaf },
  { id: 'settings' as Page, label: 'Settings', icon: Settings },
]
const HEADERS: Record<Page, { title: string; subtitle: string }> = {
  messages: { title: 'Your conversations. Yours only.', subtitle: 'Stay close to your people. Keep the world outside.' },
  contacts: { title: 'Good people. Closer connections.', subtitle: 'Your circle, on your terms.' },
  saved: { title: 'Some things are worth keeping.', subtitle: 'A home for your favorite little moments.' },
  toolkit: { title: 'A little help for your digital life.', subtitle: 'Privacy isn’t one feature. It’s the little things, together.' },
  security: { title: 'Your privacy, in the open.', subtitle: 'Clear protections. Honest limitations.' },
  data: { title: 'Keep it light. Keep in touch.', subtitle: 'Designed for meaningful conversations, not big data bills.' },
  settings: { title: 'A space that feels like you.', subtitle: 'Make the little things your own.' },
}

function Sidebar() {
  const { page, setPage, contacts, user, demo, setModal, sidebarOpen, setSidebarOpen, logout } = useCipher()
  const [profile, setProfile] = useState(false)
  const unread = contacts.reduce((sum, c) => sum + c.unread, 0)
  return <><div className={`sidebar-scrim ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}/><aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
    <div className="sidebar-brand"><button onClick={() => setPage('messages')} aria-label="Cipher home"><Logo/></button><IconButton icon={X} label="Close navigation" className="close-navigation" onClick={() => setSidebarOpen(false)}/><p>A little more private.</p></div>
    <div className="sidebar-section-label">YOUR SPACE</div><nav className="primary-navigation" aria-label="Main navigation">{NAV.map(item => <button className={page === item.id ? 'selected' : ''} key={item.id} onClick={() => setPage(item.id)}><item.icon size={19} strokeWidth={1.65}/><span>{item.label}</span>{item.id === 'messages' && unread > 0 && <b className="nav-badge">{unread}</b>}{item.id === 'toolkit' && <b className="toolkit-count">12</b>}</button>)}</nav>
    <div className="nav-separator"/><div className="sidebar-section-label">MADE FOR YOU</div><nav className="secondary-navigation" aria-label="Preferences">{PREFERENCES.map(item => <button className={page === item.id ? 'selected' : ''} key={item.id} onClick={() => setPage(item.id)}><item.icon size={18} strokeWidth={1.65}/><span>{item.label}</span>{item.id === 'security' && <span className="tiny-status-dot"/>}</button>)}</nav>
    <div className="sidebar-bottom"><button className="privacy-promise" onClick={() => setPage('toolkit')}><span className="promise-illustration"><span className="promise-orbit"/><ShieldCheck size={35} strokeWidth={1.2}/><Sparkles size={15} className="promise-spark"/><Leaf size={14} className="promise-leaf"/></span><strong>Privacy is for everyone.</strong><p>Not a premium feature.<br/>Not a privilege.</p><span className="promise-footer">Free. Now and always.<ArrowUpRight size={14}/></span></button><button className="help-link" onClick={() => setModal({ type: 'privacy' })}><HelpCircle size={16}/><span>A little help & a heads-up</span><ArrowUpRight size={13}/></button></div>
    <div className="sidebar-profile"><button onClick={() => setProfile(v => !v)} aria-label="Open your profile menu"><Avatar contact={{ name: user?.name || 'Alex Morgan', color: 'sage' }} size="small"/><span><strong>{user?.name || 'Alex Morgan'}</strong><small>{demo ? 'Your demo space' : `@${user?.username}`}</small></span><ChevronRight size={16}/></button>{profile && <div className="profile-menu"><span>{demo ? 'MAKE THIS SPACE YOURS' : 'YOUR ACCOUNT'}</span>{demo ? <><button onClick={() => { setModal({ type: 'auth', tab: 'signup' }); setProfile(false) }}>Create a free account <ArrowUpRight size={15}/></button><button onClick={() => { setModal({ type: 'auth', tab: 'login' }); setProfile(false) }}>Log in <ArrowRight size={15}/></button></> : <><button onClick={() => { setModal({ type: 'tool', tool: 'identity' }); setProfile(false) }}>Your identity card <ShieldCheck size={15}/></button><button onClick={() => { void logout(); setProfile(false) }}>Log out <LogOut size={15}/></button></>}</div>}</div>
  </aside></>
}

function Workspace() {
  const { page, setPage, user, demo, locked, online, connected, settings, setSetting, setModal, lock, toast, sidebarOpen, setSidebarOpen, contacts } = useCipher()
  const [notifications, setNotifications] = useState(false)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPage('messages'); setTimeout(() => document.querySelector<HTMLInputElement>('[aria-label="Search conversations"]')?.focus(), 60) }
      if (event.key === 'Escape') { setNotifications(false); setSidebarOpen(false) }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [setPage, setSidebarOpen])
  if (locked) return <><Auth locked/>{toast && <div className="toast" role="status"><InfoIcon/>{toast}</div>}</>
  const view = { messages: <Messages/>, contacts: <ContactsPage/>, saved: <SavedPage/>, toolkit: <ToolkitPage/>, security: <SecurityPage/>, data: <DataPage/>, settings: <SettingsPage/> }[page]
  return <div className={`app-layout page-${page}`}><Sidebar/><main className="workspace"><header className="workspace-header"><IconButton className="open-navigation" icon={Menu} label="Open navigation" onClick={() => setSidebarOpen(!sidebarOpen)}/><div className="workspace-heading"><h1>{HEADERS[page].title}</h1><p>{HEADERS[page].subtitle}</p></div><div className="workspace-header-right"><button className={`data-mode-badge ${settings.lowData ? 'enabled' : ''}`} onClick={() => setSetting('lowData', !settings.lowData)} title="Toggle low-data mode"><Leaf size={15}/><span>Low-data mode</span><i/></button><span className="header-divider"/>{demo ? <><button className="demo-badge" onClick={() => setModal({ type: 'privacy' })}><FlaskConical size={13}/><span>Demo workspace</span></button><button className="create-account-button" onClick={() => setModal({ type: 'auth', tab: 'signup' })}>Make it yours <ArrowUpRight size={15}/></button></> : <><span className={`connection-badge ${connected ? 'connected' : ''}`}><i/>{connected ? 'Connected' : 'Reconnecting'}</span><IconButton icon={LockKeyhole} label="Lock your account" onClick={lock}/></>}<div className="notification-anchor"><IconButton icon={Bell} label="Notifications" active={notifications} onClick={() => setNotifications(v => !v)}/>{notifications && <div className="notifications-menu"><div><h3>A little peace and quiet.</h3><Bell size={18}/></div><p>{settings.notifications ? 'Notifications are on. Your message content stays out of the preview.' : 'Desktop notifications are off. Your conversations will be waiting right here.'}</p><button className="text-button" onClick={() => { setPage('settings'); setNotifications(false) }}>Notification settings <ArrowUpRight size={14}/></button></div>}</div></div></header>
    {!online && <div className="offline-banner"><WifiOff size={14}/><span>You’re offline. Local tools still work; account messages will need a connection.</span></div>}
    <div className="workspace-body">{view}</div><footer className="workspace-footer"><span><LockKeyhole size={11}/>A quieter corner of the internet.</span><button onClick={() => { setPage('security'); setModal(null) }}><span className="prototype-dot"/>Unaudited prototype<span>·</span>v0.2.0<ArrowUpRight size={11}/></button></footer>
    <nav className="mobile-navigation" aria-label="Mobile navigation">{NAV.map(item => <button key={item.id} className={page === item.id ? 'selected' : ''} onClick={() => setPage(item.id)}><item.icon size={20}/><span>{item.id === 'contacts' ? 'Contacts' : item.id === 'saved' ? 'Saved' : item.id === 'toolkit' ? 'Toolkit' : item.label}</span>{item.id === 'messages' && contacts.some(c => c.unread > 0) && <i/>}</button>)}</nav></main><Dialogs/>{toast && <div className="toast" role="status"><span><Check size={15}/></span>{toast}</div>}</div>
}
function InfoIcon() { return <ShieldCheck size={17}/> }
export default function App() { return <CipherProvider><Workspace/></CipherProvider> }
