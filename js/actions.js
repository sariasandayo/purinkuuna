// =============================================================
// 鑑定行動と、その結果の言葉（文章はすべて仮）
// =============================================================
import { RULES, LABEL } from './data.js';
import { trueName } from './model.js';
import {
  lookText, smellText, shakeText, pressWeakText, pressNormalText, pressStrongText, sectionText, tasteText,
} from './texts.js';

// time: 分 / dmg: 原形への損傷の基準値 / amount: 減る量 / full: 満腹度
export const ACTIONS = [
  { id: 'look', label: '観察する', time: 1, dmg: 0 },
  { id: 'sniff', label: 'においを嗅ぐ', time: 1, dmg: 0 },
  { id: 'shake', label: '揺らす', time: 1, dmg: 2 },
  { id: 'press1', label: '弱く押す', time: 1, dmg: 3, mark: 'dent' },
  { id: 'press2', label: '普通に押す', time: 1, dmg: 8, mark: 'dent' },
  { id: 'press3', label: '全力で押す', time: 2, dmg: 22, mark: 'crack' },
  // すくう：少しだけ取って断面を見る。跡は小さく、ホイップなどで隠せる
  { id: 'scoop', label: 'すくう', time: 2, dmg: 5, amount: 0.05, mark: 'hole' },
  { id: 'taste', label: '味見する', time: 2, dmg: 6, amount: 0.08, full: 3, mark: 'hole' },
  { id: 'eat', label: '完食する', time: 4 },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 崩れやすさ（柔らかい・気泡が多いほど崩れやすい）
export function fragility(it) {
  return clamp(1.3 - it.firm * 0.8 - it.elastic * 0.2 + it.air * 0.3, 0.4, 1.5);
}

// 結果画面の手掛かりは texts.js で作る
export { keyClues } from './texts.js';

// ---- 実行 --------------------------------------------------------
// state を書き換えて、表示用の言葉を返す
export function canDo(state, it, act) {
  if (it.amount <= 0) return false;
  if (act.time > state.time) return false;
  if (act.id === 'eat' && state.full >= RULES.fullMax) return false;
  return true;
}

export function perform(state, it, act) {
  const lines = [];
  state.time -= act.time;
  // 同じ鑑定を繰り返した回数（繰り返すほど、まだ出ていない特徴が出やすくなる）
  it.tries = it.tries || {};
  it.tries[act.id] = (it.tries[act.id] || 0) + 1;

  // 損傷
  if (act.dmg) {
    let d = act.dmg * fragility(it);
    if (act.id === 'press3' && it.set === 'agar') d *= 1.4; // 寒天は割れやすい
    if (act.id === 'shake' && it.set === 'agar') d = 0;
    it.shape = Math.max(0, it.shape - d);
  }
  if (act.amount) it.amount = Math.max(0, it.amount - act.amount);
  if (act.full) state.full = Math.min(RULES.fullMax, state.full + act.full);
  if (act.mark) it.marks.push({ type: act.mark, x: 30 + Math.random() * 40 });

  switch (act.id) {
    case 'look': lines.push(...lookText(it)); break;
    case 'sniff': lines.push(...smellText(it)); break;
    case 'shake': lines.push(...shakeText(it)); break;
    case 'press1': lines.push(pressWeakText(it)); break;
    case 'press2': lines.push(...pressNormalText(it)); break;
    case 'press3': lines.push(...pressStrongText(it)); break;
    case 'scoop': lines.push(...sectionText(it)); break;
    case 'taste': lines.push(...tasteText(it)); break;
    case 'eat': {
      const room = RULES.fullMax - state.full;
      const need = RULES.fullPerItem * it.amount;
      let eaten = it.amount;
      if (need > room) eaten = room / RULES.fullPerItem;
      it.amount = Math.max(0, it.amount - eaten);
      state.full = Math.min(RULES.fullMax, state.full + eaten * RULES.fullPerItem);
      if (it.amount > 0.001) {
        lines.push('お腹がいっぱいで、全部は食べきれなかった。');
        it.shape = Math.max(0, it.shape - 40);
        it.marks.push({ type: 'hole', x: 50 });
      } else {
        it.amount = 0;
      }
      lines.push(...tasteText(it));
      if (eaten >= 0.5) {
        it.revealed = true;
        lines.push(`食べてみて分かった。これは${LABEL[it.remade ? trueName(it) : it.origTruth]}だった。`);
      }
      break;
    }
    default: break;
  }

  // 新しい言葉だけメモに追加
  for (const l of lines) if (!it.notes.includes(l)) it.notes.push(l);
  return lines;
}
