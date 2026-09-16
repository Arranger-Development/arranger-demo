import {
  Clock3,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { TUTORIAL_CATALOG } from '../../tutorial/tutorialCatalog.js';
import { renderIcon } from './icons.js';

function TutorialLibraryPanel({
  sessions = {},
  onClose = () => {},
  onRestart = () => {},
  onSelect = () => {},
}) {
  return (
    <aside className="tutorial-library-panel" aria-label="教程列表">
      <header className="tutorial-library-header">
        <div>
          <span className="tutorial-library-kicker">LEARNING DECK</span>
          <h2>选择一个教程</h2>
          <p>每个教程会分别保存作品和进度。</p>
        </div>
        <button type="button" className="tutorial-library-close" onClick={onClose}>
          关闭
        </button>
      </header>

      <div className="tutorial-library-list">
        {TUTORIAL_CATALOG.map((tutorial, index) => {
          const session = sessions[tutorial.id];
          const canContinue = session?.hasStarted && !session?.completed;
          return (
            <article className="tutorial-library-card" key={tutorial.id}>
              <div className="tutorial-library-card-index mono">0{index + 1}</div>
              <div className="tutorial-library-card-copy">
                <div className="tutorial-library-title-row">
                  <span className="tutorial-library-card-icon" aria-hidden="true">
                    {renderIcon(index === 0 ? Sparkles : Play)}
                  </span>
                  <h3>{tutorial.title}</h3>
                </div>
                <p>{tutorial.description}</p>
                <span className="tutorial-library-duration">
                  {renderIcon(Clock3)}
                  {tutorial.duration}
                </span>
              </div>
              <div className="tutorial-library-card-actions">
                <button
                  className="tutorial-library-primary"
                  type="button"
                  onClick={() => onSelect(tutorial.id)}
                >
                  {canContinue ? '继续教程' : session?.completed ? '再次体验' : '开始教程'}
                </button>
                {session?.hasStarted ? (
                  <button
                    className="tutorial-library-restart"
                    type="button"
                    onClick={() => onRestart(tutorial.id)}
                  >
                    {renderIcon(RotateCcw)}
                    重新开始
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

export { TutorialLibraryPanel };
