// Static site generator for mortgage.ozbox.org — `node build.mjs` writes ./site
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { simulate, requiredRepayment, money, duration } from './src/loan.js';
import { titleCaseSite } from './titlecase.mjs';

const SITE_URL = 'https://mortgage.ozbox.org';
const SITE_NAME = 'Mortgage Maths';
const CONTACT_EMAIL = 'contact@ozbox.org';
const ADSENSE_CLIENT = 'ca-pub-3136341800882537';
const CF_BEACON = 'aee6d3fcc638488697a52d626443492d';
const REVIEWED = 'November 2026';
const OUT = 'site';

const ASSET_V = createHash('md5').update(['src/app.js', 'src/loan.js', 'src/style.css'].map(f => readFileSync(f)).join('')).digest('hex').slice(0, 8);
const INLINE_CSS = readFileSync('src/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });
const pages = [];
const write = (p, body) => { const f = join(OUT, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, body); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => s.replace(/<[^>]+>/g, '');
const jsonLd = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

const GUIDES = [
  ['/extra-repayments/', 'How much do extra repayments save?', 'What an extra $100, $250 or $500 a month does to a home loan.'],
  ['/fortnightly-vs-monthly-repayments/', 'Fortnightly vs monthly repayments', 'Why "half the monthly repayment every fortnight" takes years off a loan.'],
  ['/how-home-loan-interest-is-calculated/', 'How home loan interest is calculated', 'Daily interest, monthly charging, and why the frequency matters a little.'],
  ['/interest-rate-changes/', 'What a rate rise or cut does', 'Repayments at every rate from 4.5% to 8%, and the trick to use after a cut.'],
  ['/offset-vs-redraw/', 'Offset vs redraw', 'Which saves more, the real differences, and when an offset account is worth its fee.'],
];
const NAV = [['/', 'Calculator'], ['/guides/', 'Guides'], ['/about/', 'About']];

function page({ path, title, description, h1, crumbs = [], body, faq = [], app = false, noindex = false }) {
  const url = SITE_URL + path;
  const lds = [];
  if (path === '/') lds.push({ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Mortgage payoff calculator', url: SITE_URL + '/', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' } });
  else lds.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement:
    [['/', 'Home'], ...crumbs, [path, strip(h1)]].map(([p, n], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE_URL + p })) });
  if (faq.length) lds.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) =>
    ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) });
  const faqHtml = faq.length ? `<h2>Questions</h2>${faq.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}` : '';
  const crumbHtml = path === '/' ? '' : `<p class="crumbs"><a href="/">Home</a>${crumbs.map(([p, n]) => ` › <a href="${p}">${n}</a>`).join('')} › ${esc(strip(h1))}</p>`;
  const html = `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#005550">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${INLINE_CSS}</style>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>
${lds.map(jsonLd).join('\n')}
</head>
<body>
<header class="top"><div class="wrap">
<a class="brand" href="/">Mortgage<span> Maths</span></a>
<nav class="main">${NAV.map(([p, n]) => `<a href="${p}"${p === path ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
</div></header>
<main class="wrap">
${crumbHtml}
<h1>${h1}</h1>
${body}
${faqHtml}
</main>
<footer class="foot"><div class="wrap">
<p>General information only, not financial advice. Calculations are estimates; your lender's figures will differ a little because of fees, rounding and rate changes. Last reviewed ${REVIEWED}.</p>
<p><a href="/about/">About</a> · <a href="/privacy/">Privacy</a> · <a href="/contact/">Contact</a> · Sister sites: <a href="https://lotto.ozbox.org/">lotto.ozbox.org</a> · <a href="https://ev.ozbox.org/">ev.ozbox.org</a> · <a href="https://paradox.ozbox.org/">paradox.ozbox.org</a> · <a href="https://fakeaway.ozbox.org/">fakeaway.ozbox.org</a></p>
</div></footer>
${app ? `<script type="module" src="/assets/app.js?v=${ASSET_V}"></script>` : ''}
${CF_BEACON ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CF_BEACON}"}'></script>` : ''}
</body>
</html>`;
  write(path === '/' ? 'index.html' : path.replace(/^\//, '') + (path.endsWith('.html') ? '' : 'index.html'), html);
  if (!noindex) pages.push(path);
}

/* ---------- worked examples (computed at build time with the same engine as the calculator) ---------- */
const base = { principal: 600000, rate: 6, years: 30, pay: 'monthly', charge: 'monthly' };
const minOf = o => requiredRepayment({ ...base, ...o });
const sim = (o, repayment, extra = 0) => simulate({ ...base, ...o, repayment, extra, record: false });
const table = (head, rows, label) => `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(label)}"><table><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const calcLink = (params, text) => `<a href="/?${new URLSearchParams(params)}">${text}</a>`;

