import { Check } from 'lucide-react';
import { renderIcon } from './icons.js';

function ChillTutorialStageRail({
  activeStageIndex = 0,
  stages = [],
}) {
  return (
    <nav className="chill-stage-rail" aria-label="Chill 教程阶段">
      {stages.map((stage, stageIndex) => {
        const state = stageIndex < activeStageIndex
          ? 'complete'
          : stageIndex === activeStageIndex ? 'active' : 'upcoming';
        return (
          <div className={`chill-stage-item ${state}`} key={stage}>
            <span className="chill-stage-number mono">
              {state === 'complete' ? renderIcon(Check) : stageIndex + 1}
            </span>
            <span>{stage}</span>
          </div>
        );
      })}
    </nav>
  );
}

export { ChillTutorialStageRail };
