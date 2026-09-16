import {
  ChevronLeft,
  ChevronRight,
  Pause,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  getContextualTutorialPosition,
  getUnionRect,
} from '../../tutorial/contextualTutorialPosition.js';
import { CHILL_TUTORIAL_RUN_STATES } from '../../tutorial/chillTutorialRuntime.js';
import { renderIcon } from './icons.js';

function createRectSnapshot(rect) {
  if (!rect) return null;
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

function getStepTargets(step) {
  return (step?.anchorSelectors ?? [])
    .flatMap((selector) => [...document.querySelectorAll(selector)]);
}

function ChillTutorialOverlay({
  alreadyApplied = false,
  onBack = () => {},
  onExit = () => {},
  onPause = () => {},
  onPrimary = () => {},
  runState = CHILL_TUTORIAL_RUN_STATES.IDLE,
  step,
  stepIndex = 0,
  stepCount = 1,
}) {
  const cardRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [targetMissing, setTargetMissing] = useState(false);

  const updatePosition = useCallback(() => {
    const targets = getStepTargets(step);
    const card = cardRef.current;
    const targetRect = getUnionRect(
      targets.map((target) => createRectSnapshot(target.getBoundingClientRect())),
    );
    if (!targetRect || !card) {
      setTargetMissing(true);
      setPosition({
        left: Math.max(12, (window.innerWidth - 336) / 2),
        placement: 'safe',
        top: Math.max(88, window.innerHeight * 0.2),
      });
      return;
    }

    setTargetMissing(false);
    const nextPosition = getContextualTutorialPosition({
      cardRect: createRectSnapshot(card.getBoundingClientRect()),
      placements: step.preferredPlacements,
      targetRect,
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth,
      },
    });
    setPosition(nextPosition);
  }, [step]);

  useEffect(() => {
    const targets = getStepTargets(step);
    targets.forEach((target) => {
      target.classList.add('chill-tutorial-target');
      target.setAttribute('data-chill-tutorial-target', 'true');
    });

    const resizeObserver = new ResizeObserver(updatePosition);
    targets.forEach((target) => resizeObserver.observe(target));
    if (cardRef.current) resizeObserver.observe(cardRef.current);
    const mutationObserver = new MutationObserver(updatePosition);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const animationFrameId = window.requestAnimationFrame(updatePosition);
    return () => {
      targets.forEach((target) => {
        target.classList.remove('chill-tutorial-target');
        target.removeAttribute('data-chill-tutorial-target');
      });
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [step, updatePosition]);

  if (!step) return null;
  const previewing = runState === CHILL_TUTORIAL_RUN_STATES.PREVIEWING;
  const completed = runState === CHILL_TUTORIAL_RUN_STATES.COMPLETED;
  const primaryLabel = previewing
    ? '正在试听…'
    : completed
      ? step.explicit ? '完成 ✓' : '听完了 ✓'
      : alreadyApplied
        ? '重新试听并继续'
        : step.primaryLabel;
  const message = targetMissing
    ? '正在定位这一步，请稍候…'
    : completed && step.explicit
      ? step.completionMessage
      : previewing || completed
        ? step.listenFor
        : step.instruction;

  return (
    <section
      className={[
        'chill-coachmark',
        previewing ? 'previewing' : '',
        completed ? 'completed' : '',
        targetMissing ? 'target-missing' : '',
      ].filter(Boolean).join(' ')}
      data-placement={position?.placement ?? 'safe'}
      ref={cardRef}
      style={position ? {
        left: `${position.left}px`,
        top: `${position.top}px`,
      } : undefined}
      aria-live="polite"
    >
      <div className="chill-coachmark-heading">
        <span className="chill-coachmark-stage">
          {stepIndex + 1}/{stepCount} · {step.stageLabel}
        </span>
      </div>

      <p className="chill-coachmark-copy">{message}</p>

      <div className="chill-coachmark-actions">
        <button
          className="chill-coachmark-primary"
          type="button"
          disabled={targetMissing || previewing || completed}
          onClick={onPrimary}
        >
          {primaryLabel}
          {renderIcon(ChevronRight)}
        </button>
        <div className="chill-coachmark-tools">
          <button type="button" onClick={onBack} disabled={stepIndex === 0}>
            {renderIcon(ChevronLeft)}
            上一步
          </button>
          <button type="button" onClick={onPause}>
            {renderIcon(Pause)}
            暂停
          </button>
          <button type="button" onClick={onExit}>
            {renderIcon(X)}
            退出教程
          </button>
        </div>
      </div>
    </section>
  );
}

export { ChillTutorialOverlay };