const M0 = minOf({}), S0 = sim({}, M0);
function extraRows(principal, extras = [0, 100, 250, 500, 1000]) {
  const m = minOf({ principal }), a = sim({ principal }, m);
  return extras.map(x => {
    const b = sim({ principal }, m, x);
    return [x ? `+${money(x)}` : 'None', money(m + x, 0), duration(b.days), money(b.totalInterest), x ? `${duration(a.days - b.days)} · ${money(a.totalInterest - b.totalInterest)}` : '–'];
  });
}
const EXTRA_HEAD = ['Extra a month', 'Monthly repayment', 'Paid off in', 'Total interest', 'Time and interest saved'];

const calcCard = (attrs = '') => `<section class="card" aria-label="Mortgage payoff calculator"><div id="calc"${attrs}><noscript><p>The calculator needs JavaScript. The worked examples below don't.</p></noscript></div></section>`;
const tiles = (skip = '') => `<div class="tiles">${GUIDES.filter(g => g[0] !== skip).map(([p, t, d]) => `<a class="tile" href="${p}"><h3>${t}</h3><p>${d}</p></a>`).join('')}</div>`;

/* ---------- home: the calculator ---------- */
const e250 = sim({}, M0, 250);
page({
  path: '/', h1: 'Mortgage payoff calculator', app: true,
  title: `Mortgage Payoff Calculator Australia: Extra Repayments & Balance Graph | ${SITE_NAME}`,
  description: 'See how long your home loan takes to repay, how much interest you\'ll pay, and how much extra repayments save. Weekly, fortnightly or monthly, with a balance graph.',
  body: `<p class="lede">Find out how long your home loan will take to pay off, what it costs in interest, and how much sooner you'd be free if you paid a little extra each week, fortnight or month.</p>
${calcCard()}
<h2>What the calculator shows</h2>
<p>Enter your loan amount, interest rate and term. The calculator works out the <strong>minimum repayment</strong> that clears the loan in that time,
  or you can enter the amount you actually pay. Add an <strong>extra repayment</strong> and the graph shows both balances side by side: the orange line
  is the loan on minimum repayments, the blue line is the loan with your extra payments. The gap between where the two lines hit zero is the time you save.
  Enter an <strong>offset</strong> balance to see how much your savings cut the loan. Add a <strong>redraw</strong> and a purple line shows the loan jumping back up when you take the money out, and how much later it then finishes.</p>
<p>For example, on a ${money(600000)} loan at 6% over 30 years, the minimum monthly repayment is about ${money(M0, 0)}. Paying an extra ${money(250)}
  a month clears it in ${duration(e250.days)} instead of 30 years and saves about <strong>${money(S0.totalInterest - e250.totalInterest)}</strong> in interest.</p>
<h2>Why small extra repayments make such a difference</h2>
<p>In the early years most of each repayment is interest. On that ${money(600000)} loan, roughly ${money(600000 * 0.06 / 12, 0)} of the first ${money(M0, 0)} repayment
  is interest and only about ${money(M0 - 600000 * 0.06 / 12, 0)} reduces the debt. Every extra dollar goes straight onto the balance, so it stops
  interest being charged on that dollar for the rest of the loan. That's why the interest saved ends up larger than the extra you pay in.</p>
${table(EXTRA_HEAD, extraRows(600000), 'Extra repayments on a $600,000 loan at 6%')}
<p class="hint">${money(600000)} loan, 6% p.a., 30-year term, monthly repayments, interest charged monthly.</p>
<h2>Repayment and interest frequency</h2>
<p><strong>Repayment frequency</strong> on its own makes little difference if each repayment is worked out for the same term. The big saving comes from
  paying <em>half</em> your monthly repayment every fortnight, because a year has 26 fortnights: that's 13 months' worth of repayments a year.
  See <a href="/fortnightly-vs-monthly-repayments/">fortnightly vs monthly repayments</a>.</p>
<p><strong>Interest frequency</strong> is how often the interest that builds up each day is added to your loan. Most Australian lenders calculate
  interest daily and charge it monthly, so "Monthly" is the default. See <a href="/how-home-loan-interest-is-calculated/">how home loan interest is calculated</a>.</p>
<h2>Guides</h2>
${tiles()}`,
  faq: [
    ['How long will it take to pay off my mortgage?', 'If you pay exactly the minimum repayment, the loan ends at the end of its term, usually 25 or 30 years. Paying more than the minimum shortens it. Enter your loan in the calculator above to see the exact time for your repayments.'],
    ['How often should I schedule my repayments?', 'Match them to your pay cycle: weekly if you\'re paid weekly, fortnightly if you\'re paid fortnightly, and so on. Because interest is worked out on your balance every day, money paid onto the loan the day your pay arrives starts saving interest straight away, instead of sitting in your everyday account until a later due date. Lining the two up also makes budgeting simpler, since each repayment comes out of the pay it belongs to. If your loan has an offset account, keeping your pay there until the repayment goes out has a similar effect.'],
    ['Are extra repayments better than putting money in savings?', `Every extra dollar on a home loan "earns" your loan's interest rate, tax-free, because it stops that interest being charged. That usually beats a savings account. The trade-off is access: check whether your loan has redraw or an offset account so you can get the money back if you need it.`],
    ['What happens to my loan if I use redraw?', 'Redraw lets you take back money you\'ve paid ahead of the minimum repayments. The amount you take out goes back onto the loan balance, and because most lenders keep your repayment the same, the loan takes longer to pay off and costs more interest. Use the redraw option in the calculator to see by how much. You can only redraw what you\'re ahead by, and some lenders charge a fee or set a minimum amount.'],
    ['Can I use the calculator for a loan I already have?', 'Yes. Enter what you owe now as the loan amount and the years left on the loan as the term. If you\'ve paid ahead of your repayments, enter that amount in "Already ahead" under Redraw: your minimum repayment is still set on the balance you were scheduled to owe, so being ahead means the loan finishes early, and the calculator shows by how much. You\'ll find the balance and available redraw in your banking app or loan statement.'],
    ['Can I make extra repayments on a fixed-rate loan?', 'Usually only a limited amount. Many fixed-rate loans cap extra repayments at a set amount per year and may charge break costs above it. Variable-rate loans generally allow unlimited extra repayments. Check your loan contract.'],
    ['Why is my lender\'s figure slightly different?', 'Lenders differ in how they round repayments, which day of the month interest is charged, and whether they count 365 days or the actual days in each month. Fees and rate changes also matter. Expect small differences, not big ones.'],
  ],
});

