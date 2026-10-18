// Leadership stories: meeting openers, recruiting and event promos.
import { CONTACT_FIELDS, filled, endScene, introScene } from './shared.js';

export const meetingOpener = {
  id: 'meeting-opener',
  name: 'Meeting Opener',
  category: 'Lead & grow',
  icon: 'agenda',
  blurb: 'Open a team meeting with energy: the theme, the agenda, one number and the standard for the week.',
  bestFor: 'Weekly huddles, all-hands, training kickoffs, presentations',
  defaultLook: 'brand-night',
  defaultFormat: '16x9',
  durations: { min: 12, default: 22, max: 40 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Meeting title', type: 'text', required: true, placeholder: 'Monday Momentum' },
    { key: 'date', label: 'Date', type: 'text', placeholder: 'Monday, Oct 20' },
    { key: 'theme', label: 'Theme or big idea', type: 'text', placeholder: 'Speed to lead wins listings' },
    { key: 'agenda', label: 'Agenda', type: 'list', max: 6, required: true, placeholder: ['Wins of the week', 'Market minute', 'Role play: buyer consult', 'Commitments'] },
    { key: 'bigNumber', label: 'Number of the week (optional)', type: 'text', placeholder: '5 min' },
    { key: 'bigNumberLabel', label: 'What it means', type: 'text', placeholder: 'Lead response standard' },
    { key: 'quote', label: 'Quote or standard', type: 'text', placeholder: 'Service. System. Success.' },
  ],
  plan(f) {
    const agenda = filled(f.agenda);
    return [
      introScene(f.title || 'Team meeting', f.date || '', 3.6),
      f.theme ? { id: 'theme', type: 'message', dur: 4, text: { eyebrow: 'This week', headline: f.theme } } : null,
      agenda.length ? { id: 'agenda', type: 'list', dur: Math.min(8, 3 + agenda.length * 0.9), text: { eyebrow: f.date || 'Agenda', headline: 'Today’s agenda' }, data: { mode: 'agenda', items: agenda } } : null,
      f.bigNumber ? { id: 'number', type: 'hero', dur: 4, text: { eyebrow: 'Number of the week', headline: f.bigNumberLabel || '' }, data: { glyph: f.bigNumber.slice(0, 8) } } : null,
      f.quote ? { id: 'quote', type: 'message', dur: 3.8, text: { eyebrow: 'The standard', headline: f.quote } } : null,
    ];
  },
  sample: { title: 'Sample meeting', date: 'Sample date', theme: 'Sample theme for the week', agenda: ['Sample item one', 'Sample item two', 'Sample item three'] },
};

