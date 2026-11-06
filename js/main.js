// =============================================================
// 画面と操作
// =============================================================
import {
  RULES, LABEL, ZUKAN, ZUKAN_BASE, ZUKAN_ING, NAMES, MAT_LABEL, COOK_TIPS, GEN, BASE_ITEM,
} from './data.js';
import { visibleShape, visibleAmount } from './model.js';
import { makeStage, cloneStage } from './stage.js';
import { ACTIONS, canDo, perform } from './actions.js';
import {
  REPAIRS, canRepair, repair, donors,
} from './repair.js';
import {
  COOK, CREAM_CHOICES, ING_GROUPS, ING_COLOR, canCook, cook, cookStatus, canRemake, findCook,
} from './cooking.js';
import { judge } from './judge.js';
import { ICON, riskDots } from './icons.js';
import { dessertSVG } from './render.js';

const app = document.getElementById('app');
const GUESS = ['未判断', '残しとく', '食べちゃう'];

let state;

const ZUKAN_ICON = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="5" width="26" height="31" rx="3" fill="#c0503a"/><rect x="10" y="5" width="23" height="28" rx="2" fill="#e2664d"/><rect x="13" y="10" width="16" height="8" rx="1.5" fill="#fff4dc"/><path d="M17 13.5 h8" stroke="#c0503a" stroke-width="1.6" stroke-linecap="round"/><rect x="7" y="31" width="26" height="5" rx="1.5" fill="#fbf1dd"/><path d="M26 5 v9 l2.5 -2 l2.5 2 v-9" fill="#f5c542"/></svg>';


// stage: makeStage の結果。同じ冷蔵庫で再挑戦できるよう、元の状態を保存しておく
function startStage(stage) {
  state = {
    screen: 'game',
    stageNo: stage.no,
    stageSrc: cloneStage(stage),
    stage,
    opening: true, // 冷蔵庫の扉が開く演出（最初の描画だけ）
    time: stage.time,
    full: 0,
    mats: { ...stage.mats },
    ing: { ...stage.ingredients },
    selected: null,
    tab: 'check', // check | fix | cook
    picking: false, // 移植元を選んでいる
    lastLines: [],
    showZukan: false,
    result: null,
    items: stage.items,
  };
}

// ---- 見た目上の状態を言葉で ---------------------------------------
function condText(it) {
  if (it.amount <= 0) return '空の容器';
  if (it.liquid) return '固まっていない';
  const s = visibleShape(it);
  const a = visibleAmount(it);
  if (a < 0.8 || s < 60) return '大きく崩れている';
  if (a < 0.95 || s < 85) return '欠けている';
  if (a < 0.99 || s < 96) return '少し跡がある';
  return '無傷に見える';
}

// 直前の行動の動き（その1回の描画だけで再生する）
const animFor = (it) => (state.anim && state.anim.id === it.id ? state.anim.kind : null);

const itemName = (it) => {
  if (it.remade) return `${it.id}（作り直し）`;
  return `${it.id}${it.revealed ? `：${LABEL[it.origTruth]}` : ''}`;
};

// ---- 描画 ---------------------------------------------------------
function hud() {
  const tPct = (state.time / state.stage.time) * 100;
  const fPct = (state.full / RULES.fullMax) * 100;
  const tgt = (state.stage.fullTarget / RULES.fullMax) * 100;
  const cleared = state.full >= state.stage.fullTarget;
  let fullWord = '空腹';
  if (state.full >= RULES.fullMax) fullWord = '限界';
  else if (cleared) fullWord = '満足！';
  // 1個分ごとの目盛り
  const steps = Math.round(RULES.fullMax / RULES.fullPerItem);
  const ticks = Array.from({ length: steps - 1 }, (_, i) => `<s style="left:${((i + 1) / steps) * 100}%"></s>`).join('');
  const lowTime = state.time <= 10;
  return `
  <header class="hud">
    <div class="order-card">
      <img class="order-face" src="assets/chihiro/determined.webp" alt="ちひろ">
      <div class="order-body">
        <div class="order-head"><span class="order-tag">ちひろの言いつけ</span><span class="order-stage">STAGE ${state.stageNo}</span></div>
        <p class="order-text">${state.stage.memo}</p>
      </div>
    </div>
    <div class="meter-row ${lowTime ? 'low' : ''}"><span>帰宅まで</span>
      <div class="meter"><i class="time" style="width:${tPct}%"></i></div><b>${state.time}分</b></div>
    <div class="meter-row full-row ${cleared ? 'cleared' : ''}"><span>満腹度</span>
      <div class="meter full-meter">
        <div class="goal-zone" style="left:${tgt}%"></div>
        <i class="full" style="width:${fPct}%"></i>${ticks}
        <em class="goal-line" style="left:${tgt}%"><span>${cleared ? 'クリア！' : 'ここまで食べればクリア'}</span></em>
      </div>
      <b>${fullWord}</b></div>
  </header>`;
}

