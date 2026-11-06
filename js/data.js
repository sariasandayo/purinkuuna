// =============================================================
// 試作版データ。数値・文章はすべて仮。後で調整する。
// 内部値はすべて 0〜1。プレイヤーには数値を見せない。
// =============================================================

export const NAMES = [
  'pudding', 'pannacotta', 'bavarois', 'milkkanten', 'coffeejelly', 'milkpudding', 'blancmange', 'annin',
  'mousse', 'posset', 'yogurtjelly', 'muhallabia', 'haupia', 'brulee', 'gingermilk',
];

export const LABEL = {
  pudding: 'プリン',
  pannacotta: 'パンナコッタ',
  bavarois: 'ババロア',
  milkkanten: '牛乳寒天',
  coffeejelly: 'コーヒーゼリー',
  milkpudding: 'ミルクプリン',
  blancmange: 'ブランマンジェ',
  annin: '杏仁豆腐',
  mousse: 'ムース',
  posset: 'ポセット',
  yogurtjelly: 'ヨーグルトゼリー',
  muhallabia: 'ムハッラビーヤ',
  haupia: 'ハウピア',
  brulee: 'クレームブリュレ',
  gingermilk: '姜汁撞奶',
  failed: '失敗作', // 中身がどの定義にも当てはまらない
  unknown: '得体の知れないもの', // 妹から見て、どれにも見えない
};

// 登場するステージ（このステージ以降の冷蔵庫に出てくる）
// 判定しやすいものを先に、紛らわしい組（ブランマンジェと杏仁豆腐、ミルクプリン）を後ろにした。
// STAGE 5 からは2種類ずつ解禁し、STAGE 8 で全種類が出揃う
export const DESSERT_FROM = {
  pudding: 1,
  pannacotta: 1,
  bavarois: 1,
  milkkanten: 1,
  coffeejelly: 2,
  brulee: 2,
  mousse: 3,
  posset: 4,
  yogurtjelly: 5,
  haupia: 5,
  muhallabia: 6,
  gingermilk: 6,
  blancmange: 7,
  annin: 7,
  milkpudding: 8,
};

// ---- 中身の定義（ゲーム内正典） --------------------------------
// ideal: 理想値 / tol: 許容幅 / set: 固め方ごとの適合倍率（書いていない固め方は 0.2）
// require: 必須条件（満たさないと適合度が大きく下がる）
// 固め方：egg_heat（卵の加熱凝固）/ gelatin / agar（寒天）/ starch（でんぷん）/ acid（酸）/ enzyme（酵素）/ none（固まっていない）
// 香り：その香りを持つデザート以外は、はっきりした香りがあると必須条件を満たさない
export const AROMAS = ['almond', 'annin', 'coffee', 'citrus', 'yogurt', 'rose', 'coconut', 'ginger', 'fruit'];
const NO_EXTRA = {
  ideal: Object.fromEntries([...AROMAS, 'crust'].map((k) => [k, 0])),
  tol: Object.fromEntries([...AROMAS, 'crust'].map((k) => [k, 0.3])),
};
const def = (ideal, tol, set, require) => {
  const myAromas = AROMAS.filter((k) => ideal[k]);
  return {
    ideal: { ...NO_EXTRA.ideal, ...ideal },
    tol: { ...NO_EXTRA.tol, ...tol },
    set,
    require: (f) => require(f)
      && AROMAS.every((k) => myAromas.includes(k) || (f[k] ?? 0) < 0.35) // 自分以外の香りがない
      && (ideal.crust ? true : (f.crust ?? 0) < 0.5), // 焦げた膜は、それを持つデザートだけ
  };
};

