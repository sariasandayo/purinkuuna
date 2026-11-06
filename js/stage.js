// =============================================================
// ステージ（1面は固定、2面以降は自動生成）とちひろ（妹）の指示
// =============================================================
import {
  NAMES, LABEL, TUTORIAL, GEN, BASE_ITEM, DESSERT_FROM, RULES,
} from './data.js';
import { contentFit, trueName, sisterView } from './model.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function pickWeighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) { r -= w; if (r < 0) return v; }
  return entries[entries.length - 1][0];
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- 指示 --------------------------------------------------------
// type:
//   keepAll  … 「Xは食べないで」         X を元の数だけ残す
//   keepTwo  … 「XとYは食べないで」       X と Y を元の数だけ残す
//   keepN    … 「Xをn個残して」          X を n 個残す（残りは食べてよい）
//   onlyEat  … 「食べていいのはXだけ」    X 以外をすべて元の数だけ残す
export function orderMemo(order) {
  const [x, y] = order.names.map((n) => LABEL[n]);
  switch (order.type) {
    case 'keepAll': return `${x}は絶対食べるなよ！`;
    case 'keepTwo': return `${x}と${y}は絶対食べるなよ！`;
    case 'keepN': return `${x}を${order.n}個残しとけよ！`;
    case 'onlyEat': return `${x}だけは食べてもいいよ！`;
    default: return '';
  }
}

// 名称ごとに、帰宅時に必要な個数
export function protectedCounts(order, items) {
  const orig = {};
  for (const it of items) orig[it.origTruth] = (orig[it.origTruth] || 0) + 1;
  const out = {};
  switch (order.type) {
    case 'keepAll':
    case 'keepTwo':
      for (const n of order.names) out[n] = orig[n] || 0;
      break;
    case 'keepN':
      out[order.names[0]] = order.n;
      break;
    case 'onlyEat':
      for (const n of Object.keys(orig)) if (n !== order.names[0]) out[n] = orig[n];
      break;
    default: break;
  }
  return out;
}

// 指示から、守る対象の名称（作り直し材料の保証用）
function protectedNamesOf(order, names) {
  const out = {};
  if (order.type === 'onlyEat') for (const n of names) { if (n !== order.names[0]) out[n] = 1; } else for (const n of order.names) out[n] = 1;
  return out;
}

// ---- 個体の生成 ----------------------------------------------------
function makeFromTemplate(t, lure) {
  const it = { ...BASE_ITEM, air: 0 };
  const spec = lure && t.lure ? { ...t, ...t.lure } : t;
  for (const [k, v] of Object.entries(spec)) {
    if (k === 'w' || k === 'white' || k === 'lure') continue;
    if (Array.isArray(v)) it[k] = rnd(v[0], v[1]);
    else if (typeof v === 'number' && (k === 'caramel' || k === 'cubes')) it[k] = Math.random() < v;
    else it[k] = v;
  }
  if (t.white && Math.random() < t.white) it.colorBias = rnd(-0.55, -0.4); // 白いプリン
  return it;
}

// その名称として公平な個体を作る（正体が一致し、妹にもそう見え、次点と差がある）
// lure が真なら、見た目の引っかけを入れる（入れられない場合は普通に作る）
function makeItem(name, lure) {
  const temps = GEN.templates[name];
  for (let i = 0; i < 400; i += 1) {
    const t = pickWeighted(temps.map((x) => [x, x.w]));
    const it = makeFromTemplate(t, lure && i < 200);
    if (trueName(it) !== name) continue;
    if (sisterView(it).best !== name) continue;
    const scores = NAMES.map((n) => contentFit(it, n)).sort((a, b) => b - a);
    if (scores[0] - scores[1] < GEN.minMargin) continue;
    return it;
  }
  throw new Error(`生成失敗: ${name}`);
}

export function levelOf(stageNo) {
  let lv = GEN.levels[0];
  for (const l of GEN.levels) if (stageNo >= l.from) lv = l;
  // 出てくるデザートは、登場ステージ（DESSERT_FROM）までに解禁されたもの
  return { ...lv, pool: NAMES.filter((n) => DESSERT_FROM[n] <= stageNo) };
}

function chooseOrder(stageNo, pool) {
  if (stageNo <= GEN.puddingOnlyUntil) return { type: 'keepAll', names: ['pudding'] };
  const type = pickWeighted(Object.entries(GEN.orderWeights));
  const targets = pool.filter((n) => !GEN.notTarget.includes(n)); // 安全枠はお題にしない
  const x = pick(targets);
  if (type === 'keepTwo') return { type, names: [x, pick(targets.filter((n) => n !== x))] };
  if (type === 'keepN') return { type, names: [x], n: randInt(1, 2) };
  return { type, names: [x] };
}