/* ---------- guides ---------- */
page({ path: '/guides/', h1: 'Home loan guides', title: `Home Loan Guides | ${SITE_NAME}`, description: 'Plain-English guides to extra repayments, repayment frequency, how interest is calculated and what rate changes do, with worked Australian examples.',
  body: `<p class="lede">Worked examples for the questions people ask most about paying off a home loan. Every figure is calculated with the same engine as the <a href="/">calculator</a>.</p>${tiles()}` });

// Extra repayments
{
  const rows400 = extraRows(400000, [0, 100, 250, 500]), rows800 = extraRows(800000, [0, 100, 250, 500]);
  const lump = (() => { const b = simulate({ ...base, repayment: M0, extra: 0, record: false }); return b; })();
  // a one-off $10,000 at the start is the same as borrowing $10,000 less with the same repayment
  const l10 = sim({ principal: 590000 }, M0);
  page({
    path: '/extra-repayments/', h1: 'How much do extra repayments save?', crumbs: [['/guides/', 'Guides']],
    title: `Extra Mortgage Repayments: How Much Time and Interest Do They Save? | ${SITE_NAME}`,
    description: 'Worked examples of extra home loan repayments in Australia: what $100, $250, $500 or $1,000 a month saves on $400k, $600k and $800k loans.',
    body: `<p class="lede">Extra repayments are the simplest way to pay off a home loan faster. Here's what different amounts do, worked out to the month.</p>
<h2>On a ${money(600000)} loan</h2>
${table(EXTRA_HEAD, extraRows(600000), 'Extra repayments on a $600,000 loan')}
<h2>On a ${money(400000)} loan</h2>
${table(EXTRA_HEAD, rows400, 'Extra repayments on a $400,000 loan')}
<h2>On an ${money(800000)} loan</h2>
${table(EXTRA_HEAD, rows800, 'Extra repayments on an $800,000 loan')}
<p class="hint">All examples: 6% p.a., 30-year term, monthly repayments, interest charged monthly. ${calcLink({ loan: 600000, rate: 6, extra: 250 }, 'Try your own numbers')}.</p>
<h2>Why it works</h2>
<p>Interest is charged on whatever you still owe. An extra repayment lowers the balance immediately, so every later interest charge is a little
  smaller, and because your regular repayment stays the same, more of each one goes to the debt. The effect snowballs: in every example above, the interest
  saved is more than the total extra you pay in.</p>
<h2>Early dollars are worth the most</h2>
<p>A one-off ${money(10000)} paid in the first month, with no other change, finishes the ${money(600000)} loan in ${duration(l10.days)} instead of 30 years and saves
  about ${money(lump.totalInterest - l10.totalInterest)} in interest. The same ${money(10000)} paid in the last few years saves very little, because there's
  little time left for interest to build up on it.</p>
<h2>Things to check first</h2>
<ul>
<li><strong>Fixed-rate limits.</strong> Many fixed loans cap extra repayments each year and charge break costs above the cap.</li>
<li><strong>Redraw or offset.</strong> Money in an offset account reduces the interest just like an extra repayment, but stays yours to spend. Redraw lets you take extra repayments back out, sometimes with a fee.</li>
<li><strong>Higher-interest debts first.</strong> Credit cards and personal loans usually cost far more than a home loan, so clearing them first saves more.</li>
</ul>
<h2>More guides</h2>${tiles('/extra-repayments/')}`,
    faq: [
      ['Is it better to make one big extra repayment or regular small ones?', 'Money paid earlier saves more, so a lump sum now beats the same total spread over later years. But regular extra repayments are easier to keep up, and they add up to more over time. Many people do both: a regular extra amount plus tax refunds or bonuses as lump sums.'],
      ['Do extra repayments reduce my required repayment?', 'Usually not. Most lenders keep your required repayment the same and let the loan finish earlier, which is what saves the most interest. Some will recalculate a lower repayment if you ask.'],
    ],
  });
}