export const CONTENT_DEF = {
  pudding: def(
    { egg: 0.7, fat: 0.35, air: 0.0, firm: 0.55, elastic: 0.55 },
    { egg: 0.3, fat: 0.3, air: 0.15, firm: 0.3, elastic: 0.35 },
    { egg_heat: 1.0, gelatin: 0.8, starch: 0.4, agar: 0.2 },
    (f) => f.egg >= 0.3 && f.air < 0.2,
  ),
  pannacotta: def(
    { egg: 0.0, fat: 0.85, air: 0.0, firm: 0.3, elastic: 0.45 },
    { egg: 0.15, fat: 0.2, air: 0.15, firm: 0.25, elastic: 0.3 },
    { gelatin: 1.0, starch: 0.3, egg_heat: 0.2, agar: 0.2 },
    (f) => f.egg < 0.2 && f.fat >= 0.6,
  ),
  bavarois: def(
    { egg: 0.5, fat: 0.75, air: 0.45, firm: 0.4, elastic: 0.4 },
    { egg: 0.25, fat: 0.25, air: 0.2, firm: 0.25, elastic: 0.3 },
    { gelatin: 1.0, egg_heat: 0.3, starch: 0.2, agar: 0.2 },
    (f) => f.egg >= 0.2 && f.air >= 0.25,
  ),
  milkkanten: def(
    { egg: 0.0, fat: 0.15, air: 0.0, firm: 0.85, elastic: 0.2 },
    { egg: 0.15, fat: 0.2, air: 0.15, firm: 0.2, elastic: 0.25 },
    { agar: 1.0, gelatin: 0.3, starch: 0.2, egg_heat: 0.1 },
    (f) => f.set === 'agar',
  ),
  coffeejelly: def(
    { egg: 0.0, fat: 0.05, air: 0.0, firm: 0.5, elastic: 0.5, coffee: 0.8 },
    { egg: 0.15, fat: 0.25, air: 0.15, firm: 0.3, elastic: 0.35 },
    { gelatin: 1.0, agar: 0.9, starch: 0.3 },
    (f) => f.egg < 0.2 && f.coffee >= 0.35,
  ),
  milkpudding: def(
    { egg: 0.0, fat: 0.3, air: 0.0, firm: 0.45, elastic: 0.65 },
    { egg: 0.15, fat: 0.15, air: 0.15, firm: 0.25, elastic: 0.25 },
    { gelatin: 1.0, starch: 0.4, agar: 0.3 },
    (f) => f.egg < 0.2 && f.fat < 0.5,
  ),
  blancmange: def(
    { egg: 0.0, fat: 0.35, air: 0.0, firm: 0.45, elastic: 0.25, almond: 0.7 },
    { egg: 0.15, fat: 0.3, air: 0.15, firm: 0.25, elastic: 0.3 },
    { starch: 1.0, gelatin: 0.85, agar: 0.3, egg_heat: 0.1 },
    (f) => f.egg < 0.2 && f.almond >= 0.35,
  ),
  annin: def(
    { egg: 0.0, fat: 0.3, air: 0.0, firm: 0.6, elastic: 0.3, annin: 0.7 },
    { egg: 0.15, fat: 0.3, air: 0.15, firm: 0.35, elastic: 0.35 },
    { agar: 1.0, gelatin: 0.9, starch: 0.3, egg_heat: 0.1 },
    (f) => f.egg < 0.2 && f.annin >= 0.35,
  ),
  mousse: def(
    { egg: 0.1, fat: 0.7, air: 0.7, firm: 0.2, elastic: 0.2, fruit: 0.7 },
    { egg: 0.25, fat: 0.3, air: 0.2, firm: 0.2, elastic: 0.25 },
    { gelatin: 1.0, none: 0.5 },
    (f) => f.air >= 0.5 && f.fruit >= 0.35,
  ),
  posset: def(
    { egg: 0.0, fat: 0.9, air: 0.0, firm: 0.3, elastic: 0.1, citrus: 0.6 },
    { egg: 0.15, fat: 0.15, air: 0.15, firm: 0.2, elastic: 0.2 },
    { acid: 1.0, gelatin: 0.3 },
    (f) => f.egg < 0.2 && f.citrus >= 0.35,
  ),
  yogurtjelly: def(
    { egg: 0.0, fat: 0.25, air: 0.0, firm: 0.45, elastic: 0.55, yogurt: 0.7 },
    { egg: 0.15, fat: 0.25, air: 0.15, firm: 0.25, elastic: 0.3 },
    { gelatin: 1.0, agar: 0.7 },
    (f) => f.egg < 0.2 && f.yogurt >= 0.35,
  ),
  muhallabia: def(
    { egg: 0.0, fat: 0.3, air: 0.0, firm: 0.4, elastic: 0.2, rose: 0.7 },
    { egg: 0.15, fat: 0.3, air: 0.15, firm: 0.25, elastic: 0.3 },
    { starch: 1.0, gelatin: 0.5 },
    (f) => f.egg < 0.2 && f.rose >= 0.35,
  ),
  haupia: def(
    { egg: 0.0, fat: 0.5, air: 0.0, firm: 0.75, elastic: 0.2, coconut: 0.7 },
    { egg: 0.15, fat: 0.3, air: 0.15, firm: 0.2, elastic: 0.25 },
    { starch: 1.0, agar: 0.5, gelatin: 0.3 },
    (f) => f.egg < 0.2 && f.coconut >= 0.35,
  ),
  brulee: def(
    { egg: 0.75, fat: 0.7, air: 0.0, firm: 0.45, elastic: 0.4, crust: 1 },
    { egg: 0.3, fat: 0.3, air: 0.15, firm: 0.3, elastic: 0.35, crust: 0.4 },
    { egg_heat: 1.0, gelatin: 0.3 },
    (f) => f.egg >= 0.3 && f.air < 0.2 && f.crust >= 0.5,
  ),
  gingermilk: def(
    { egg: 0.0, fat: 0.25, air: 0.0, firm: 0.2, elastic: 0.15, ginger: 0.7 },
    { egg: 0.15, fat: 0.25, air: 0.15, firm: 0.2, elastic: 0.2 },
    { enzyme: 1.0 },
    (f) => f.egg < 0.2 && f.ginger >= 0.35,
  ),
};
export const CONTENT_WEIGHT = {
  egg: 1.5, fat: 1, air: 1.5, firm: 1, elastic: 0.7, crust: 2,
  ...Object.fromEntries(AROMAS.map((k) => [k, 1.5])),
};

