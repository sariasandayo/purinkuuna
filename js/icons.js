// =============================================================
// ボタン用の小さなアイコン（24×24、線画）
// =============================================================
const wrap = (body) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICON = {
  look: wrap('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  sniff: wrap('<path d="M12 4c-1.5 4-3.5 7-3.5 10a3.5 3.5 0 0 0 7 0"/><path d="M6 6c1.5 1 2 2.5 1 4M18 6c-1.5 1-2 2.5-1 4"/>'),
  shake: wrap('<path d="M7 18h10l-1.5-8h-7z"/><path d="M3 9c1-1.5 1-3 0-4.5M21 9c-1-1.5-1-3 0-4.5"/>'),
  press: wrap('<path d="M12 3v9"/><path d="M9 9l3 3 3-3"/><path d="M5 18c2 2 12 2 14 0"/><path d="M7 15.5c1.5 1.2 8.5 1.2 10 0"/>'),
  scoop: wrap('<ellipse cx="9" cy="8" rx="4" ry="5"/><path d="M11.5 12l7 8"/>'),
  cut: wrap('<path d="M4 20L18 6a2.8 2.8 0 0 0-4-4L4 12z"/><path d="M4 12l3 3"/>'),
  taste: wrap('<path d="M7 9c0-3 2.2-5 5-5s5 2 5 5v4a5 5 0 0 1-10 0z"/><path d="M12 9v7"/>'),
  eat: wrap('<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10"/><path d="M17 3c-2 2-2.5 5-2.5 8h2.5v10"/>'),
  whip: wrap('<path d="M6 19h12"/><path d="M8 19c-2-3 0-6 4-6s6 3 4 6"/><path d="M10 13c-1-2 .5-4 2-4s3 2 2 4"/><path d="M12 9V6"/>'),
  sauce: wrap('<path d="M9 3h6v4l2 3v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9l2-3z"/><path d="M9 14h6"/>'),
  graft: wrap('<rect x="3" y="11" width="7" height="8" rx="1.5"/><rect x="14" y="11" width="7" height="8" rx="1.5"/><path d="M8 7c2-3 6-3 8 0M14 7l2 0 0-2"/>'),
  cup: wrap('<path d="M5 7h14l-2 12H7z"/><path d="M8 4h8"/>'),
  warm: wrap('<path d="M12 3c2 3-2 4 0 7s2 4 0 7"/><path d="M5 20h14"/><path d="M7 17h10"/>'),
  boil: wrap('<path d="M4 11h16l-1.5 9h-13z"/><circle cx="9" cy="6" r="1.4"/><circle cx="14" cy="4.5" r="1.4"/><circle cx="16" cy="8" r="1"/>'),
  cool: wrap('<path d="M4 9h11a3 3 0 1 0-3-3"/><path d="M4 13h14a3 3 0 1 1-3 3"/><path d="M4 17h6"/>'),
  pour: wrap('<path d="M4 6l7 4-2 5-6-3z"/><path d="M10 12c2 1 3 3 3 6"/><path d="M8 20h10"/>'),
  discard: wrap('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  steam: wrap('<path d="M8 4c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4M16 4c-1 1.5 1 2.5 0 4"/><path d="M4 12h16l-1.5 8h-13z"/>'),
  chill: wrap('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M9 5v2M9 13v3"/>'),
  freeze: wrap('<path d="M12 2v20M4 6l16 12M20 6L4 18"/><path d="M9 3l3 2 3-2M9 21l3-2 3 2"/>'),
  brulee: wrap('<path d="M14 3l-4 7h4l-3 6"/><path d="M4 18c3 2 13 2 16 0"/><path d="M4 18c0-1.5 16-1.5 16 0"/>'),
};

// 崩れやすさの目安（0〜3）を点で示す
export function riskDots(n) {
  return `<span class="risk" aria-label="崩れやすさ ${n}">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
}
