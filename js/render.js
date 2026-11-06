// =============================================================
// デザートの描画（SVG）
// 容器は正体と無関係にランダム（グラス・脚付きグラス・ココット）。
// 中身は容器の内側の形で切り抜き、陰影・表面のハイライト・質感を重ねて立体感を出す。
// anim を渡すと、鑑定に応じた動き（物性で変わる）を付ける。
// =============================================================
import { lookFeatures, bodyLook, visibleAmount } from './model.js';

function hex(c) { return c.replace('#', '').match(/\w\w/g).map((h) => parseInt(h, 16)); }
function mix(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const bodyColor = (yellow) => mix('#fcf8ef', '#efbf55', yellow);

// ---- 動きのパラメータ（物性から） ----------------------------------
function motion(it, kind) {
  const v = {};
  if (kind === 'shake') {
    if (it.liquid) { v.amp = 10; v.dur = 1.2; } else if (it.set === 'agar') { v.amp = 1.5; v.dur = 0.35; } else if (it.set === 'starch') { v.amp = 2.5; v.dur = 0.7; } else {
      v.amp = 3 + it.elastic * 9 - it.firm * 3 + it.air * 2;
      v.dur = 0.6 + it.elastic * 0.9;
    }
  }
  if (kind.startsWith('press')) {
    const power = { press1: 0.5, press2: 1, press3: 1.7 }[kind];
    v.sq = Math.min(0.35, (1.1 - it.firm) * 0.22 * power);
    v.dur = 0.35 + (1 - it.elastic) * 1.1; // 弾力がないほど戻りが遅い
  }
  return v;
}

// ---- 容器の形 -----------------------------------------------------
// halfAt(y)：高さ y での内側の半幅。inner：中身を切り抜くパス。
function cupGeom(it) {
  const s = it.smallCup ? 0.84 : 1;
  const type = it.cup || 'glass';
  if (type === 'ramekin') {
    const top = 54;
    const bottom = 90;
    const th = 30 * s;
    const bh = 28 * s;
    return {
      type, top, bottom, th, bh, floor: bottom - 4, ry: 6.5,
      halfAt: (y) => th - 1.8 - (th - bh) * ((y - top) / (bottom - top)),
    };
  }
  if (type === 'footed') {
    // 丸みのある器（クープ型）
    const top = 32;
    const bottom = 68;
    const th = 31 * s;
    return {
      type, top, bottom, th, bh: 6, floor: bottom - 1, ry: 4.5,
      halfAt: (y) => {
        const t = Math.min(1, Math.max(0, (y - top) / (bottom - top)));
        return Math.max(2, (th - 1.8) * Math.sqrt(1 - t ** 2.4));
      },
    };
  }
  const top = it.smallCup ? 40 : 28;
  const bottom = 90;
  const th = 26 * s;
  const bh = 19 * s;
  return {
    type, top, bottom, th, bh, floor: bottom - 6, ry: 4, // 底の厚いガラス
    halfAt: (y) => th - 1.8 - (th - bh) * ((y - top) / (bottom - top)),
  };
}

// 容器の内側の形（中身を切り抜く）
function innerPath(g) {
  if (g.type === 'footed') {
    const { top, bottom, th } = g;
    const w = th - 1.8;
    return `M${50 - w},${top} C${50 - w},${top + (bottom - top) * 0.75} ${50 - w * 0.45},${bottom} 50,${bottom} C${50 + w * 0.45},${bottom} ${50 + w},${top + (bottom - top) * 0.75} ${50 + w},${top} Z`;
  }
  const t = g.halfAt(g.top);
  const b = g.halfAt(g.floor);
  const r = 3;
  return `M${50 - t},${g.top - 10} L${50 + t},${g.top - 10} L${50 + b},${g.floor - r} Q${50 + b},${g.floor} ${50 + b - r},${g.floor} L${50 - b + r},${g.floor} Q${50 - b},${g.floor} ${50 - b},${g.floor - r} Z`;
}

// 外側の輪郭
function outerPath(g) {
  const { top, bottom, th, bh } = g;
  if (g.type === 'footed') {
    return `M${50 - th},${top} C${50 - th},${top + (bottom - top) * 0.78} ${50 - th * 0.42},${bottom + 3} 50,${bottom + 3} C${50 + th * 0.42},${bottom + 3} ${50 + th},${top + (bottom - top) * 0.78} ${50 + th},${top}`;
  }
  if (g.type === 'ramekin') {
    return `M${50 - th},${top} L${50 - bh},${bottom - 2} Q${50 - bh},${bottom + 1} ${50 - bh + 4},${bottom + 1} L${50 + bh - 4},${bottom + 1} Q${50 + bh},${bottom + 1} ${50 + bh},${bottom - 2} L${50 + th},${top}`;
  }
  return `M${50 - th},${top} L${50 - bh},${bottom - 2} Q${50 - bh},${bottom + 1} ${50 - bh + 3},${bottom + 1} L${50 + bh - 3},${bottom + 1} Q${50 + bh},${bottom + 1} ${50 + bh},${bottom - 2} L${50 + th},${top}`;
}

// ---- 描画本体 ------------------------------------------------------
export function dessertSVG(it, size = 100, anim = null) {
  const f = lookFeatures(it);
  const bl = bodyLook(it);
  let body = bodyColor(bl.yellow);
  if (bl.pink > 0) body = mix(body, '#e78aa1', bl.pink * 0.75); // 果物
  if (bl.brown > 0) body = mix(body, '#3f2414', bl.brown * 0.85); // コーヒー
  const light = mix(body, '#ffffff', 0.45);
  const shade = mix(body, '#7a5a35', 0.28);
  const dark = mix(body, '#4a3320', 0.45);
  const g = cupGeom(it);
  const id = `d${Math.random().toString(36).slice(2, 8)}`;

  const amount = visibleAmount(it);
  const usable = g.floor - g.top - (g.type === 'footed' ? 3 : 5);
  const fillTop = g.type === 'ramekin'
    ? g.top + 2.5 + (1 - amount) * 8
    : g.floor - usable * amount;
  const rx = g.halfAt(fillTop);
  const ry = Math.max(1.6, Math.min(g.ry, rx * 0.17));

  // ---- 定義（グラデーション・フィルタ・切り抜き） ----
  let defs = `
    <clipPath id="${id}in"><path d="${innerPath(g)}"/></clipPath>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(body, '#ffffff', 0.12)}"/><stop offset="1" stop-color="${shade}"/></linearGradient>
    <linearGradient id="${id}side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="0.22" stop-color="#000" stop-opacity="0"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.06"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient>
    <radialGradient id="${id}top" cx="0.42" cy="0.4" r="0.7"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${mix(body, '#ffffff', 0.1)}"/></radialGradient>
    <radialGradient id="${id}car" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#b8742f"/><stop offset="0.6" stop-color="#8a4716"/><stop offset="1" stop-color="#5e2b0b"/></radialGradient>
    <radialGradient id="${id}crust" cx="0.45" cy="0.4" r="0.8"><stop offset="0" stop-color="#e3a54e"/><stop offset="0.7" stop-color="#c27a2a"/><stop offset="1" stop-color="#8c4f16"/></radialGradient>
    <linearGradient id="${id}glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfe2ee" stop-opacity="0.55"/><stop offset="0.15" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="0.85" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="1" stop-color="#cfe2ee" stop-opacity="0.5"/></linearGradient>
    <linearGradient id="${id}cer" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e7e1d6"/><stop offset="0.35" stop-color="#fffdf9"/><stop offset="0.7" stop-color="#f6f2ea"/><stop offset="1" stop-color="#ddd5c7"/></linearGradient>
    <filter id="${id}blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="${id}soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.6"/></filter>
    <filter id="${id}matte" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;

  // ---- 影 ----
  const shadowY = g.type === 'footed' ? 89.5 : g.bottom + 2;
  const shadowRx = g.type === 'footed' ? 17 : g.bh + 6;
  let back = `<ellipse cx="50" cy="${shadowY}" rx="${shadowRx}" ry="2.6" fill="#5b6f7c" opacity="0.28" filter="url(#${id}blur)"/>`;

  // ---- 容器の奥側 ----
  if (g.type === 'ramekin') {
    back += `<ellipse cx="50" cy="${g.top}" rx="${g.th}" ry="${g.ry}" fill="#efe9df"/>`;
    back += `<ellipse cx="50" cy="${g.top + 0.6}" rx="${g.th - 1.8}" ry="${g.ry - 1.2}" fill="#e2dacd"/>`;
  } else {
    back += `<path d="${outerPath(g)} Z" fill="#e6f1f7" opacity="0.55"/>`;
  }

  // ---- 中身 ----
  let jelly = '';
  if (it.amount > 0) {
    const top = fillTop;
    // 側面（容器の形で切り抜く）
    let inside = `<rect x="0" y="${top}" width="100" height="${100 - top}" fill="url(#${id}b)"/>`;
    inside += `<rect x="0" y="${top}" width="100" height="${100 - top}" fill="url(#${id}side)"/>`;
    if (it.su > 0.2 && g.type !== 'ramekin') {
      // 側面から見える小さな穴（す）
      for (const [dx, dy] of [[-0.5, 10], [0.3, 16], [-0.1, 22], [0.55, 8]]) {
        if (top + dy < g.floor - 3) inside += `<ellipse cx="${50 + dx * rx}" cy="${top + dy}" rx="0.9" ry="0.6" fill="${shade}" opacity="0.8"/>`;
      }
    }
    if (it.air > 0.3 && g.type !== 'ramekin') {
      // 気泡の多い生地は、側面に細かな粒
      for (let i = 0; i < 14; i += 1) {
        const x = 50 + ((i * 37) % 23 - 11) / 11 * rx * 0.85;
        const y = top + 4 + ((i * 53) % 29);
        if (y < g.floor - 2) inside += `<circle cx="${x}" cy="${y}" r="0.45" fill="${shade}" opacity="0.55"/>`;
      }
    }
    jelly += `<g clip-path="url(#${id}in)">${inside}</g>`;

    // 上面
    if (it.liquid) {
      jelly += `<ellipse cx="50" cy="${top}" rx="${rx}" ry="${ry * 0.8}" fill="url(#${id}top)"/>`;
      jelly += `<path d="M${50 - rx * 0.55},${top} q${rx * 0.28},-1.2 ${rx * 0.55},0 t${rx * 0.55},0" stroke="${shade}" stroke-width="0.6" fill="none" opacity="0.7"/>`;
    } else if (it.whip) {
      jelly += whipSVG(id, rx, top);
    } else {
      jelly += `<ellipse cx="50" cy="${top}" rx="${rx}" ry="${ry}" fill="url(#${id}top)"/>`;
      if (f.gloss < 0.35) jelly += `<ellipse cx="50" cy="${top}" rx="${rx}" ry="${ry}" fill="#fff" filter="url(#${id}matte)" opacity="0.6"/>`;
      if (f.crust > 0.5) {
        // 焦がした硬い膜（クレームブリュレ）
        jelly += `<ellipse cx="50" cy="${top}" rx="${rx - 0.4}" ry="${ry - 0.3}" fill="url(#${id}crust)"/>`;
        for (const [dx, dy, r] of [[-0.45, 0.8, 2.6], [0.15, -0.6, 2], [0.5, 0.9, 1.8], [-0.1, 1.4, 1.4], [0.3, 0.2, 1.2]]) {
          jelly += `<ellipse cx="${50 + dx * rx}" cy="${top + dy}" rx="${r}" ry="${r * 0.4}" fill="#6e3a0e" opacity="0.55" filter="url(#${id}soft)"/>`;
        }
      }
      if (f.caramel) {
        jelly += `<ellipse cx="50" cy="${top}" rx="${rx - 0.8}" ry="${ry - 0.5}" fill="url(#${id}car)"/>`;
        // 縁から垂れるカラメル
        const drips = it.sauce ? [[-0.85, 7], [-0.35, 10], [0.55, 6], [0.82, 9]] : [[-0.8, 5], [0.65, 7]];
        let d = '';
        for (const [dx, len] of drips) {
          const x = 50 + dx * rx;
          d += `<path d="M${x - 1.8},${top} q0.4,${len * 0.7} 1.8,${len} q1.4,-${len * 0.3} 1.8,-${len}" fill="#7a3d12" opacity="0.92"/>`;
        }
        jelly += `<g clip-path="url(#${id}in)">${d}</g>`;
      }
      if (f.water > 0.3) {
        jelly += `<path d="M${50 - rx + 1},${top + 0.6} A${rx - 1},${ry - 0.4} 0 0,0 ${50 + rx - 1},${top + 0.6}" stroke="#a9d6ec" stroke-width="1.1" fill="none" opacity="0.8"/>`;
      }
      // つや（つやがあるほど大きく明るい）
      if (f.gloss > 0.3 || f.caramel || f.crust > 0.5) {
        const gl = Math.max(f.gloss, f.caramel ? 0.8 : 0);
        jelly += `<ellipse cx="${50 - rx * 0.32}" cy="${top - ry * 0.25}" rx="${rx * 0.36}" ry="${ry * 0.32}" fill="#fff" opacity="${(gl * 0.75).toFixed(2)}" filter="url(#${id}soft)"/>`;
        jelly += `<ellipse cx="${50 + rx * 0.42}" cy="${top + ry * 0.2}" rx="${rx * 0.1}" ry="${ry * 0.15}" fill="#fff" opacity="${(gl * 0.5).toFixed(2)}"/>`;
      }
      if (it.frost) {
        for (let i = 0; i < 16; i += 1) {
          jelly += `<circle cx="${50 + ((i * 41) % 31 - 15) / 15 * rx * 0.85}" cy="${top + ((i * 17) % 7 - 3) / 3 * ry * 0.7}" r="0.55" fill="#fff" opacity="0.95"/>`;
        }
      }
      jelly += marksSVG(it, g, id, top, rx, ry, shade, dark);
    }
  } else {
    // 空の容器：底に少しだけ残りかす
    jelly += `<ellipse cx="50" cy="${g.floor - 1}" rx="${g.halfAt(g.floor) * 0.6}" ry="1.4" fill="${mix(body, '#d8ccb6', 0.5)}" opacity="0.7"/>`;
  }

  // ---- 容器の手前側 ----
  let front = '';
  if (g.type === 'ramekin') {
    // 白い陶器：手前の壁は、ふちの手前側の弧から下だけ（内側が見える）
    const { top, bottom, th, bh } = g;
    const wall = `M${50 - th},${top} A${th},${g.ry} 0 0,0 ${50 + th},${top} L${50 + bh},${bottom - 2} Q${50 + bh},${bottom + 1} ${50 + bh - 4},${bottom + 1} L${50 - bh + 4},${bottom + 1} Q${50 - bh},${bottom + 1} ${50 - bh},${bottom - 2} Z`;
    front += `<path d="${wall}" fill="url(#${id}cer)"/>`;
    // 縦の溝（陰影で）
    let ribs = '';
    for (let i = -6; i <= 6; i += 1) {
      const u = i / 6.6;
      const x1 = 50 + th * u;
      const x2 = 50 + bh * u;
      const yTop = top + g.ry * Math.sqrt(Math.max(0, 1 - u * u)) + 0.8;
      ribs += `<path d="M${x1},${yTop} L${x2},${bottom - 1}" stroke="#d2c8b8" stroke-width="1.1" opacity="${(0.5 + Math.abs(u) * 0.4).toFixed(2)}"/>`;
      ribs += `<path d="M${x1 + 0.9},${yTop} L${x2 + 0.8},${bottom - 1}" stroke="#ffffff" stroke-width="0.6" opacity="0.7"/>`;
    }
    front += ribs;
    front += `<path d="M${50 - th},${top} A${th},${g.ry} 0 0,0 ${50 + th},${top}" fill="none" stroke="#fffdf8" stroke-width="1.6"/>`;
    front += `<path d="${outerPath(g)}" fill="none" stroke="#bdb2a1" stroke-width="0.8"/>`;
    front += `<ellipse cx="50" cy="${top}" rx="${th}" ry="${g.ry}" fill="none" stroke="#c9bfae" stroke-width="0.8"/>`;
  } else {
    // ガラス：輪郭・厚み・映り込み
    front += `<path d="${outerPath(g)} Z" fill="url(#${id}glass)"/>`;
    if (g.type === 'glass') {
      const b = g.halfAt(g.floor);
      front += `<path d="M${50 - b},${g.floor} L${50 + b},${g.floor} L${50 + g.bh - 0.5},${g.bottom} L${50 - g.bh + 0.5},${g.bottom} Z" fill="#d5e6f0" opacity="0.55"/>`;
      front += `<ellipse cx="50" cy="${g.floor}" rx="${b}" ry="1.6" fill="none" stroke="#b6cfdd" stroke-width="0.6" opacity="0.8"/>`;
    }
    front += `<path d="${outerPath(g)}" fill="none" stroke="#8fa9ba" stroke-width="1.1" stroke-linejoin="round"/>`;
    front += `<ellipse cx="50" cy="${g.top}" rx="${g.th}" ry="${g.ry}" fill="none" stroke="#8fa9ba" stroke-width="1.1"/>`;
    front += `<ellipse cx="50" cy="${g.top + 0.5}" rx="${g.th - 1}" ry="${g.ry - 0.8}" fill="none" stroke="#ffffff" stroke-width="0.7" opacity="0.8"/>`;
    // 縦の映り込み
    const hl1 = g.type === 'footed'
      ? `M${50 - g.th + 4},${g.top + 4} C${50 - g.th + 4},${g.top + 18} ${50 - g.th * 0.6},${g.bottom - 6} ${50 - g.th * 0.35},${g.bottom - 3}`
      : `M${50 - g.th + 4},${g.top + 5} L${50 - g.bh + 3.5},${g.floor - 3}`;
    front += `<path d="${hl1}" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.75" filter="url(#${id}soft)"/>`;
    front += `<path d="M${50 + g.th - 5},${g.top + 6} L${50 + g.th - 6.5},${g.top + 14}" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>`;
    if (g.type === 'footed') {
      // 脚と台
      const y0 = g.bottom + 3;
      front += `<path d="M48.2,${y0} C48.2,${y0 + 6} 47.6,${y0 + 12} 46.5,${y0 + 15} L53.5,${y0 + 15} C52.4,${y0 + 12} 51.8,${y0 + 6} 51.8,${y0} Z" fill="#dbeaf2" opacity="0.8" stroke="#8fa9ba" stroke-width="0.9"/>`;
      front += `<ellipse cx="50" cy="${y0 + 16.5}" rx="15" ry="3" fill="#e2eef5" opacity="0.85" stroke="#8fa9ba" stroke-width="0.9"/>`;
      front += `<path d="M38,${y0 + 16} q12,2.5 24,0" stroke="#fff" stroke-width="0.8" fill="none" opacity="0.8"/>`;
    }
  }

  // ---- スプーン（すくう・味見・食べる） ----
  let spoon = '';
  if (anim && ['scoop', 'taste', 'eat'].includes(anim)) {
    spoon = `<g class="spoon"><defs><linearGradient id="${id}sp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="1" stop-color="#9aa3ab"/></linearGradient></defs>
      <path d="M71,${fillTop - 26} L64,${fillTop - 5}" stroke="url(#${id}sp)" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="62.5" cy="${fillTop - 2}" rx="5.2" ry="3.4" transform="rotate(-20 62.5 ${fillTop - 2})" fill="url(#${id}sp)" stroke="#8b949c" stroke-width="0.5"/></g>`;
  }

  let cls = '';
  let style = '';
  if (anim) {
    cls = `anim-${anim.startsWith('press') ? 'press' : anim}`;
    const m = motion(it, anim);
    style = Object.entries(m).map(([k, v]) => `--${k}:${v.toFixed(3)}`).join(';');
  }

  return `<svg class="${cls} cup-${g.type}" style="${style}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs>${defs}</defs>`
    + `<g class="cupwrap">${back}<g class="jelly">${jelly}</g>${front}</g>${spoon}</svg>`;
}

// ---- ホイップ（絞り出したクリーム） --------------------------------
function whipSVG(id, rx, top) {
  const c = '#fffaf1';
  const s = '#d9ccb5';
  let out = `<defs><radialGradient id="${id}w" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#efe5d3"/></radialGradient></defs>`;
  out += `<ellipse cx="50" cy="${top}" rx="${rx + 0.5}" ry="5" fill="url(#${id}w)" stroke="${s}" stroke-width="0.6"/>`;
  // 外周のひだ
  const n = 7;
  for (let i = 0; i < n; i += 1) {
    const u = (i / (n - 1)) * 2 - 1;
    const x = 50 + u * rx * 0.78;
    const y = top - 1 + Math.abs(u) * 1.5;
    out += `<path d="M${x - 5},${y + 1} Q${x - 4},${y - 7} ${x},${y - 8} Q${x + 4},${y - 7} ${x + 5},${y + 1} Z" fill="url(#${id}w)" stroke="${s}" stroke-width="0.6"/>`;
    out += `<path d="M${x - 2},${y - 1} Q${x},${y - 6} ${x + 1.5},${y - 6.5}" stroke="${s}" stroke-width="0.5" fill="none"/>`;
  }
  // 中央の山と先端
  out += `<path d="M42,${top - 5} Q43,${top - 15} 50,${top - 17} Q57,${top - 15} 58,${top - 5} Z" fill="url(#${id}w)" stroke="${s}" stroke-width="0.6"/>`;
  out += `<path d="M46,${top - 8} Q49,${top - 13} 53,${top - 13}" stroke="${s}" stroke-width="0.6" fill="none"/>`;
  out += `<path d="M48,${top - 16.5} Q50,${top - 21} 52.5,${top - 19}" stroke="${s}" stroke-width="0.7" fill="${c}"/>`;
  return out;
}

// ---- 傷（へこみ・穴・ひび・切れ目・移植の継ぎ目） --------------------
function marksSVG(it, g, id, top, rx, ry, shade, dark) {
  let out = '';
  const s = it.smallCup ? 0.84 : 1;
  for (const m of it.marks) {
    const x = 50 + (m.x - 50) * s * (rx / 26);
    const y = top + ((m.x * 7) % 3 - 1) * ry * 0.25;
    if (m.type === 'patch') {
      out += `<ellipse cx="${x}" cy="${y + 0.5}" rx="5" ry="${Math.min(2.4, ry * 0.6)}" fill="${bodyColor(m.yellow)}" stroke="${dark}" stroke-width="0.5" stroke-dasharray="1.2 1"/>`;
      continue;
    }
    if (it.sauce && m.type !== 'hole') continue; // ソースで浅い傷は見えない
    if (m.type === 'dent') {
      out += `<ellipse cx="${x}" cy="${y + 0.3}" rx="3.8" ry="${Math.min(1.6, ry * 0.4)}" fill="${shade}" opacity="0.65" filter="url(#${id}soft)"/>`;
      out += `<path d="M${x - 3.4},${y + 0.9} q3.4,1.4 6.8,0" stroke="#fff" stroke-width="0.6" fill="none" opacity="0.8"/>`;
    }
    if (m.type === 'hole') {
      const o = it.sauce ? 0.35 : 1;
      out += `<ellipse cx="${x}" cy="${y + 0.5}" rx="5.2" ry="${Math.min(2.8, ry * 0.7)}" fill="${dark}" opacity="${0.85 * o}"/>`;
      out += `<ellipse cx="${x + 0.4}" cy="${y + 1.1}" rx="3.4" ry="${Math.min(1.5, ry * 0.4)}" fill="${mix(dark, '#000000', 0.35)}" opacity="${0.7 * o}" filter="url(#${id}soft)"/>`;
      out += `<path d="M${x - 5},${y + 0.8} q5,2.6 10,0" stroke="#fff" stroke-width="0.6" fill="none" opacity="${0.7 * o}"/>`;
    }
    if (m.type === 'crack') {
      out += `<path d="M${x - 7},${y - 0.3} l2.6,1.4 l2.2,-1.6 l2.6,2.1 l2.4,-1.8 l2.8,1" stroke="${dark}" stroke-width="1" fill="none" stroke-linejoin="round"/>`;
      out += `<path d="M${x - 7},${y + 0.3} l2.6,1.4 l2.2,-1.6 l2.6,2.1 l2.4,-1.8 l2.8,1" stroke="#fff" stroke-width="0.5" fill="none" opacity="0.6"/>`;
    }
    if (m.type === 'cut') {
      out += `<g clip-path="url(#${id}in)"><path d="M${x},${y - 1} L${x - 4},${g.floor}" stroke="${dark}" stroke-width="1.2"/>`
        + `<path d="M${x + 0.9},${y - 0.5} L${x - 3},${g.floor}" stroke="#fff" stroke-width="0.6" opacity="0.7"/></g>`;
    }
  }
  return out;
}