// ---- 見た目の定義 ------------------------------------------------
// 見た目の特徴値は中身から計算する（model.js の lookFeatures）。
// 色は個体差が大きい（白いプリン、黄色いパンナコッタもある）ため、yellow の許容幅は広め。
// brown（茶色）はコーヒー、pink は果物、crust は焦がした膜から決まる。
const LOOK_BASE = {
  ideal: { caramel: 0, cubes: 0, water: 0, whip: 0, brown: 0, pink: 0, crust: 0 },
  tol: { caramel: 0.6, cubes: 0.4, water: 0.3, whip: 0.6, brown: 0.3, pink: 0.3, crust: 0.3 },
};
const look = (ideal, tol) => ({ ideal: { ...LOOK_BASE.ideal, ...ideal }, tol: { ...LOOK_BASE.tol, ...tol } });
export const LOOK_DEF = {
  pudding: look({ yellow: 0.65, gloss: 0.6, caramel: 0.8 }, { yellow: 0.4, gloss: 0.35, cubes: 0.3, whip: 0.45 }),
  pannacotta: look({ yellow: 0.15, gloss: 0.8, caramel: 0.3, whip: 0.2 }, { yellow: 0.3, gloss: 0.3, caramel: 0.8, whip: 0.9 }),
  bavarois: look({ yellow: 0.4, gloss: 0.2, whip: 0.5 }, { yellow: 0.3, gloss: 0.25, caramel: 0.7, whip: 1 }),
  milkkanten: look({ yellow: 0.05, gloss: 0.45, water: 0.4 }, { yellow: 0.25, gloss: 0.35, water: 0.4 }),
  coffeejelly: look({ yellow: 0, gloss: 0.85, brown: 1, whip: 0.3 }, { yellow: 0.4, gloss: 0.3, brown: 0.35, whip: 0.9 }),
  milkpudding: look({ yellow: 0.1, gloss: 0.85, caramel: 0.2 }, { yellow: 0.3, gloss: 0.3, caramel: 0.8 }),
  blancmange: look({ yellow: 0.03, gloss: 0.35 }, { yellow: 0.2, gloss: 0.25 }),
  annin: look({ yellow: 0.03, gloss: 0.55, water: 0.45 }, { yellow: 0.2, gloss: 0.35, water: 0.45 }),
  mousse: look({ yellow: 0.1, gloss: 0.1, pink: 0.8, whip: 0.3 }, { yellow: 0.3, gloss: 0.25, pink: 0.4, whip: 1 }),
  posset: look({ yellow: 0.15, gloss: 0.45 }, { yellow: 0.3, gloss: 0.3 }),
  yogurtjelly: look({ yellow: 0.03, gloss: 0.6, water: 0.3 }, { yellow: 0.25, gloss: 0.3, water: 0.4 }),
  muhallabia: look({ yellow: 0.03, gloss: 0.35 }, { yellow: 0.2, gloss: 0.25 }),
  haupia: look({ yellow: 0.02, gloss: 0.35 }, { yellow: 0.2, gloss: 0.25 }),
  brulee: look({ yellow: 0.6, gloss: 0.6, crust: 1 }, { yellow: 0.4, gloss: 0.4, crust: 0.4 }),
  gingermilk: look({ yellow: 0.05, gloss: 0.5, water: 0.3 }, { yellow: 0.25, gloss: 0.35, water: 0.4 }),
};
export const LOOK_WEIGHT = {
  yellow: 2, gloss: 1, caramel: 1, cubes: 1, water: 1, whip: 1.5, brown: 2, pink: 2, crust: 2,
};

