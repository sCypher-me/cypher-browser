import type { ReactNode } from 'react';
import type { Palette } from 'lucide-react';

export function Switch({ checked, label, onChange, disabled = false }: { checked: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return <button type="button" className={`sc-switch ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}><span /></button>;
}

export function Row({ id, title, detail, children }: { id?: string; title: string; detail?: string; children: ReactNode }) {
  return <div id={id} className="sc-row"><div className="sc-row-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</div><div className="sc-row-control">{children}</div></div>;
}

export function Panel({ id, eyebrow, title, detail, icon: Icon, children }: { id?: string; eyebrow?: string; title: string; detail?: string; icon: typeof Palette; children: ReactNode }) {
  return <section id={id} className="sc-panel"><div className="sc-panel-heading"><span className="sc-panel-icon"><Icon size={17} /></span><div><span className="sc-eyebrow">{eyebrow || 'PREFERÊNCIA'}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div></div><div className="sc-panel-content">{children}</div></section>;
}
