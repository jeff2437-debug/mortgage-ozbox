// Loan engine for mortgage.ozbox.org (no dependencies; used by the browser and the build).
//
// Model: interest accrues every day on the outstanding balance at rate / 365, and the
// accrued interest is added to the loan (charged) at the chosen interest frequency.
// Repayments come off the balance at the chosen repayment frequency. Events are placed on
// a 365-day year: a monthly event every 365/12 days, fortnightly every 14 days, and so on.
// When a charge and a repayment fall on the same day, interest is charged first.

export const PAY_FREQS = { weekly: 52, fortnightly: 26, monthly: 12 };
export const CHARGE_FREQS = { daily: 365, weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, yearly: 1 };
export const PAY_LABEL = { weekly: 'week', fortnightly: 'fortnight', monthly: 'month' };

const DAYS = 365;
const EPS = 1e-9;

/**
 * Simulate a loan.
 * @returns {{ repaid:boolean, days:number, periods:number, totalInterest:number, totalPaid:number,
 *            points:Array<[number, number]>, years:Array<{year:number, interest:number, paid:number, balance:number}> }}
 * points: [years, balance] after every repayment (starts at [0, principal]).
 */
export function simulate({ principal, rate, pay = 'monthly', charge = 'monthly', repayment, extra = 0, redrawAt = 0, redrawAmount = 0, maxYears = 60, record = true }) {
  const np = PAY_FREQS[pay], nc = CHARGE_FREQS[charge];
  const dp = DAYS / np, dc = DAYS / nc, di = rate / 100 / DAYS;
  const amount = repayment + extra;
  let bal = principal, accrued = 0, t = 0, kp = 1, kc = 1, totalInterest = 0, totalPaid = 0, periods = 0;
  const points = record ? [[0, principal]] : null;
  const years = [];
  let yr = { year: 1, interest: 0, paid: 0, balance: principal };
  const limit = maxYears * DAYS + EPS;
  const tr = redrawAt * DAYS;
  let redrawn = 0, rdPending = redrawAmount > 0 && redrawAt > 0;
  while (bal > EPS) {
    const tp = kp * dp, tc = kc * dc, next = Math.min(tp, tc, rdPending ? tr : Infinity);
    if (next > limit) return finish(false);
    accrued += bal * di * (next - t);
    t = next;
    // close off calendar years for the yearly table
    while (record && t > yr.year * DAYS + EPS) { yr.balance = bal; years.push(yr); yr = { year: yr.year + 1, interest: 0, paid: 0, balance: bal }; }
    if (rdPending && Math.abs(tr - next) < EPS) {
      // redraw: money taken back out of the loan, so the balance jumps up
      if (record) points.push([t / DAYS, bal]);
      bal += redrawAmount; redrawn = redrawAmount; yr.redrawn = (yr.redrawn || 0) + redrawAmount; rdPending = false;
      if (record) points.push([t / DAYS, bal]);
    }
    if (Math.abs(tc - next) < EPS) { bal += accrued; totalInterest += accrued; yr.interest += accrued; accrued = 0; kc++; }
    if (Math.abs(tp - next) < EPS) {
      kp++; periods++;
      if (amount >= bal + accrued - EPS) {
        // final repayment clears the balance and any interest accrued but not yet charged
        totalInterest += accrued; yr.interest += accrued;
        const last = bal + accrued;
        totalPaid += last; yr.paid += last; bal = 0; accrued = 0;
        if (record) points.push([t / DAYS, 0]);
        break;
      }
      bal -= amount; totalPaid += amount; yr.paid += amount;
      if (record) points.push([t / DAYS, bal]);
    }
  }
  return finish(true);

  function finish(repaid) {
    if (record) { yr.balance = bal; years.push(yr); }
    return { repaid, days: t, periods, totalInterest, totalPaid, points, years, repayment, extra, redrawn };
  }
}

/** Smallest regular repayment that clears the loan within `years` (bisection, to the cent). */
export function requiredRepayment({ principal, rate, pay = 'monthly', charge = 'monthly', years }) {
  if (principal <= 0) return 0;
  const np = PAY_FREQS[pay];
  if (rate <= 0) return Math.ceil(principal / (years * np) * 100) / 100;
  let lo = 0, hi = principal; // one payment per period of the whole principal always clears it
  for (let i = 0; i < 60 && hi - lo > 0.005; i++) {
    const mid = (lo + hi) / 2;
    const r = simulate({ principal, rate, pay, charge, repayment: mid, maxYears: years, record: false });
    if (r.repaid) hi = mid; else lo = mid;
  }
  return Math.ceil(hi * 100) / 100;
}

/** Interest charged in the first repayment period: a repayment at or below this never reduces the loan. */
export function firstPeriodInterest({ principal, rate, pay = 'monthly' }) {
  return principal * rate / 100 / PAY_FREQS[pay];
}

export const money = (v, dp = 0) => '$' + (Math.round(v * 10 ** dp) / 10 ** dp).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** "27 years 4 months" from a number of days on a 365-day year. */
export function duration(days) {
  const months = Math.round(days / (DAYS / 12));
  const y = Math.floor(months / 12), m = months % 12;
  const ys = y ? `${y} year${y === 1 ? '' : 's'}` : '', ms = m ? `${m} month${m === 1 ? '' : 's'}` : '';
  return [ys, ms].filter(Boolean).join(' ') || 'less than a month';
}

/** Balance at time x (years) from a points list: the last point at or before x (0 once repaid). */
export function balanceAt(points, x) {
  if (!points.length) return 0;
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
  let lo = 0, hi = points.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (points[m][0] <= x + 1e-9) lo = m; else hi = m - 1; }
  return points[lo][1];
}
