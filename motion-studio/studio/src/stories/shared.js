// Field groups and scene helpers shared by story templates.

export const CONTACT_FIELDS = [
  { key: 'agentName', label: 'Agent name', type: 'text', placeholder: 'Your name', group: 'Contact' },
  { key: 'agentTitle', label: 'Title or role', type: 'text', placeholder: 'Redfin Agent', group: 'Contact' },
  { key: 'headshot', label: 'Headshot', type: 'image', help: 'A clear, well-lit photo, face centered.', group: 'Contact' },
  { key: 'phone', label: 'Phone', type: 'text', placeholder: '(310) 555-0123', group: 'Contact' },
  { key: 'email', label: 'Email', type: 'text', placeholder: 'name@redfin.com', group: 'Contact' },
  { key: 'dre', label: 'DRE license number', type: 'text', placeholder: '01234567', group: 'Contact' },
  { key: 'qrLink', label: 'Link for the QR code', type: 'url', placeholder: 'https://…', help: 'Listing page, loyalty link, booking page or RSVP. Shown as a QR code and as text.', group: 'Contact' },
];

export const first = name => String(name || '').trim().split(/\s+/)[0] || '';
export const filled = arr => (Array.isArray(arr) ? arr.filter(x => x && (typeof x === 'string' ? x.trim() : Object.values(x).some(v => String(v ?? '').trim()))) : []);

export function endScene(f, { headline = '', sub = '', cta = 'Scan to connect', dur = 5 } = {}) {
  return {
    id: 'end', type: 'endcard', dur,
    text: { headline, sub },
    data: { cta: f.qrLink ? cta : '', linkText: f.qrLink || '' },
  };
}

export function introScene(title, eyebrow = '', dur = 3.2) {
  return { id: 'intro', type: 'intro', dur, text: { eyebrow, headline: title } };
}

/** Validation helpers */
export function needOne(f, keys, msg) {
  return keys.some(k => (Array.isArray(f[k]) ? filled(f[k]).length : String(f[k] ?? '').trim())) ? [] : [{ level: 'warn', msg }];
}
