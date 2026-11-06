// =============================================================
// ちひろ（妹）の帰宅時の判定
// 指示から「名称ごとに必要な個数」を出し、ちひろから見たその名称の個数と、
// 見た目上の傷・量で判定する。
// =============================================================
import { RULES, LABEL } from './data.js';
import {
  sisterView, visibleShape, visibleAmount, trueName,
} from './model.js';
import { keyClues } from './actions.js';

const vs = (i) => visibleShape(i);
const va = (i) => visibleAmount(i);
const isMajor = (i) => vs(i) < RULES.traceMajor.shape || va(i) < RULES.traceMajor.amount;
const isMinor = (i) => !isMajor(i) && (vs(i) < RULES.traceMinor.shape || va(i) < RULES.traceMinor.amount);

export function judge(state) {
  const protect = state.stage.protect;
  const reasons = []; // 地の文
  const speech = []; // ちひろのセリフ
  const shortNames = [];
  const majorItems = [];
  const minorItems = [];

  for (const [name, need] of Object.entries(protect)) {
    if (need <= 0) continue;
    const seen = state.items.filter((i) => i.amount > 0 && sisterView(i).best === name);
    const clean = seen.filter((i) => !isMajor(i) && !isMinor(i));
    const minor = seen.filter(isMinor);
    const major = seen.filter(isMajor);
    if (seen.length < need) {
      shortNames.push(name);
      speech.push(`${LABEL[name]}が足りないんだけど！？`);
      for (const i of state.items) {
        if (i.origTruth === name && i.amount > 0 && !seen.includes(i)) {
          speech.push(`なんで${LABEL[sisterView(i).best]}があるの……？`);
        }
      }
    } else if (clean.length + minor.length < need) {
      // 崩れたものを数に入れないと足りない
      majorItems.push(...major.slice(0, need - clean.length - minor.length));
    } else if (clean.length < need) {
      minorItems.push(...minor.slice(0, need - clean.length));
    }
  }

  let title;
  let success = false;
  let face; // ちひろの表情（assets/chihiro/ のファイル名）
  if (shortNames.length) {
    title = `発覚：${shortNames.map((n) => LABEL[n]).join('と')}が足りない`;
    face = 'angry';
  } else if (majorItems.length) {
    title = '発覚：手を付けた跡';
    face = 'shout';
    reasons.push(`${majorItems.map((i) => i.id).join('・')}が、ひと目で分かるほど崩れていた。`);
  } else if (state.full < (state.stage.fullTarget || RULES.fullTarget)) {
    title = '失敗：空腹のまま';
    face = 'confused';
    speech.push('……なんか飢えてる？');
    reasons.push('言いつけは守ったが、お腹は満たされなかった。');
  } else if (minorItems.length) {
    title = 'セーフ';
    success = true;
    face = 'sideglance';
    speech.push('なんか違和感が……');
  } else {
    title = '完全犯罪';
    success = true;
    face = 'tasting';
    speech.push('いっただっきまーす！');
  }

  // 食べられる限界まで食べてクリアしたとき
  if (success && state.full >= RULES.fullMax) speech.push('……なんでそんな苦しそうなん？');

  // 手を付けた、残すべきだったデザートの手掛かり
  const protectedNames = Object.keys(protect);
  const missed = success ? [] : state.items
    .filter((i) => protectedNames.includes(i.origTruth) && !i.remade
      && (i.amount < RULES.traceMajor.amount || i.shape < RULES.traceMajor.shape))
    .map((i) => ({ id: i.id, name: LABEL[i.origTruth], clues: keyClues(i) }));

  const rows = state.items.map((i) => {
    const v = i.amount > 0 ? sisterView(i).best : null;
    let cond;
    if (i.amount <= 0) cond = '完食';
    else if (isMajor(i)) cond = '大きく崩れて見える';
    else if (isMinor(i)) cond = '少し跡が見える';
    else cond = '無傷に見える';
    const fixes = [i.remade && '作り直した', i.whip && 'ホイップで誤魔化した', i.sauce && 'ソースで誤魔化した',
      i.smallCup && '容器を替えて誤魔化した', i.marks.some((m) => m.type === 'patch') && '移植して誤魔化した'].filter(Boolean);
    if (fixes.length) cond += `（${fixes.join('・')}）`;
    const now = i.amount > 0 ? trueName(i) : i.origTruth;
    return {
      id: i.id,
      truth: LABEL[i.origTruth] + (now !== i.origTruth ? `→${LABEL[now]}` : ''),
      cond,
      sister: v ? LABEL[v] : '（空の容器）',
      protected: protectedNames.includes(i.origTruth),
    };
  });

  return {
    title, success, reasons, speech, face, missed, rows, full: state.full,
  };
}
