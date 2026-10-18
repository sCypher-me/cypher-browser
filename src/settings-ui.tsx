import type { ReactNode } from 'react';
import type { Palette } from 'lucide-react';

const slug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function Switch({ checked, label, onChange, disabled = false }: { checked: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return <button type="button" className={`sc-switch ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}><span /></button>;
}

export function Row({ id, title, detail, children }: { id?: string; title: string; detail?: string; children: ReactNode }) {
  return <div id={id} className="sc-row"><div className="sc-row-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</div><div className="sc-row-control">{children}</div></div>;
}

/** Um bloco da Central. O título também alimenta o sumário lateral da seção. */
export function Panel({ id, eyebrow, title, detail, icon: Icon, wide = false, children }: { id?: string; eyebrow?: string; title: string; detail?: string; icon: typeof Palette; wide?: boolean; children: ReactNode }) {
  return <section id={id || `panel-${slug(title)}`} data-toc={title} className={`sc-panel ${wide ? 'sc-wide' : ''}`}>
    <div className="sc-panel-heading"><span className="sc-panel-icon"><Icon size={15} /></span><div>{eyebrow && <span className="sc-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{detail && <p>{detail}</p>}</div></div>
    <div className="sc-panel-content">{children}</div>
  </section>;
}

/** Envolve componentes que já trazem o próprio cabeçalho, para entrarem na grade e no sumário. */
export function Block({ id, title, wide = false, children }: { id: string; title: string; wide?: boolean; children: ReactNode }) {
  return <section id={id} data-toc={title} className={`sc-panel sc-block ${wide ? 'sc-wide' : ''}`}>{children}</section>;
}
