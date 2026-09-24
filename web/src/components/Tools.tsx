import { useState, useEffect, type ChangeEvent } from 'react'
import { KeyRound, FileLock2, ScanFace, Link2, Fingerprint, Timer, LockKeyhole, Leaf, ShieldCheck, NotebookPen, ScanLine, Copy, RefreshCw, ArrowUpRight, Download, Upload, Eye, EyeOff, LoaderCircle, Check, AlertTriangle, ImageOff, Search, Sparkles, FileCheck2, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useCipher } from '../lib/store'
import { Modal, Toggle, EmptyState, IconButton } from './ui'
import { generatePassword, encryptVault, decryptVault, fingerprint, decodeText } from '../lib/crypto.mjs'
import { download, cleanImage, formatBytes, readFile } from '../lib/api'

export const TOOLS = [
  { id: 'passwords', name: 'Password generator', description: 'A stronger secret, without the mental gymnastics.', icon: KeyRound, color: 'sage', category: 'Identity', label: 'CRYPTOGRAPHIC RANDOMNESS' },
  { id: 'text', name: 'Text lock', description: 'Turn a little message into something only you can open.', icon: LockKeyhole, color: 'lavender', category: 'Encryption', label: 'AES-256-GCM' },
  { id: 'notes', name: 'Private notes', description: 'Your thoughts, wrapped in a passphrase. Yours to keep.', icon: NotebookPen, color: 'sand', category: 'Encryption', label: 'LOCAL & ENCRYPTED' },
  { id: 'files', name: 'File vault', description: 'Put a private layer around the files that matter.', icon: FileLock2, color: 'blue', category: 'Encryption', label: 'ENCRYPT & DECRYPT' },
  { id: 'photos', name: 'Photo cleaner', description: 'Share the moment. Leave the location data behind.', icon: ImageOff, color: 'peach', category: 'Everyday privacy', label: 'REMOVE EXIF DATA' },
  { id: 'links', name: 'Link inspector', description: 'Take a closer look at a link before you take the leap.', icon: Link2, color: 'pink', category: 'Everyday privacy', label: 'NO LINK IS VISITED' },
  { id: 'identity', name: 'Your identity card', description: 'An easy hello, with a fingerprint that is uniquely yours.', icon: ScanFace, color: 'lavender', category: 'Identity', label: 'SHARE & VERIFY' },
  { id: 'hash', name: 'File fingerprint', description: 'Check whether two files are exactly the same.', icon: Fingerprint, color: 'sage', category: 'Identity', label: 'SHA-256 CHECKSUM' },
  { id: 'timer', name: 'Disappearing messages', description: 'Some conversations don’t need to last forever.', icon: Timer, color: 'peach', category: 'Everyday privacy', label: 'YOUR TIME, YOUR CHOICE' },
  { id: 'lock', name: 'Take a private moment', description: 'Lock your space and clear unlocked account keys.', icon: LockKeyhole, color: 'blue', category: 'Everyday privacy', label: 'SESSION LOCK' },
  { id: 'data', name: 'A lighter footprint', description: 'Keep your connections close and your data usage small.', icon: Leaf, color: 'sage', category: 'Everyday privacy', label: 'LOW-DATA CONTROLS' },
  { id: 'security', name: 'Your safety check', description: 'Understand the protections. Know the limitations.', icon: ShieldCheck, color: 'sand', category: 'Identity', label: 'NO FALSE PROMISES' },
]

