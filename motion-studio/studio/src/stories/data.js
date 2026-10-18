// Data stories: market updates and dashboard recaps. Built to run 30-45 seconds so numbers
// build anticipation and land one at a time. Every chart carries a source / as-of line.
import { CONTACT_FIELDS, filled, endScene, introScene } from './shared.js';

export const marketUpdate = {
  id: 'market-update',
  name: 'Market Update',
  category: 'Market & data',
  icon: 'chart',
  blurb: 'Turn a market report into a 30-45 second update: the headline stat, the trend, what it means for buyers and sellers.',
  bestFor: 'Monthly market reports, sold reports, client newsletters, team meetings',
  defaultLook: 'newsroom',
  defaultFormat: '16x9',
  durations: { min: 30, default: 38, max: 60 },
  minPhotos: 0,
  fields: [
    { key: 'area', label: 'Market', type: 'text', required: true, placeholder: 'Los Angeles County' },
    { key: 'period', label: 'Period', type: 'text', required: true, placeholder: 'September 2026' },
    { key: 'headlineStat', label: 'Headline number', type: 'text', placeholder: '$1.05M', help: 'The one number people should remember. Built in 3D.' },
    { key: 'headlineStatLabel', label: 'What it is', type: 'text', placeholder: 'Median sold price' },
    { key: 'takeaway', label: 'The takeaway in one sentence', type: 'text', placeholder: 'Prices held steady while inventory grew.' },
    { key: 'stats', label: 'Key numbers', type: 'stats', max: 4, help: 'From the report, exactly as published.' },
    { key: 'series', label: 'Trend (label and value)', type: 'series', max: 8, help: 'e.g. months and median price, or cities and % sold above asking.', placeholder: [{ label: 'Jun', value: '' }, { label: 'Jul', value: '' }, { label: 'Aug', value: '' }, { label: 'Sep', value: '' }] },
    { key: 'seriesTitle', label: 'Trend title', type: 'text', placeholder: 'Median price, last 4 months' },
    { key: 'source', label: 'Source and as-of date', type: 'text', required: true, placeholder: 'Source: [report name], data as of Sep 30, 2026', help: 'Required so every number is accountable.' },
    { key: 'screenshot', label: 'Report screenshot (optional)', type: 'image', help: 'Shown with callouts so viewers see where the numbers come from.' },
    { key: 'callouts', label: 'Callouts on the screenshot', type: 'callouts', max: 4, showIf: f => !!f.screenshot },
    { key: 'buyers', label: 'What it means for buyers', type: 'list', max: 4 },
    { key: 'sellers', label: 'What it means for sellers', type: 'list', max: 4 },
    { key: 'message', label: 'Closing line', type: 'text', default: 'Questions about your home or your search? Let’s talk.' },
    ...CONTACT_FIELDS,
  ],
  plan(f) {
    const stats = filled(f.stats);
    const series = filled(f.series).filter(r => String(r.value ?? '').trim());
    const buyers = filled(f.buyers), sellers = filled(f.sellers);
    const src = f.source || '';
    return [
      introScene(`${f.area || 'Market'} update`, f.period || '', 3.4),
      { id: 'headline', type: 'hero', dur: 4.5, step: 'Headline', text: { eyebrow: f.period || 'This month', headline: f.headlineStatLabel || 'The headline number', sub: f.takeaway || '' }, data: { glyph: (f.headlineStat || '').slice(0, 8) || '★', glyphLabel: f.area || '' } },
      f.screenshot ? { id: 'report', type: 'screenshot', dur: 6, step: 'Report', text: { eyebrow: 'From the report', headline: f.takeaway || 'Where the numbers come from', sub: src }, data: { callouts: filled(f.callouts) } } : null,
      stats.length ? { id: 'numbers', type: 'stats', dur: 5.5, step: 'Numbers', text: { eyebrow: f.period || 'By the numbers', headline: 'The key numbers', sub: src }, data: { stats } } : null,
      series.length ? { id: 'trend', type: 'chart', dur: 6.5, step: 'Trend', text: { eyebrow: 'The trend', headline: f.seriesTitle || 'How it moved' }, data: { series, source: src } } : null,
      buyers.length ? { id: 'buyers', type: 'list', dur: Math.min(7, 2.8 + buyers.length * 1), step: 'Buyers', text: { eyebrow: 'For buyers', headline: 'What it means for buyers' }, data: { mode: 'check', strike: false, items: buyers } } : null,
      sellers.length ? { id: 'sellers', type: 'list', dur: Math.min(7, 2.8 + sellers.length * 1), step: 'Sellers', text: { eyebrow: 'For sellers', headline: 'What it means for sellers' }, data: { mode: 'check', strike: false, items: sellers } } : null,
      { id: 'message', type: 'message', dur: 3.6, text: { eyebrow: f.area || '', headline: f.message || 'Let’s talk.' } },
      endScene(f, { headline: `${f.area || 'Market'} · ${f.period || ''}`.replace(/ · $/, ''), sub: src, cta: 'Scan for your home’s value', dur: 5 }),
    ];
  },
  validate(f) {
    const out = [];
    if (!filled(f.stats).length && !filled(f.series).length && !f.headlineStat) out.push({ level: 'error', msg: 'Add at least one number: a headline number, key numbers or a trend.' });
    return out;
  },
  sample: { area: 'Sample County', period: 'Sample month', headlineStat: '$1.0M', headlineStatLabel: 'Sample median price', takeaway: 'Sample takeaway sentence.', stats: [{ value: '1,234', label: 'Sample homes sold' }, { value: '31', label: 'Sample days on market' }], series: [{ label: 'A', value: '10' }, { label: 'B', value: '14' }, { label: 'C', value: '12' }, { label: 'D', value: '17' }], source: 'Sample data · not real figures' },
};

