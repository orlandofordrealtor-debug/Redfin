// Celebration stories: agent spotlight, team wins and new reviews.
import { CONTACT_FIELDS, filled, first, endScene } from './shared.js';

export const agentSpotlight = {
  id: 'agent-spotlight',
  name: 'Agent Spotlight',
  category: 'Celebrate',
  icon: 'star',
  blurb: 'Put one agent in the spotlight: who they are, what they achieved and what clients say.',
  bestFor: 'Milestones, top producer, rookie of the month, promotions',
  defaultLook: 'brand-glass',
  defaultFormat: '9x16',
  durations: { min: 15, default: 22, max: 40 },
  minPhotos: 0,
  fields: [
    { key: 'occasion', label: 'What are we celebrating?', type: 'text', required: true, placeholder: 'Top Producer of Q3', help: 'Becomes the big headline.' },
    { key: 'agentName', label: 'Agent name', type: 'text', required: true, placeholder: 'Agent name' },
    { key: 'agentTitle', label: 'Title or role', type: 'text', placeholder: 'Redfin Agent' },
    { key: 'headshot', label: 'Headshot', type: 'image', required: true },
    { key: 'bigNumber', label: 'One big number (optional)', type: 'text', placeholder: '25', help: 'Built in 3D on the title, e.g. 25 closings. Up to 8 characters.' },
    { key: 'bigNumberLabel', label: 'What the big number means', type: 'text', placeholder: 'Closings this year' },
    { key: 'stats', label: 'More numbers', type: 'stats', max: 3, help: 'Verified numbers only.' },
    { key: 'achievements', label: 'Wins and highlights', type: 'list', max: 5, placeholder: ['Closed 25 homes this year', '100% five-star reviews', 'Mentored two new agents'] },
    { key: 'photos', label: 'Homes or moments (optional)', type: 'images', max: 10, captions: true },
    { key: 'review', label: 'Client quote (optional)', type: 'textarea' },
    { key: 'reviewer', label: 'Who said it', type: 'text' },
    { key: 'message', label: 'Closing message', type: 'textarea', default: 'Proud of you. Keep raising the bar.' },
    ...CONTACT_FIELDS.filter(f => !['agentName', 'agentTitle', 'headshot'].includes(f.key)),
  ],
  plan(f) {
    const name = f.agentName || 'Agent name';
    const ach = filled(f.achievements);
    const stats = filled(f.stats);
    return [
      { id: 'title', type: 'hero', dur: 4, text: { eyebrow: 'Spotlight', headline: f.occasion || 'Agent spotlight', sub: name }, data: { glyph: f.bigNumber || '★', glyphLabel: f.bigNumber ? f.bigNumberLabel || '' : '' } },
      { id: 'spotlight', type: 'portrait', dur: 4.2, text: { eyebrow: f.occasion || 'Spotlight', headline: name, sub: f.agentTitle || '' }, data: { badge: f.bigNumber && f.bigNumberLabel ? `${f.bigNumber} ${f.bigNumberLabel}` : '' } },
      ach.length ? { id: 'wins', type: 'list', dur: Math.min(6.5, 2.6 + ach.length * 0.8), text: { eyebrow: 'Highlights', headline: `${first(name) || 'Their'}${first(name) ? '’s' : ''} wins` }, data: { mode: 'check', strike: false, items: ach } } : null,
      stats.length ? { id: 'numbers', type: 'stats', dur: 4.4, text: { eyebrow: 'By the numbers', headline: 'The results' }, data: { stats } } : null,
      (f.photos || []).length ? { id: 'homes', type: 'gallery', dur: Math.min(8, 4 + f.photos.length * 0.5), text: { eyebrow: 'Recent work', headline: 'Homes and moments' } } : null,
      f.review ? { id: 'review', type: 'quote', dur: 5, text: { eyebrow: 'What clients say' }, data: { quote: f.review, author: f.reviewer || '', stars: 5 } } : null,
      { id: 'message', type: 'message', dur: 3.6, text: { eyebrow: f.occasion || '', headline: f.message || 'Proud of you.' } },
      endScene(f, { headline: f.occasion || 'Congratulations', sub: `Congratulations, ${first(name) || name}!`, cta: 'Scan to connect' }),
    ];
  },
  sample: { occasion: 'Sample: Top Producer', agentName: 'Sample Agent', agentTitle: 'Redfin Agent', bigNumber: '25', bigNumberLabel: 'Sample closings', achievements: ['Sample win one', 'Sample win two', 'Sample win three'] },
};

