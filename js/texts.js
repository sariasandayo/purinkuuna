// =============================================================
// 鑑定結果の言葉（文章はすべて仮。後でまとめて修正する）
// ・同じ特徴でも言い回しを複数用意し、毎回ランダムに選ぶ
// ・しきい値に揺らぎを入れるので、境目の個体は調べるたびに言い方が変わる
// ・違うデザートでも同じ言葉が出ることがある（キーワードだけで判別させない）
// ・観察や揺らすなど弱い鑑定は、特徴の一部しか返さない
// ・壊さない鑑定（観察・におい・揺らす・押す）は、わざと曖昧にしている。
//   揺らぎを大きくし、固め方や卵の有無は「たまに分かる」程度。はっきり確かめるには、すくう・味見が必要
// ・すくうは断面（固め方の手応え・気泡・穴・水分・層）、味見は味（卵・乳脂肪・香り）が分かる
// det = true のとき（結果画面の手掛かり用）は、揺らぎなし・先頭の言い回し・全特徴
// =============================================================
import { lookFeatures } from './model.js';

let DET = false;
const jit = () => (DET ? 0 : (Math.random() - 0.5) * 0.14);
const vjit = () => (DET ? 0 : (Math.random() - 0.5) * 0.4); // 壊さない鑑定用の大きな揺らぎ
const say = (pool) => (DET ? pool[0] : pool[Math.floor(Math.random() * pool.length)]);
const chance = (p) => !DET && Math.random() < p;
function some(lines, k) {
  if (DET) return lines;
  const a = [...lines];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

// 特徴 {key, text} の中から k 個選ぶ。この個体でまだ出ていない特徴を優先する
function pickNew(it, feats, k) {
  if (DET) return feats.map((f) => f.text);
  it.seen = it.seen || [];
  const fresh = feats.filter((f) => !it.seen.includes(f.key));
  const old = feats.filter((f) => it.seen.includes(f.key));
  const chosen = [];
  for (const group of [fresh, old]) {
    const g = [...group];
    while (g.length && chosen.length < k) chosen.push(g.splice(Math.floor(Math.random() * g.length), 1)[0]);
  }
  for (const f of chosen) if (!it.seen.includes(f.key)) it.seen.push(f.key);
  return chosen.map((f) => f.text);
}
const tries = (it, id) => (it.tries && it.tries[id]) || 0;

// 香りごとの言葉（においを嗅ぐ／味見）。香りは、においを嗅ぐと必ず分かる
const AROMA_SMELL = {
  almond: ['香ばしく、ナッツを砕いたような丸い香りがする。', 'ナッツのような香ばしい香りがする。'],
  annin: ['桃やさくらんぼの種を思わせる、甘く鋭く抜ける香りがする。', '甘く、つんと抜ける独特の香りがする。'],
  coffee: ['コーヒーの香りがする。', '香ばしく、ほろ苦い香りがする。'],
  citrus: ['レモンのさわやかな香りがする。', 'すっきりした柑橘の香りがする。'],
  yogurt: ['ヨーグルトのような、酸っぱい匂いがする。', 'ほんのり酸っぱい匂いがする。'],
  rose: ['花のような、華やかな香りがする。', 'バラの香りがする。'],
  coconut: ['甘いココナッツの香りがする。', '南国のような甘い香りがする。'],
  ginger: ['ショウガのぴりっとした香りがする。', 'つんとくる、スパイシーな香りがする。'],
  fruit: ['甘酸っぱい果物の香りがする。', 'ベリーのような香りがする。'],
};
const AROMA_TASTE = {
  almond: ['ナッツのような香ばしい風味が口に広がる。', '香ばしい風味が残る。'],
  annin: ['甘く鋭い、独特の香りが鼻に抜ける。', 'つんと抜ける香りが残る。'],
  coffee: ['コーヒーのほろ苦さが広がる。', '苦みのある大人の味。'],
  citrus: ['レモンの酸味が、ほのかに効いている。', 'さわやかな酸味がある。'],
  yogurt: ['ヨーグルトの酸味がある。', 'さわやかな酸味がある。'],
  rose: ['花の香りが口いっぱいに広がる。', '華やかな香りが鼻に抜ける。'],
  coconut: ['ココナッツの甘い風味がする。', '南国のような甘い風味。'],
  ginger: ['ショウガがぴりっと効いている。', 'あとから舌がぴりっとする。'],
  fruit: ['甘酸っぱい果物の味がする。', 'さわやかな酸味がある。'],
};
const aromaKeys = (it, k = 1) => Object.keys(AROMA_SMELL).filter((a) => (it[a] || 0) * k > 0.35);
// においで香りがはっきりしないときの言葉（どの香りでも出る）
const VAGUE_AROMA = ['何かの香りがするが、はっきりしない。', 'ほんのり甘い香りがする気がする。', '冷蔵庫の匂いに混じって、何かの香りがする。'];

// ---- 観察 --------------------------------------------------------
export function lookText(it) {
  const f = lookFeatures(it);
  if (it.whip) {
    return [
      say(['上面はホイップに覆われていて、表面が見えない。', 'ホイップがこんもり載っている。']),
      f.yellow + jit() > 0.3 ? say(['ホイップの下から、黄色っぽい本体がのぞく。', '下の生地は少し黄色い。'])
        : say(['ホイップの下の生地は白っぽい。', '下の生地はほとんど白い。']),
    ];
  }
  const feats = [];
  const push = (key, text) => feats.push({ key: `look-${key}`, text });
  const y = f.yellow + vjit();
  if (f.brown + jit() > 0.5) push('color', say(['濃い茶色で、透き通っている。', 'コーヒー色をしている。', '黒っぽい茶色だ。']));
  else if (f.pink + jit() > 0.4) push('color', say(['淡いピンク色をしている。', 'ほんのり色づいている。', 'やさしいクリーム色だ。']));
  else if (y > 0.55) push('color', say(['濃い卵色をしている。', '黄色みが強い。', 'こっくりした黄色だ。']));
  else if (y > 0.3) push('color', say(['淡いクリーム色をしている。', 'ほんのり黄色い。', 'やさしいクリーム色だ。', '白に少し黄色を混ぜたような色。']));
  else push('color', say(['白っぽい色をしている。', '乳白色をしている。', 'ほとんど真っ白だ。', 'やさしいクリーム色だ。']));
  const g = f.gloss + vjit();
  if (g > 0.65) push('gloss', say(['表面につやがある。', '表面がつるりと光っている。', 'みずみずしいつやがある。']));
  else if (g < 0.35) push('gloss', say(['表面はマットで、しっとりしている。', '表面に光沢がない。', '表面がふんわり曇って見える。']));
  else push('gloss', say(['表面はなめらかだが、強いつやはない。', '表面はなめらかだ。', 'ほどほどのつやがある。']));
  if (f.crust > 0.5) push('crust', say(['表面がこんがり焦げて、硬そうな膜になっている。', '表面が飴色に光っている。', '上に茶色いソースがかかっている。']));
  if (it.caramel || it.sauce) push('caramel', say(['上に茶色いソースがかかっている。', 'カラメル色のソースが載っている。']));
  if (f.water + vjit() > 0.3) push('water', say(['容器のふちに、少し水が溜まっている。', '表面がうっすら濡れている。', '底のほうに水分が見える。']));
  const out = pickNew(it, feats, 1); // 観察で分かるのは1回に1つ（まだ見ていない特徴を優先）
  if (chance(0.5)) out.push(say(['冷蔵庫の明かりで、ほんのり光って見える。', '見た目は、よくある冷たいデザートだ。', '容器の中にきれいに収まっている。', '特に変わったところはない。']));
  return out;
}

// ---- においを嗅ぐ ------------------------------------------------
export function smellText(it) {
  const out = [];
  const k = it.whip ? 0.5 : 1; // ホイップがあると匂いが弱まる
  if (it.whip) out.push(say(['ホイップの甘い匂いが強くて、下の匂いは分かりにくい。', 'クリームの匂いばかりする。']));
  // 香りは、はっきり分かるとは限らない（味見なら確実）
  // 2回目以降は、香りも卵の匂いもはっきり分かる
  const sure = tries(it, 'sniff') >= 2;
  for (const a of aromaKeys(it, k)) out.push(DET || sure || chance(0.65) ? say(AROMA_SMELL[a]) : say(VAGUE_AROMA));
  const rest = [];
  const e = it.egg * k + (sure ? 0 : vjit());
  if (DET || sure || chance(0.5)) {
    if (e > 0.6) rest.push({ key: 'sniff-egg', text: say(['卵の匂いがする気がする。', 'カスタードのような匂いがする。']) });
    else if (e > 0.3) rest.push({ key: 'sniff-egg', text: say(['ほのかに卵の匂いがする…ような気もする。', 'かすかにカスタードっぽい匂い？']) });
  }
  if (it.caramel || it.sauce || (it.crust || 0) > 0.5) rest.push({ key: 'sniff-caramel', text: say(['カラメルの香ばしい匂いがする。', '焦がした砂糖の匂いがする。']) });
  if (it.fat * k + vjit() > 0.7) rest.push({ key: 'sniff-milk', text: say(['濃いミルクの匂いがする。', 'こってりした乳の匂いがする。']) });
  else rest.push({ key: 'sniff-milk', text: say(['牛乳のやさしい匂いがする。', 'ミルクの匂いがする。']) });
  // 卵の匂いがあれば、2回目以降は必ず出す。それ以外は、まだ嗅いでいない匂いを優先
  const eggLine = rest.find((x) => x.key === 'sniff-egg');
  if (DET) out.push(...rest.map((x) => x.text));
  else if (sure && eggLine) { out.push(eggLine.text); it.seen = it.seen || []; if (!it.seen.includes('sniff-egg')) it.seen.push('sniff-egg'); } else out.push(...pickNew(it, rest, 1));
  if (chance(0.4)) out.push(say(['甘い匂いがする。', '冷蔵庫の匂いが少し移っている。']));
  return out;
}

// ---- 揺らす ------------------------------------------------------
export function shakeText(it) {
  if (it.set === 'none') return [say(['たぷたぷと揺れる。固まっていない。', '液体のように波打つ。'])];
  // 固め方ごとの特徴的な揺れ方は、たまにしか分からない
  if (DET || chance(tries(it, 'shake') >= 2 ? 0.75 : 0.35)) {
    if (it.set === 'starch') return [say(['ゆっくり重たげに揺れて、すぐ止まる。', 'もったりと少しだけ揺れる。'])];
    if (it.set === 'agar') return [say(['小刻みに震えて、すぐ止まる。', 'ほとんど揺れない。'])];
    if (it.set === 'acid') return [say(['とろりと重たげに、少しだけ揺れる。'])];
    if (it.set === 'enzyme') return [say(['ふるふると頼りなく揺れる。今にも崩れそうだ。'])];
    if (it.air > 0.3) return [say(['ふるふると、表面だけが軽く震える。', 'ふわっと軽く揺れる。'])];
  }
  // それ以外は、柔らかさと弾みの大まかな印象だけ
  const soft = (1 - it.firm) * 0.6 + it.elastic * 0.4 + vjit();
  if (soft > 0.6) return [say(['ぷるぷるとよく揺れる。', 'ゆらゆらと大きく揺れる。', '弾むように揺れる。'])];
  if (soft > 0.42) return [say(['ほどよく揺れる。', '全体がゆっくり揺れて、止まる。', '少しだけ揺れる。'])];
  return [say(['あまり揺れない。', '少しだけ揺れる。', 'しっかりしていて、ほとんど動かない。'])];
}

// ---- 押す --------------------------------------------------------
export function pressWeakText(it) {
  if ((it.crust || 0) > 0.5) return say(['表面が硬い膜で覆われている。', 'コツコツと硬い手応えがある。']);
  const f = it.firm + vjit();
  if (f > 0.7) return say(['硬い。指をはっきり押し返してくる。', 'しっかりした手応えがある。']);
  if (f > 0.45) return say(['適度な張りがあって、少しだけ沈む。', 'ほどよい弾力がある。', 'しっかりした手応えがある。']);
  return say(['柔らかく、指がすっと沈む。', 'やわらかい。', 'ほどよい弾力がある。']);
}

function recoveryText(it, vague = false) {
  if (vague && !DET && Math.random() < 0.6) {
    // 普通に押す：戻り方の大まかな印象だけのことが多い
    const e = it.elastic - (it.set === 'starch' || it.set === 'acid' ? 0.2 : 0) + vjit();
    if (e >= 0.5) return say(['指を離すと、わりとすぐ戻った。', '押し返してくる感じがある。']);
    if (e >= 0.3) return say(['指を離すと、ゆっくり戻った。', '少しずつ戻った…気がする。']);
    return say(['押した跡が少し残った。', 'あまり戻らない。']);
  }
  if (it.set === 'agar') return say(['表面が硬い。押し続けると割れそうだ。', '押してもほとんどへこまない。']);
  if (it.set === 'starch') return say(['へこんだ跡がそのまま残った。もったりしている。', '押した跡が戻らない。']);
  if (it.set === 'none') return say(['指が沈んで、そのまま戻らない。']);
  if (it.set === 'acid') return say(['押した跡がそのまま残った。', '押した跡が戻らない。']);
  if (it.set === 'enzyme') return say(['指が沈んで、そのまま崩れてしまった。', '押した所がぐずぐずになった。']);
  if (it.air + jit() > 0.3) return say(['押した所がしぼむように沈み、あまり戻らない。', '押した跡が戻らない。', 'ふわっと沈んだ。']);
  const e = it.elastic + jit();
  if (e >= 0.55) return say(['指を離すと、すぐ元に戻った。', 'すぐに押し返してきた。']);
  if (e >= 0.35) return say(['指を離すと、ゆっくり元に戻った。', '少しずつ戻った。']);
  return say(['へこんだ跡が残った。', '押した跡が戻らない。']);
}

export function pressNormalText(it) {
  const out = [recoveryText(it, true)];
  if (DET || chance(0.5)) out.unshift(pressWeakText(it));
  return out;
}

export function pressStrongText(it) {
  let brk;
  if ((it.crust || 0) > 0.5) brk = say(['パリッと表面の膜が割れた。下は柔らかい。', '膜が割れて、とろりとした中身が見えた。']);
  else if (it.set === 'enzyme') brk = say(['ぐしゃっと崩れた。', '形がなくなるほど崩れた。']);
  else if (it.set === 'acid') brk = say(['ねっとりと潰れた。', '押した所が深くへこんだ。']);
  else if (it.set === 'agar') brk = say(['ぱきっとひびが入った。', '割れるように崩れた。']);
  else if (it.set === 'starch') brk = say(['押した所が、もったりと潰れた。', 'ねっとりと潰れた。']);
  else if (it.air > 0.3) brk = say(['潰れた所に、細かな泡の跡が見える。', 'くしゅっと潰れた。']);
  else if (it.set === 'egg_heat') brk = say(['表面が裂けた。中までぎっしり詰まっている。', '裂け目から、詰まった中身が見える。']);
  else brk = say(['押した所が崩れて、つるりとした断面がのぞいた。', 'ぐにゃりと崩れた。']);
  return [brk, recoveryText(it)];
}

// ---- すくう（断面が分かる） ------------------------------------------------
export function sectionText(it) {
  const out = [];
  if ((it.crust || 0) > 0.5) out.push(say(['表面の膜をパリッと割ってから、スプーンが入る。', 'まず硬い膜に当たった。']));
  if (it.set === 'acid') out.push(say(['スプーンの跡がそのまま残る、濃厚な手応え。', 'ねっとりした手応えがある。']));
  else if (it.set === 'enzyme') out.push(say(['スプーンを入れたとたん、ほろほろと崩れた。', '豆腐のように、すぐ崩れる。']));
  else if (it.set === 'agar') out.push(say(['スプーンでさくっと割れる。', 'さくっと切れる。']));
  else if (it.set === 'egg_heat') out.push(say(['スプーンに、詰まった手応えがある。', 'ずっしりした手応えがある。']));
  else if (it.set === 'starch') out.push(say(['スプーンにまとわりつくような、もったりした手応え。', 'ねっとりした手応えがある。']));
  else if (it.set === 'none') out.push(say(['スプーンが抵抗なく沈む。どろりとしている。']));
  else if (it.set === 'gelatin' && it.elastic >= 0.55) out.push(say(['ぷるんと弾んで、すくった縁がきれいに立つ。', 'スプーンを押し返すような弾力がある。']));
  else if (it.set === 'gelatin' && it.firm < 0.38) out.push(say(['とろりと柔らかく、すくった跡がゆるく崩れる。', 'スプーンにほとんど手応えがない。']));
  else out.push(say(['スプーンがすっと入る。', 'するりとすくえる。']));
  if (it.su > 0.2) out.push(say(['断面に小さな穴が点々とある。', '断面に細かい穴が見える。']));
  if (it.air > 0.3) out.push(say(['断面に細かな気泡が均一に見える。', '断面がスポンジのように細かい。', '断面に細かい穴が見える。']));
  else if (it.set === 'agar') out.push(say(['断面は少しざらついている。', '断面がきらきらしている。']));
  else if (it.su <= 0.2 && it.set !== 'none') out.push(say(['断面はつるりとしていて、気泡はない。', '断面はなめらかだ。']));
  if (it.syneresis > 0.3) out.push(say(['すくった跡に、じわりと水がにじむ。', 'スプーンの跡が濡れている。']));
  if (it.caramel || it.sauce) out.push(say(['ソースは上にだけ載っていて、下は一色の生地だ。', '中は一色で、ソースは上だけ。']));
  return out;
}

// ---- 味見 --------------------------------------------------------
export function tasteText(it) {
  const out = [];
  const e = it.egg + jit();
  if (e > 0.55) out.push(say(['卵の風味がはっきりする。', 'カスタードのような濃い味。', '卵のコクがある。']));
  else if (e > 0.25) out.push(say(['ほのかに卵のコクがある。', '卵のコクがある。', 'かすかに卵っぽい。']));
  else out.push(say(['卵の味はしない。', '卵っぽさはない。']));
  const ft = it.fat + jit();
  if (ft > 0.7) out.push(say(['舌の表面に、濃いクリームの膜が長く残る。', '生クリームのような濃厚な味。', 'こってりしている。']));
  else if (ft > 0.3) out.push(say(['まろやかな乳の味がする。', 'ミルクの味がする。', 'こってりしている。']));
  else out.push(say(['さっぱりした牛乳の味がする。', 'ミルクの味がする。', 'あっさりしている。']));
  for (const a of aromaKeys(it)) out.push(say(AROMA_TASTE[a]));
  if ((it.crust || 0) > 0.5) out.push(say(['パリッと割れる膜の下は、とろりと柔らかい。', '表面の膜がほろ苦く香ばしい。']));
  if (it.set === 'none') out.push('どろりとしていて、固まっていない。');
  // 食感（固め方）は、ひと口では分からない。断面を見るには「すくう」
  if (chance(0.5)) out.push(say(['ひと口では、食感まではよく分からない。', 'おいしい。', '口の中ですぐなくなった。']));
  return out;
}

// 結果画面で使う「決め手になる手掛かり」（揺らぎなし）
export function keyClues(it) {
  DET = true;
  try {
    return [...smellText(it), ...sectionText(it), ...tasteText(it)];
  } finally {
    DET = false;
  }
}
