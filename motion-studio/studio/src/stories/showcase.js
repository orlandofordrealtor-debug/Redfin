// Showcase: every scene type with clearly labelled sample content. Used to test looks and to
// preview templates. Hidden from the template gallery.
export default {
  id: 'showcase',
  name: 'Look Showcase',
  category: 'Internal',
  hidden: true,
  blurb: 'Every scene type with sample content.',
  defaultLook: 'brand-glass',
  defaultFormat: '16x9',
  minPhotos: 5,
  fields: [],
  plan() {
    return [
      { id: 'intro', type: 'intro', dur: 3.4, text: { eyebrow: 'Sample', headline: 'Look showcase' } },
      { id: 'hero', type: 'hero', dur: 3.6, text: { eyebrow: 'Sample title', headline: 'Big numbers, built in 3D', sub: 'Every look restyles the same scenes' }, data: { glyph: '24', glyphLabel: 'Sample' } },
      { id: 'portrait', type: 'portrait', dur: 3.6, text: { eyebrow: 'Spotlight', headline: 'Sample Agent', sub: 'Redfin Agent' }, data: { badge: 'Sample badge' } },
      { id: 'gallery', type: 'gallery', dur: 5.5, text: { eyebrow: 'Gallery', headline: 'Sample homes' } },
      { id: 'property', type: 'property', dur: 4.6, text: { eyebrow: 'Just sold', headline: '123 Sample Street', sub: 'Los Angeles, CA' }, data: { status: 'just-sold', price: '$1,250,000', facts: ['3 bd', '2 ba', '1,850 sq ft'] } },
      { id: 'stats', type: 'stats', dur: 4.2, text: { eyebrow: 'By the numbers', headline: 'Sample metrics' }, data: { stats: [{ value: '42', label: 'Sample count' }, { value: '98%', label: 'Sample rate' }, { value: '$3.2M', label: 'Sample volume' }] } },
      { id: 'chart', type: 'chart', dur: 5, text: { eyebrow: 'Chart', headline: 'Sample trend' }, data: { series: [{ label: 'Jan', value: '12' }, { label: 'Feb', value: '18' }, { label: 'Mar', value: '15' }, { label: 'Apr', value: '24' }, { label: 'May', value: '21' }], source: 'Sample data · not real figures' } },
      { id: 'leaderboard', type: 'leaderboard', dur: 5, text: { eyebrow: 'Leaderboard', headline: 'Sample team race' }, data: { rows: [{ name: 'Sample One', value: '14' }, { name: 'Sample Two', value: '11' }, { name: 'Sample Three', value: '9' }, { name: 'Sample Four', value: '7' }] } },
      { id: 'list', type: 'list', dur: 5, text: { eyebrow: 'Checklist', headline: 'Sample steps' }, data: { mode: 'check', items: ['Book the consult', 'Get pre-approved', 'Tour the shortlist', 'Write the offer'] } },
      { id: 'quote', type: 'quote', dur: 5, text: { eyebrow: 'Review' }, data: { stars: 5, quote: 'Sample review text. Every step was clear, and we always knew what came next.', author: 'Sample Client' } },
      { id: 'timeline', type: 'timeline', dur: 5, text: { eyebrow: 'Milestones', headline: 'Sample timeline' }, data: { items: [{ label: 'Offer', title: 'Day 0' }, { label: 'Escrow', title: 'Day 3' }, { label: 'Appraisal', title: 'Day 14' }, { label: 'Close', title: 'Day 30' }] } },
      { id: 'message', type: 'message', dur: 3.4, text: { eyebrow: 'Message', headline: 'Anything in. Amazing out.' }, data: { accentWord: 'Amazing' } },
      { id: 'end', type: 'endcard', dur: 4.6, text: { headline: 'Sample end card', sub: 'Scan to connect' }, data: { name: 'Sample Agent', title: 'Redfin Agent', phone: '(555) 010-0000', cta: 'Scan to connect', linkText: 'https://www.redfin.com' } },
    ];
  },
  sample: { qrLink: 'https://www.redfin.com' },
};
