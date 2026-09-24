import { useEffect, useRef, type ReactNode } from 'react'
import { X, Check, Users, type LucideIcon } from 'lucide-react'
import type { Contact } from '../lib/types'

export function Logo({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'small' : ''}`}><span className="brand-mark"><svg viewBox="0 0 36 36" fill="none"><path d="M27 9H14a8 8 0 0 0-8 8v12l6-4h11a8 8 0 0 0 8-8v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="m15 15 4 4L29 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>{!small && <span>cipher<span className="brand-dot">.</span></span>}</div>
}
export function Avatar({ contact, size = 'medium', online = false }: { contact: Pick<Contact, 'name' | 'color' | 'avatar' | 'group'>; size?: 'tiny' | 'small' | 'medium' | 'large' | 'xl'; online?: boolean }) {
  const initials = contact.name.split(' ').slice(0, 2).map(n => n[0]).join('')
  return <span className={`avatar avatar-${size} color-${contact.color}`}>
    {contact.avatar ? <img src={contact.avatar} alt="" /> : contact.group ? <Users size={size === 'xl' ? 32 : 21} strokeWidth={1.7} /> : <span>{initials}</span>}
    {online && <i className="presence-dot" />}
  </span>
}
export function IconButton({ icon: Icon, label, onClick, className = '', active = false, disabled = false, children }: { icon: LucideIcon; label: string; onClick?: () => void; className?: string; active?: boolean; disabled?: boolean; children?: ReactNode }) {
  return <button type="button" className={`icon-button ${active ? 'active' : ''} ${className}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}><Icon size={19} strokeWidth={1.7} />{children}</button>
}
export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} disabled={disabled} className={`toggle ${checked ? 'checked' : ''}`}><span>{checked && <Check size={10} strokeWidth={3} />}</span></button>
}
export function Modal({ children, title, eyebrow, onClose, wide = false }: { children: ReactNode; title: string; eyebrow?: string; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose); closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    const timeout = setTimeout(() => ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus(), 60)
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]')
        if (!nodes?.length) return
        const first = nodes[0], last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handle)
    return () => { clearTimeout(timeout); document.removeEventListener('keydown', handle); previous?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className={`modal ${wide ? 'modal-wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div><IconButton icon={X} label="Close dialog" onClick={onClose} /></div>{children}
  </div></div>
}
export function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={32} strokeWidth={1.4} /></span><h2>{title}</h2><p>{text}</p>{children}</div>
}
export function SettingRow({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children: ReactNode }) {
  return <div className="setting-row"><span className="setting-icon"><Icon size={19} strokeWidth={1.7} /></span><div><strong>{title}</strong>{text && <p>{text}</p>}</div><span className="setting-control">{children}</span></div>
}