// 判断の目印（旗）
const FLAG_SVG = [
  '',
  // 残しとく：赤い旗
  '<svg viewBox="0 0 24 24" class="flag keep" aria-label="残しとく"><line x1="6" y1="3" x2="6" y2="22" stroke="#6b5b4b" stroke-width="2" stroke-linecap="round"/><path d="M7 4 L20 7.5 L7 11 Z" fill="#d9483b"/></svg>',
  // 食べちゃう：緑のスプーン
  '<svg viewBox="0 0 24 24" class="flag eat" aria-label="食べちゃう"><circle cx="12" cy="12" r="11" fill="#3f8f5a"/><ellipse cx="12" cy="8.5" rx="3.2" ry="4" fill="#fff"/><rect x="11" y="11" width="2" height="8" rx="1" fill="#fff"/></svg>',
];

// 冷蔵庫の棚に並べる（文字は出さない。詳しくは選んだときのシートで）
// 大きさは問題によらず一定：3段×4マス。空いたマスは何も置かない
const SHELVES = 3;
const PER_SHELF = 4;
function fridge() {
  const rows = [];
  for (let r = 0; r < SHELVES; r += 1) {
    const cells = [];
    for (let c = 0; c < PER_SHELF; c += 1) {
      const it = state.items[r * PER_SHELF + c];
      cells.push(it ? `
      <button class="slot ${it.amount <= 0 ? 'gone' : ''}" data-sel="${it.id}" aria-label="${it.id}">
        ${dessertSVG(it, 80, animFor(it))}${FLAG_SVG[it.guess]}
      </button>` : '<div class="slot empty"></div>');
    }
    rows.push(`<div class="shelf">${cells.join('')}</div>`);
  }
  const door = state.opening ? `
    <div class="door" aria-hidden="true">
      <div class="door-handle"></div>
      <div class="door-stage">STAGE ${state.stageNo}</div>
    </div>` : '';
  return `<div class="fridge-wrap"><main class="fridge" style="--per:${PER_SHELF}">
    <div class="fridge-light"></div>${rows.join('')}
  </main>${door}</div>`;
}

// 鑑定ボタン：見る・触る・スプーンの3グループ。崩れやすさを点で示す。完食は独立した大きなボタン
const RISK = { look: 0, sniff: 0, shake: 1, press1: 1, press2: 2, press3: 3, scoop: 2, taste: 3 };
const ACT_GROUPS = [
  { label: '見る', ids: ['look', 'sniff'] },
  { label: '触る', ids: ['shake'], press: ['press1', 'press2', 'press3'] },
  { label: 'スプーン', ids: ['scoop', 'taste'] },
];
const PRESS_LABEL = { press1: '弱く', press2: '普通に', press3: '全力で' };

function actButton(it, id) {
  const a = ACTIONS.find((x) => x.id === id);
  return `<button class="abtn" data-act="${id}" ${canDo(state, it, a) ? '' : 'disabled'}>
    ${ICON[id] || ''}<span class="abtn-label">${a.label}</span>
    <span class="abtn-meta"><span>${a.time}分</span>${riskDots(RISK[id])}</span></button>`;
}