// Fortnightly vs monthly
{
  const fMin = minOf({ pay: 'fortnightly' }), wMin = minOf({ pay: 'weekly' });
  const a = sim({}, M0), f = sim({ pay: 'fortnightly' }, fMin), half = sim({ pay: 'fortnightly' }, M0 / 2);
  const w = sim({ pay: 'weekly' }, wMin), quarter = sim({ pay: 'weekly' }, M0 / 4);
  const row = (label, amount, per, r) => [label, `${money(amount, 2)} a ${per}`, money(amount * { month: 12, fortnight: 26, week: 52 }[per], 0), duration(r.days), money(r.totalInterest)];
  page({
    path: '/fortnightly-vs-monthly-repayments/', h1: 'Fortnightly vs monthly mortgage repayments', crumbs: [['/guides/', 'Guides']],
    title: `Fortnightly vs Monthly Mortgage Repayments: Which Saves More? | ${SITE_NAME}`,
    description: 'Do fortnightly repayments really pay off a home loan faster? Worked Australian example comparing monthly, fortnightly and weekly repayments.',
    body: `<p class="lede">Switching to fortnightly repayments is one of the most repeated home loan tips. It works, but only if you do it the right way.</p>
${table(['Repayment', 'Amount', 'Paid a year', 'Paid off in', 'Total interest'], [
  row('Monthly (minimum)', M0, 'month', a),
  row('Fortnightly (minimum for 30 years)', fMin, 'fortnight', f),
  row('Fortnightly: half the monthly', M0 / 2, 'fortnight', half),
  row('Weekly (minimum for 30 years)', wMin, 'week', w),
  row('Weekly: a quarter of the monthly', M0 / 4, 'week', quarter),
], 'Repayment frequency comparison')}
<p class="hint">${money(600000)} loan, 6% p.a., 30-year term, interest charged monthly.</p>
<h2>The trick is in the maths of the calendar</h2>
<p>A year has 12 months but 26 fortnights. If you pay <strong>half your monthly repayment every fortnight</strong>, you make 26 half-payments a year:
  the same as <strong>13 monthly repayments</strong> instead of 12. That extra month's worth each year, about ${money(M0, 0)} here, goes straight
  onto the loan, and on this example it cuts the loan to ${duration(half.days)} and saves ${money(a.totalInterest - half.totalInterest)}.</p>
<p>If your lender instead sets the fortnightly repayment as the minimum needed to repay over the same 30 years (${money(fMin, 2)} here), you pay
  almost exactly the same amount per year as monthly, and the loan still takes about 30 years. The small saving comes only from paying a little earlier each month.</p>
<h2>How to do it</h2>
<p>Ask your lender to set your repayment to <em>half of your current monthly repayment, paid fortnightly</em>, or simply keep the fortnightly
  amount and add the difference as an extra repayment. Lining repayments up with a fortnightly pay cycle also makes budgeting easier.
  ${calcLink({ loan: 600000, rate: 6, pay: 'fortnightly', repay: (M0 / 2).toFixed(2), extra: 0 }, 'See this example in the calculator')}.</p>
<h2>More guides</h2>${tiles('/fortnightly-vs-monthly-repayments/')}`,
    faq: [
      ['Do fortnightly repayments save money?', `Only if you pay more over the year. Paying half the monthly repayment every fortnight adds the equivalent of one extra monthly repayment a year, which on a ${money(600000)}, 6% loan saves about ${money(a.totalInterest - half.totalInterest)}. A fortnightly repayment worked out for the same term saves very little.`],
      ['Is weekly better than fortnightly?', 'Paying a quarter of the monthly repayment every week works the same way as half-monthly fortnightly: 52 quarter-payments equal 13 monthly repayments. It saves slightly more because money comes off the loan a little sooner.'],
    ],
  });
}