export function ToolkitPage() {
  const { setModal, setPage, lock, contacts, selected } = useCipher()
  const [category, setCategory] = useState('All tools')
  const [query, setQuery] = useState('')
  const tools = TOOLS.filter(t => (category === 'All tools' || t.category === category) && `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()))
  function open(id: string) {
    if (id === 'data' || id === 'security') return setPage(id)
    if (id === 'lock') return lock()
    if (id === 'timer') return setModal({ type: 'timer', contact: contacts.find(c => c.id === selected) })
    setModal({ type: 'tool', tool: id })
  }
  return <div className="page-content toolkit-page"><div className="toolkit-hero"><div><span className="light-eyebrow"><Sparkles size={14}/> YOUR EVERYDAY PRIVACY TOOLKIT</span><h2>A little more<br/>peace of mind.</h2><p>Thoughtful tools for your digital life.<br/>Always here. Always free.</p><span className="hero-tag"><span/>12 useful tools. Zero subscriptions.</span></div><div className="toolkit-illustration"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><span className="floating-tool float-one"><KeyRound size={25}/></span><span className="floating-tool float-two"><Fingerprint size={29}/></span><span className="floating-tool float-three"><Leaf size={24}/></span><div className="hero-shield"><ShieldCheck size={74} strokeWidth={1.1}/></div><i className="spark spark-one"/><i className="spark spark-two"/></div></div>
    <div className="tools-toolbar"><div className="filter-tabs">{['All tools', 'Encryption', 'Identity', 'Everyday privacy'].map(c => <button className={category === c ? 'selected' : ''} key={c} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="small-search"><Search size={16}/><input aria-label="Search tools" placeholder="Find a tool" value={query} onChange={e => setQuery(e.target.value)}/></div></div>
    <div className="tools-grid">{tools.map(tool => <button key={tool.id} className="tool-card" onClick={() => open(tool.id)}><div className="tool-card-top"><span className={`tool-icon color-${tool.color}`}><tool.icon size={23} strokeWidth={1.5}/></span><ArrowUpRight size={17}/></div><h3>{tool.name}</h3><p>{tool.description}</p><span className="tool-label">{tool.label}</span></button>)}</div>
    {!tools.length && <EmptyState icon={Search} title="Nothing here just yet." text="Try a different word or category."/>}
    <p className="page-footnote"><LockKeyhole size={13}/>Encryption and inspection tools run on your device. No files or text are uploaded.</p>
  </div>
}

export function ToolModal({ tool, initial = '' }: { tool: string; initial?: string }) {
  const { setModal, notify, user, demo } = useCipher()
  const [mode, setMode] = useState('encrypt')
  const [text, setText] = useState(initial)
  const [passphrase, setPassphrase] = useState('')
  const [visible, setVisible] = useState(false)
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [length, setLength] = useState(24)
  const [symbols, setSymbols] = useState(true)
  const [password, setPassword] = useState(() => generatePassword())
  const [file, setFile] = useState<File | null>(null)
  const [photo, setPhoto] = useState<{ url: string; blob: Blob } | null>(null)
  const [linkResult, setLinkResult] = useState<{ host: string; protocol: string; warnings: string[]; path: string } | null>(null)
  const [qr, setQr] = useState('')
  const [fp, setFp] = useState('')
  const [compare, setCompare] = useState('')
  const definition = TOOLS.find(t => t.id === tool)!
  useEffect(() => { if (tool === 'passwords') setPassword(generatePassword(length, symbols)) }, [length, symbols, tool])
  useEffect(() => {
    if (tool !== 'identity' || !user) return
    let active = true
    void fingerprint(user.publicKey).then(value => { if (active) setFp(value) })
    void QRCode.toDataURL(JSON.stringify({ app: 'Cipher', version: 1, username: user.username, publicKey: user.publicKey }), { width: 240, margin: 2, color: { dark: '#193e35', light: '#ffffff' } }).then(url => { if (active) setQr(url) })
    return () => { active = false }
  }, [tool, user])
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); notify('Copied to your clipboard. Clear it when you’re done.') } catch { notify('Clipboard access isn’t available. Select and copy the text instead.') } }
  async function run() {
    setError(''); setBusy(true); setOutput('')
    try {
      if (tool === 'text' || tool === 'notes') {
        if (!text.trim()) throw new Error('Add some text first.')
        if (mode === 'encrypt') setOutput(await encryptVault(text, passphrase))
        else setOutput(decodeText(await decryptVault(text, passphrase)))
      } else if (tool === 'files') {
        if (!file) throw new Error('Choose a file first.')
        if (file.size > 16 * 1048576) throw new Error('Use a file under 16 MB for this local tool.')
        if (mode === 'encrypt') {
          const box = await encryptVault(new Uint8Array(await file.arrayBuffer()), passphrase)
          download(box, `${file.name}.cipher`, 'application/json')
          setOutput('Your encrypted file has been downloaded. Keep the passphrase somewhere safe.')
        } else {
          const bytes = await decryptVault(await file.text(), passphrase)
          download(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }), file.name.replace(/\.cipher$/, '') || 'decrypted-file')
          setOutput('Your decrypted file has been downloaded. It is no longer encrypted; store it carefully.')
        }
      } else if (tool === 'hash') {
        if (!file) throw new Error('Choose a file first.')
        if (file.size > 100 * 1048576) throw new Error('Use a file under 100 MB.')
        const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
        setOutput(Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''))
      } else if (tool === 'photos') {
        if (!file) throw new Error('Choose a photo first.')
        const blob = await cleanImage(file, false)
        setPhoto({ url: await readFile(blob), blob })
      } else if (tool === 'links') {
        const url = new URL(text)
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use a complete HTTP or HTTPS link.')
        const warnings = []
        if (url.protocol !== 'https:') warnings.push('This link is not HTTPS. Traffic may be readable in transit.')
        if (url.username || url.password) warnings.push('This URL contains embedded credentials, which can disguise its destination.')
        if (url.hostname.includes('xn--')) warnings.push('This internationalized domain uses punycode. Check for lookalike characters.')
        if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) warnings.push('The destination is an IP address, not a named domain.')
        if (url.port && !['443', '80'].includes(url.port)) warnings.push('The destination uses an unusual port.')
        if (url.hash || url.search) warnings.push('This link contains parameters or a fragment. These can contain tracking or private data.')
        setLinkResult({ host: url.hostname, protocol: url.protocol, path: `${url.pathname}${url.search ? '?…' : ''}`, warnings })
      }
    } catch (e) { setError((e as Error).name === 'OperationError' ? 'Could not decrypt. Check the passphrase and make sure the data is unmodified.' : (e as Error).message) }
    finally { setBusy(false) }
  }
  function selectFile(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] || null); setOutput(''); setPhoto(null); setError('') }
  const isEncryption = ['text', 'notes', 'files'].includes(tool)
  return <Modal title={definition?.name || 'Your privacy tool'} eyebrow="LITTLE TOOLS. REAL PEACE OF MIND." onClose={() => setModal(null)}>
    <p className="modal-description">{definition?.description}</p><div className="local-badge"><LockKeyhole size={12}/>Runs on your device. Nothing is uploaded.</div>
    {tool === 'passwords' && <div className="tool-form"><div className="password-result"><code>{password}</code><IconButton icon={Copy} label="Copy password" onClick={() => void copy(password)}/></div><div className="range-label"><label htmlFor="password-length">Password length</label><strong>{length} characters</strong></div><input id="password-length" type="range" min={16} max={64} value={length} onChange={e => setLength(Number(e.target.value))}/><div className="tool-setting"><span>Include symbols <small>! @ # $ % & *</small></span><Toggle checked={symbols} label="Include password symbols" onChange={() => setSymbols(v => !v)}/></div><p className="tool-tip"><ShieldCheck size={17}/>Generated with cryptographic randomness, not predictable patterns. Use a different password for every account.</p><button className="button primary full" onClick={() => setPassword(generatePassword(length, symbols))}><RefreshCw size={16}/>Generate another password</button></div>}
    {isEncryption && <><div className="segmented"><button className={mode === 'encrypt' ? 'selected' : ''} onClick={() => { setMode('encrypt'); setOutput(''); setError('') }}><LockKeyhole size={14}/>Encrypt</button><button className={mode === 'decrypt' ? 'selected' : ''} onClick={() => { setMode('decrypt'); setOutput(''); setError('') }}><KeyRound size={14}/>Decrypt</button></div><div className="tool-form">{tool !== 'files' && <label>{mode === 'encrypt' ? tool === 'notes' ? 'Your private note' : 'Your message' : 'Encrypted vault data'}<textarea aria-label={mode === 'encrypt' ? tool === 'notes' ? 'Your private note' : 'Your message' : 'Encrypted vault data'} rows={5} placeholder={mode === 'encrypt' ? 'A thought worth keeping to yourself…' : 'Paste the complete Cipher vault JSON here…'} value={text} maxLength={200000} onChange={e => setText(e.target.value)}/></label>}{tool === 'files' && <label className="upload-zone"><Upload size={28}/><strong>{file ? file.name : mode === 'encrypt' ? 'Choose a file to protect' : 'Choose a .cipher file'}</strong><span>{file ? formatBytes(file.size) : 'Up to 16 MB · processed on this device'}</span><input type="file" onChange={selectFile}/></label>}<label>Passphrase<div className="password-field"><input aria-label="Passphrase" type={visible ? 'text' : 'password'} value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder={mode === 'encrypt' ? 'At least 12 characters — keep it safe' : 'The original passphrase'} autoComplete="off"/><button onClick={() => setVisible(v => !v)} aria-label="Toggle passphrase visibility">{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label><p className="tiny muted">AES-256-GCM · PBKDF2-SHA256, 600,000 iterations. There is no recovery if you lose your passphrase. This tool has not been independently audited.</p></div></>}
    {['photos', 'hash'].includes(tool) && <div className="tool-form"><label className="upload-zone"><Upload size={28}/><strong>{file?.name || (tool === 'photos' ? 'Choose a photo' : 'Choose a file')}</strong><span>{file ? formatBytes(file.size) : tool === 'photos' ? 'JPG, PNG, or WebP · up to 15 MB' : 'Any file · up to 100 MB'}</span><input type="file" accept={tool === 'photos' ? 'image/jpeg,image/png,image/webp' : undefined} onChange={selectFile}/></label>{tool === 'photos' && <p className="tiny muted">Re-encodes your image as a JPEG to discard embedded EXIF metadata, including GPS. Visible landmarks, faces, and the filename can still reveal information. Images are resized to a maximum of 1920 pixels.</p>}</div>}
    {tool === 'links' && <div className="tool-form"><label>Link to inspect<input type="url" placeholder="https://example.com/a-little-something" value={text} onChange={e => { setText(e.target.value); setLinkResult(null) }}/></label><p className="tiny muted">A local syntax check, not a malware scan. Cipher will not open this link or contact its destination.</p>{linkResult && <div className="link-result"><span className="eyebrow">ACTUAL DESTINATION</span><strong>{linkResult.host}</strong><code>{linkResult.protocol}//{linkResult.host}{linkResult.path}</code>{linkResult.warnings.length ? linkResult.warnings.map(w => <p key={w}><AlertTriangle size={15}/>{w}</p>) : <p><Check size={15}/>No obvious structural warning signs. This does not mean the site is safe.</p>}</div>}</div>}
    {tool === 'identity' && (demo ? <EmptyState icon={Fingerprint} title="An identity that’s really yours." text="Demo profiles don’t have cryptographic identities. Create a free account to generate your key and share your fingerprint."><button className="button primary" onClick={() => setModal({ type: 'auth', tab: 'signup' })}>Create an account <ArrowUpRight size={15}/></button></EmptyState> : <div className="identity-tool"><div className="qr-frame">{qr ? <img src={qr} alt="Your Cipher public identity QR code"/> : <LoaderCircle className="spin"/>}</div><h3>{user?.name}</h3><span>@{user?.username}</span><label>YOUR PUBLIC KEY FINGERPRINT</label><code>{fp}</code><p className="tiny muted">Share this public identity card with your contact through a trusted channel. Compare the entire fingerprint in person or over a verified call. Never share your passphrase.</p><div className="button-row"><button className="button secondary" onClick={() => void copy(`Cipher @${user?.username}\nFingerprint: ${fp}\nPublic key: ${user?.publicKey}`)}><Copy size={15}/>Copy identity</button><button className="button primary" onClick={() => { void fetch(qr).then(r => r.blob()).then(blob => download(blob, `cipher-${user?.username}.png`)) }}><Download size={15}/>Save QR card</button></div></div>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    {output && <div className="tool-output"><div><strong>{tool === 'hash' ? 'SHA-256 fingerprint' : mode === 'decrypt' ? 'Decrypted result' : 'Your result'}</strong>{tool !== 'files' && <IconButton icon={Copy} label="Copy result" onClick={() => void copy(output)}/>}</div>{tool === 'files' ? <p><Check size={16}/>{output}</p> : <textarea readOnly rows={tool === 'hash' ? 2 : 4} value={output} aria-label="Tool result"/>}{tool === 'hash' && <label>Compare with an expected SHA-256 hash<input placeholder="Paste a fingerprint to compare" value={compare} onChange={e => setCompare(e.target.value)}/>{compare && <span className={`compare-result ${compare.trim().toLowerCase() === output ? 'match' : 'mismatch'}`}>{compare.trim().toLowerCase() === output ? <><Check size={14}/>Exact match</> : <><X size={14}/>The fingerprints don’t match</>}</span>}</label>}{['notes', 'text'].includes(tool) && <button className="button secondary full" onClick={() => download(output, mode === 'encrypt' ? 'private-note.cipher' : 'decrypted-note.txt')}><Download size={15}/>Download {mode === 'encrypt' ? 'encrypted' : 'decrypted'} note</button>}</div>}
    {photo && <div className="photo-result"><img src={photo.url} alt="Cleaned photo preview"/><div><strong>Metadata removed.</strong><span>{formatBytes(file?.size || 0)} → {formatBytes(photo.blob.size)}</span></div><button className="button primary full" onClick={() => download(photo.blob, 'clean-photo.jpg')}><Download size={16}/>Download cleaned photo</button></div>}
    {!['passwords', 'identity'].includes(tool) && <button className="button primary full tool-run" disabled={busy} onClick={() => void run()}>{busy ? <LoaderCircle className="spin" size={17}/> : tool === 'links' ? <Search size={16}/> : tool === 'hash' ? <Fingerprint size={16}/> : tool === 'photos' ? <ImageOff size={16}/> : <LockKeyhole size={16}/>} {busy ? 'Working, right here on your device…' : tool === 'links' ? 'Inspect this link' : tool === 'hash' ? 'Calculate fingerprint' : tool === 'photos' ? 'Remove photo metadata' : `${mode === 'encrypt' ? 'Encrypt' : 'Decrypt'} ${tool === 'files' ? 'file' : tool === 'notes' ? 'note' : 'text'}`}</button>}
  </Modal>
}
