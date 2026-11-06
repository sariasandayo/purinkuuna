// =============================================================
// 修復（隠す・移植・容器替え）。数値・文章は仮。
// 妹は「見た目上の」原形と量で判定するので、隠せばごまかせる。
// ただし覆いは見た目の名称適合度も変える（ホイップでプリンらしさが消える等）。
// =============================================================
import { REPAIR_RULES as R, AROMAS } from './data.js';
import { bodyLook } from './model.js';
import { fragility } from './actions.js';

export const REPAIRS = [
  { id: 'whip', label: 'ホイップで隠す', time: 2, mat: 'whip' },
  { id: 'sauce', label: 'ソースをかける', time: 1, mat: 'sauce' },
  { id: 'graft', label: '別のデザートから移植', time: 3 },
  { id: 'cup', label: '小さい容器に移す', time: 3, mat: 'cup' },
];

export function canRepair(state, it, r) {
  if (r.time > state.time) return false;
  if (r.mat && state.mats[r.mat] <= 0) return false;
  switch (r.id) {
    case 'whip': return it.amount > 0 && !it.whip;
    case 'sauce': return it.amount > 0 && !it.whip && !it.sauce;
    case 'graft': return it.amount < 0.995 && donors(state, it).length > 0;
    case 'cup': return it.amount > 0 && !it.smallCup;
    default: return false;
  }
}

// 移植元にできるデザート
export function donors(state, it) {
  return state.items.filter((d) => d !== it && d.amount > 0.15);
}

const MIX_KEYS = ['egg', 'fat', 'air', 'firm', 'elastic', 'su', 'syneresis', 'colorBias', 'crust', ...AROMAS];

export function repair(state, it, r, donor) {
  const lines = [];
  state.time -= r.time;
  if (r.mat) state.mats[r.mat] -= 1;

  switch (r.id) {
    case 'whip':
      it.whip = true;
      lines.push('ホイップで表面を覆った。傷は見えなくなった。');
      break;

    case 'sauce':
      it.sauce = true;
      lines.push(it.caramel ? 'カラメルソースを上から足した。小さな傷は目立たなくなった。'
        : 'カラメルソースをかけた。小さな傷は目立たなくなった。');
      break;

    case 'cup':
      it.smallCup = true;
      it.shape = Math.max(0, it.shape - 8 * fragility(it));
      lines.push('一回り小さい容器に移した。量が減ったのは目立たなくなった。');
      if (fragility(it) > 1) lines.push('移すときに少し崩れた。');
      break;

    case 'graft': {
      const amt = Math.min(R.graftMax, 1 - it.amount, donor.amount);
      const lookR = bodyLook(it);
      const lookD = bodyLook(donor);
      const mismatch = Math.abs(lookR.yellow - lookD.yellow) + Math.abs(lookR.gloss - lookD.gloss) * 0.5;

      // 中身が混ざる
      const p = amt / (it.amount + amt);
      for (const k of MIX_KEYS) it[k] = it[k] * (1 - p) + donor[k] * p;

      it.amount = Math.min(1, it.amount + amt);
      donor.amount = Math.max(0, donor.amount - amt);
      donor.shape = Math.max(0, donor.shape - 12 * fragility(donor));
      donor.marks.push({ type: 'hole', x: 30 + Math.random() * 40 });
      donor.notes.push(`${it.id}の修復のために、一部を切り取られた。`);

      it.shape = Math.min(R.graftSeamCap, it.shape + R.graftFill);
      const holeIdx = it.marks.findIndex((m) => m.type === 'hole');
      const x = holeIdx >= 0 ? it.marks[holeIdx].x : 50;
      if (holeIdx >= 0) it.marks.splice(holeIdx, 1);
      it.marks.push({ type: 'patch', x, yellow: lookD.yellow });

      lines.push(`${donor.id}から少し切り取って、${it.id}の欠けた所に詰めた。`);
      if (mismatch > 0.12) {
        it.shape = Math.max(0, it.shape - mismatch * R.graftMismatch);
        lines.push('詰めた所だけ、色やつやが違って見える。');
      } else {
        lines.push('ほとんど見分けがつかない。');
      }
      break;
    }
    default: break;
  }
  for (const l of lines) if (!it.notes.includes(l)) it.notes.push(l);
  return lines;
}
