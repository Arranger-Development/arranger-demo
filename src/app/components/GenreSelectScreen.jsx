import { useState } from 'react';
import {
  CURRENT_GENRE_ID,
  GENRE_OPTIONS,
} from '../genreOptions.js';
import { HardwareFlowShell } from './HardwareFlowShell.jsx';

function GenreSelectScreen({
  currentGenreId = CURRENT_GENRE_ID,
  onGenreEnter = () => {},
  options = GENRE_OPTIONS,
}) {
  const [selectedPreviewGenreId, setSelectedPreviewGenreId] = useState(currentGenreId);

  const handleGenreSelect = (genre) => {
    setSelectedPreviewGenreId(genre.id);
    if (genre.enabled) {
      onGenreEnter(genre.id);
    }
  };

  const handleGenreAction = (genre) => {
    setSelectedPreviewGenreId(genre.id);
    if (genre.entryType === 'multimodal' || genre.enabled) {
      onGenreEnter(genre.id);
    }
  };

  return (
    <HardwareFlowShell
      ariaLabel="选择曲风"
      consoleTitle="AETHER SYNTHESIZERS - GENRE SELECT"
      kicker="GENRE SELECT"
      title="选择曲风"
    >
      <div className="genre-grid" role="list" aria-label="曲风列表">
        {options.map((genre) => {
          const selected = genre.id === selectedPreviewGenreId;
          const genreStyle = {
            '--genre-ink': genre.ink,
            '--genre-neon': genre.neon,
            '--genre-tone': genre.tone,
          };
          const actionLabel = genre.actionLabel ?? '试听';

          return (
            <div
              className="genre-card-shell"
              data-gem-tone={genre.gemTone ?? 'amber'}
              key={genre.id}
              role="listitem"
              style={genreStyle}
            >
              <button
                className="genre-card"
                type="button"
                style={genreStyle}
                aria-label={`选择${genre.displayTitle}`}
                aria-pressed={selected}
                data-enabled={genre.enabled ? 'true' : 'false'}
                data-genre-id={genre.id}
                data-selected={selected ? 'true' : undefined}
                onClick={() => handleGenreSelect(genre)}
              >
                <span className="genre-label">{genre.displayTitle}</span>
                <span className="genre-art-frame" aria-hidden="true">
                  <img
                    className="genre-art-image"
                    src={genre.artImage}
                    alt=""
                    draggable="false"
                    decoding="async"
                  />
                </span>
                <span className="genre-description">{genre.description}</span>
                <span className="genre-status mono">
                  {genre.statusLabel ?? (genre.enabled ? 'ENTER' : 'PREVIEW')}
                </span>
              </button>
              <button
                className="genre-gem-button"
                type="button"
                aria-label={`${actionLabel} ${genre.displayTitle}`}
                data-gem-tone={genre.gemTone ?? 'amber'}
                onClick={() => handleGenreAction(genre)}
              >
                <span className="genre-gem-socket" aria-hidden="true">
                  <span className="genre-gem" />
                </span>
                <span className="genre-gem-label" aria-hidden="true">{actionLabel}</span>
              </button>
            </div>
          );
        })}
      </div>
    </HardwareFlowShell>
  );
}

// JSX component references are not marked as reads by this repository's lint parser.
void HardwareFlowShell;

export { GenreSelectScreen };
