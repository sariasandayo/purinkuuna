// =============================================================
// 再製造（空になった容器で作り直す）。数値・文章は仮。
// 材料の量は扱わない。材料と工程の選択・順序で内部値が決まる。
// 順序効果は「名称の判定が変わるもの」だけを入れている：
//   ・泡は熱で消える（温める・煮立てる・蒸す、温かい液に泡を入れる）
//   ・ゼラチンは温かい液でないと溶けない。煮立てると固まる力が弱まる
//   ・寒天は煮立てないと溶けない
//   ・でんぷんは煮立てるととろみがつき、冷めると固まる
//   ・レモン汁＋生クリームは、温めてから冷やすと固まる（酸凝固）
//   ・ショウガ汁＋牛乳は、温かいうちに合わさるとすぐ固まる。煮立てると固まる力がなくなる（酵素凝固）
//   ・表面を焦がすと、硬い膜（クレームブリュレ）ができる
//   ・卵の入った液を煮立てると、卵がぼそぼそに固まる
//   ・卵液は容器に流してから蒸すと固まる
// =============================================================

export const COOK = {
  add: [
    // 材料を加えるだけでは時間は進まない
    { id: 'whole', label: '全卵', time: 0 },
    { id: 'yolk', label: '卵黄', time: 0 },
    { id: 'white', label: '卵白', time: 0 },
    { id: 'milk', label: '牛乳', time: 0 },
    { id: 'cream', label: '生クリーム', time: 0 },
    { id: 'gelatin', label: 'ゼラチン', time: 0 },
    { id: 'agar', label: '寒天', time: 0 },
    { id: 'starch', label: 'コーンスターチ', time: 0 },
    { id: 'almond', label: 'アーモンドエッセンス', time: 0 },
    { id: 'annin', label: '杏仁霜', time: 0 },
    { id: 'coffee', label: 'コーヒー', time: 0 },
    { id: 'lemon', label: 'レモン汁', time: 0 },
    { id: 'yogurt', label: 'ヨーグルト', time: 0 },
    { id: 'rose', label: 'ローズウォーター', time: 0 },
    { id: 'coconut', label: 'ココナッツミルク', time: 0 },
    { id: 'ginger', label: 'ショウガ汁', time: 0 },
    { id: 'berry', label: 'ベリー', time: 0 },
  ],
  bowl: [
    { id: 'warm', label: '温める', time: 2 },
    { id: 'boil', label: '煮立てる', time: 3 },
    { id: 'cool', label: '粗熱を取る', time: 4 },
    { id: 'pour', label: '容器に流す', time: 1 },
    { id: 'discard', label: '捨てる', time: 0 },
  ],
  cup: [
    { id: 'steam', label: '蒸す', time: 20 },
    { id: 'chill', label: '冷蔵庫で冷やす', time: 20 },
    { id: 'freeze', label: '冷凍庫で急冷', time: 8 },
    { id: 'brulee', label: '表面を焦がす', time: 3 },
  ],
};

// 材料の分類と色（作り直しの画面で、色の丸と一緒に並べる）
export const ING_GROUPS = [
  { label: '卵', ids: ['whole', 'yolk', 'white'] },
  { label: '乳・液体', ids: ['milk', 'cream', 'yogurt', 'coconut', 'coffee'] },
  { label: '固めるもの', ids: ['gelatin', 'agar', 'starch', 'lemon', 'ginger'] },
  { label: '香り・色', ids: ['almond', 'annin', 'rose', 'berry'] },
];
export const ING_COLOR = {
  whole: '#f2c14e', yolk: '#f0a500', white: '#f6f3ea', milk: '#ffffff', cream: '#fff3d6', yogurt: '#f4f1ea',
  coconut: '#faf6ee', coffee: '#5a3a22', gelatin: '#e3ecf2', agar: '#dce8dc', starch: '#f1eee6', lemon: '#f5df4d',
  ginger: '#dcb56a', almond: '#c99b6d', annin: '#efe3d6', rose: '#f0a3b6', berry: '#c2416a',
};
export const COOK_ICON = {
  warm: 'warm', boil: 'boil', cool: 'cool', pour: 'pour', discard: 'discard', steam: 'steam', chill: 'chill', freeze: 'freeze', brulee: 'brulee',
};