// ---- ルール ------------------------------------------------------
export const RULES = {
  timeMax: 50, // 1面の制限時間（分）。2面以降は難易度の段階表で決まる
  fullTarget: 80, // 腹八分目
  fullMax: 120, // 腹十二分目
  fullPerItem: 20, // 1個まるごと食べたときの満腹度（満足まで4個、限界は6個）
  sisterLookWeight: 0.7, // 妹の判定での見た目の比重
  failContent: 35, // 中身の適合度がどれもこれ未満なら「失敗作」
  failSister: 40, // 妹から見た適合度がどれもこれ未満なら「得体の知れないもの」
  // 判定は「見た目上の」原形と量で行う（修復で隠せる）。
  // 弱く押す・揺らす程度は気づかれない。普通に押すと痕跡、全力で押す・すくう・味見は発覚。
  traceMinor: { shape: 96, amount: 0.99 }, // 下回ると「痕跡あり」
  traceMajor: { shape: 85, amount: 0.95 }, // 下回ると「発覚」
};

// ---- 修復 --------------------------------------------------------
export const REPAIR_RULES = {
  whipHide: 25, // ホイップで隠せる損傷
  whipVolume: 0.05, // ホイップで量が多く見える分
  sauceHide: 10, // ソースで隠せる損傷
  sauceVolume: 0.04, // ソースが小さな欠けを埋めて、量が減ったのを目立たなくする分（すくった跡は隠せる）
  smallCup: 0.85, // 小さい容器に移すと、量が 1/0.85 倍に見える
  graftMax: 0.15, // 1回の移植で移す量
  graftFill: 8, // 穴を詰めたときの原形回復
  graftSeamCap: 97, // 移植しても継ぎ目は残る
  graftMismatch: 30, // 色・つやの違いが目立つときの損傷
};

// ---- ステージ ----------------------------------------------------
// 正体は中身の適合度から自動で決まる。ここには書かない。
// colorBias: 色の個体差（マイナスで白く、プラスで黄色く）
export const BASE_ITEM = {
  su: 0, syneresis: 0, caramel: false, cubes: false, colorBias: 0, crust: 0,
  ...Object.fromEntries(AROMAS.map((k) => [k, 0])),
};
const base = BASE_ITEM;

// 作り直し用の材料
export const INGREDIENT_IDS = [
  'whole', 'yolk', 'white', 'milk', 'cream', 'gelatin', 'agar', 'starch',
  'almond', 'annin', 'coffee', 'lemon', 'yogurt', 'rose', 'coconut', 'ginger', 'berry',
];

// 1面（練習）：固定。指示は「プリンは食べないで」
export const TUTORIAL = {
  order: { type: 'keepAll', names: ['pudding'] },
  time: 50,
  mats: { whip: 2, sauce: 1, cup: 1 },
  ingredients: {
    whole: 2, yolk: 1, white: 1, milk: 3, cream: 2, gelatin: 2, agar: 1, starch: 1,
    almond: 0, annin: 0, coffee: 0, lemon: 0, yogurt: 0, rose: 0, coconut: 0, ginger: 0, berry: 0,
  },
  items: [
    // 焼きプリン（カラメルあり、すが入っている）
    { ...base, egg: 0.75, fat: 0.35, air: 0, set: 'egg_heat', firm: 0.6, elastic: 0.5, su: 0.4, caramel: true },
    // カラメルソースのパンナコッタ（少し黄色い）
    { ...base, egg: 0, fat: 0.85, air: 0, set: 'gelatin', firm: 0.3, elastic: 0.45, caramel: true, colorBias: 0.3 },
    // ババロア
    { ...base, egg: 0.5, fat: 0.75, air: 0.45, set: 'gelatin', firm: 0.4, elastic: 0.35 },
    // 牛乳寒天（少し離水）
    { ...base, egg: 0, fat: 0.15, air: 0, set: 'agar', firm: 0.85, elastic: 0.2, syneresis: 0.5 },
    // ゼラチンで固めたプリン（カラメルなし、着色で黄色い）
    { ...base, egg: 0.4, fat: 0.4, air: 0, set: 'gelatin', firm: 0.45, elastic: 0.65, colorBias: 0.3 },
    // パンナコッタ（白い）
    { ...base, egg: 0, fat: 0.85, air: 0, set: 'gelatin', firm: 0.3, elastic: 0.45 },
    // 角切りの牛乳寒天
    { ...base, egg: 0, fat: 0.15, air: 0, set: 'agar', firm: 0.85, elastic: 0.2, syneresis: 0.4 },
  ],
};