export const dashboardRecap = {
  id: 'dashboard-recap',
  name: 'Dashboard Recap',
  category: 'Market & data',
  icon: 'dashboard',
  blurb: 'Drop in a dashboard screenshot: it is shown with callouts, then the numbers rebuild as animated charts. 30-45 seconds.',
  bestFor: 'Team performance, conversion, AICR, attach rate, weekly scorecards',
  defaultLook: 'newsroom',
  defaultFormat: '16x9',
  durations: { min: 30, default: 40, max: 60 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Q3 team performance' },
    { key: 'period', label: 'Period', type: 'text', placeholder: 'Week of Oct 13' },
    { key: 'screenshot', label: 'Dashboard screenshot', type: 'image', required: true, help: 'A clean, full screenshot. Crop out browser bars.' },
    { key: 'callouts', label: 'Callouts', type: 'callouts', max: 4, help: 'Click the screenshot to point at the numbers that matter.' },
    { key: 'headlineStat', label: 'The number that matters most', type: 'text', placeholder: '42%' },
    { key: 'headlineStatLabel', label: 'What it is', type: 'text', placeholder: 'Tour-to-offer conversion' },
    { key: 'stats', label: 'Supporting numbers', type: 'stats', max: 4 },
    { key: 'series', label: 'Chart (label and value)', type: 'series', max: 8 },
    { key: 'seriesTitle', label: 'Chart title', type: 'text' },
    { key: 'board', label: 'Leaderboard (name and value)', type: 'rows', max: 8, help: 'Real names for internal videos; initials when privacy is set to social.' },
    { key: 'boardMetric', label: 'Leaderboard metric', type: 'text' },
    { key: 'actions', label: 'Next actions for the team', type: 'list', max: 5, placeholder: ['Call every new lead within 5 minutes', 'Book two consults per day'] },
    { key: 'source', label: 'Source and as-of date', type: 'text', required: true, placeholder: 'Source: team dashboard, data as of Oct 17, 2026' },
    { key: 'message', label: 'Closing line', type: 'text', default: 'Same standard. Bigger results. Let’s go.' },
    { key: 'agentName', label: 'From (leader name)', type: 'text', group: 'Contact' },
  ],
  plan(f, { privacy } = {}) {
    const stats = filled(f.stats);
    const series = filled(f.series).filter(r => String(r.value ?? '').trim());
    const rows = filled(f.board).filter(r => r.name && String(r.value ?? '').trim());
    const actions = filled(f.actions);
    const src = f.source || '';
    return [
      introScene(f.title || 'Dashboard recap', f.period || '', 3.4),
      { id: 'report', type: 'screenshot', dur: 7, step: 'Dashboard', text: { eyebrow: f.period || 'The dashboard', headline: f.title || 'Where we stand', sub: src }, data: { callouts: filled(f.callouts) } },
      f.headlineStat ? { id: 'headline', type: 'hero', dur: 4.5, step: 'Focus', text: { eyebrow: 'The number that matters', headline: f.headlineStatLabel || '', sub: '' }, data: { glyph: f.headlineStat.slice(0, 8), glyphLabel: f.period || '' } } : null,
      stats.length ? { id: 'numbers', type: 'stats', dur: 5.5, step: 'Numbers', text: { eyebrow: 'Rebuilt from the dashboard', headline: 'The supporting numbers', sub: src }, data: { stats } } : null,
      series.length ? { id: 'trend', type: 'chart', dur: 6.5, step: 'Trend', text: { eyebrow: 'Trend', headline: f.seriesTitle || 'How it moved' }, data: { series, source: src } } : null,
      rows.length ? { id: 'board', type: 'leaderboard', dur: 6, step: 'Leaders', text: { eyebrow: 'Leaderboard', headline: f.boardMetric || 'Who is leading' }, data: { rows, anonymize: privacy === 'social' } } : null,
      actions.length ? { id: 'actions', type: 'list', dur: Math.min(8, 3 + actions.length * 1), step: 'Actions', text: { eyebrow: 'Next actions', headline: 'What we do next' }, data: { mode: 'steps', items: actions } } : null,
      { id: 'message', type: 'message', dur: 4, text: { eyebrow: f.agentName ? `From ${f.agentName}` : 'Let’s go', headline: f.message || 'Let’s go.' } },
    ];
  },
  validate(f) {
    const out = [];
    if (!filled(f.callouts).length && f.screenshot) out.push({ level: 'tip', field: 'callouts', msg: 'Add callouts on the screenshot so people know where to look.' });
    if (!f.headlineStat && !filled(f.stats).length) out.push({ level: 'warn', msg: 'Type in at least one number from the dashboard so it can be rebuilt as an animated chart. Double-check it against the screenshot.' });
    return out;
  },
  sample: { title: 'Sample dashboard recap', period: 'Sample week', headlineStat: '42%', headlineStatLabel: 'Sample conversion', stats: [{ value: '128', label: 'Sample leads' }, { value: '54', label: 'Sample tours' }], actions: ['Sample action one', 'Sample action two'], source: 'Sample data · not real figures' },
};