// 指示に合わせて、冷蔵庫に入れる名称の並びを決める。
// 食べてよいもののうち「見分けやすいもの」（残すべきものと紛らわしくないもの）は obviousMax 個まで。
// 満足まで4個必要なので、残りは紛らわしいものを食べる必要がある。
function edibleNames(protect, k, lv) {
  const pool = lv.pool.filter((n) => !protect.includes(n));
  const conf = [...new Set(protect.flatMap((n) => GEN.confusables[n] || []))].filter((n) => pool.includes(n));
  const obvious = pool.filter((n) => !conf.includes(n));
  const nObvious = conf.length ? Math.min(k, randInt(Math.max(0, lv.obviousMax - 1), lv.obviousMax)) : k;
  const out = [];
  for (let i = 0; i < k; i += 1) {
    if (i < nObvious && obvious.length) out.push(pick(obvious));
    else out.push(pick(conf.length ? conf : pool));
  }
  return out;
}

function composeNames(order, lv) {
  const [x, y] = order.names;
  const er = lv.edible || GEN.edible;
  const edible = randInt(er[0], er[1]);
  switch (order.type) {
    case 'keepAll': {
      const xc = randInt(GEN.keepCount[0], GEN.keepCount[1]);
      return [...Array(xc).fill(x), ...edibleNames([x], edible, lv)];
    }
    case 'keepTwo':
      return [...Array(randInt(1, 2)).fill(x), ...Array(randInt(1, 2)).fill(y), ...edibleNames([x, y], edible, lv)];
    case 'keepN': {
      // 指定より1個多く入れる。余った1個も食べてよいが、残すべきものと同じ種類なので見分けが必要
      const xc = order.n + 1;
      return [...Array(xc).fill(x), ...edibleNames([x], edible - 1, lv)];
    }
    case 'onlyEat': {
      // 食べてよいのは X だけ。ほか（守る対象）は X と紛らわしいものを中心に入れる
      const pool = lv.pool.filter((n) => n !== x);
      const conf = (GEN.confusables[x] || []).filter((n) => pool.includes(n));
      const k = randInt(GEN.onlyEatOthers[0], GEN.onlyEatOthers[1]);
      const rest = Array.from({ length: k }, () => (conf.length && Math.random() < 0.75 ? pick(conf) : pick(pool)));
      return [...Array(edible).fill(x), ...rest];
    }
    default: return [];
  }
}

function finishStage(stageNo, order, items, mats, time, ingredients) {
  const list = items.map((src, i) => {
    const it = {
      ...src,
      id: String.fromCharCode(65 + i), // A, B, C, …
      shape: 100,
      amount: 1,
      marks: [],
      notes: [],
      guess: 0,
      revealed: false,
      whip: false,
      sauce: false,
      smallCup: false,
      frost: false,
      liquid: false,
      remade: false,
      cook: null,
      // 容器は正体と無関係にランダム（見た目のばらつき用）
      cup: src.cup || pickWeighted([['glass', 45], ['footed', 30], ['ramekin', 25]]),
    };
    it.origTruth = trueName(it);
    return it;
  });
  return {
    no: stageNo,
    order,
    time,
    fullTarget: levelOf(stageNo).fullTarget || RULES.fullTarget,
    memo: orderMemo(order),
    mats: { ...mats },
    ingredients: { ...ingredients },
    items: list,
    protect: protectedCounts(order, list),
  };
}

export function makeStage(stageNo) {
  const lv = levelOf(stageNo);
  const order = chooseOrder(stageNo, lv.pool);
  const names = shuffle(composeNames(order, lv));
  // 引っかけは、残すべきでないもの（＝見た目で残すべきものに似せると罠になるもの）に入れる
  const items = names.map((n) => makeItem(n, !order.names.includes(n) && Math.random() < lv.lure));
  const mats = Object.fromEntries(Object.entries(lv.mats).map(([k, [a, b]]) => [k, randInt(a, b)]));
  const ing = Object.fromEntries(Object.entries(GEN.ingredients).map(([k, [a, b]]) => [k, randInt(a, b)]));
  // 残すべきデザートを作り直すのに欠かせない材料は、必ず1つ以上入れる
  for (const n of Object.keys(protectedNamesOf(order, names))) {
    const key = GEN.keyIngredient[n];
    if (key) ing[key] = Math.max(1, ing[key]);
  }
  if (stageNo === 1) {
    // 1面：お題は「プリン」固定。中身は毎回生成。時間・材料は練習用
    return finishStage(1, order, items, TUTORIAL.mats, TUTORIAL.time, { ...TUTORIAL.ingredients });
  }
  return finishStage(stageNo, order, items, mats, lv.time, ing);
}

// 失敗したときに同じ冷蔵庫で再挑戦するための複製
export function cloneStage(stage) {
  return JSON.parse(JSON.stringify(stage));
}