// 生クリームは、選んだあとに「そのまま加える／泡立てて加える」を選ぶ
export const CREAM_CHOICES = [
  { id: 'cream', label: 'そのまま加える', time: 0 },
  { id: 'whipped', label: '泡立てて加える', time: 4 },
];

const ADD_LABEL = Object.fromEntries(COOK.add.map((a) => [a.id, a.label]));
const ALL = [...COOK.add, CREAM_CHOICES[1], ...COOK.bowl, ...COOK.cup];
export const findCook = (id) => ALL.find((a) => a.id === id);

function newBowl() {
  return {
    stage: 'bowl', // bowl | cup
    ing: {},
    warm: false,
    gelDissolved: false,
    gelBoiled: false,
    agarBoiled: false,
    starchBoiled: false,
    scrambled: false,
    whipAir: 0,
    eggSet: false,
    chilled: false,
    frost: false,
    heated: false, // 一度でも温めた・煮立てた
    gingerDead: false, // ショウガの固める力がなくなった
    enzymeSet: false,
    crust: false,
  };
}

const hasEgg = (g) => g.whole || g.yolk || g.white;
const hasBase = (g) => hasEgg(g) || g.milk || g.cream || g.coffee || g.coconut || g.yogurt;
const hasLiquid = (g) => hasBase(g) || g.berry; // ベリーはピューレとして液体扱い

// 作り直しができる容器か
export const canRemake = (it) => it.amount <= 0 || (it.cook && it.cook.stage === 'cup');

export function canCook(state, it, act) {
  const a = findCook(act.id); // 生クリームの「そのまま加える」は材料の生クリームと同じ扱い
  if (a.time > state.time) return false;
  const c = it.cook || newBowl();
  const g = c.ing;
  if (c.stage === 'bowl') {
    if (it.amount > 0) return false;
    if (COOK.add.includes(a)) return !g[a.id] && (state.ing[a.id] || 0) > 0;
    switch (a.id) {
      case 'whipped': return !g.whipped && (state.ing.cream || 0) > 0;
      case 'warm':
      case 'boil': return hasLiquid(g);
      case 'cool': return c.warm;
      case 'pour': return hasLiquid(g);
      case 'discard': return Object.keys(g).length > 0;
      default: return false;
    }
  }
  switch (a.id) {
    case 'steam': return !c.eggSet && !c.chilled;
    case 'chill':
    case 'freeze': return !c.chilled;
    case 'brulee': return !c.crust && !it.liquid;
    default: return false;
  }
}

// ボウル・容器の状態を言葉で
export function cookStatus(it) {
  const c = it.cook;
  if (!c || (c.stage === 'bowl' && Object.keys(c.ing).length === 0)) return 'ボウルは空。';
  const g = c.ing;
  const names = COOK.add.filter((a) => g[a.id]).map((a) => a.label);
  if (g.whipped) names.push('泡立てた生クリーム');
  const out = [];
  out.push(c.stage === 'bowl' ? `ボウル：${names.join('、')}` : `容器の中：${names.join('、')}`);
  if (c.warm) out.push('温かい。');
  if (g.gelatin && !c.gelDissolved) out.push('ゼラチンの粒が溶けずに残っている。');
  if (g.agar && !c.agarBoiled) out.push('寒天が溶けずに沈んでいる。');
  if (g.starch && !c.starchBoiled) out.push('でんぷんが底に沈んでいる。');
  else if (g.starch && c.stage === 'bowl') out.push('とろみがついている。');
  if (c.scrambled) out.push('卵がぼそぼそに固まっている。');
  if (c.enzymeSet && c.stage === 'bowl') out.push('ボウルの中で、ふるふると固まりかけている。');
  if (c.crust) out.push('表面が焦げて、硬い膜になっている。');
  if (c.stage === 'cup') out.push(it.liquid ? 'まだ固まっていない。' : '固まっている。');
  return out.join(' ');
}