function checkPanel(it) {
  const eat = ACTIONS.find((x) => x.id === 'eat');
  return `
  <div class="agroups">
    ${ACT_GROUPS.map((g) => `
    <div class="agroup">
      <div class="agroup-label">${g.label}</div>
      <div class="agroup-row" style="grid-template-columns:repeat(${g.press ? 3 : g.ids.length},1fr)">
        ${g.ids.map((id) => actButton(it, id)).join('')}
        ${g.press ? `<div class="press">
          <div class="press-head">${ICON.press}<span>押す</span></div>
          <div class="press-seg">${g.press.map((id) => {
            const a = ACTIONS.find((x) => x.id === id);
            return `<button data-act="${id}" ${canDo(state, it, a) ? '' : 'disabled'}><b>${PRESS_LABEL[id]}</b><span>${a.time}分</span>${riskDots(RISK[id])}</button>`;
          }).join('')}</div></div>` : ''}
      </div>
    </div>`).join('')}
  </div>
  <p class="risk-legend">${riskDots(2)} 崩れやすさの目安</p>
  <button class="eat-btn" data-act="eat" ${canDo(state, it, eat) ? '' : 'disabled'}>
    ${ICON.eat}<span class="eat-main">完食する</span><span class="eat-sub">${eat.time}分・お腹が満たされ、正体が分かる。ただし無くなる</span>
  </button>`;
}

function fixPanel(it) {
  if (state.picking) {
    const list = donors(state, it);
    return `
    <p class="hint">どれから切り取って詰めますか？（切り取った方には穴が開きます）</p>
    <div class="donors">${list.map((d) => `
      <button class="donor" data-donor="${d.id}">${dessertSVG(d, 56)}<span>${itemName(d)}</span><small>${condText(d)}</small></button>`).join('')}
    </div>
    <button class="act wide" data-cancel="1">やめる</button>`;
  }
  return `<div class="agroup"><div class="agroup-label">直す・隠す</div><div class="agroup-row steps">${REPAIRS.map((r) => {
    const left = r.mat ? `残り${state.mats[r.mat]}` : '';
    return `<button class="abtn fix" data-fix="${r.id}" ${canRepair(state, it, r) ? '' : 'disabled'}>
      ${ICON[r.id] || ''}<span class="abtn-label">${r.label}</span><span class="abtn-meta"><span>${r.time}分</span>${left ? `<span>${left}</span>` : ''}</span></button>`;
  }).join('')}</div></div>`;
}

// 材料：分類ごとに、色の丸・名前・残り数のチップで並べる
function ingChip(it, id) {
  const a = COOK.add.find((x) => x.id === id);
  const left = state.ing[id] || 0;
  // 生クリームは、押すと「そのまま／泡立てる」を選ぶ
  const ok = id === 'cream' ? CREAM_CHOICES.some((c) => canCook(state, it, c)) : canCook(state, it, a);
  const attr = id === 'cream' ? 'data-creampick="1"' : `data-cook="${id}"`;
  return `<button class="ing ${left ? '' : 'none'}" ${attr} ${ok ? '' : 'disabled'}>
    <i style="background:${ING_COLOR[id]}"></i><span>${a.label}</span><b>×${left}</b></button>`;
}

// 工程：アイコン付きのボタン
function stepButton(it, a) {
  return `<button class="abtn step" data-cook="${a.id}" ${canCook(state, it, a) ? '' : 'disabled'}>
    ${ICON[a.id] || ''}<span class="abtn-label">${a.label}</span><span class="abtn-meta"><span>${a.time}分</span></span></button>`;
}

