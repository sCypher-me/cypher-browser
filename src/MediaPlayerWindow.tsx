import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Music2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import type { BrowserState, NowPlaying } from './types';
import './media-player.css';

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2,'0')}`;
};
const host = (address: string) => { try { return new URL(address).hostname; } catch { return address; } };

export default function MediaPlayerWindow() {
  const [state, setState] = useState<BrowserState | null>(null);
  const [localPosition, setLocalPosition] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);
  const [tint, setTint] = useState('');
  const audio = useRef<HTMLAudioElement>(null);
  const settings = state?.settings;
  const media: NowPlaying | null = state?.nowPlaying || null;
  const pageIsPlaying = !!media?.playing;
  const backgroundSelected = !!settings?.backgroundMusicData && !pageIsPlaying && (!!settings.backgroundMusicEnabled || !media);
  const playingTitle = backgroundSelected ? settings?.backgroundMusicName || 'Música de fundo' : media?.title || '';
  const playingArtist = backgroundSelected ? 'Faixa local do Cypher' : media?.artist || host(media?.pageUrl || '');
  const playing = backgroundSelected ? !!settings?.backgroundMusicEnabled : pageIsPlaying;
  const artwork = !backgroundSelected ? media?.artwork || '' : '';
  const duration = backgroundSelected ? localDuration : media?.duration || 0;
  const position = backgroundSelected ? localPosition : media?.currentTime || 0;
  const accent = settings?.accent || '#b6f36a';

  async function command(action: string, payload?: unknown) {
    try { return await window.cypher.invoke(action, payload); } catch { return undefined; }
  }

  useEffect(() => {
    if (!window.cypher) return;
    const off = window.cypher.onState(setState);
    void window.cypher.invoke('state').then(setState).catch(() => {});
    return off;
  }, []);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.pause();
    element.src = settings?.backgroundMusicData || '';
    element.loop = true;
    element.load();
    setLocalPosition(0);
    setLocalDuration(0);
    if (settings?.backgroundMusicEnabled) void element.play().catch(() => void command('media:background:set', { enabled:false }));
  }, [settings?.backgroundMusicData]);

  useEffect(() => {
    const element = audio.current;
    if (!element || !settings?.backgroundMusicData) return;
    if (settings.backgroundMusicEnabled && !pageIsPlaying) void element.play().catch(() => void command('media:background:set', { enabled:false }));
    else element.pause();
  }, [settings?.backgroundMusicEnabled, pageIsPlaying, settings?.backgroundMusicData]);

  useEffect(() => {
    if (!pageIsPlaying || !settings?.backgroundMusicEnabled) return;
    audio.current?.pause();
    void command('media:background:set', { enabled:false });
  }, [pageIsPlaying, settings?.backgroundMusicEnabled]);

  useEffect(() => {
    if (!artwork) { setTint(''); return; }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
        const context = canvas.getContext('2d', { willReadFrequently:true });
        if (!context) return;
        context.drawImage(image,0,0,8,8);
        const data = context.getImageData(0,0,8,8).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 30) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
        if (count) setTint(`rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`);
      } catch { setTint(''); }
    };
    image.onerror = () => { if (!cancelled) setTint(''); };
    image.src = artwork;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [artwork]);

  async function togglePlayback() {
    if (backgroundSelected || !media) {
      const element = audio.current;
      if (!settings?.backgroundMusicData || !element) {
        await command('media:window:close');
        await command('navigate', 'cypher://settings');
        return;
      }
      if (element.paused) {
        try { await element.play(); await command('media:background:set', { enabled:true }); }
        catch { await command('media:background:set', { enabled:false }); }
      } else { element.pause(); await command('media:background:set', { enabled:false }); }
      return;
    }
    await command('media:control', { tabId:media.tabId, action:pageIsPlaying ? 'pause' : 'play' });
  }

  async function playBackgroundMusic() {
    const element = audio.current;
    if (!settings?.backgroundMusicData || !element) {
      await command('media:window:close');
      await command('navigate', 'cypher://settings');
      return;
    }
    try { await element.play(); await command('media:background:set', { enabled:true }); }
    catch { await command('media:background:set', { enabled:false }); }
  }

  function seek(value: number) {
    if (backgroundSelected && audio.current) { audio.current.currentTime = value; setLocalPosition(value); }
    else if (media) void command('media:control', { tabId:media.tabId, action:'seek', value });
  }

  const playerStyle = { '--player-tint':tint || accent } as CSSProperties;
  return <main className="mini-player-window" style={playerStyle}>
    <section className="mini-player-card" aria-label="Miniplayer do Cypher">
      <header className="mini-player-header"><span><Music2 size={14}/> REPRODUÇÃO</span><div className="mini-player-header-actions">{!backgroundSelected && media && <button type="button" className="mini-player-open" aria-label="Abrir a aba em reprodução" title="Abrir a aba em reprodução" onClick={() => void command('media:window:show-tab',media.tabId)}><ArrowUpRight size={15}/></button>}<button type="button" className="mini-player-close" aria-label="Fechar miniplayer" title="Fechar" onClick={() => void command('media:window:close')}><X size={17}/></button></div></header>
      {playingTitle ? <>
        <div className="mini-player-main">
          <div className="mini-player-art">{artwork ? <img src={artwork} alt="Capa do áudio"/> : <Music2 size={26}/>}</div>
          <div className="mini-player-track"><strong title={playingTitle}>{playingTitle}</strong><span title={playingArtist}>{playingArtist}</span><small title={backgroundSelected ? 'Faixa local do Cypher' : `${media?.tabTitle || 'Aba do navegador'} · ${host(media?.pageUrl || '')}`}>{backgroundSelected ? 'Faixa local do Cypher' : `${media?.tabTitle || 'Aba do navegador'} · ${host(media?.pageUrl || '')}`}</small></div>
          <div className="mini-player-progress"><input type="range" aria-label="Posição da reprodução" min="0" max={Math.max(1,duration)} step="1" value={Math.min(position,duration || position)} disabled={!duration} onChange={event => seek(Number(event.target.value))}/><div><span>{formatTime(position)}</span><span>{duration ? formatTime(duration) : '—:—'}</span></div></div>
          <div className="mini-player-controls"><button type="button" aria-label="Voltar 10 segundos" title="Voltar 10 segundos" disabled={backgroundSelected || !media} onClick={() => media && void command('media:control', { tabId:media.tabId, action:'seek-back' })}><SkipBack size={16}/></button><button type="button" className="mini-player-play" aria-label={playing ? 'Pausar' : 'Reproduzir'} title={playing ? 'Pausar' : 'Reproduzir'} onClick={() => void togglePlayback()}>{playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button><button type="button" aria-label="Avançar 10 segundos" title="Avançar 10 segundos" disabled={backgroundSelected || !media} onClick={() => media && void command('media:control', { tabId:media.tabId, action:'seek-forward' })}><SkipForward size={16}/></button></div>
        </div>
        {!settings?.backgroundMusicEnabled && settings?.backgroundMusicData && !backgroundSelected && <button type="button" className="mini-player-background-option" onClick={() => void playBackgroundMusic()}>Reproduzir música de fundo</button>}
      </> : <div className="mini-player-empty"><Music2 size={25}/><strong>Nada está tocando</strong><span>Quando uma aba começar a reproduzir áudio ou vídeo, os controles aparecerão aqui.</span><button type="button" onClick={() => void togglePlayback()}>Escolher música de fundo</button></div>}
      <audio ref={audio} preload="none" aria-hidden="true" onTimeUpdate={event => setLocalPosition(event.currentTarget.currentTime)} onLoadedMetadata={event => setLocalDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} />
    </section>
  </main>;
}