// 工程の状態から内部値を決める
function applyFeatures(it) {
  const c = it.cook;
  const g = c.ing;
  const eggs = [g.whole && 0.75, g.yolk && 0.7, g.white && 0.5].filter(Boolean);
  const egg = eggs.length ? Math.max(...eggs) : 0;
  // 乳脂肪：泡立てた生クリームも「生クリーム」として数える
  const cream = g.cream || g.whipped;
  let fat = 0.3;
  if (cream && g.milk) fat = 0.65;
  else if (cream) fat = g.cream && g.whipped ? 0.9 : 0.85;
  else if (g.milk) fat = 0.2;
  else if (g.coconut) fat = 0.5;
  else if (g.yogurt) fat = 0.25;
  else if (g.coffee) fat = 0.05;
  if (cream && (g.yogurt || g.coffee || g.coconut) && !g.milk) fat = 0.6; // 生クリームで割ったもの
  if (g.cream && g.lemon) fat = Math.max(fat, 0.85);
  const air = c.whipAir;

  let set = 'none';
  let firm = 0.05;
  let elastic = 0;
  let su = 0;
  let syneresis = 0;
  if (c.eggSet) {
    set = 'egg_heat'; firm = 0.6; elastic = 0.5; su = g.cream ? 0.15 : 0.35;
  } else if (g.gelatin && c.chilled) {
    set = 'gelatin';
    if (c.gelDissolved) {
      firm = 0.4; elastic = 0.55;
      if (c.gelBoiled) { firm *= 0.7; elastic *= 0.7; }
      if (fat > 0.7) firm -= 0.1;
    } else {
      firm = 0.15; elastic = 0.2; // 溶けていないゼラチンでは、ゆるくしか固まらない
    }
  } else if (g.agar && c.agarBoiled && c.chilled) {
    set = 'agar'; firm = 0.85; elastic = 0.2; syneresis = 0.4;
  } else if (g.starch && c.starchBoiled && !c.warm) {
    set = 'starch'; firm = g.coconut ? 0.75 : 0.45; elastic = 0.25; // 冷めれば常温でも固まる
  } else if (g.lemon && g.cream && c.heated && c.chilled) {
    set = 'acid'; firm = 0.3; elastic = 0.1; // レモンの酸で固まる
  } else if (c.enzymeSet) {
    set = 'enzyme'; firm = 0.2; elastic = 0.15; syneresis = 0.3; // ショウガの力で固まる
  }
  if (c.scrambled) { su = 0.8; firm = Math.min(firm, 0.3); elastic = 0.15; }
  firm = Math.max(0.05, firm - air * 0.4);
  elastic = Math.max(0, elastic - air * 0.3);

  const wasLiquid = it.liquid;
  Object.assign(it, {
    egg,
    fat,
    air,
    set,
    firm,
    elastic,
    su,
    syneresis,
    colorBias: g.white && !g.whole && !g.yolk ? -0.45 : 0,
    almond: g.almond ? 0.7 : 0,
    annin: g.annin ? 0.7 : 0,
    coffee: g.coffee ? 0.8 : 0,
    citrus: g.lemon ? 0.6 : 0,
    yogurt: g.yogurt ? 0.7 : 0,
    rose: g.rose ? 0.7 : 0,
    coconut: g.coconut ? 0.7 : 0,
    ginger: g.ginger ? 0.7 : 0,
    fruit: g.berry ? 0.7 : 0,
    crust: c.crust ? 1 : 0,
    frost: c.frost,
    liquid: set === 'none',
  });
  if (it.liquid) it.shape = 40; // 液体のままでは崩れているのと同じ
  else if (wasLiquid) it.shape = 100;
}

