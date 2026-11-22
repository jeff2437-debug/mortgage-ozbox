// Mortgage payoff calculator UI.
import { simulate, requiredRepayment, firstPeriodInterest, money, duration, balanceAt, PAY_LABEL } from './loan.js';

const $ = (s, r = document) => r.querySelector(s);
const box = $('#calc');
if (box) init(box);

function init(box) {
  const q = new URLSearchParams(location.search);
  const num = (k, d) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) && v >= 0 ? v : d; };
  const pick = (k, d, ok) => (ok.includes(q.get(k)) ? q.get(k) : d);
  const st = {
    principal: num('loan', +box.dataset.loan || 600000),
    rate: num('rate', +box.dataset.rate || 6),
    years: num('years', 30),
    pay: pick('pay', box.dataset.pay || 'monthly', ['weekly', 'fortnightly', 'monthly']),
    charge: pick('charge', 'monthly', ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly']),
    mode: q.get('repay') ? 'own' : 'min',
    own: num('repay', 0),
    extra: num('extra', box.dataset.extra != null ? +box.dataset.extra : 200),
    rdAmt: num('redraw', 0),
    rdAt: num('redrawAt', 5),
  };

  box.innerHTML = `
<form class="inputs" novalidate>
  <label>Loan amount <span class="field"><i>$</i><input id="f-loan" type="number" inputmode="decimal" min="0" step="1000" value="${st.principal}"></span></label>
  <label>Interest rate <span class="field"><input id="f-rate" type="number" inputmode="decimal" min="0" max="30" step="0.01" value="${st.rate}"><i>% p.a.</i></span></label>
  <label>Loan term <span class="field"><input id="f-years" type="number" inputmode="numeric" min="1" max="40" step="1" value="${st.years}"><i>years</i></span></label>
  <label>Repayments <select id="f-pay">${opt(['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly'])}</select></label>
  <label>Interest charged <select id="f-charge">${opt(['daily', 'Daily'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly (most common)'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly'])}</select></label>
  <fieldset class="repay"><legend>Regular repayment</legend>
    <label class="radio"><input type="radio" name="mode" value="min"${st.mode === 'min' ? ' checked' : ''}> Minimum for the loan term: <b id="o-min"></b></label>
    <label class="radio"><input type="radio" name="mode" value="own"${st.mode === 'own' ? ' checked' : ''}> My own amount
      <span class="field small"><i>$</i><input id="f-own" type="number" inputmode="decimal" min="0" step="10" aria-label="Your regular repayment" value="${st.own || ''}"></span></label>
  </fieldset>
  <label class="extra"><span>Extra repayment each <span id="o-per">month</span></span> <span class="field"><i>$</i><input id="f-extra" type="number" inputmode="decimal" min="0" step="10" value="${st.extra}"></span></label>
  <fieldset class="repay redraw"><legend>Redraw (optional)</legend>
    <label class="radio">Take out <span class="field small"><i>$</i><input id="f-rdamt" type="number" inputmode="decimal" min="0" step="1000" aria-label="Amount to redraw" value="${st.rdAmt || ''}" placeholder="0"></span>
      after <span class="field small yrs"><input id="f-rdat" type="number" inputmode="decimal" min="0.1" max="40" step="1" aria-label="Years until the redraw" value="${st.rdAt}"><i>years</i></span></label>
    <small class="hint">Redraw lets you take back money you've paid ahead of the minimum. Your repayment usually stays the same, so the loan runs longer.</small>
  </fieldset>
</form>
<div class="results" aria-live="polite">
  <div class="stats" id="o-stats"></div>
  <p class="msg" id="o-msg"></p>
  <div id="o-chart" class="chart"></div>
  <details class="sched"><summary>Year-by-year schedule</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Year-by-year loan schedule"><table id="o-table"></table></div></details>
  <p class="hint">Estimates only. Interest is worked out daily on the balance and added to the loan at the frequency you choose. Lenders' exact methods, fees and rate changes will make real figures differ a little. <a id="o-link" href="#">Link to these figures</a></p>
</div>`;
  $('#f-pay').value = st.pay;
  $('#f-charge').value = st.charge;
  const chart = makeChart($('#o-chart'));

  function opt(...pairs) { return pairs.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); }

  let timer;
  box.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(read, 120); });
  box.addEventListener('change', read);
  // stop the mouse wheel changing a focused number field while the page scrolls
  box.addEventListener('wheel', e => { if (e.target.type === 'number' && document.activeElement === e.target) e.target.blur(); }, { passive: true });
  $('#f-own').addEventListener('focus', () => { $('[name=mode][value=own]').checked = true; });

  function read() {
    const f = id => parseFloat($(id).value);
    st.principal = Math.max(0, f('#f-loan') || 0);
    st.rate = Math.min(30, Math.max(0, f('#f-rate') || 0));
    st.years = Math.min(40, Math.max(1, Math.round(f('#f-years') || 1)));
    st.pay = $('#f-pay').value; st.charge = $('#f-charge').value;
    st.mode = $('[name=mode]:checked').value;
    st.own = Math.max(0, f('#f-own') || 0);
    st.extra = Math.max(0, f('#f-extra') || 0);
    st.rdAmt = Math.max(0, f('#f-rdamt') || 0);
    st.rdAt = Math.min(40, Math.max(0, f('#f-rdat') || 0));
    run();
  }

  function run() {
    const per = PAY_LABEL[st.pay];
    $('#o-per').textContent = per;
    const min = requiredRepayment(st);
    $('#o-min').textContent = st.principal ? `${money(min, 2)} a ${per}` : '–';
    if (!$('#f-own').value) $('#f-own').placeholder = min.toFixed(0);
    const base = st.mode === 'own' && st.own > 0 ? st.own : min;
    const stats = $('#o-stats'), msg = $('#o-msg');
    $('#o-link').href = '?' + new URLSearchParams({ loan: st.principal, rate: st.rate, years: st.years, pay: st.pay, charge: st.charge, extra: st.extra, ...(st.mode === 'own' && st.own ? { repay: st.own } : {}), ...(st.rdAmt ? { redraw: st.rdAmt, redrawAt: st.rdAt } : {}) });
    if (!st.principal) { stats.innerHTML = ''; msg.textContent = 'Enter a loan amount to start.'; chart.update([]); $('#o-table').innerHTML = ''; return; }

    const a = simulate({ ...st, repayment: base, extra: 0 });
    const b = st.extra > 0 ? simulate({ ...st, repayment: base, extra: st.extra }) : null;
    const plan = b || a; // your plan without any redraw
    const interest1 = firstPeriodInterest(st);
    if (!plan.repaid) {
      stats.innerHTML = '';
      msg.className = 'msg warn';
      msg.textContent = base + st.extra <= interest1
        ? `A repayment of ${money(base + st.extra, 2)} a ${per} doesn't cover the interest (about ${money(interest1, 0)} a ${per} to start), so the loan would never be repaid.`
        : `At ${money(base + st.extra, 2)} a ${per} this loan wouldn't be repaid within 60 years.`;
      chart.update([{ pts: plan.points, color: '#c2410c', name: 'Balance' }], 60);
      $('#o-table').innerHTML = '';
      return;
    }

    // Redraw: limited to what you've paid ahead of the minimum-repayment schedule by then.
    let c = null, rdNote = '';
    if (st.rdAmt > 0 && st.rdAt > 0) {
      const sched = Math.abs(base - min) < 0.005 ? a : simulate({ ...st, repayment: min, extra: 0 });
      if (st.rdAt * 365 >= plan.days) rdNote = `The loan is already paid off before year ${st.rdAt}, so there's nothing to redraw then.`;
      else {
        const avail = Math.max(0, Math.floor(balanceAt(sched.points, st.rdAt) - balanceAt(plan.points, st.rdAt)));
        const amt = Math.min(st.rdAmt, avail);
        if (amt <= 0) rdNote = `By year ${st.rdAt} you won't have paid ahead of the minimum repayments, so there's nothing available to redraw.`;
        else {
          c = simulate({ ...st, repayment: base, extra: st.extra, redrawAt: st.rdAt, redrawAmount: amt });
          if (amt < st.rdAmt) rdNote = `Only about ${money(avail)} would be available to redraw after ${st.rdAt} years (what you've paid ahead of the minimum), so the calculator uses that. `;
          rdNote += c.repaid
            ? `Redrawing ${money(amt)} after ${st.rdAt} years adds ${duration(Math.max(0, c.days - plan.days))} to the loan and ${money(c.totalInterest - plan.totalInterest)} in interest, compared with leaving it in.`
            : `After redrawing ${money(amt)}, these repayments wouldn't clear the loan within 60 years.`;
        }
      }
    }
    const main = c && c.repaid ? c : plan;
    msg.className = 'msg';
    const s = (label, value, sub = '', cls = '') => `<div class="stat ${cls}"><small>${label}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    const cmp = main !== a && a.repaid;
    let html = s('Regular repayment', `${money(base + st.extra, 2)}`, `a ${per}${st.extra ? ` (${money(base, 2)} + ${money(st.extra, 2)} extra)` : ''}`);
    html += s('Paid off in', duration(main.days), cmp ? (main.days <= a.days ? `${duration(a.days - main.days)} sooner` : `${duration(main.days - a.days)} later`) : `${main.periods.toLocaleString('en-AU')} repayments`, 'good');
    html += s('Total interest', money(main.totalInterest), cmp ? (a.totalInterest >= main.totalInterest ? `saves ${money(a.totalInterest - main.totalInterest)}` : `costs ${money(main.totalInterest - a.totalInterest)} more`) : '', cmp ? 'good' : '');
    html += s('Total repaid', money(main.totalPaid), `on a ${money(st.principal)} loan${main.redrawn ? ` + ${money(main.redrawn)} redrawn` : ''}`);
    stats.innerHTML = html;
    let text = '';
    if (b && !a.repaid) text = `Without the extra ${money(st.extra, 2)}, ${money(base, 2)} a ${per} would never clear this loan.`;
    else if (b) text = `Adding ${money(st.extra, 2)} a ${per} cuts ${duration(a.days - b.days)} off the loan and saves ${money(a.totalInterest - b.totalInterest)} in interest.`;
    msg.textContent = [text, rdNote].filter(Boolean).join(' ');

    const series = [];
    if (b || c) series.push({ pts: a.points, color: '#c2410c', name: st.mode === 'own' ? (b ? 'Without extra' : 'Without redraw') : 'Minimum repayments' });
    if (b) series.push({ pts: b.points, color: '#1d5fc4', name: `With ${money(st.extra, 0)} extra`, dash: !!c });
    if (c) series.push({ pts: c.points, color: '#7c3aed', name: `${b ? 'Extra and' : 'With'} ${money(c.redrawn)} redraw` });
    if (!series.length) series.push({ pts: a.points, color: '#1d5fc4', name: 'Loan balance' });
    // fit the x-axis to the last payoff (rounded up to a whole year) so the lines end near the right edge
    chart.update(series, Math.max(1, Math.ceil(Math.max(...series.map(s => s.pts[s.pts.length - 1][0])) - 1e-6)));

    const rd = main.years.some(y => y.redrawn);
    $('#o-table').innerHTML = `<thead><tr><th scope="col">Year</th><th scope="col">Repaid</th>${rd ? '<th scope="col">Redrawn</th>' : ''}<th scope="col">Interest</th><th scope="col">Balance at end</th></tr></thead><tbody>` +
      main.years.map(y => `<tr><td>${y.year}</td><td>${money(y.paid)}</td>${rd ? `<td>${y.redrawn ? money(y.redrawn) : ''}</td>` : ''}<td>${money(y.interest)}</td><td>${money(y.balance)}</td></tr>`).join('') + '</tbody>';
  }
  read();
}

/* ---------- balance chart (inline SVG, no libraries) ---------- */
function makeChart(host) {
  const NS = 'http://www.w3.org/2000/svg', W = 640, H = 300, L = 62, R = 16, T = 14, B = 36;
  const el = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  host.innerHTML = '<div class="legend"></div><div class="plot"></div><div class="tip" hidden></div>';
  const legend = host.querySelector('.legend'), tip = host.querySelector('.tip');
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Loan balance over time' });
  host.querySelector('.plot').append(svg);
  const gGrid = el('g'), gLines = el('g'), gHover = el('g', { visibility: 'hidden' });
  svg.append(gGrid, gLines, gHover);
  const cross = el('line', { y1: T, y2: H - B, class: 'cross' }); gHover.append(cross);
  let series = [], xMax = 30, yMax = 1;
  const pw = W - L - R, ph = H - T - B;
  const xs = x => L + x / xMax * pw, ys = y => T + ph - y / yMax * ph;

  function update(list, years = 30) {
    series = list; xMax = Math.max(1, years);
    let hi = 0; for (const s of list) for (const [, v] of s.pts) if (v > hi) hi = v;
    yMax = nice(hi || 1);
    legend.innerHTML = list.length > 1 ? list.map(s => `<span><i style="background:${s.dash ? `repeating-linear-gradient(90deg,${s.color} 0 5px,transparent 5px 8px)` : s.color}"></i>${s.name}</span>`).join('') : '';
    gGrid.innerHTML = ''; gLines.innerHTML = '';
    for (let k = 0; k <= 4; k++) {
      const v = yMax * k / 4, y = ys(v);
      gGrid.append(el('line', { x1: L, x2: W - R, y1: y, y2: y, class: k ? 'grid' : 'axis' }));
      const t = el('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'tick' }); t.textContent = short(v); gGrid.append(t);
    }
    const step = xMax <= 6 ? 1 : xMax <= 12 ? 2 : xMax <= 45 ? 5 : 10;
    for (let x = 0; x <= xMax + 1e-9; x += step) {
      const t = el('text', { x: xs(x), y: H - B + 16, 'text-anchor': 'middle', class: 'tick' }); t.textContent = x; gGrid.append(t);
    }
    const xt = el('text', { x: L + pw / 2, y: H - 4, 'text-anchor': 'middle', class: 'tick' }); xt.textContent = 'Years'; gGrid.append(xt);
    gHover.querySelectorAll('circle').forEach(c => c.remove());
    for (const s of list) {
      const n = s.pts.length, every = Math.max(1, Math.floor(n / 500));
      let d = '';
      for (let i = 0; i < n; i += every) d += (d ? 'L' : 'M') + xs(s.pts[i][0]).toFixed(1) + ',' + ys(s.pts[i][1]).toFixed(1);
      const lastP = s.pts[n - 1]; if (lastP) d += 'L' + xs(lastP[0]).toFixed(1) + ',' + ys(lastP[1]).toFixed(1);
      gLines.append(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', ...(s.dash ? { 'stroke-dasharray': '7 5' } : {}) }));
      s.dot = el('circle', { r: 4.5, fill: s.color, stroke: '#fff', 'stroke-width': 2 }); gHover.append(s.dot);
    }
  }
  const at = (pts, x) => { // balance at time x (years): last point at or before x
    if (!pts.length || x > pts[pts.length - 1][0]) return pts.length ? 0 : null;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m][0] <= x) lo = m; else hi = m - 1; }
    return pts[lo][1];
  };
  svg.addEventListener('pointermove', e => {
    if (!series.length) return;
    const r = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(xMax, ((e.clientX - r.left) / r.width * W - L) / pw * xMax));
    const xr = Math.round(x * 12) / 12;
    gHover.setAttribute('visibility', 'visible');
    cross.setAttribute('x1', xs(xr)); cross.setAttribute('x2', xs(xr));
    const yrs = Math.floor(xr + 1e-9), mos = Math.round((xr - yrs) * 12);
    tip.hidden = false;
    tip.innerHTML = `<b>After ${yrs} yr${yrs === 1 ? '' : 's'}${mos ? ` ${mos} mo` : ''}</b>` + series.map(s => {
      const v = at(s.pts, xr); s.dot.setAttribute('cx', xs(xr)); s.dot.setAttribute('cy', v == null ? -99 : ys(v));
      return `<span><i style="background:${s.color}"></i>${s.name}: ${v == null ? '–' : money(v)}</span>`;
    }).join('');
    const left = xs(xr) / W * r.width;
    tip.style.left = (left > r.width / 2 ? left - tip.offsetWidth - 12 : left + 12) + 'px';
  });
  svg.addEventListener('pointerleave', () => { gHover.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  return { update };
}
function nice(v) { const mag = 10 ** Math.floor(Math.log10(v)); return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * mag).find(s => s >= v); }
function short(v) { return v >= 1e6 ? '$' + (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'm' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'k' : '$' + Math.round(v); }
