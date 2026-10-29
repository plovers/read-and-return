import { getLanguage } from 'obsidian';

const chinese = {
  "Top / return": "顶部 / 返回",
  "Jump to top": "跳到顶部并记住位置",
  "Jump to bottom": "跳转到底部",
  "Already at bottom; return point kept.": "已在底部，保留原返回点",
  "Return to saved position": "返回临时位置",
  "Set return point": "设置返回点",
  "Go back": "位置后退",
  "Go forward": "位置前进",
  "Clear note navigation": "清除当前笔记导航记录",
  "Read and Return navigation menu": "Read and Return 导航菜单",
  "Open a Markdown note first.": "请先打开 Markdown 笔记",
  "Note navigation cleared.": "已清除当前笔记的导航记录",
  "Return point set.": "已设置临时返回点",
  "Already at top; return point kept.": "已在顶部，保留原返回点",
  "No return point.": "尚未设置返回点",
  "No more positions.": "没有更多位置记录",
  "Could not restore; retry after the note loads.": "暂时无法恢复位置，请等待笔记加载后重试",
  "Text changed; restored an approximate position.": "原文已变化，已恢复到附近位置",
  "Top": "顶部并记住位置",
  "Return": "返回",
  "Back": "后退",
  "Forward": "前进",
  "Clear this note": "清除本篇导航",
  "Jump to top and remember": "顶部并记住位置",
  "More navigation actions": "更多导航操作",
  "Navigation stays in this session; note content is never changed.": "导航记录仅保存在本次会话，不修改笔记正文。",
  "Mobile control": "移动端悬浮按钮",
  "Desktop control": "桌面端悬浮按钮",
  "Side": "按钮位置",
  "Left": "左侧",
  "Right": "右侧",
  "Bottom spacing": "底部距离",
  "Mobile reserves at least 96px plus the safe area; increase for taller toolbars.": "移动端至少预留 96px，再叠加系统安全区，避开底部导航栏；可继续上移。"
};

/** Obsidian uses `zh` for Simplified Chinese and `zh-TW` for Traditional Chinese. */
export function t(key: keyof typeof chinese): string {
  const language = getLanguage().trim().replace(/_/g, '-').toLowerCase();
  const simplified = /^(?:zh|zh-cn|zh-sg|zh-hans(?:-[a-z]{2})?)$/.test(language);
  return simplified ? chinese[key] : key;
}
