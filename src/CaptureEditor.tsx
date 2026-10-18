import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Copy, Download, Highlighter, PenLine, Square, Undo2, X } from 'lucide-react';

type Tool = 'pen' | 'marker' | 'box';
type Stroke = { tool: Tool; color: string; points: Array<[number, number]> };
const colors = ['#ff5436', '#ffbf1f', '#3ddc84', '#5aa9ff', '#ffffff', '#111111'];

export default function CaptureEditor({ image, onClose, command, notify }: { image: string; onClose: () => void; command: (action: string, payload?: unknown) => Promise<any>; notify: (message: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null), imageRef = useRef<HTMLImageElement | null>(null), drawing = useRef<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(colors[0]);
  const [busy, setBusy] = useState(false);
  function paint(list: Stroke[]) {
    const canvas = canvasRef.current, base = imageRef.current; if (!canvas || !base) return;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(base, 0, 0);
    for (const stroke of list) {
      context.save(); context.strokeStyle = stroke.color; context.lineCap = 'round'; context.lineJoin = 'round';
      const scale = canvas.width / 1400;
      if (stroke.tool === 'box' && stroke.points.length > 1) {
        const [[x1, y1], [x2, y2]] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
        context.lineWidth = 4 * Math.max(1, scale); context.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      } else {
        context.globalAlpha = stroke.tool === 'marker' ? 0.35 : 1; context.lineWidth = (stroke.tool === 'marker' ? 22 : 4) * Math.max(1, scale);
        context.beginPath(); stroke.points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y)); context.stroke();
      }
      context.restore();
    }
  }
  useEffect(() => {
    const base = new Image();
    base.onload = () => { imageRef.current = base; const canvas = canvasRef.current; if (!canvas) return; canvas.width = base.naturalWidth; canvas.height = base.naturalHeight; paint([]); };
    base.src = image;
  }, [image]);
  useEffect(() => paint(strokes), [strokes]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); setStrokes(list => list.slice(0, -1)); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const point = (event: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current!, rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height];
  };
  async function exported(action: 'clipboard:image' | 'capture:save') {
    const canvas = canvasRef.current; if (!canvas) return;
    setBusy(true);
    try { const ok = await command(action, canvas.toDataURL('image/png')); if (ok) notify(action === 'clipboard:image' ? 'Captura copiada para a área de transferência.' : 'Captura salva.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível exportar a captura.'); }
    finally { setBusy(false); }
  }
  return <div className="capture-screen" role="dialog" aria-modal="true" aria-label="Captura de tela">
    <div className="capture-toolbar">
      <span className="eyebrow">CAPTURA</span>
      <div className="cz-segment" role="group" aria-label="Ferramenta">
        {([['pen', PenLine, 'Caneta'], ['marker', Highlighter, 'Marca-texto'], ['box', Square, 'Retângulo']] as const).map(([value, Icon, label]) => <button type="button" key={value} aria-pressed={tool === value} className={tool === value ? 'chosen' : ''} title={label} aria-label={label} onClick={() => setTool(value)}><Icon size={15}/></button>)}
      </div>
      <div className="capture-colors" role="group" aria-label="Cor">{colors.map(value => <button type="button" key={value} aria-label={`Cor ${value}`} aria-pressed={color === value} className={color === value ? 'chosen' : ''} style={{ background: value }} onClick={() => setColor(value)}/>)}</div>
      <button type="button" className="cz-icon" aria-label="Desfazer traço" disabled={!strokes.length} onClick={() => setStrokes(list => list.slice(0, -1))}><Undo2 size={16}/></button>
      <div className="capture-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={() => void exported('clipboard:image')}><Copy size={14}/> Copiar</button>
        <button type="button" className="button primary" disabled={busy} onClick={() => void exported('capture:save')}><Download size={14}/> Salvar PNG</button>
        <button type="button" className="cz-icon" aria-label="Fechar captura" onClick={onClose}><X size={18}/></button>
      </div>
    </div>
    <div className="capture-stage">
      <canvas ref={canvasRef} className={`capture-canvas tool-${tool}`}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drawing.current = { tool, color, points: [point(event)] }; }}
        onPointerMove={event => { if (!drawing.current) return; const next = point(event); drawing.current = { ...drawing.current, points: drawing.current.tool === 'box' ? [drawing.current.points[0], next] : [...drawing.current.points, next] }; paint([...strokes, drawing.current]); }}
        onPointerUp={() => { if (drawing.current && drawing.current.points.length > 1) { const finished = drawing.current; setStrokes(list => [...list, finished]); } drawing.current = null; }}/>
    </div>
  </div>;
}
