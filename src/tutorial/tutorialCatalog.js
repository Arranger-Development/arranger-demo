const TUTORIAL_IDS = Object.freeze({
  CHILL_RAINY_STREET: 'chill-rainy-street',
  LEGACY_BASICS: 'legacy-basics',
});

const TUTORIAL_CATALOG = Object.freeze([
  Object.freeze({
    id: TUTORIAL_IDS.CHILL_RAINY_STREET,
    title: 'Chill：雨夜街头',
    description: '用 88 BPM 和四条轨道，完成一段有前奏、主题、变化和收尾的 8 小节编曲。',
    duration: '3–4 分钟',
    runtime: 'contextual',
  }),
  Object.freeze({
    id: TUTORIAL_IDS.LEGACY_BASICS,
    title: '基础创作教程',
    description: '沿用原有的完整基础教程，熟悉轨道、编辑器、模板与播放。',
    duration: '约 10 分钟',
    runtime: 'sidebar',
  }),
]);

function getTutorialCatalogItem(tutorialId) {
  return TUTORIAL_CATALOG.find((item) => item.id === tutorialId) ?? null;
}

export {
  TUTORIAL_CATALOG,
  TUTORIAL_IDS,
  getTutorialCatalogItem,
};
