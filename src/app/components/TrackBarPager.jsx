import { ChevronLeft, ChevronRight } from 'lucide-react';
import { renderIcon } from './icons.js';

function TrackBarPager({
  canPageBars = false,
  children,
  className = '',
  contentClassName = '',
  onNextBar = () => {},
  onPreviousBar = () => {},
  trackId = 'drums',
}) {
  const shellClassName = ['track-editor-pager-shell', className]
    .filter(Boolean)
    .join(' ');
  const contentClassNames = ['track-editor-pager-content', contentClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClassName} data-type={trackId}>
      <button
        aria-label="切换到上一个 Clip"
        className="track-page-btn previous"
        disabled={!canPageBars}
        onClick={onPreviousBar}
        title="切换到上一个 Clip"
        type="button"
      >
        {renderIcon(ChevronLeft)}
        <span className="track-page-btn-label" aria-hidden="true">
          <span>上一个</span>
          <span className="track-page-btn-kind">CLIP</span>
        </span>
      </button>
      <div className={contentClassNames}>{children}</div>
      <button
        aria-label="切换到下一个 Clip"
        className="track-page-btn next"
        disabled={!canPageBars}
        onClick={onNextBar}
        title="切换到下一个 Clip"
        type="button"
      >
        {renderIcon(ChevronRight)}
        <span className="track-page-btn-label" aria-hidden="true">
          <span>下一个</span>
          <span className="track-page-btn-kind">CLIP</span>
        </span>
      </button>
    </div>
  );
}

export { TrackBarPager };
