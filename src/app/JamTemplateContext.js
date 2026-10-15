import { createContext, useContext, useSyncExternalStore } from 'react';

export const JamTemplateContext = createContext(null);
const empty = { projects: [], activeId: null };
const noopSubscribe = () => () => {};
const emptySnapshot = () => empty;
export function useProjectTemplates() {
  const context = useContext(JamTemplateContext);
  const state = useSyncExternalStore(context?.store.subscribe ?? noopSubscribe, context?.store.getSnapshot ?? emptySnapshot);
  const project = state.projects.find(p => p.id === state.activeId);
  return { ...context, project, state };
}