export const teamWins = {
  id: 'team-wins',
  name: 'Team Wins',
  category: 'Celebrate',
  icon: 'trophy',
  blurb: 'Weekly or monthly shout-outs: wins, top performers and a rallying message for the team.',
  bestFor: 'Weekly huddles, Slack shout-outs, month-end recaps',
  defaultLook: 'celebration',
  defaultFormat: '16x9',
  durations: { min: 15, default: 28, max: 45 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, default: 'Team wins this week', placeholder: 'Team wins this week' },
    { key: 'period', label: 'Period', type: 'text', placeholder: 'Week of Oct 13' },
    { key: 'bigNumber', label: 'Headline number', type: 'text', placeholder: '18', help: 'Built in 3D. Example: 18 offers written.' },
    { key: 'bigNumberLabel', label: 'What it means', type: 'text', placeholder: 'Offers written' },
    { key: 'wins', label: 'Wins to call out', type: 'list', max: 6, placeholder: ['Sample: Maria closed in Silver Lake', 'Sample: James got 3 listing appointments'] },
    { key: 'board', label: 'Leaderboard (name and value)', type: 'rows', max: 8, help: 'Names show for internal videos and become initials when privacy is set to social.', placeholder: [{ name: 'Agent one', value: '5' }, { name: 'Agent two', value: '4' }] },
    { key: 'boardMetric', label: 'Leaderboard metric', type: 'text', placeholder: 'Appointments set' },
    { key: 'stats', label: 'Team numbers', type: 'stats', max: 4 },
    { key: 'message', label: 'Rallying message', type: 'textarea', default: 'Same standard next week. Let’s run it back.' },
    { key: 'agentName', label: 'From (leader name)', type: 'text', placeholder: 'Your name', group: 'Contact' },
    { key: 'agentTitle', label: 'Title', type: 'text', placeholder: 'Sales Manager', group: 'Contact' },
  ],
  plan(f, { privacy } = {}) {
    const wins = filled(f.wins);
    const rows = filled(f.board).filter(r => r.name && String(r.value ?? '').trim());
    const stats = filled(f.stats);
    return [
      { id: 'title', type: 'hero', dur: 4, step: 'Wins', text: { eyebrow: f.period || 'Team wins', headline: f.title || 'Team wins', sub: '' }, data: { glyph: f.bigNumber || '★', glyphLabel: f.bigNumber ? f.bigNumberLabel || '' : '' } },
      wins.length ? { id: 'wins', type: 'list', dur: Math.min(7.5, 2.6 + wins.length * 0.9), step: 'Wins', text: { eyebrow: 'Shout-outs', headline: 'Wins worth celebrating' }, data: { mode: 'check', strike: false, items: wins } } : null,
      rows.length ? { id: 'board', type: 'leaderboard', dur: 5.5, step: 'Leaders', text: { eyebrow: 'Leaderboard', headline: f.boardMetric || 'Top performers' }, data: { rows, anonymize: privacy === 'social' } } : null,
      stats.length ? { id: 'numbers', type: 'stats', dur: 4.6, step: 'Numbers', text: { eyebrow: 'Team numbers', headline: f.period ? `Our ${f.period.toLowerCase().startsWith('week') ? 'week' : 'month'} in numbers` : 'By the numbers' }, data: { stats } } : null,
      { id: 'message', type: 'message', dur: 4, step: 'Next', text: { eyebrow: f.agentName ? `From ${f.agentName}` : 'Next up', headline: f.message || 'Let’s run it back.' } },
    ];
  },
  sample: { title: 'Sample: Team wins this week', period: 'Sample week', bigNumber: '18', bigNumberLabel: 'Sample offers', wins: ['Sample win one', 'Sample win two', 'Sample win three'], board: [{ name: 'Sample One', value: '6' }, { name: 'Sample Two', value: '5' }, { name: 'Sample Three', value: '3' }], boardMetric: 'Sample metric' },
};

export const newReview = {
  id: 'new-review',
  name: 'New Review',
  category: 'Celebrate',
  icon: 'quote',
  blurb: 'Turn a five-star review into a share-ready video with stars, the quote and your contact.',
  bestFor: 'Zillow/Google/Redfin reviews, client thank-yous, testimonials',
  defaultLook: 'brand-glass',
  defaultFormat: '9x16',
  durations: { min: 10, default: 16, max: 30 },
  minPhotos: 0,
  fields: [
    { key: 'review', label: 'Review text', type: 'textarea', required: true, help: 'Paste the client’s words exactly, with permission.' },
    { key: 'reviewer', label: 'Reviewer', type: 'text', placeholder: 'First name and last initial' },
    { key: 'stars', label: 'Stars', type: 'number', default: 5, min: 1, max: 5 },
    { key: 'context', label: 'Context', type: 'text', placeholder: 'Sold their first home in Pasadena' },
    { key: 'photos', label: 'Home photo (optional)', type: 'images', max: 3 },
    ...CONTACT_FIELDS,
  ],
  plan(f) {
    return [
      { id: 'title', type: 'hero', dur: 3.4, text: { eyebrow: 'New review', headline: `${f.stars || 5}-star review`, sub: f.context || '' }, data: { glyph: String(f.stars || 5) + '\u2605', glyphLabel: 'Stars' } },
      { id: 'review', type: 'quote', dur: Math.min(9, 4 + String(f.review || '').length / 40), text: { eyebrow: f.context || 'Client review' }, data: { quote: f.review || 'Paste the review here.', author: f.reviewer || '', stars: Number(f.stars || 5) } },
      f.headshot || f.agentName ? { id: 'agent', type: 'portrait', dur: 3.6, text: { eyebrow: 'Thank you', headline: f.agentName || '', sub: f.agentTitle || '' } } : null,
      endScene(f, { headline: 'Thank you for the trust', sub: 'Ready when you are.', cta: 'Scan to connect' }),
    ];
  },
  sample: { review: 'Sample review: clear, calm and always one step ahead. We never wondered what came next.', reviewer: 'Sample Client', stars: 5, context: 'Sample context', agentName: 'Sample Agent' },
};