// How interest is calculated
{
  const charges = [['daily', 'Daily'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']];
  const rows = charges.map(([c, n]) => { const m = minOf({ charge: c }); const r = sim({ charge: c }, m); return [n, money(m, 2), money(r.totalInterest)]; });
  const day = 600000 * 0.06 / 365;
  page({
    path: '/how-home-loan-interest-is-calculated/', h1: 'How home loan interest is calculated', crumbs: [['/guides/', 'Guides']],
    title: `How Is Home Loan Interest Calculated in Australia? Daily vs Monthly | ${SITE_NAME}`,
    description: 'How Australian lenders calculate mortgage interest daily and charge it monthly, with a worked example and the effect of charging frequency on repayments.',
    body: `<p class="lede">Your interest rate is quoted per year, but interest isn't charged once a year. Here's what actually happens to your loan each day.</p>
<h2>Calculated daily, charged monthly</h2>
<p>Most Australian lenders work out interest <strong>every day</strong> on that day's closing balance, using the annual rate divided by 365.
  The daily amounts build up and are <strong>charged</strong> (added to the loan) once a month. On a ${money(600000)} balance at 6%:</p>
<p class="note">${money(600000)} × 6% ÷ 365 = <strong>${money(day, 2)} a day</strong>, or about ${money(day * 365 / 12, 0)} for an average month.</p>
<p>Because interest follows the daily balance, any extra repayment or money in an offset account starts saving interest from the day it lands, not the next month.</p>
<h2>Does the charging frequency matter?</h2>
<p>A little. Once interest is charged it becomes part of the balance, and interest is then charged on it too. The more often that happens, the slightly
  higher the cost. Here's the same loan with interest charged at different frequencies:</p>
${table(['Interest charged', 'Minimum monthly repayment', 'Total interest over 30 years'], rows, 'Effect of interest charging frequency')}
<p class="hint">${money(600000)} loan, 6% p.a., 30 years, monthly repayments. Interest accrues daily in every case.</p>
<p>The difference between daily and monthly charging is only a few dollars a month. The rate itself matters far more: see
  <a href="/interest-rate-changes/">what a rate rise or cut does</a>.</p>
<h2>Comparison rates</h2>
<p>Australian lenders must also quote a <strong>comparison rate</strong>, which rolls most fees into a single percentage based on a standard example loan.
  Use it to compare loans; use the actual interest rate in the calculator to estimate repayments.</p>
<h2>More guides</h2>${tiles('/how-home-loan-interest-is-calculated/')}`,
    faq: [
      ['Is home loan interest compounded daily?', 'Usually it\'s calculated daily but compounded monthly: daily amounts are added up and charged to the loan once a month, and only then does interest start being charged on them.'],
      ['Why does my interest charge change from month to month?', 'Because months have different numbers of days. A 31-day month has more daily interest than a 28-day February, even if your balance and rate stay the same.'],
    ],
  });
}

// Rate changes
{
  const rates = [4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
  const rows = rates.map(r => { const m = minOf({ rate: r }); const s = sim({ rate: r }, m); return [`${r.toFixed(2)}%`, money(m, 0), r === 6 ? '–' : `${m >= M0 ? '+' : '−'}${money(Math.abs(m - M0), 0)}`, money(s.totalInterest)]; });
  const keep = sim({ rate: 5.5 }, M0), at55 = sim({ rate: 5.5 }, minOf({ rate: 5.5 }));
  page({
    path: '/interest-rate-changes/', h1: 'What a rate rise or cut does to your mortgage', crumbs: [['/guides/', 'Guides']],
    title: `Interest Rate Rise Calculator: Mortgage Repayments at 4.5% to 8% | ${SITE_NAME}`,
    description: 'Monthly repayments on a $600,000 home loan at every rate from 4.5% to 8%, and how keeping your repayments the same after a rate cut pays the loan off years sooner.',
    body: `<p class="lede">A rate change of a quarter of a percent sounds small. On a large loan over decades it isn't.</p>
${table(['Interest rate', 'Monthly repayment', 'Compared with 6%', 'Total interest over 30 years'], rows, 'Repayments at different interest rates')}
<p class="hint">${money(600000)} loan, 30 years, monthly repayments, interest charged monthly.</p>
<p>As a rule of thumb, each 0.25% change moves the repayment on this loan by roughly ${money((minOf({ rate: 6.25 }) - M0), 0)} a month, or about
  ${money((minOf({ rate: 6.25 }) - M0) / 6, 0)} a month for every ${money(100000)} borrowed.</p>
<h2>After a rate cut: keep paying the same</h2>
<p>When rates fall, lenders usually lower your required repayment. If you can afford to keep paying what you paid before, the difference becomes an
  automatic extra repayment. If the rate on this loan dropped from 6% to 5.5% and you kept paying ${money(M0, 0)} a month, the loan would finish in
  <strong>${duration(keep.days)}</strong> instead of 30 years, saving about ${money(at55.totalInterest - keep.totalInterest)} compared with dropping to the new minimum.</p>
<h2>Preparing for a rise</h2>
<p>Lenders test whether you could still afford repayments a few percentage points above your actual rate before they approve a loan. You can do the
  same: put a higher rate into the ${calcLink({ loan: 600000, rate: 7, extra: 0 }, 'calculator')} and see whether the repayment would still fit your budget.
  Extra repayments made now also build a buffer you can draw on through redraw or offset if rates rise.</p>
<h2>More guides</h2>${tiles('/interest-rate-changes/')}`,
    faq: [
      ['How much does a 0.25% rate rise add to repayments?', `On a ${money(600000)}, 30-year loan at around 6%, about ${money(minOf({ rate: 6.25 }) - M0, 0)} a month. Scale it by your loan size: roughly ${money((minOf({ rate: 6.25 }) - M0) / 6, 0)} a month per ${money(100000)} borrowed.`],
      ['Should I keep my repayments the same when rates fall?', 'If your budget allows, it\'s one of the easiest ways to pay a loan off faster: the difference goes straight to the balance. If you have more expensive debts, paying those off first usually saves more.'],
    ],
  });
}

// Offset vs redraw
{
  // An offset loan is "done" once the offset balance could clear what's owed.
  const offsetDone = (amt) => { const r = simulate({ ...base, repayment: M0, offset: amt }); const p = r.points.find(([, b]) => b <= amt) || r.points[r.points.length - 1];
    // interest up to that point
    const r2 = simulate({ ...base, repayment: M0, offset: amt, maxYears: p[0] + 1e-6 });
    return { days: p[0] * 365, interest: r2.totalInterest }; };
  const none = S0;
  const rows = [10000, 20000, 50000].flatMap(amt => {
    const o = offsetDone(amt), d = sim({ principal: 600000 - amt }, M0);
    return [
      [`${money(amt)} in offset`, duration(o.days), money(o.interest), `${duration(none.days - o.days)} · ${money(none.totalInterest - o.interest)}`],
      [`${money(amt)} paid in (redraw)`, duration(d.days), money(d.totalInterest), `${duration(none.days - d.days)} · ${money(none.totalInterest - d.totalInterest)}`],
    ];
  });
  const yearSave = [5000, 10000, 20000, 50000].map(a => [money(a), money(a * 0.06, 0), money(a * 0.06 / 12, 0)]);
  page({
    path: '/offset-vs-redraw/', h1: 'Offset vs redraw: which is better?', crumbs: [['/guides/', 'Guides']],
    title: `Offset Account vs Redraw: Which Saves More on Your Home Loan? | ${SITE_NAME}`,
    description: 'Offset account or redraw? Worked Australian examples showing the interest each saves, the real differences in access, fees and tax, and when an offset is worth paying for.',
    body: `<p class="lede">Both let your savings cut the interest on your home loan. They save the same amount of interest; where they differ is how easily you can get your money back, and what you pay for the privilege.</p>
<h2>How each one works</h2>
<p><strong>Redraw:</strong> you pay extra money into the loan itself. The balance drops, so less interest is charged, and you can take ("redraw") the extra back out later.
  <strong>Offset:</strong> your money sits in a transaction account linked to the loan. It stays a separate balance, but the lender charges interest only on the loan
  balance <em>minus</em> what's in the offset. ${money(20000)} in offset against a ${money(600000)} loan means interest on ${money(580000)}.</p>
<h2>Which saves more interest?</h2>
<p>Neither: the same amount saves the same interest. Here's ${money(10000)}, ${money(20000)} and ${money(50000)} kept in offset for the life of the loan, compared with paying it in as an extra repayment and leaving it there:</p>
${table(['Savings', 'Loan finished in', 'Total interest', 'Time and interest saved'], rows, 'Offset compared with redraw')}
<p class="hint">${money(600000)} loan, 6% p.a., 30 years, minimum monthly repayments of ${money(M0, 0)} unchanged. The offset loan counts as finished once the offset balance could pay out what's left.</p>
<p>The figures match because in both cases the same amount of money stops being charged interest. So the decision comes down to the differences below.</p>
<h2>The differences that matter</h2>
<ul>
<li><strong>Getting your money back.</strong> Offset money is in an everyday account: card, transfers, salary paid in. Redraw usually means a request through online banking, and some lenders set minimum amounts, charge fees, or can limit redraw in some circumstances.</li>
<li><strong>Fees.</strong> Offset accounts often come with "package" loans that charge an annual fee, or with a slightly higher rate. Redraw is usually free on basic variable loans.</li>
<li><strong>Fixed rates.</strong> Many fixed-rate loans don't offer a full offset and cap extra repayments, so neither works as well while the rate is fixed.</li>
<li><strong>If you might rent the home out later.</strong> Money in offset stays your savings. Money redrawn from a loan is new borrowing, and what it's used for can affect what interest is tax-deductible. If you might turn the home into an investment property, ask an accountant before choosing redraw.</li>
<li><strong>Habits.</strong> Money in an offset is easy to spend. Some people find that money tucked into the loan, slightly harder to get at, is more likely to stay there.</li>
</ul>
<h2>Is an offset account worth its fee?</h2>
<p>The interest an offset saves in a year is roughly the balance you keep in it times your rate. At 6%:</p>
${table(['Average offset balance', 'Interest saved a year', 'A month'], yearSave, 'Interest saved by an offset balance')}
<p>Compare that with the extra cost of the loan that has the offset: its annual fee, plus any difference in rate. If you'd only keep a few thousand dollars there, redraw on a cheaper loan can come out ahead. If your pay goes into the offset and you hold a healthy buffer, the offset usually wins on convenience as well.</p>
<p>Try it with your own loan: the ${calcLink({ loan: 600000, rate: 6, extra: 0, offset: 20000 }, 'calculator')} has an offset field, and a redraw option that shows what taking money back out does to your loan.</p>
<h2>More guides</h2>${tiles('/offset-vs-redraw/')}`,
    faq: [
      ['Is an offset account better than redraw?', 'They save exactly the same interest for the same amount of money. An offset is easier to use day to day and keeps savings separate, which can matter for tax if the home later becomes an investment. Redraw is often available on cheaper loans with no package fee. The better choice depends on how much you\'d keep in it and what the offset costs.'],
      ['Does money in an offset reduce my repayments?', 'Usually not. Most lenders keep the repayment the same, so less of each repayment goes to interest and more goes off the balance, and the loan finishes earlier.'],
      ['Can I have more than one offset account?', 'Some lenders allow several offset accounts against one loan, for example separate accounts for bills and savings. All their balances count towards reducing the interest.'],
    ],
  });
}

/* ---------- about / privacy / contact / 404 ---------- */
page({ path: '/about/', h1: `About ${SITE_NAME}`, title: `About | ${SITE_NAME}`, description: `About ${SITE_NAME}: a free Australian mortgage payoff calculator with worked examples.`,
  body: `<p>${SITE_NAME} is a free calculator and set of guides for Australians paying off a home loan. It answers one question well: how long will this loan take, and what changes that?</p>
<h2>How the calculations work</h2>
<p>Interest accrues every day on the outstanding balance at the annual rate divided by 365, and is added to the loan at the frequency you choose
  (monthly for most Australian loans). Repayments come off the balance weekly (every 7 days), fortnightly (every 14 days) or monthly (every 365/12 days).
  When interest and a repayment fall on the same day, interest is charged first. The minimum repayment is the smallest amount, to the cent, that clears the loan within the term.</p>
<p>Everything runs in your browser; nothing you enter is sent anywhere. The figures are estimates for planning, not an offer or financial advice.
  Real loans include fees, rate changes and lender-specific rounding.</p>
<h2>Corrections</h2>
<p>If you spot something wrong, please <a href="/contact/">let us know</a>.</p>` });
page({ path: '/privacy/', h1: 'Privacy', title: `Privacy policy | ${SITE_NAME}`, description: `Privacy policy for ${SITE_NAME}.`,
  body: `<p>We don't ask for your personal information. The calculator runs in your browser and doesn't send the numbers you enter to us.</p>
<h2>Advertising</h2>
<p>This site uses Google AdSense to show ads. Google and its partners may use cookies to show ads based on your visits to this and other websites. You can turn off personalised ads at <a href="https://adssettings.google.com/">Google Ad Settings</a>, and learn more at <a href="https://policies.google.com/technologies/partner-sites">how Google uses information from sites that use its services</a>.</p>
<h2>Visitor statistics</h2>
<p>We use Cloudflare Web Analytics to count page views. It doesn't use cookies and doesn't track you across sites.</p>
<h2>Contact</h2>
<p>Questions: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>` });
page({ path: '/contact/', h1: 'Contact', title: `Contact | ${SITE_NAME}`, description: `Contact ${SITE_NAME}.`,
  body: `<p>Questions, corrections and suggestions are welcome: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. We can't give personal financial advice.</p>` });
page({ path: '/404.html', h1: 'Page not found', title: `Page not found | ${SITE_NAME}`, description: 'Page not found.', noindex: true,
  body: `<p>That page doesn't exist. Try the <a href="/">mortgage payoff calculator</a> or the <a href="/guides/">guides</a>.</p>` });

/* ---------- assets ---------- */
writeFileSync(join(OUT, 'assets/loan.js'), readFileSync('src/loan.js'));
writeFileSync(join(OUT, 'assets/app.js'), readFileSync('src/app.js', 'utf8').replace(`from './loan.js'`, `from './loan.js?v=${ASSET_V}'`));
for (const f of ['og.png', 'favicon.ico', 'apple-touch-icon.png', 'favicon.svg']) if (existsSync('src/' + f)) copyFileSync('src/' + f, join(OUT, f));
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
write('ads.txt', `google.com, ${ADSENSE_CLIENT.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);
write('_headers', `/assets/*\n  Cache-Control: public, max-age=3600\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `<url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
titleCaseSite(OUT);
console.log(`Built ${pages.length} pages into ${OUT}/`);