function cookPanel(it) {
  const inCup = it.cook && it.cook.stage === 'cup';
  if (state.creamPick && !inCup) {
    return `
    <p class="bowl">${cookStatus(it)}</p>
    <h4>生クリームをどうする？（残り${state.ing.cream || 0}）</h4>
    <div class="acts two">${CREAM_CHOICES.map((c) => `<button class="act cook" data-cook="${c.id}" ${canCook(state, it, c) ? '' : 'disabled'}>${c.label}<small>${c.time ? `${c.time}分` : '時間はかからない'}</small></button>`).join('')}</div>
    <button class="act wide" data-creamcancel="1">やめる</button>`;
  }
  if (inCup) {
    return `
    <p class="bowl">${cookStatus(it)}</p>
    <div class="agroup"><div class="agroup-label">容器で仕上げる</div>
      <div class="agroup-row steps">${COOK.cup.map((a) => stepButton(it, a)).join('')}</div></div>`;
  }
  const steps = COOK.bowl.filter((a) => a.id !== 'discard');
  const discard = COOK.bowl.find((a) => a.id === 'discard');
  return `
    <p class="bowl">${cookStatus(it)}</p>
    <div class="agroup"><div class="agroup-label">材料を加える<small>加えるだけなら時間はかからない</small></div>
      ${ING_GROUPS.map((g) => {
        // 冷蔵庫にない材料は出さない
        const ids = g.ids.filter((x) => (state.ing[x] || 0) > 0 || (it.cook && it.cook.ing[x]));
        return ids.length ? `<div class="ing-group"><span class="ing-glabel">${g.label}</span>
        <div class="ing-row">${ids.map((x) => ingChip(it, x)).join('')}</div></div>` : '';
      }).join('')}
    </div>
    <div class="agroup"><div class="agroup-label">工程</div>
      <div class="agroup-row steps">${steps.map((a) => stepButton(it, a)).join('')}</div>
      <button class="text-btn" data-cook="discard" ${canCook(state, it, discard) ? '' : 'disabled'}>${ICON.discard}ボウルの中身を捨てる（材料は戻らない）</button>
    </div>
    <p class="hint">カラメルやホイップは「直す・隠す」から。</p>`;
}

// シート上部に固定するバー：残り時間・満腹度・図鑑・閉じる（スクロールしても常に見える）
function sheetBar() {
  const tPct = (state.time / state.stage.time) * 100;
  const fPct = (state.full / RULES.fullMax) * 100;
  const tgt = (state.stage.fullTarget / RULES.fullMax) * 100;
  const cleared = state.full >= state.stage.fullTarget;
  return `
    <div class="sheet-bar">
      <div class="sb-meters">
        <div class="sb-row ${state.time <= 10 ? 'low' : ''}"><span>帰宅まで</span><div class="sb-meter"><i class="time" style="width:${tPct}%"></i></div><b>${state.time}分</b></div>
        <div class="sb-row ${cleared ? 'cleared' : ''}"><span>満腹度</span><div class="sb-meter"><i class="full" style="width:${fPct}%"></i><em style="left:${tgt}%"></em></div><b>${cleared ? '満足！' : ''}</b></div>
      </div>
      <button class="mini-zukan" data-zukan="1" aria-label="図鑑を開く">${ZUKAN_ICON}</button>
      <button class="close" data-close="1" aria-label="閉じる">×</button>
    </div>`;
}

function sheet() {
  const it = state.items.find((i) => i.id === state.selected);
  if (!it) return '';
  const notes = it.notes.length
    ? it.notes.map((n) => `<li class="${state.lastLines.includes(n) ? 'new' : ''}">${n}</li>`).join('')
    : '<li class="empty">まだ何も調べていない。</li>';
  return `
  <div class="overlay" data-close="1"></div>
  <section class="sheet ${state.sheetOpened ? 'pop' : ''}">
    ${sheetBar()}
    <div class="sheet-head">
      ${dessertSVG(it, 104, animFor(it))}
      <div>
        <h2>${itemName(it)}</h2>
        <p class="cond">${condText(it)}</p>
        <div class="guess">${GUESS.map((g, i) => `<button class="g${i} ${it.guess === i ? 'on' : ''}" data-guess="${i}">${FLAG_SVG[i]}${g}</button>`).join('')}</div>
      </div>
    </div>
    <h3>メモ</h3>
    <ul class="notes">${notes}</ul>
    <div class="tabs">
      <button class="${state.tab === 'check' ? 'on' : ''}" data-tab="check">調べる・食べる</button>
      <button class="${state.tab === 'fix' ? 'on' : ''}" data-tab="fix">直す・隠す</button>
      ${canRemake(it) ? `<button class="${state.tab === 'cook' ? 'on' : ''}" data-tab="cook">作り直す</button>` : ''}
    </div>
    ${{ check: checkPanel, fix: fixPanel, cook: cookPanel }[state.tab](it)}
  </section>`;
}

