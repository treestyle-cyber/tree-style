// Shared by /picks and the Studio's story maker: the colors and small drawings of each kind of piece.
// Colors used to draw each piece
const HEX = { green:"#2F5A3C", moss:"#55623A", sage:"#8FA07E", red:"#A3202C", burgundy:"#6E1A2A", gold:"#C9A961", champagne:"#D8C39A",
  white:"#F1ECE2", ivory:"#EDE4D0", silver:"#C4C8CC", clear:"#DDE6EC", navy:"#1F2E4D", blue:"#6F8FB0", gray:"#8C8F94",
  brown:"#6B4A33", pink:"#E0679A", lime:"#B5D334", turquoise:"#3FB8B0", wicker:"#A9814F", pine:"#3F6B47", black:"#1B1B1D" };
const col = (cols, i) => HEX[cols[Math.min(i, cols.length - 1)]] || cols[0];
// Small drawings of each kind of piece, in its colors
const shine = `<ellipse cx="-6" cy="-7" rx="4" ry="6" fill="#fff" opacity=".28" transform="rotate(30)"/>`;
const DRAW = {
  ball: c => `<g><circle cx="-14" cy="6" r="15" fill="${col(c,0)}"/><rect x="-18" y="-13" width="8" height="5" rx="1" fill="#C9A961"/><g transform="translate(-14 6)">${shine}</g>
    <circle cx="16" cy="9" r="12" fill="${col(c,1)}"/><rect x="13" y="-7" width="6" height="4" rx="1" fill="#C9A961"/><g transform="translate(16 9) scale(.8)">${shine}</g></g>`,
  drop: c => `<g><path d="M0 -26 C12 -10 16 6 0 30 C-16 6 -12 -10 0 -26Z" fill="${col(c,0)}"/><path d="M0 -26 C5 -12 6 4 0 22" stroke="${col(c,1)}" stroke-width="3" fill="none" opacity=".7"/><rect x="-4" y="-31" width="8" height="5" rx="1" fill="#C9A961"/></g>`,
  sprig: c => `<g stroke="${col(c,0)}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M0 30 C2 10 -2 -10 4 -30"/>${[-20,-10,0,10,20].map(y=>`<path d="M${1+y/12} ${y} l-15 -7 M${1+y/12} ${y} l15 -9"/>`).join("")}</g>`,
  flower: c => `<g>${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-14" rx="10" ry="15" fill="${col(c,0)}" transform="rotate(${a})" opacity=".95"/>`).join("")}<circle r="7" fill="${col(c,1)}"/></g>`,
  berries: c => `<g><path d="M-18 26 C-8 8 6 -2 20 -22" stroke="${HEX.brown}" stroke-width="2.5" fill="none"/>${[[-10,10],[-3,3],[5,-6],[12,-14],[-14,2],[2,-12],[10,4]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="5.5" fill="${col(c,i%2)}"/>`).join("")}</g>`,
  bow: c => `<g fill="${col(c,0)}"><path d="M0 0 C-14 -18 -30 -14 -26 0 C-30 14 -14 18 0 0Z"/><path d="M0 0 C14 -18 30 -14 26 0 C30 14 14 18 0 0Z"/><path d="M-3 2 L-14 30 L-7 27 L-3 32Z M3 2 L14 30 L7 27 L3 32Z"/><circle r="6" fill="${col(c,1)}" stroke="rgba(0,0,0,.2)"/></g>`,
  ribbon: c => `<g><rect x="-26" y="-14" width="52" height="28" rx="4" fill="${col(c,0)}"/><rect x="-26" y="-14" width="52" height="5" fill="${col(c,1)}"/><rect x="-26" y="9" width="52" height="5" fill="${col(c,1)}"/><path d="M14 14 l10 18 l4 -8 l8 4 l-10 -14z" fill="${col(c,0)}"/></g>`,
  horn: c => `<g fill="none" stroke="${col(c,0)}" stroke-width="5" stroke-linecap="round"><path d="M-24 6 C-24 -14 10 -14 10 0 C10 12 -14 12 -14 0"/><path d="M10 0 L26 -16" /><path d="M20 -22 L32 -10" stroke-width="7"/></g>`,
  star: c => `<path d="M0 -28 L8 -9 L28 -9 L12 3 L18 23 L0 11 L-18 23 L-12 3 L-28 -9 L-8 -9Z" fill="${col(c,0)}"/>`,
  skirt: c => `<g><path d="M-34 22 C-30 4 -14 -4 0 -4 C14 -4 30 4 34 22 Z" fill="${col(c,0)}"/><path d="M-34 22 C-20 28 20 28 34 22" stroke="rgba(0,0,0,.25)" stroke-width="2" fill="none"/><rect x="-3" y="-28" width="6" height="26" fill="${HEX.brown}"/></g>`,
};
const svg = (kind, c) => `<svg width="96" height="72" viewBox="-40 -34 80 68" aria-hidden="true">${DRAW[kind](c)}</svg>`;
