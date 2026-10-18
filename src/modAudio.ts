import { useEffect, useRef } from 'react';
import type { ModEffects } from './types';

type SoundKey = 'click' | 'hover' | 'tabOpen' | 'tabClose' | 'typing' | 'navigate';

/** Plays a mod's interface sounds and its two-layer reactive music. */
export function useModAudio({ effects, soundVolume, musicVolume, tabCount, activeUrl, pageMediaPlaying }: { effects?: ModEffects; soundVolume: number; musicVolume: number; tabCount: number; activeUrl: string; pageMediaPlaying: boolean }) {
  const sounds = effects?.sounds || null, music = effects?.music || null;
  const soundsRef = useRef(sounds); soundsRef.current = sounds;
  const volumeRef = useRef(soundVolume); volumeRef.current = soundVolume;
  const activity = useRef(0);
  const play = (key: SoundKey) => {
    const url = soundsRef.current?.files[key];
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volumeRef.current * (soundsRef.current?.volume ?? 0.6) * (key === 'hover' ? 0.5 : 1)));
    void audio.play().catch(() => {});
  };
  const bump = (amount: number) => { activity.current = Math.min(1, activity.current + amount); };

  useEffect(() => {
    let lastHover: Element | null = null, lastHoverAt = 0, lastTypeAt = 0;
    const onClick = (event: MouseEvent) => { bump(0.25); const target = event.target instanceof Element ? event.target.closest('button,[role="button"],a,.tab') : null; if (target && !target.hasAttribute('disabled')) play('click'); };
    const onOver = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button,[role="button"],a') : null;
      if (!target || target === lastHover || Date.now() - lastHoverAt < 90) return;
      lastHover = target; lastHoverAt = Date.now(); play('hover');
    };
    const onKey = (event: KeyboardEvent) => {
      bump(0.12);
      const editable = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(event.target.tagName));
      if (!editable || event.key.length !== 1 && event.key !== 'Backspace' || Date.now() - lastTypeAt < 35) return;
      lastTypeAt = Date.now(); play('typing');
    };
    const onScroll = () => bump(0.05);
    document.addEventListener('click', onClick, true);
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('wheel', onScroll, { capture: true, passive: true });
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('mouseover', onOver, true); document.removeEventListener('keydown', onKey, true); document.removeEventListener('wheel', onScroll, true); };
  }, []);

  const previousTabs = useRef(tabCount);
  useEffect(() => {
    if (tabCount > previousTabs.current) { play('tabOpen'); bump(0.3); }
    else if (tabCount < previousTabs.current) play('tabClose');
    previousTabs.current = tabCount;
  }, [tabCount]);
  const previousUrl = useRef(activeUrl);
  useEffect(() => {
    if (activeUrl !== previousUrl.current && /^https?:/i.test(activeUrl)) { play('navigate'); bump(0.4); }
    previousUrl.current = activeUrl;
  }, [activeUrl]);

  const layers = useRef<{ base: HTMLAudioElement; active: HTMLAudioElement | null; key: string } | null>(null);
  useEffect(() => {
    const key = music ? `${music.base}|${music.active}` : '';
    if (layers.current && layers.current.key !== key) { layers.current.base.pause(); layers.current.active?.pause(); layers.current = null; }
    if (!music) return;
    if (!layers.current) {
      const make = (url: string) => { const audio = new Audio(url); audio.loop = true; audio.volume = 0; return audio; };
      layers.current = { base: make(music.base), active: music.active ? make(music.active) : null, key };
    }
    const { base, active } = layers.current;
    const tick = window.setInterval(() => {
      const silent = pageMediaPlaying || document.visibilityState === 'hidden' || musicVolume <= 0;
      activity.current = Math.max(0, activity.current - 0.025);
      const target = silent ? 0 : musicVolume * music.volume;
      base.volume += (target - base.volume) * 0.15;
      if (active) active.volume += (target * activity.current - active.volume) * 0.2;
      if (silent && base.volume < 0.01) { base.pause(); active?.pause(); }
      else if (!silent && base.paused) { void base.play().catch(() => {}); void active?.play().catch(() => {}); try { if (active) active.currentTime = base.currentTime; } catch {} }
    }, 200);
    return () => window.clearInterval(tick);
  }, [music?.base, music?.active, music?.volume, musicVolume, pageMediaPlaying]);
  useEffect(() => () => { layers.current?.base.pause(); layers.current?.active?.pause(); layers.current = null; }, []);
  return !!sounds;
}
