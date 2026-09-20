import { useEffect, useLayoutEffect, useRef } from 'react';
import { livePhraseProgress, liveProgressPath } from '../liveCellProgress.js';
import './liveCellProgress.css';

export default function LiveCellProgress({ playback, id, bars, running }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const svg = ref.current;
    const resize = () => {
      const { width, height } = svg.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${width || 1} ${height || 1}`);
      const path = liveProgressPath(width, height);
      svg.querySelectorAll('path').forEach((node) => node.setAttribute('d', path));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const svg = ref.current;
    let frame;
    const draw = (fraction) => {
      svg.style.setProperty('--pw-perimeter-offset', String(100 * (1 - fraction)));
      svg.style.opacity = fraction > 0 ? '1' : '0';
    };
    if (!running) { draw(0); return undefined; }
    const tick = () => {
      draw(livePhraseProgress(playback.getProgress(), id, bars));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); draw(0); };
  }, [playback, id, bars, running]);
  return <svg ref={ref} className="pw-live-perimeter" data-running={running} aria-hidden="true" focusable="false">
    <path className="pw-live-perimeter-glow" pathLength="100" vectorEffect="non-scaling-stroke" />
    <path className="pw-live-perimeter-line" pathLength="100" vectorEffect="non-scaling-stroke" />
  </svg>;
}
