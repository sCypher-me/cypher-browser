import { useEffect, useState } from 'react';
import { Bug, Copy, ExternalLink, Trash2 } from 'lucide-react';
import type { Settings } from './types';
import { Panel, Row, Switch } from './settings-ui';

type ErrorReport = { id: string; kind: string; message: string; stack: string; detail: string; count: number; firstSeen: number; lastSeen: number; version: string; platform: string; sent: boolean };

const kindLabel: Record<string, string> = {
  main: 'Processo principal', promise: 'Tarefa interna', renderer: 'Interface', interface: 'Interface',
  'page-crash': 'Página encerrada', 'process-crash': 'Processo encerrado',
};

export function DiagnosticsPanel({ settings, command, onSettings }: { settings: Settings; command: (action: string, payload?: unknown) => Promise<any>; onSettings: (patch: Partial<Settings>) => void }) {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [open, setOpen] = useState('');
  const refresh = () => void command('diagnostics:list').then(result => { if (result) { setReports(result.reports || []); setCanSend(result.canSend === true); } });
  useEffect(refresh, [settings.sendErrorReports]);

  const copy = (report: ErrorReport) => void command('clipboard:write', `${report.message}\n${report.stack}`.slice(0, 8000));
  const destination = canSend ? 'enviados automaticamente para a equipe do Cypher' : 'guardados neste computador para você enviar quando quiser';

  return <Panel id="privacy-error-reports" eyebrow="MELHORIAS" title="Relatórios de erro" detail={`Quando ativado, falhas do Cypher são registradas sem endereços de sites, nomes de usuário, e-mails ou arquivos pessoais, e ficam ${destination}.`} icon={Bug}>
    <Row id="privacy-error-reports-toggle" title="Enviar relatórios de erro" detail="Ajuda a encontrar e corrigir falhas. Você pode desligar quando quiser.">
      <Switch label="Enviar relatórios de erro" checked={settings.sendErrorReports} onChange={() => onSettings({ sendErrorReports: !settings.sendErrorReports })}/>
    </Row>
    {reports.length === 0
      ? <div className="sc-info-strip"><Bug size={16}/><span>{settings.sendErrorReports ? 'Nenhum erro registrado até agora.' : 'Os relatórios estão desligados; nada é registrado.'}</span></div>
      : <>
        {reports.slice(0, 12).map(report => <div key={report.id} className="sc-diagnostic">
          <button type="button" className="sc-diagnostic-head" aria-expanded={open === report.id} onClick={() => setOpen(open === report.id ? '' : report.id)}>
            <span className="sc-diagnostic-kind">{kindLabel[report.kind] || report.kind}</span>
            <strong>{report.message}</strong>
            <small>{report.count > 1 ? `${report.count}× · ` : ''}{new Date(report.lastSeen).toLocaleString('pt-BR')}{report.sent ? ' · enviado' : ''}</small>
          </button>
          {open === report.id && <div className="sc-diagnostic-body">
            <pre>{[report.detail, report.stack].filter(Boolean).join('\n') || 'Sem rastreamento técnico.'}</pre>
            <div className="sc-action-row">
              <button className="sc-button sc-button-subtle" onClick={() => copy(report)}><Copy size={14}/>Copiar</button>
              <button className="sc-button sc-button-subtle" onClick={() => void command('diagnostics:issue', report.id)}><ExternalLink size={14}/>Relatar no GitHub</button>
            </div>
          </div>}
        </div>)}
        <div className="sc-action-row"><button className="sc-button sc-button-subtle" onClick={() => void command('diagnostics:clear').then(refresh)}><Trash2 size={14}/>Apagar relatórios</button></div>
      </>}
  </Panel>;
}