export const leaderboardStory = {
  id: 'leaderboard',
  name: 'Leaderboard',
  category: 'Market & data',
  icon: 'podium',
  blurb: 'A race to the top: ranked bars, the leader in 3D and a push for next week.',
  bestFor: 'Contests, weekly rankings, sales challenges',
  defaultLook: 'celebration',
  defaultFormat: '16x9',
  durations: { min: 12, default: 20, max: 40 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'October appointment race' },
    { key: 'metric', label: 'What is ranked', type: 'text', required: true, placeholder: 'Appointments set' },
    { key: 'board', label: 'Rankings (name and value)', type: 'rows', max: 8, required: true },
    { key: 'leaderPhoto', label: 'Leader headshot (optional)', type: 'image' },
    { key: 'prize', label: 'Prize or stakes (optional)', type: 'text' },
    { key: 'message', label: 'Closing line', type: 'text', default: 'Every call counts. See you at the top.' },
    { key: 'source', label: 'Source and as-of date', type: 'text', placeholder: 'Source: team dashboard, as of Oct 17' },
  ],
  plan(f, { privacy } = {}) {
    const rows = filled(f.board).filter(r => r.name && String(r.value ?? '').trim());
    const sorted = [...rows].sort((a, b) => parseFloat(String(b.value).replace(/[^\d.-]/g, '')) - parseFloat(String(a.value).replace(/[^\d.-]/g, '')));
    const leader = sorted[0];
    const anon = privacy === 'social';
    const leaderName = leader ? (anon ? leader.name.split(/\s+/).map(p => p[0] + '.').join(' ') : leader.name) : '';
    return [
      { id: 'title', type: 'hero', dur: 4, text: { eyebrow: f.metric || 'Leaderboard', headline: f.title || 'Leaderboard', sub: f.prize || '' }, data: { glyph: '#1', glyphLabel: f.metric || '' } },
      { id: 'board', type: 'leaderboard', dur: 6.5, text: { eyebrow: f.metric || 'Rankings', headline: f.title || 'The race', sub: f.source || '' }, data: { rows, anonymize: anon } },
      leader && f.leaderPhoto ? { id: 'leader', type: 'portrait', dur: 4, text: { eyebrow: 'In the lead', headline: leaderName, sub: `${leader.value} ${f.metric || ''}`.trim() }, data: { badge: '#1' } } : null,
      { id: 'message', type: 'message', dur: 3.8, text: { eyebrow: f.prize || 'Keep going', headline: f.message || 'See you at the top.' } },
    ];
  },
  sample: { title: 'Sample race', metric: 'Sample metric', board: [{ name: 'Sample One', value: '12' }, { name: 'Sample Two', value: '10' }, { name: 'Sample Three', value: '7' }, { name: 'Sample Four', value: '5' }] },
};