export const recruiting = {
  id: 'recruiting',
  name: 'Join the Team',
  category: 'Lead & grow',
  icon: 'people',
  blurb: 'Recruit with a story: why the team, what growth looks like, a real agent voice, and a QR to apply.',
  bestFor: 'Recruiting posts, career nights, LinkedIn, info sessions',
  defaultLook: 'brand-glass',
  defaultFormat: '9x16',
  durations: { min: 15, default: 26, max: 45 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Headline', type: 'text', required: true, default: 'Build your career with Redfin', placeholder: 'Build your career with Redfin' },
    { key: 'audience', label: 'Who you are looking for', type: 'text', placeholder: 'Licensed agents in Los Angeles' },
    { key: 'reasons', label: 'Why join', type: 'list', max: 5, required: true, help: 'Use approved, accurate wording about compensation, leads and support.' },
    { key: 'stats', label: 'Team facts (verified)', type: 'stats', max: 3 },
    { key: 'photos', label: 'Team photos (optional)', type: 'images', max: 8, captions: true },
    { key: 'testimonial', label: 'Agent testimonial', type: 'textarea' },
    { key: 'testimonialBy', label: 'Agent name and tenure', type: 'text' },
    { key: 'message', label: 'Closing line', type: 'text', default: 'Let’s talk about your next chapter.' },
    ...CONTACT_FIELDS,
  ],
  plan(f) {
    const reasons = filled(f.reasons), stats = filled(f.stats);
    return [
      introScene(f.title || 'Join the team', f.audience || 'Now hiring', 3.4),
      reasons.length ? { id: 'why', type: 'list', dur: Math.min(8, 3 + reasons.length), text: { eyebrow: 'Why agents join', headline: f.title || 'Why join' }, data: { mode: 'check', strike: false, items: reasons } } : null,
      stats.length ? { id: 'facts', type: 'stats', dur: 4.6, text: { eyebrow: 'The team', headline: 'By the numbers' }, data: { stats } } : null,
      (f.photos || []).length ? { id: 'team', type: 'gallery', dur: Math.min(8, 4 + f.photos.length * 0.5), text: { eyebrow: 'The team', headline: 'Life on the team' } } : null,
      f.testimonial ? { id: 'voice', type: 'quote', dur: 5.5, text: { eyebrow: 'In their words' }, data: { quote: f.testimonial, author: f.testimonialBy || '', stars: 0 } } : null,
      { id: 'message', type: 'message', dur: 3.6, text: { eyebrow: f.audience || '', headline: f.message || 'Let’s talk.' } },
      endScene(f, { headline: f.message || 'Let’s talk', sub: f.agentName || '', cta: 'Scan to apply' }),
    ];
  },
  sample: { title: 'Sample: Build your career', audience: 'Sample audience', reasons: ['Sample reason one', 'Sample reason two', 'Sample reason three'] },
};

export const eventPromo = {
  id: 'event-promo',
  name: 'Event Invite',
  category: 'Lead & grow',
  icon: 'calendar',
  blurb: 'Promote a seminar, workshop or client event with the date, what to expect and an RSVP QR code.',
  bestFor: 'Homebuyer seminars, client appreciation events, workshops',
  defaultLook: 'brand-glass',
  defaultFormat: '9x16',
  durations: { min: 12, default: 20, max: 35 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Event name', type: 'text', required: true, placeholder: 'First-Time Buyer Workshop' },
    { key: 'when', label: 'Date and time', type: 'text', required: true, placeholder: 'Sat, Nov 8 · 10 AM–12 PM' },
    { key: 'where', label: 'Where', type: 'text', placeholder: 'Redfin Pasadena office · or Zoom' },
    { key: 'expect', label: 'What to expect', type: 'list', max: 5, placeholder: ['How much home you can afford', 'Down payment options', 'Live Q&A'] },
    { key: 'photos', label: 'Venue or speaker photos (optional)', type: 'images', max: 6 },
    ...CONTACT_FIELDS,
  ],
  plan(f) {
    const expect = filled(f.expect);
    return [
      { id: 'title', type: 'hero', dur: 4, text: { eyebrow: 'You’re invited', headline: f.title || 'Event', sub: [f.when, f.where].filter(Boolean).join(' · ') }, data: { glyph: (String(f.when || '').match(/\b\d{1,2}\b/) || [''])[0] || '★', glyphLabel: (String(f.when || '').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/i) || [''])[0] } },
      expect.length ? { id: 'expect', type: 'list', dur: Math.min(7, 2.8 + expect.length * 0.9), text: { eyebrow: f.when || 'What to expect', headline: 'What you’ll get' }, data: { mode: 'check', strike: false, items: expect } } : null,
      (f.photos || []).length ? { id: 'photos', type: 'gallery', dur: 5, text: { eyebrow: f.where || '', headline: f.title || '' } } : null,
      endScene(f, { headline: f.title || 'Save your seat', sub: [f.when, f.where].filter(Boolean).join(' · '), cta: 'Scan to RSVP' }),
    ];
  },
  sample: { title: 'Sample workshop', when: 'Sat, Nov 8 · 10 AM', where: 'Sample location', expect: ['Sample topic one', 'Sample topic two'] },
};
