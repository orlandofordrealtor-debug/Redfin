// Listing status stories. One framework covers every status (just listed, coming soon, under
// contract, pending, sold, closed, price improvement, back on market, open house...). Each gallery
// entry is the same template with a different starting status, so people can switch at any time.
import { CONTACT_FIELDS, filled, endScene } from './shared.js';
import { STATUS } from '../scenes/property.js';

const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.chip }));

const COPY = {
  'just-sold': { eyebrow: 'Just sold', end: 'Thinking of selling?', cta: 'Scan for a free home valuation' },
  'just-closed': { eyebrow: 'Just closed', end: 'Congratulations to my clients!', cta: 'Scan to connect' },
  'just-listed': { eyebrow: 'Just listed', end: 'Book a private tour', cta: 'Scan to view the listing' },
  'coming-soon': { eyebrow: 'Coming soon', end: 'Get first access', cta: 'Scan to get on the list' },
  'under-contract': { eyebrow: 'Under contract', end: 'Ready for your move?', cta: 'Scan to connect' },
  'pending': { eyebrow: 'Pending', end: 'Ready for your move?', cta: 'Scan to connect' },
  'price-improved': { eyebrow: 'Price improvement', end: 'Book a tour this week', cta: 'Scan to view the listing' },
  'back-on-market': { eyebrow: 'Back on market', end: 'Second chance to make it yours', cta: 'Scan to view the listing' },
  'open-house': { eyebrow: 'Open house', end: 'Come see it in person', cta: 'Scan to RSVP' },
  'off-market': { eyebrow: 'Off-market opportunity', end: 'Ask me for details', cta: 'Scan to connect' },
  'sold-over-asking': { eyebrow: 'Sold over asking', end: 'Thinking of selling?', cta: 'Scan for a free home valuation' },
  'multiple-offers': { eyebrow: 'Multiple offers', end: 'Strategy wins', cta: 'Scan to connect' },
};

