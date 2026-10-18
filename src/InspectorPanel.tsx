import { MousePointerClick, Pipette, Undo2, X } from 'lucide-react';
import type { Settings } from './types';
import { Switch } from './settings-ui';
import { TokenControls, ToolbarArrangement } from './CustomizationSettings';

export type InspectTarget = 'address' | 'toolbar' | 'tabs' | 'rail' | 'page' | 'brand' | 'routes';
const targetInfo: Record<InspectTarget, { title: string; id: string; detail: string }> = {
  address: { title: 'Barra de endereço', id: 'cypher.chrome.address', detail: 'Forma, altura e posição da barra.' },
  toolbar: { title: 'Barra de ferramentas', id: 'cypher.chrome.toolbar', detail: 'Ordem, visibilidade e posição de cada botão.' },
  routes: { title: 'Rotas de conexão', id: 'cypher.chrome.routes', detail: 'Os seletores Normal, Tor e I2P.' },
  tabs: { title: 'Abas', id: 'cypher.chrome.tabs', detail: 'Disposição, largura e comportamento das abas.' },
  rail: { title: 'Trilho de atalhos', id: 'cypher.chrome.rail', detail: 'A coluna de ícones à esquerda.' },
  page: { title: 'Área da página', id: 'cypher.chrome.page', detail: 'Cores, cortes e bordas que emolduram a página.' },
  brand: { title: 'Identidade', id: 'cypher.chrome.brand', detail: 'Pele, cores e tipografia do navegador.' },
};
const swatches = ['#ff5436', '#c6f36e', '#5aa9ff', '#ffbf1f', '#c4b3ff', '#3ddc84', '#ff7ab6'];

export default function InspectorPanel({ settings: s, target, canUndo, onSettings, onUndo, onClose, onSiteColor }: { settings: Settings; target: InspectTarget | null; canUndo: boolean; onSettings: (patch: Partial<Settings>) => void; onUndo: () => void; onClose: () => void; onSiteColor: () => void }) {
  const info = target ? targetInfo[target] : null;
  const segment = <T extends string>(label: string, value: T, options: Array<[T, string]>, apply: (value: T) => void) => <div className="ins-field"><span>{label}</span><div className="cz-segment" role="group" aria-label={label}>{options.map(([option, text]) => <button type="button" key={option} aria-pressed={value === option} className={value === option ? 'chosen' : ''} onClick={() => apply(option)}>{text}</button>)}</div></div>;
  const toggle = (label: string, checked: boolean, apply: () => void) => <div className="ins-field ins-toggle"><span>{label}</span><Switch checked={checked} label={label} onChange={apply}/></div>;
  const colors = <div className="ins-field"><span>Cor de destaque</span><div className="ins-swatches">{swatches.map(color => <button type="button" key={color} aria-label={`Usar ${color}`} className={s.accent.toLowerCase() === color ? 'chosen' : ''} style={{ background: color }} onClick={() => onSettings({ accent: color })}/>)}<label className="ins-custom-color" title="Outra cor"><input type="color" aria-label="Escolher outra cor" value={s.accent} onChange={event => onSettings({ accent: event.target.value })}/>+</label></div><button type="button" className="ins-link" onClick={onSiteColor}><Pipette size={13}/> Usar a cor do site aberto</button></div>;
  return <aside className="inspector-panel" aria-label="Inspetor da interface">
    <header><div><span className="eyebrow">INSPETOR</span><strong>{info ? info.title : 'Clique em qualquer parte'}</strong>{info && <small>{info.id}</small>}</div><button type="button" className="cz-icon" aria-label="Fechar inspetor" onClick={onClose}><X size={16}/></button></header>
    <div className="ins-body">
      {!info && <div className="ins-empty"><MousePointerClick size={28}/><p>Passe o ponteiro pela interface e clique na peça que você quer mudar: barra, abas, trilho, área da página ou o logo.</p></div>}
      {info && <p className="ins-detail">{info.detail}</p>}
      {target === 'address' && <>
        <TokenControls settings={s} onSettings={onSettings} only={['cut', 'barHeight']}/>
        {segment('Posição', s.toolbarPosition, [['top', 'Topo'], ['bottom', 'Base']], toolbarPosition => onSettings({ toolbarPosition }))}
      </>}
      {target === 'toolbar' && <>
        {segment('Posição', s.toolbarPosition, [['top', 'Topo'], ['bottom', 'Base']], toolbarPosition => onSettings({ toolbarPosition }))}
        <ToolbarArrangement settings={s} onSettings={onSettings}/>
      </>}
      {target === 'routes' && <>
        {toggle('Mostrar seletor de rotas', !s.toolbarHidden.includes('routes'), () => onSettings({ toolbarHidden: s.toolbarHidden.includes('routes') ? s.toolbarHidden.filter(item => item !== 'routes') : [...s.toolbarHidden, 'routes'] }))}
        <p className="ins-detail">Para abrir sites específicos sempre pelo Tor ou I2P, use Configurações → Conexões → Rota por site.</p>
      </>}
      {target === 'tabs' && <>
        {segment('Disposição', s.tabPosition, [['side', 'Lateral'], ['top', 'Topo']], tabPosition => onSettings({ tabPosition }))}
        {toggle('Abas ocultas', s.tabsAutoHide, () => onSettings({ tabsAutoHide: !s.tabsAutoHide }))}
        {toggle('Coluna compacta', s.compact, () => onSettings({ compact: !s.compact }))}
        <label className="cz-range"><span>Largura da coluna<output>{s.sidebarWidth} px</output></span><input type="range" min={210} max={360} step={2} value={s.sidebarWidth} onChange={event => onSettings({ sidebarWidth: Number(event.target.value) })}/></label>
        <TokenControls settings={s} onSettings={onSettings} only={['density']}/>
      </>}
      {target === 'rail' && <>
        {toggle('Mostrar trilho', s.showRail, () => onSettings({ showRail: !s.showRail }))}
        <p className="ins-detail">Sem o trilho, Home, Favoritos e as páginas internas continuam na paleta (Ctrl Shift A) e no menu.</p>
      </>}
      {target === 'page' && <>
        {colors}
        <TokenControls settings={s} onSettings={onSettings} only={['cut', 'borderWidth']}/>
        {toggle('Cor do espaço como destaque', s.workspaceAccent, () => onSettings({ workspaceAccent: !s.workspaceAccent }))}
      </>}
      {target === 'brand' && <>
        {segment('Pele', s.skin, [['recorte', 'Recorte'], ['classic', 'Clássico']], skin => onSettings({ skin }))}
        {segment('Modo', s.appearanceMode, [['dark', 'Escuro'], ['light', 'Claro'], ['system', 'Sistema']], appearanceMode => onSettings({ appearanceMode }))}
        {colors}
        <TokenControls settings={s} onSettings={onSettings} only={['displayFont', 'bodyFont']}/>
      </>}
    </div>
    <footer><button type="button" className="button secondary" disabled={!canUndo} onClick={onUndo}><Undo2 size={14}/> Desfazer</button><button type="button" className="button primary" onClick={onClose}>Concluir</button></footer>
  </aside>;
}