// 2面以降の自動生成
export const GEN = {
  puddingOnlyUntil: 1, // この面まではプリン指定のみ（＝1面だけ）
  orderWeights: { keepAll: 4, keepN: 2, keepTwo: 2, onlyEat: 1 }, // 指示の種類と出やすさ
  notTarget: ['coffeejelly'], // 見分けやすい「安全枠」。お題にはしない
  // 作り直し用の材料の在庫 [最小, 最大]（加えると1つ減る。泡立てた生クリームも生クリームを1つ使う）
  ingredients: {
    whole: [1, 2], yolk: [1, 2], white: [0, 1], milk: [2, 3], cream: [1, 2],
    gelatin: [1, 2], agar: [0, 1], starch: [0, 1], almond: [0, 1], annin: [0, 1],
    coffee: [0, 1], lemon: [0, 1], yogurt: [0, 1], rose: [0, 1], coconut: [0, 1], ginger: [0, 1], berry: [0, 1],
  },
  // 残すべきデザートの作り直しに欠かせない材料（そのステージでは必ず1つ以上入れる）
  keyIngredient: {
    coffeejelly: 'coffee', blancmange: 'almond', annin: 'annin', mousse: 'berry', posset: 'lemon',
    yogurtjelly: 'yogurt', muhallabia: 'rose', haupia: 'coconut', gingermilk: 'ginger',
  },
  // 冷蔵庫の構成（ステージに関係なく、この範囲でぶれる）
  edible: [5, 6], // 食べてよいものの数（満足まで4個＋余裕）
  keepCount: [1, 3], // 「Xは食べないで」のときのXの数
  onlyEatOthers: [2, 4], // 「食べていいのはXだけ」のときの、X以外（守る対象）の数
  // 難易度の段階。from 以上のステージで使う（下ほど後半）。出てくるデザートは DESSERT_FROM で決まる
  //   obviousMax … 食べてよいもののうち、残すべきものと紛らわしくないもの（見分けやすいもの）の上限
  //   time       … 制限時間（分）
  //   lure       … 見た目の引っかけ（カラメル付きのパンナコッタなど）を作る確率
  //   mats       … 修復材料 [最小, 最大]
  //   fullTarget … クリアに必要な満腹度（省略時は RULES.fullTarget = 80、4個分）
  //   edible     … 食べてよいものの数（省略時は edible）
  levels: [
    { from: 2, obviousMax: 3, time: 50, lure: 0.1, mats: { whip: [1, 2], sauce: [1, 1], cup: [1, 1] } },
    { from: 3, obviousMax: 3, time: 48, lure: 0.15, mats: { whip: [1, 2], sauce: [1, 1], cup: [1, 1] } },
    { from: 4, obviousMax: 2, time: 46, lure: 0.2, mats: { whip: [1, 2], sauce: [1, 1], cup: [1, 1] } },
    { from: 7, obviousMax: 2, time: 43, lure: 0.3, mats: { whip: [1, 1], sauce: [1, 1], cup: [0, 1] } },
    { from: 10, obviousMax: 1, time: 42, lure: 0.4, mats: { whip: [0, 1], sauce: [0, 1], cup: [0, 1] }, fullTarget: 100, edible: [6, 7] },
  ],
  // 紛らわしい相手
  confusables: {
    pudding: ['bavarois', 'pannacotta', 'milkpudding', 'brulee'],
    pannacotta: ['pudding', 'blancmange', 'bavarois', 'milkpudding', 'posset'],
    bavarois: ['pudding', 'pannacotta', 'mousse'],
    milkkanten: ['annin', 'blancmange', 'haupia'],
    coffeejelly: [],
    milkpudding: ['pannacotta', 'pudding', 'yogurtjelly'],
    blancmange: ['annin', 'pannacotta', 'milkkanten', 'muhallabia'],
    annin: ['blancmange', 'milkkanten', 'muhallabia'],
    mousse: ['bavarois', 'yogurtjelly'],
    posset: ['pannacotta', 'yogurtjelly', 'milkpudding'],
    yogurtjelly: ['posset', 'milkpudding', 'mousse'],
    muhallabia: ['blancmange', 'annin', 'haupia'],
    haupia: ['milkkanten', 'muhallabia', 'blancmange'],
    brulee: ['pudding'],
    gingermilk: ['milkpudding', 'posset', 'annin'],
  },
  // 個体のテンプレート。[最小, 最大] は範囲内でランダム、caramel は確率、lure は引っかけ時の上書き
  templates: {
    pudding: [
      { w: 3, set: 'egg_heat', egg: [0.65, 0.8], fat: [0.3, 0.4], firm: [0.55, 0.65], elastic: [0.45, 0.55], su: [0.2, 0.45], caramel: 0.7, white: 0.25 },
      { w: 2, set: 'gelatin', egg: [0.4, 0.5], fat: [0.35, 0.45], firm: [0.42, 0.5], elastic: [0.6, 0.7], colorBias: [0.2, 0.35], caramel: 0.4 },
    ],
    pannacotta: [
      {
        w: 1, set: 'gelatin', egg: [0, 0], fat: [0.8, 0.9], firm: [0.25, 0.35], elastic: [0.4, 0.5], colorBias: [0, 0.4], caramel: 0.4,
        lure: { colorBias: [0.3, 0.45], caramel: 1 }, // プリンに見せかける
      },
    ],
    bavarois: [
      {
        w: 1, set: 'gelatin', egg: [0.45, 0.55], fat: [0.7, 0.8], air: [0.4, 0.5], firm: [0.35, 0.45], elastic: [0.3, 0.4], colorBias: [0, 0.15], caramel: 0.2,
        lure: { colorBias: [0.15, 0.25], caramel: 1 },
      },
    ],
    milkkanten: [
      {
        w: 1, set: 'agar', egg: [0, 0], fat: [0.1, 0.2], firm: [0.8, 0.9], elastic: [0.15, 0.25], syneresis: [0.3, 0.55], colorBias: [0, 0.05],
        lure: { syneresis: [0.5, 0.65], firm: [0.7, 0.8] }, // 杏仁豆腐のように水が出て、少し柔らかい
      },
    ],
    coffeejelly: [
      { w: 2, set: 'gelatin', egg: [0, 0], fat: [0, 0.1], firm: [0.4, 0.55], elastic: [0.45, 0.6], coffee: [0.7, 0.9] },
      { w: 1, set: 'agar', egg: [0, 0], fat: [0, 0.1], firm: [0.55, 0.65], elastic: [0.3, 0.45], coffee: [0.7, 0.9] },
    ],
    milkpudding: [
      {
        w: 1, set: 'gelatin', egg: [0, 0], fat: [0.2, 0.35], firm: [0.4, 0.5], elastic: [0.6, 0.7], colorBias: [0, 0.25], caramel: 0.3,
        lure: { colorBias: [0.3, 0.45], caramel: 1 }, // 「名前にプリンとある」うえに、見た目もプリン
      },
    ],
    blancmange: [
      {
        w: 3, set: 'starch', egg: [0, 0], fat: [0.3, 0.4], firm: [0.4, 0.5], elastic: [0.2, 0.3], almond: [0.6, 0.75],
        lure: { set: 'gelatin', elastic: [0.45, 0.55] }, // ゼラチンでつやがあり、パンナコッタのよう
      },
      { w: 2, set: 'gelatin', egg: [0, 0], fat: [0.3, 0.4], firm: [0.4, 0.5], elastic: [0.45, 0.55], almond: [0.6, 0.75] },
    ],
    annin: [
      { w: 3, set: 'agar', egg: [0, 0], fat: [0.25, 0.35], firm: [0.6, 0.7], elastic: [0.25, 0.35], syneresis: [0.5, 0.65], annin: [0.6, 0.75] },
      { w: 2, set: 'gelatin', egg: [0, 0], fat: [0.35, 0.45], firm: [0.4, 0.5], elastic: [0.45, 0.55], annin: [0.6, 0.75] },
    ],
    mousse: [
      {
        w: 1, set: 'gelatin', egg: [0, 0.15], fat: [0.6, 0.8], air: [0.6, 0.8], firm: [0.15, 0.25], elastic: [0.15, 0.25], fruit: [0.55, 0.8],
        lure: { fruit: [0.4, 0.45] }, // 色が淡く、ババロアのよう
      },
    ],
    posset: [
      { w: 1, set: 'acid', egg: [0, 0], fat: [0.85, 0.95], firm: [0.25, 0.35], elastic: [0.05, 0.15], citrus: [0.55, 0.7], colorBias: [0, 0.2] },
    ],
    yogurtjelly: [
      { w: 1, set: 'gelatin', egg: [0, 0], fat: [0.15, 0.3], firm: [0.4, 0.5], elastic: [0.5, 0.6], syneresis: [0.2, 0.45], yogurt: [0.6, 0.8] },
    ],
    muhallabia: [
      { w: 1, set: 'starch', egg: [0, 0], fat: [0.25, 0.35], firm: [0.35, 0.45], elastic: [0.15, 0.25], rose: [0.6, 0.8] },
    ],
    haupia: [
      { w: 1, set: 'starch', egg: [0, 0], fat: [0.4, 0.6], firm: [0.7, 0.8], elastic: [0.15, 0.25], coconut: [0.6, 0.8] },
    ],
    brulee: [
      { w: 1, set: 'egg_heat', egg: [0.7, 0.8], fat: [0.6, 0.8], firm: [0.4, 0.5], elastic: [0.35, 0.45], crust: [0.85, 1], su: [0, 0.15] },
    ],
    gingermilk: [
      { w: 1, set: 'enzyme', egg: [0, 0], fat: [0.2, 0.3], firm: [0.15, 0.25], elastic: [0.1, 0.2], syneresis: [0.2, 0.4], ginger: [0.6, 0.8] },
    ],
  },
  // 指示対象が判別できることの保証：中身の適合度で、正体と次点の差がこれ以上
  minMargin: 20,
};