// ---- 図鑑（本の見た目） --------------------------------------------
// ページ：0 = 目次、1〜 = 各デザート、最後 = 調理の基本
const ZUKAN_PAGES = ['index1', 'index2', 'tips', ...NAMES];
const INDEX_SPLIT = 9; // 目次1ページ目に載せる数
let zukanPageMemory = 0; // 前回開いていたページ（ステージをまたいでも覚えておく）

// 挿絵用の見本（生成テンプレートの中央値）
function sampleOf(name) {
  const t = GEN.templates[name][0];
  const it = { ...BASE_ITEM, air: 0, shape: 100, amount: 1, marks: [], cup: name === 'pudding' ? 'ramekin' : 'footed' };
  for (const [k, v] of Object.entries(t)) {
    if (Array.isArray(v)) it[k] = (v[0] + v[1]) / 2;
    else if (k === 'set') it[k] = v;
  }
  if (name === 'pudding') it.caramel = true;
  if (name === 'pannacotta') it.caramel = false;
  return it;
}

function zukanPage(key) {
  if (key === 'index1' || key === 'index2') {
    // 目次は2ページに分ける。項目を押すとそのページへ
    const entries = ZUKAN_PAGES.map((k, i) => ({ k, i })).filter((e) => !e.k.startsWith('index'));
    const part = key === 'index1' ? entries.slice(0, INDEX_SPLIT) : entries.slice(INDEX_SPLIT);
    return `
      <h3 class="b-title">もくじ<small>${key === 'index1' ? '（1）' : '（2）'}</small></h3>
      ${key === 'index1' ? '<p class="b-note top">※ この本に書いてあるのは一般的な傾向です。冷蔵庫の中のひとつひとつが、必ずこの通りとは限りません。</p>' : ''}
      <ol class="b-index">${part.map(({ k, i }) => `<li><button data-zpage="${i}"><span>${k === 'tips' ? '調理の基本' : LABEL[k]}</span><i></i><b>${pageNo(i)}</b></button></li>`).join('')}
      </ol>`;
  }
  if (key === 'tips') {
    return `
      <h3 class="b-title">調理の基本</h3>
      <ul class="b-list">${COOK_TIPS.map((l) => `<li>${l}</li>`).join('')}</ul>`;
  }
  return `
    <h3 class="b-title">${LABEL[key]}</h3>
    <div class="b-hero">${dessertSVG(sampleOf(key), 120)}</div>
    <p class="b-lead">${ZUKAN_BASE[key]}</p>
    <h4 class="b-sub">主な材料</h4>
    <div class="b-chips">${ZUKAN_ING[key].map((x) => `<span>${x}</span>`).join('')}</div>
    <h4 class="b-sub">特徴</h4>
    <ul class="b-list">${ZUKAN[key].map((l) => `<li>${l}</li>`).join('')}</ul>`;
}

// 目次を除いたページ番号（調理の基本＝1）
const pageNo = (i) => i - 1;

