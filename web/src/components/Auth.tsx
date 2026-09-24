import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, ShieldCheck, LockKeyhole, Check, LoaderCircle, Leaf, ArrowLeft } from 'lucide-react'
import { useCipher } from '../lib/store'
import { post } from '../lib/api'
import { createIdentity, deriveCredential, unlockIdentity, destroyKeys } from '../lib/crypto.mjs'
import { Logo } from './ui'
import type { Keys } from '../lib/types'

export function Auth({ initial = 'signup', locked = false }: { initial?: string; locked?: boolean }) {
  const { authenticate, setModal, user, demo, resumeDemo, logout } = useCipher()
  const [tab, setTab] = useState(locked ? 'login' : initial)
  const [name, setName] = useState('')
  const [username, setUsername] = useState(user?.username || '')
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signup = tab === 'signup'
  const shell = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (locked) return
    const previous = document.activeElement as HTMLElement
    const scope = shell.current?.closest('.auth-modal')
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null)
      if (event.key !== 'Tab' || !scope) return
      const nodes = scope.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]')
      if (!nodes.length) return
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    const timer = setTimeout(() => scope?.querySelector<HTMLInputElement>('input:not([disabled])')?.focus(), 60)
    document.addEventListener('keydown', key)
    return () => { clearTimeout(timer); document.removeEventListener('keydown', key); previous?.focus() }
  }, [locked, setModal])
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (signup && passphrase.length < 12) return setError('Use a passphrase of at least 12 characters.')
    if (signup && passphrase !== confirm) return setError('Your passphrases don’t match.')
    if (signup && !accepted) return setError('Please acknowledge the prototype’s security limits.')
    if (!crypto.subtle) return setError('A secure HTTPS connection is required for encryption.')
    setBusy(true)
    let generatedKeys: Keys | undefined
    try {
      const handle = username.trim().toLowerCase()
      const credential = await deriveCredential(handle, passphrase)
      if (signup) {
        const identity = await createIdentity(handle, passphrase)
        generatedKeys = identity.keys
        const result = await post('/auth/register', { name: name.trim(), username: handle, credential, publicKey: identity.publicKey, wrappedKey: identity.wrappedKey })
        authenticate(result.user, identity.keys)
        generatedKeys = undefined
      } else {
        const result = await post('/auth/login', { username: handle, credential })
        const keys = await unlockIdentity(handle, passphrase, result.user.publicKey, result.wrappedKey)
        authenticate(result.user, keys)
      }
      setPassphrase(''); setConfirm('')
    } catch (e) { destroyKeys(generatedKeys); setError((e as Error).message || 'Could not unlock your identity. Check your passphrase.') }
    finally { setBusy(false) }
  }
  if (locked && demo) return <div className="locked-screen"><Logo/><div className="lock-art"><LockKeyhole size={44} strokeWidth={1.3}/></div><span className="eyebrow">A MOMENT TO YOURSELF</span><h1>Your space is paused.</h1><p>This is a demo screen lock, not authentication.<br/>Create an account for passphrase-protected access.</p><button className="button primary" onClick={resumeDemo}>Resume demo <ArrowRight size={17}/></button></div>
  return <div ref={shell} className={locked ? 'auth-shell locked-auth' : 'auth-shell'}>
    <div className="auth-story"><Logo/><div><span className="eyebrow">YOUR CONVERSATIONS. YOURS ONLY.</span><h2>A little more private.<br/>A lot more <em>you.</em></h2><p>A place for the big plans, the small moments, and everything you only want to share with your people.</p><div className="auth-perks"><span><ShieldCheck size={18}/> Encrypted account conversations</span><span><Leaf size={18}/> Less data. More connection.</span><span><Check size={18}/> No phone number. No subscription.</span></div></div><span className="auth-story-footer">Privacy should be a given. Not an upgrade.</span></div>
    <div className="auth-form-wrap">
      {!locked && <button className="text-button auth-back" onClick={() => setModal(null)}><ArrowLeft size={15}/> Back to the demo</button>}
      {!locked && <div className="auth-tabs"><button className={signup ? 'selected' : ''} onClick={() => { setTab('signup'); setError('') }}>Create account</button><button className={!signup ? 'selected' : ''} onClick={() => { setTab('login'); setError('') }}>Log in</button></div>}
      <span className="auth-icon"><LockKeyhole size={23} strokeWidth={1.5}/></span>
      <h2>{signup ? 'Make yourself at home.' : locked ? 'Welcome back.' : 'Your people are waiting.'}</h2>
      <p className="muted">{signup ? 'Just a username and a strong passphrase. That’s it.' : 'Your passphrase unlocks your identity on this device.'}</p>
      <form onSubmit={submit} className="auth-form">
        {signup && <label>Your name<input name="name" autoComplete="name" placeholder="Alex Morgan" required maxLength={50} value={name} onChange={e => setName(e.target.value)}/></label>}
        <label>Username<div className="input-with-prefix"><span>@</span><input aria-label="Username" name="username" autoComplete="username" placeholder="your_name" required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" disabled={locked} value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}/></div>{signup && <small>3–24 letters, numbers, or underscores. No phone number needed.</small>}</label>
        <label>Passphrase<div className="password-field"><input aria-label="Passphrase" name="password" type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'At least 12 characters' : 'Your private passphrase'} required minLength={signup ? 12 : undefined} maxLength={256} value={passphrase} onChange={e => setPassphrase(e.target.value)}/><button type="button" aria-label={visible ? 'Hide passphrase' : 'Show passphrase'} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        {signup && <><div className="strength-meter"><i style={{ width: `${Math.min(100, passphrase.length / 24 * 100)}%` }} /></div><label>Confirm passphrase<input aria-label="Confirm passphrase" type="password" autoComplete="new-password" placeholder="One more time" required value={confirm} onChange={e => setConfirm(e.target.value)}/></label><label className="checkbox-label"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}/><span>I understand this is an unaudited prototype, not for high-risk use. A lost passphrase cannot be recovered.</span></label></>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button primary full" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18}/>{signup ? 'Creating your identity…' : 'Unlocking your identity…'}</> : <>{signup ? 'Create your free account' : 'Unlock your space'}<ArrowRight size={17}/></>}</button>
      </form>
      <>{window.CipherAndroid && <button className="text-button" style={{ marginTop: 16 }} onClick={() => window.CipherAndroid!.configureRelay()}>Android connection settings <ArrowRight size={14}/></button>}</><p className="auth-footnote"><LockKeyhole size={12}/> Your passphrase stays in your browser. A separate login credential is sent over HTTPS.</p>
      {locked && <button className="text-button" onClick={() => void logout()}>Log out and return to demo</button>}
      {!signup && <p className="tiny muted">There is no passphrase reset. This prevents recovery by the server, but means a lost passphrase also means lost access.</p>}
    </div>
  </div>
}