export const MAT_LABEL = { whip: 'ホイップ', sauce: 'カラメルソース', cup: '小さい容器' };

// ---- 図鑑（一般的な傾向。個体の正解ではない） --------------------
// 調理の一般知識（図鑑に表示）
export const COOK_TIPS = [
  'ゼラチンは温かい液に溶ける。冷たい液では溶け残る。煮立てると固まる力が弱まる。',
  'ゼラチンで固めるものは、冷やさないと固まらない。',
  '寒天は、煮立てないと溶けない。',
  'でんぷんは、煮立てるととろみがつき、冷めると固まる。',
  '卵の入った液を煮立てると、卵だけが先に固まってぼそぼそになる。',
  '卵液は、容器に入れて蒸すと全体がなめらかに固まる。',
  '泡は熱に弱い。温かい液に混ぜたり、後から加熱したりすると消える。',
  'レモン汁を温めた生クリームに加えて冷やすと、ゼラチンなしでもとろりと固まる。',
  'ショウガ汁は、温めた牛乳と合わせるとすぐに固まる。煮立てるとその力がなくなる。',
  '表面に砂糖をのせて焦がすと、硬いカラメルの膜ができる。',
  '冷凍庫で急いで冷やすと早いが、表面に霜が付く。',
  'エッセンスや果汁などは、加えるだけで香りや色が付く。',
];