function zukan() {
  if (!state.showZukan) return '';
  const p = zukanPageMemory;
  const last = ZUKAN_PAGES.length - 1;
  const isIndex = ZUKAN_PAGES[p].startsWith('index');
  // 今のデザートが載っている目次のページ
  const backTo = p - 2 < INDEX_SPLIT ? 0 : 1;
  return `
  <div class="overlay z" data-zukan="0"></div>
  <section class="book">
    <div class="book-head"><span>おうちのデザート図鑑</span>
      ${isIndex ? '' : `<button class="to-index" data-zpage="${backTo}">≡ もくじ</button>`}
      <button class="close" data-zukan="0" aria-label="閉じる">×</button></div>
    <div class="book-page">${zukanPage(ZUKAN_PAGES[p])}</div>
    <div class="book-foot">
      <button data-zpage="${p - 1}" ${p <= 0 ? 'disabled' : ''}>‹ 前</button>
      <span>${isIndex ? `もくじ ${p + 1}/2` : `${pageNo(p)} / ${pageNo(last)}`}</span>
      <button data-zpage="${p + 1}" ${p >= last ? 'disabled' : ''}>次 ›</button>
    </div>
    <div class="book-ribbon"></div>
  </section>`;
}

function gameScreen() {
  return `${hud()}${fridge()}
  <footer class="foot">
    <button class="wait" data-finish="1">ちひろの帰りを待つ</button>
  </footer>
  ${sheet()}`;
}

function titleScreen() {
  return `
  <section class="title">
    <div class="title-hero">
      <img class="title-bg" src="assets/title.webp" alt="">
      <h1 class="title-logo"><img src="assets/logo.webp" alt="「プリン」は絶対食べるなよ！！"></h1>
    </div>
    <ul class="rules">
      <li>妹のちひろはプリンが大好き！</li>
      <li>ちひろの逆鱗に触れないように、お腹一杯になるまで冷蔵庫を漁ろう！</li>
      <li>ちひろの言いつけは絶対だ！</li>
      <li>食べるものはよく調べてから食べよう！ただし、調べすぎたら痕跡が残っちゃうかも！</li>
      <li>痕跡はできるだけ隠蔽しよう！</li>
      <li>もしちひろの分を食べちゃったら、自分で作るしかない！？</li>
    </ul>
    <button class="start" data-start="1">冷蔵庫を開ける</button>
  </section>`;
}

function resultButtons(r) {
  if (!r.success) return '<button class="start" data-restart="1">もう一度</button><button class="start sub" data-title="1">タイトルへ</button>';
  return `<button class="start" data-next="1">STAGE ${state.stageNo + 1}へ</button>`;
}

// 結果画面：ちひろの表情とセリフ（吹き出し）、地の文、表
function resultScreen() {
  const r = state.result;
  return `
  <section class="result ${r.success ? 'ok' : 'ng'}">
    <p class="stage-no">STAGE ${state.stageNo}</p>
    <h1>${r.title}</h1>
    <div class="chihiro-talk">
      <img class="chihiro-face" src="assets/chihiro/${r.face}.webp" alt="ちひろ">
      <div class="talk-body">
        ${r.speech.length
    ? `${r.speech.map((x) => `<p class="bubble">${x}</p>`).join('')}<span class="talk-name">ちひろ</span>`
    : r.reasons.map((x) => `<p class="narration">${x}</p>`).join('')}
      </div>
    </div>
    ${r.speech.length ? r.reasons.map((x) => `<p class="narration">${x}</p>`).join('') : ''}
    <table>
      <tr><th></th><th>正体</th><th>帰宅時の見た目</th><th>ちひろの判断</th></tr>
      ${r.rows.map((x) => `<tr class="${x.protected ? 'prot' : ''}"><td>${x.id}</td><td>${x.truth}</td><td>${x.cond}</td><td>${x.sister}</td></tr>`).join('')}
    </table>
    ${r.missed.length ? `<h3>手を付けたデザートの手がかり</h3>${r.missed.map((m) => `
      <div class="missed"><b>${m.id}（${m.name}）</b><ul>${m.clues.map((c) => `<li>${c}</li>`).join('')}</ul></div>`).join('')}` : ''}
    ${resultButtons(r)}
  </section>`;
}