export function cook(state, it, a) {
  if (!it.cook) it.cook = newBowl();
  const c = it.cook;
  const g = c.ing;
  const lines = [];
  state.time -= a.time;

  if (COOK.add.includes(a)) {
    g[a.id] = true;
    state.ing[a.id] -= 1;
    if (a.id === 'ginger') {
      if (c.warm && (g.milk || g.cream) && !c.gingerDead) { c.enzymeSet = true; lines.push('温かい牛乳とショウガ汁が合わさって、ふるふると固まり始めた。'); } else lines.push('ショウガ汁を加えた。');
    } else if (a.id === 'gelatin') {
      if (c.warm) { c.gelDissolved = true; lines.push('温かい液に入れたので、ゼラチンが溶けた。'); } else lines.push('ゼラチンを入れたが、冷たい液の中で溶けずに残っている。');
    } else if (a.id === 'agar' || a.id === 'starch') {
      lines.push(`${ADD_LABEL[a.id]}を入れた。`);
    } else {
      lines.push(`${ADD_LABEL[a.id]}を加えた。`);
    }
  } else {
    switch (a.id) {
      case 'whipped':
        g.whipped = true;
        state.ing.cream -= 1;
        // 温かい液では泡が溶ける。牛乳などの液が少ないほど、泡の多い軽い生地になる
        c.whipAir = c.warm ? 0.15 : (hasBase(g) ? 0.45 : 0.7);
        lines.push(c.warm ? '泡立てた生クリームを入れたが、温かい液の中で泡がだいぶ溶けてしまった。'
          : '泡立てた生クリームを、さっくり混ぜ込んだ。');
        break;
      case 'warm':
        c.warm = true;
        c.heated = true;
        lines.push('ボウルを温めた。');
        if (g.ginger && (g.milk || g.cream) && !c.gingerDead && !c.enzymeSet) { c.enzymeSet = true; lines.push('ショウガ汁の入った牛乳が、ふるふると固まり始めた。'); }
        if (g.gelatin && !c.gelDissolved) { c.gelDissolved = true; lines.push('ゼラチンが溶けた。'); }
        if (c.whipAir > 0) { c.whipAir *= 0.3; lines.push('泡がしぼんでしまった。'); }
        break;
      case 'boil':
        c.warm = true;
        c.heated = true;
        lines.push('しっかり煮立てた。');
        if (g.ginger) { c.gingerDead = true; c.enzymeSet = false; lines.push('ショウガ汁が煮えて、固まる力がなくなった。'); }
        if (g.agar) { c.agarBoiled = true; lines.push('寒天が溶けた。'); }
        if (g.starch) { c.starchBoiled = true; lines.push('でんぷんで、とろみがついた。'); }
        if (g.gelatin) { c.gelDissolved = true; c.gelBoiled = true; lines.push('ゼラチンは溶けたが、煮立てたので固まる力が弱くなりそうだ。'); }
        if (hasEgg(g)) { c.scrambled = true; lines.push('卵が煮えて、ぼそぼそに固まってしまった。'); }
        if (c.whipAir > 0) { c.whipAir = 0; lines.push('泡はすっかり消えた。'); }
        break;
      case 'cool':
        c.warm = false;
        lines.push('粗熱が取れた。');
        break;
      case 'discard':
        it.cook = newBowl();
        lines.push('ボウルの中身を捨てた。');
        break;
      case 'pour':
        c.stage = 'cup';
        Object.assign(it, {
          amount: 1, shape: 100, marks: [], whip: false, sauce: false, caramel: false,
          remade: true, revealed: false, liquid: true,
        });
        lines.push('容器に流し入れた。');
        break;
      case 'steam':
        c.warm = true;
        if (hasEgg(g) && !c.scrambled) { c.eggSet = true; lines.push('蒸し上がった。卵液が固まった。'); } else lines.push('蒸したが、固まる様子はない。');
        if (c.whipAir > 0) { c.whipAir *= 0.2; lines.push('泡は蒸気でほとんど消えた。'); }
        break;
      case 'chill':
        c.chilled = true; c.warm = false;
        lines.push('冷蔵庫で冷やした。');
        break;
      case 'freeze':
        c.chilled = true; c.warm = false; c.frost = true;
        lines.push('冷凍庫で急いで冷やした。表面に霜が付いて、つやがなくなった。');
        break;
      case 'brulee':
        c.crust = true;
        lines.push('表面に砂糖をのせて焦がした。パリッとした硬い膜ができた。');
        break;
      default: break;
    }
  }

  if (c.stage === 'cup') {
    applyFeatures(it);
    if (['steam', 'chill', 'freeze', 'pour'].includes(a.id) && !(a.id === 'pour' && it.liquid)) lines.push(it.liquid ? 'まだ固まっていない。' : '固まった。');
  }
  for (const l of lines) it.notes.push(l);
  return lines;
}