function makeListingStory({ id, name, status, blurb, bestFor, icon }) {
  return {
    id,
    name,
    category: 'Listings',
    icon,
    blurb,
    bestFor,
    defaultLook: status === 'open-house' ? 'brand-glass' : status.includes('sold') || status === 'just-closed' ? 'brand-glass' : 'brand-glass',
    defaultFormat: '9x16',
    durations: { min: 12, default: 20, max: 40 },
    minPhotos: 3,
    fields: [
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, default: status, help: 'Switch any time; the 3D status word and wording update.' },
      { key: 'address', label: 'Address', type: 'text', required: true, placeholder: '123 Palm Ave' },
      { key: 'city', label: 'City / neighborhood', type: 'text', placeholder: 'Silver Lake, Los Angeles' },
      { key: 'price', label: 'Price', type: 'text', placeholder: '$1,250,000', help: 'Shown counting up. Leave blank to hide.' },
      { key: 'beds', label: 'Beds', type: 'text', placeholder: '3' },
      { key: 'baths', label: 'Baths', type: 'text', placeholder: '2' },
      { key: 'sqft', label: 'Square feet', type: 'text', placeholder: '1,850' },
      { key: 'photos', label: 'Property photos', type: 'images', min: 3, max: 10, recommended: '5–8', unit: 'photos', captions: true, help: 'Lead with the best exterior. The first photo becomes the hero.' },
      { key: 'highlights', label: 'Highlights', type: 'list', max: 5, help: 'Short phrases: "Remodeled kitchen", "Walk to Sunset Junction".', placeholder: ['Remodeled kitchen', 'Private backyard', 'Walk to shops and cafés'] },
      { key: 'stats', label: 'Results to share', type: 'stats', max: 3, help: 'Optional and verified only, e.g. "12 offers", "8 days on market", "$75K over asking".' },
      { key: 'openHouse', label: 'Open house date and time', type: 'text', placeholder: 'Sat & Sun · 1–4 PM', showIf: f => f.status === 'open-house' },
      { key: 'review', label: 'Client quote', type: 'textarea', help: 'Optional. Use real words from your client, with permission.' },
      { key: 'reviewer', label: 'Who said it', type: 'text', placeholder: 'The Martinez Family' },
      ...CONTACT_FIELDS,
    ],
    plan(f) {
      const st = f.status || status;
      const copy = COPY[st] || COPY['just-sold'];
      const facts = [f.beds && `${f.beds} bd`, f.baths && `${f.baths} ba`, f.sqft && `${f.sqft} sq ft`].filter(Boolean);
      const photos = f.photos || [];
      const hl = filled(f.highlights);
      const stats = filled(f.stats);
      return [
        {
          id: 'property', type: 'property', dur: 5, step: 'Home',
          text: { eyebrow: copy.eyebrow, headline: f.address || 'Address', sub: f.city || '' },
          data: { status: st, price: f.price || '', facts, photoIndex: 0, badge: st === 'open-house' && f.openHouse ? f.openHouse : '' },
        },
        photos.length > 1 || photos.length === 0 ? {
          id: 'gallery', type: 'gallery', dur: Math.min(8, 4 + Math.max(3, photos.length) * 0.5),
          text: { eyebrow: f.city || copy.eyebrow, headline: hl.length ? 'Take a look inside' : 'Every angle' },
          data: { from: photos.length > 1 ? 1 : 0 },
        } : null,
        hl.length ? {
          id: 'highlights', type: 'list', dur: Math.min(6.5, 2.6 + hl.length * 0.8),
          text: { eyebrow: 'Highlights', headline: st === 'open-house' && f.openHouse ? f.openHouse : 'Why it stands out' },
          data: { mode: 'check', strike: false, items: hl },
        } : null,
        stats.length ? {
          id: 'results', type: 'stats', dur: 4.4,
          text: { eyebrow: 'The results', headline: st.includes('sold') || st === 'just-closed' ? 'Strategy that delivered' : 'By the numbers' },
          data: { stats },
        } : null,
        f.review ? {
          id: 'review', type: 'quote', dur: 5,
          text: { eyebrow: 'Client review' },
          data: { quote: f.review, author: f.reviewer || '', stars: 5 },
        } : null,
        endScene(f, { headline: copy.end, sub: f.agentName ? `${f.agentName}${f.agentTitle ? ' · ' + f.agentTitle : ''}` : '', cta: copy.cta }),
      ];
    },
    validate(f) {
      const out = [];
      if (!(f.photos || []).length) out.push({ level: 'warn', field: 'photos', msg: 'Add property photos. Placeholders show until you do.' });
      if (!f.agentName) out.push({ level: 'tip', field: 'agentName', msg: 'Add the agent name for the end card.' });
      return out;
    },
    sample: { status, address: '123 Sample Street', city: 'Los Angeles, CA', price: '$1,250,000', beds: '3', baths: '2', sqft: '1,850', highlights: ['Sample highlight one', 'Sample highlight two', 'Sample highlight three'], agentName: 'Sample Agent', agentTitle: 'Redfin Agent', qrLink: 'https://www.redfin.com' },
  };
}

export const LISTING_STORIES = [
  makeListingStory({ id: 'just-sold', name: 'Just Sold', status: 'just-sold', icon: 'sold', blurb: 'Celebrate a sale: the home, the price, the results and your contact.', bestFor: 'Sold, closed, sold over asking, multiple offers' }),
  makeListingStory({ id: 'just-listed', name: 'Just Listed', status: 'just-listed', icon: 'listed', blurb: 'Launch a listing with the hero photo, price, highlights and a QR to the listing.', bestFor: 'New listings, coming soon, price improvements' }),
  makeListingStory({ id: 'under-contract', name: 'Under Contract', status: 'under-contract', icon: 'contract', blurb: 'Share momentum while it is in escrow or pending.', bestFor: 'Under contract, pending, back on market' }),
  makeListingStory({ id: 'open-house', name: 'Open House', status: 'open-house', icon: 'house', blurb: 'Invite people in: date and time, highlights, photos and an RSVP QR code.', bestFor: 'Open houses, broker previews, private showings' }),
  makeListingStory({ id: 'listing-status', name: 'Any Listing Status', status: 'coming-soon', icon: 'status', blurb: 'Pick from every status: coming soon, price improvement, back on market, off-market and more.', bestFor: 'Every other status update' }),
];