// 図鑑：主な材料（一般的なもの）
export const ZUKAN_ING = {
  pudding: ['卵', '牛乳', '（生クリーム）', '（カラメル）'],
  pannacotta: ['生クリーム', '牛乳', 'ゼラチン'],
  bavarois: ['卵黄', '牛乳', 'ゼラチン', '泡立てた生クリーム'],
  milkkanten: ['牛乳', '寒天'],
  coffeejelly: ['コーヒー', 'ゼラチン（または寒天）'],
  milkpudding: ['牛乳', 'ゼラチン'],
  blancmange: ['牛乳', 'でんぷん（またはゼラチン）', 'アーモンドの香り'],
  annin: ['牛乳', '寒天（またはゼラチン）', '杏仁の香り'],
  mousse: ['果物', '泡立てた生クリーム', 'ゼラチン'],
  posset: ['生クリーム', 'レモン汁'],
  yogurtjelly: ['ヨーグルト', 'ゼラチン', '（牛乳）'],
  muhallabia: ['牛乳', 'でんぷん', 'ローズウォーター'],
  haupia: ['ココナッツミルク', 'でんぷん'],
  brulee: ['卵黄', '生クリーム', '牛乳', '砂糖（表面）'],
  gingermilk: ['牛乳', 'ショウガ汁'],
};

// 図鑑：各デザートが「何をどうしたものか」
export const ZUKAN_BASE = {
  pudding: '卵と牛乳（や生クリーム）を合わせた卵液を、容器に入れて蒸したり焼いたりして固めたもの。ゼラチンなどで冷やし固めたものもある。',
  pannacotta: '生クリームと牛乳を温めてゼラチンを溶かし、冷やし固めたもの。',
  bavarois: '卵黄と牛乳を温めてゼラチンを溶かしたものに、泡立てた生クリームを混ぜ込み、冷やし固めたもの。',
  milkkanten: '牛乳に寒天を煮溶かして、冷やし固めたもの。',
  coffeejelly: 'コーヒーにゼラチン（または寒天）を溶かし、冷やし固めたもの。',
  milkpudding: '牛乳を温めてゼラチンを溶かし、冷やし固めたもの。名前に「プリン」とあるが、卵は使わない。',
  blancmange: '牛乳にアーモンドの香りを付け、でんぷんでとろみをつけて（またはゼラチンを溶かして）冷やし固めたもの。',
  annin: '牛乳に杏仁の香りを付け、寒天（またはゼラチン）で冷やし固めたもの。',
  mousse: '果物などの風味の生地に、泡立てた生クリームをたっぷり混ぜ込み、ゼラチンで軽く固めたもの。',
  posset: '温めた生クリームにレモン汁を加え、冷やして固めたもの。ゼラチンなどは使わない。',
  yogurtjelly: 'ヨーグルトにゼラチンを溶かし込み、冷やし固めたもの。',
  muhallabia: '牛乳にでんぷんでとろみをつけ、ローズウォーターで香りを付けて冷やし固めた、中東のデザート。',
  haupia: 'ココナッツミルクをでんぷんで煮固めた、ハワイのデザート。',
  brulee: '濃い卵液を蒸し焼きにして固め、表面に砂糖をのせて焦がしたもの。',
  gingermilk: 'ショウガ汁に温めた牛乳を注ぎ、ショウガの力で固めた、中国・広東のデザート。',
};

