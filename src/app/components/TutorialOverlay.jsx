function renderTutorialCopy(copy) {
  const [titleBlock = '', ...contentBlocks] = String(copy ?? '').split('\n\n');
  const titleLines = titleBlock.split('\n').filter(Boolean);
  const contentLines = contentBlocks.flatMap((block) => block.split('\n')).filter(Boolean);
  const [subtitleLine = '', ...bodyLines] = contentLines;

  return (
    <div className="tutorial-copy">
      <div className="tutorial-copy-title-group">
        {titleLines.map((line, lineIndex) => (
          <span className="tutorial-copy-title" key={`copy-title-${lineIndex}`}>
            {line}
          </span>
        ))}
      </div>
      {subtitleLine ? (
        <div className="tutorial-copy-subtitle">
          {subtitleLine}
        </div>
      ) : null}
      {bodyLines.length ? (
        <div className="tutorial-copy-body-group">
          {bodyLines.map((line, lineIndex) => (
            <span className="tutorial-copy-body" key={`copy-body-${lineIndex}`}>
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TutorialOverlay({
  canGoBack = true,
  canManualNext = true,
  collapsed = false,
  countInValue = null,
  directoryItems = [],
  displayCopy,
  onBack,
  onCompleteTask,
  onDirectorySelect,
  onPrimaryAction,
  onSkip,
  primaryDisabled = false,
  primaryLabel,
  showCompleteButton = false,
  step,
}) {
  if (!step) return null;

  const resolvedPrimaryLabel = primaryLabel ?? step.primaryLabel ?? '下一步';
  const resolvedPrimaryDisabled = primaryDisabled || (!showCompleteButton && !canManualNext);
  const handlePrimaryAction = showCompleteButton ? onCompleteTask : onPrimaryAction;
  const showPrimaryButton = showCompleteButton || canManualNext;

  if (collapsed) return null;

  return (
    <aside className="tutorial-panel" aria-live="polite">
      <div className="tutorial-panel-header">
        <div className="tutorial-panel-label">教程</div>
        {directoryItems.length ? (
          <nav className="tutorial-directory" aria-label="教程目录">
            {directoryItems.map((item) => {
              const directoryButtonClassName = [
                'tutorial-directory-button',
                item.active ? 'active' : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  aria-current={item.active ? 'step' : undefined}
                  className={directoryButtonClassName}
                  disabled={item.disabled}
                  key={item.id}
                  onClick={() => onDirectorySelect(item.stepIndex)}
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>

      <div className="tutorial-panel-body">
        {countInValue ? (
          <div className="tutorial-count-in" aria-live="assertive">
            {countInValue}
          </div>
        ) : null}
        {renderTutorialCopy(displayCopy ?? step.copy)}
      </div>

      <div className="tutorial-panel-actions">
        {showPrimaryButton ? (
          <button
            className="tutorial-primary"
            type="button"
            onClick={handlePrimaryAction}
            disabled={resolvedPrimaryDisabled}
          >
            {resolvedPrimaryLabel}
          </button>
        ) : null}
        <button className="tutorial-secondary" type="button" onClick={onBack} disabled={!canGoBack}>
          上一步
        </button>
        <button className="tutorial-link" type="button" onClick={onSkip}>
          跳过教程
        </button>
      </div>
    </aside>
  );
}

export { TutorialOverlay };
