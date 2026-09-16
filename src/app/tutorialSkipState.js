function createTutorialSkipAppState(initialState) {
  if (!initialState || typeof initialState !== 'object') return null;

  return {
    ...initialState,
    clips: {
      ids: [],
      byId: {},
    },
    selectedClipId: null,
  };
}

export { createTutorialSkipAppState };