export const ZUKAN = {
  pudding: [
    '卵を使い、卵の風味がある。黄色いものが多いが、卵白主体の白いものもある。',
    '卵を加熱して固めるものが典型。ゼラチンなどで固めたものも、本作ではプリンに含める。',
    '気泡はほとんどない。加熱して固めたものは、断面に小さな穴（す）が入ることがある。',
    'カラメルがかかっていることが多いが、必須ではない。',
  ],
  pannacotta: [
    '卵を使わない。生クリームが主体で、乳脂肪が多い。',
    'ゼラチンで固める。柔らかく、口の中でとろける。',
    '白〜アイボリーで、表面につやがある。',
    'ベリーやカラメルのソースを合わせることがある。',
  ],
  bavarois: [
    '卵黄を使ったベースに、泡立てた生クリームを加えて、ゼラチンで固める。',
    '内部に細かな気泡を含み、軽いのにコクがある。',
    '淡い黄色で、表面はマット。',
  ],
  milkkanten: [
    '牛乳を寒天で固める。卵は使わない。',
    '硬めで、ほとんど揺れない。歯切れが良く、スプーンでさくっと割れる。',
    '時間がたつと水が出る（離水）。',
  ],
  coffeejelly: [
    'コーヒーの香りと苦みがある。卵や乳はほとんど使わない。',
    '濃い茶色で、透き通ったつやがある。',
    'ひと目で分かることが多い。',
  ],
  milkpudding: [
    '卵を使わない。牛乳が主体で、乳脂肪は少なめ。さっぱりしている。',
    'ゼラチンで固める。ぷるんとよく弾む。',
    '白くてつやがある。本作では、名前に「プリン」とあってもプリンではない。',
  ],
  blancmange: [
    '牛乳を、でんぷん（またはゼラチン）で固める。卵は使わない。',
    'アーモンドの香りがある。香ばしく、ナッツを砕いたような丸い香り。',
    '純白で、表面はマット。でんぷんで固めると、もったりした口当たりになる。',
  ],
  annin: [
    '牛乳に杏仁の香りを付けて、寒天（またはゼラチン）で固める。卵は使わない。',
    '杏仁の香りがある。桃やさくらんぼの種を思わせる、甘く鋭く抜ける香り。',
    '白い。寒天で固めたものは、少し水が出ることがある。',
  ],
  mousse: [
    '気泡がとても多く、ふわふわと軽い。押すと沈んで戻らない。',
    '果物の香りがはっきりしていて、ほんのり色づいていることが多い。',
    '卵黄の風味はあまりしない。',
  ],
  posset: [
    '生クリームが主体で、とても濃厚。卵は使わない。',
    'ゼラチンなどを使わず、レモンの酸で固まる。弾力はなく、スプーンの跡がそのまま残る。',
    'レモンの香りとほのかな酸味がある。',
  ],
  yogurtjelly: [
    'ヨーグルトの酸味と香りがある。卵は使わない。',
    'ゼラチンで固める。白く、ぷるんとしている。',
    '少し水が出ることがある。',
  ],
  muhallabia: [
    '牛乳をでんぷんで固める。卵は使わない。',
    'ローズウォーター（バラ）の華やかな香りがある。',
    '白く、もったりした口当たり。',
  ],
  haupia: [
    'ココナッツミルクをでんぷんで固める。卵は使わない。',
    'ココナッツの甘い香りがある。',
    '白く、硬めで、切っても形を保つ。',
  ],
  brulee: [
    '卵黄と生クリームを使った、とても濃い卵液で作る。',
    '表面が、焦がした砂糖の硬い膜で覆われている。叩くとコツコツと音がする。',
    '膜の下はとろりと柔らかい。',
  ],
  gingermilk: [
    '牛乳をショウガの力で固める。卵もゼラチンも使わない。',
    'とても柔らかく、強く触るとすぐに崩れる。',
    'ショウガのぴりっとした香りがある。',
  ],
};