function render() {
  let html;
  if (state.screen === 'title') html = titleScreen();
  else if (state.screen === 'game') html = gameScreen();
  else html = resultScreen();
  // 図鑑はどの画面からでも開ける
  // 詳細シートを開いているときは、シートの見出しにある図鑑ボタンを使う
  if (!(state.screen === 'game' && state.selected)) {
    html += `<button class="zukan-fab" data-zukan="1" aria-label="図鑑を開く">${ZUKAN_ICON}<span>図鑑</span></button>`;
  }
  html += zukan();
  // 描き直してもスクロール位置が戻らないよう、シートと図鑑の位置を覚えておく
  const keep = ['.sheet:not(.zukan)', '.book-page'].map((sel) => {
    const el = app.querySelector(sel);
    return el ? el.scrollTop : 0;
  });
  const sameSheet = state.lastSheetId === state.selected;
  const samePage = state.lastZukanPage === zukanPageMemory;
  app.innerHTML = html;
  const sheetEl = app.querySelector('.sheet:not(.zukan)');
  if (sheetEl && sameSheet) sheetEl.scrollTop = keep[0];
  const pageEl = app.querySelector('.book-page');
  if (pageEl && samePage) pageEl.scrollTop = keep[1];
  state.lastSheetId = state.selected;
  state.lastZukanPage = zukanPageMemory;
  state.sheetOpened = false;
  if (state.anim) state.anim = null;
  if (state.opening) state.opening = false;
}

// ---- 操作 ---------------------------------------------------------
function finish() {
  state.selected = null;
  state.result = judge(state);
  state.screen = 'result';
}

function afterAction(lines) {
  state.lastLines = lines;
  if (state.time <= 0) finish();
}

const selected = () => state.items.find((i) => i.id === state.selected);

app.addEventListener('click', (e) => {
  const b = e.target.closest('button,[data-close],[data-zukan]');
  if (!b) return;
  const d = b.dataset;

  if (d.start !== undefined) startStage(makeStage(1));
  else if (d.restart) startStage(cloneStage(state.stageSrc));
  else if (d.next) startStage(makeStage(state.stageNo + 1));
  else if (d.title) state = { screen: 'title', showZukan: false };
  else if (d.sel) {
    state.selected = d.sel; state.lastLines = []; state.picking = false; state.creamPick = false; state.sheetOpened = true;
    const it = selected();
    state.tab = it && canRemake(it) ? 'cook' : 'check';
  }
  else if (d.close) { state.selected = null; state.picking = false; }
  else if (d.zukan !== undefined) state.showZukan = d.zukan === '1';
  else if (d.zpage !== undefined) zukanPageMemory = Number(d.zpage);
  else if (d.tab) { state.tab = d.tab; state.picking = false; }
  else if (d.guess !== undefined) { const it = selected(); if (it) it.guess = Number(d.guess); }
  else if (d.act) {
    const it = selected();
    const act = ACTIONS.find((a) => a.id === d.act);
    if (it && act && canDo(state, it, act)) {
      if (['shake', 'press1', 'press2', 'press3', 'scoop', 'taste', 'eat'].includes(act.id)) state.anim = { id: it.id, kind: act.id };
      afterAction(perform(state, it, act));
    }
  } else if (d.fix) {
    const it = selected();
    const r = REPAIRS.find((x) => x.id === d.fix);
    if (it && r && canRepair(state, it, r)) {
      if (r.id === 'graft') state.picking = true;
      else afterAction(repair(state, it, r));
    }
  } else if (d.donor) {
    const it = selected();
    const donor = state.items.find((i) => i.id === d.donor);
    const r = REPAIRS.find((x) => x.id === 'graft');
    state.picking = false;
    if (it && donor && canRepair(state, it, r)) afterAction(repair(state, it, r, donor));
  } else if (d.cook) {
    const it = selected();
    const a = findCook(d.cook);
    state.creamPick = false;
    if (it && a && canCook(state, it, a)) afterAction(cook(state, it, a));
  } else if (d.creampick) state.creamPick = true;
  else if (d.creamcancel) state.creamPick = false;
  else if (d.cancel) state.picking = false;
  else if (d.finish) {
    if (window.confirm('ちひろが帰ってくるまで飛ばしますか。')) finish();
  }
  render();
});

state = { screen: 'title', showZukan: false };
render();
