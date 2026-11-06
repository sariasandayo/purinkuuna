// =============================================================
// 名称適合度の計算（中身・見た目・妹の判定）
// =============================================================
import {
  NAMES, CONTENT_DEF, CONTENT_WEIGHT, LOOK_DEF, LOOK_WEIGHT, RULES, REPAIR_RULES,
} from './data.js';

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const gauss = (v, ideal, tol) => Math.exp(-(((v - ideal) / tol) ** 2));

// 中身の名称適合度（0〜100）
export function contentFit(it, name) {
  const d = CONTENT_DEF[name];
  let s = 0;
  let w = 0;
  for (const k of Object.keys(d.ideal)) {
    const wt = CONTENT_WEIGHT[k];
    s += wt * gauss(it[k] ?? 0, d.ideal[k], d.tol[k]);
    w += wt;
  }
  let v = (s / w) * (d.set[it.set] ?? 0.2);
  if (!d.require(it)) v *= 0.25;
  return Math.round(v * 100);
}

// 中身から見た目の特徴値を計算する
// 中身そのものの見た目（修復による覆いを含まない）
export function bodyLook(it) {
  const baseGloss = {
    gelatin: 0.8, egg_heat: 0.6, agar: 0.45, starch: 0.35, acid: 0.45, enzyme: 0.5,
  }[it.set] ?? 0.5;
  return {
    yellow: clamp(it.egg * 0.85 + it.colorBias),
    gloss: clamp(baseGloss - it.air * 1.2 - (it.frost ? 0.3 : 0)),
    brown: clamp((it.coffee || 0) * 1.15), // コーヒーで茶色に
    pink: clamp((it.fruit || 0) * 1.15), // 果物で色づく
  };
}

// 妹が見る見た目（ホイップやソースの覆いを含む）
export function lookFeatures(it) {
  const b = bodyLook(it);
  const f = {
    yellow: b.yellow,
    gloss: b.gloss,
    caramel: it.caramel || it.sauce ? 1 : 0,
    cubes: it.cubes ? 1 : 0,
    water: clamp(it.syneresis),
    whip: it.whip ? 1 : 0,
    brown: b.brown,
    pink: b.pink,
    crust: clamp(it.crust || 0),
  };
  if (f.crust > 0.5) f.gloss = 0.6; // 焦がした膜はガラスのように光る
  if (it.whip) {
    // 上面が白いホイップで覆われる。横からは本体の色が少し見える
    f.yellow = b.yellow * 0.5;
    f.gloss = 0.1;
    f.caramel = 0;
    f.crust = 0;
    f.brown *= 0.5;
    f.pink *= 0.5;
  }
  return f;
}

// 妹から見た原形・量（修復で隠した分を含む）
export function visibleShape(it) {
  const hide = (it.whip ? REPAIR_RULES.whipHide : 0) + (it.sauce ? REPAIR_RULES.sauceHide : 0);
  return Math.min(100, it.shape + hide);
}
export function visibleAmount(it) {
  if (it.amount <= 0) return 0;
  let a = it.amount;
  if (it.smallCup) a /= REPAIR_RULES.smallCup;
  if (it.whip) a += REPAIR_RULES.whipVolume;
  if (it.sauce) a += REPAIR_RULES.sauceVolume;
  return Math.min(1, a);
}

// 見た目の名称適合度（0〜100）
export function lookFit(it, name) {
  const f = lookFeatures(it);
  const d = LOOK_DEF[name];
  let s = 0;
  let w = 0;
  for (const k of Object.keys(d.ideal)) {
    const wt = LOOK_WEIGHT[k];
    s += wt * gauss(f[k], d.ideal[k], d.tol[k]);
    w += wt;
  }
  return Math.round((s / w) * 100);
}

function argmax(scores) {
  let best = null;
  for (const n of NAMES) if (best === null || scores[n] > scores[best]) best = n;
  return best;
}

// 中身で決まる正体
export function trueName(it) {
  const sc = {};
  for (const n of NAMES) sc[n] = contentFit(it, n);
  const best = argmax(sc);
  return sc[best] < RULES.failContent ? 'failed' : best;
}

// 妹から見た名称（見た目重視＋中身）
export function sisterView(it) {
  if (it.liquid) return { scores: {}, best: 'unknown' }; // 固まっていないものは何にも見えない
  const w = RULES.sisterLookWeight;
  const sc = {};
  for (const n of NAMES) sc[n] = Math.round(w * lookFit(it, n) + (1 - w) * contentFit(it, n));
  const best = argmax(sc);
  return { scores: sc, best: sc[best] < RULES.failSister ? 'unknown' : best };
}
