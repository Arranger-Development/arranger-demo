import { useEffect, useLayoutEffect, useRef } from 'react';
import { livePhraseProgress, jamPhraseProgress, liveProgressPath } from '../liveCellProgress.js';
import './phrasePerimeterProgress.css';

export default function PhrasePerimeterProgress({ playback, id, bars, running, track, phraseId, inset = 3, radius = 4 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const svg = ref.current;
    const resize = () => {
      const { width, height } = svg.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${width || 1} ${height || 1}`);
      const path = liveProgressPath(width, height, inset, radius);
      svg.querySelectorAll('path').forEach((node) => node.setAttribute('d', path));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [inset, radius]);
  useEffect(() => {
    const svg = ref.current;
    let frame;
    const draw = (fraction) => {
      svg.style.setProperty('--pw-perimeter-offset', String(100 * (1 - fraction)));
      svg.style.opacity = fraction > 0 ? '1' : '0';
    };
    if (!running) { draw(0); return undefined; }
    const tick = () => {
      const progress = playback.getProgress();
      draw(phraseId ? jamPhraseProgress(progress, track, phraseId) : livePhraseProgress(progress, id, bars));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); draw(0); };
  }, [playback, id, bars, running, track, phraseId]);
  return <svg ref={ref} className="pw-phrase-perimeter" data-running={running} aria-hidden="true" focusable="false">
    <path className="pw-phrase-perimeter-glow" pathLength="100" vectorEffect="non-scaling-stroke" />
    <path className="pw-phrase-perimeter-line" pathLength="100" vectorEffect="non-scaling-stroke" />
  </svg>;
}
