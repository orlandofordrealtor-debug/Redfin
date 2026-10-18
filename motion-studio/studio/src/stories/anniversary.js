// Work anniversary / milestone: years in 3D, the person, their numbers, a gallery (homes they
// closed or celebration graphics), the thank-you, and an end card with photo, QR code and link.
const first = name => String(name || '').trim().split(/\s+/)[0] || '';
const filled = arr => (Array.isArray(arr) ? arr.filter(x => x && (typeof x === 'string' ? x.trim() : String(x.value ?? '').trim())) : []);

export default {
  id: 'anniversary',
  name: 'Work Anniversary',
  category: 'Celebrate',
  icon: 'medal',
  blurb: 'Celebrate an agent\'s years with Redfin: their photo, career numbers, homes or celebration graphics, and a heartfelt thank-you.',
  bestFor: 'Anniversaries, milestones, retirements, service awards',
  defaultLook: 'brand-glass',
  defaultFormat: '9x16',
  durations: { min: 15, default: 26, max: 45 },
  minPhotos: 4,
  fields: [
    { key: 'agentName', label: 'Agent name', type: 'text', required: true, placeholder: 'Heidi Ludwig', help: 'Shown in the title, spotlight and end card.' },
    { key: 'years', label: 'Years with the company', type: 'number', required: true, placeholder: '11', min: 1, max: 60, help: 'Becomes the big 3D number.' },
    { key: 'company', label: 'Company', type: 'text', default: 'Redfin' },
    { key: 'date', label: 'Anniversary date', type: 'text', placeholder: 'Oct 19' },
    { key: 'agentTitle', label: 'Title or role', type: 'text', placeholder: 'Redfin Principal Agent' },
    { key: 'specialty', label: 'Specialty', type: 'text', placeholder: 'South Bay Specialist' },
    { key: 'areas', label: 'Areas they serve', type: 'list', max: 6, placeholder: ['Manhattan Beach', 'Redondo Beach', 'Hermosa Beach', 'Torrance'] },
    { key: 'headshot', label: 'Headshot', type: 'image', required: true, help: 'A clear, well-lit photo, face centered. Square or portrait works best.' },
    { key: 'stats', label: 'Career numbers', type: 'stats', max: 3, help: 'Verified numbers only, e.g. "484 Total deals", "$519M Sales volume".', placeholder: [{ value: '484', label: 'Total deals' }, { value: '$519M', label: 'Sales volume' }, { value: '$9.0M', label: 'Highest sales price' }] },
    { key: 'photos', label: 'Homes they closed, or celebration graphics', type: 'images', min: 3, max: 12, recommended: '5–8', unit: 'images', captions: true, help: 'Home exteriors, or anniversary graphics and posters. Tall images get portrait cards automatically.' },
    { key: 'galleryEyebrow', label: 'Gallery label', type: 'text', placeholder: 'A year of closings' },
    { key: 'galleryTitle', label: 'Gallery headline', type: 'text', placeholder: 'Homes closed this year' },
    { key: 'message', label: 'Thank-you message', type: 'textarea', default: 'Thank you for your amazing service.', help: 'One or two short sentences land best.' },
    { key: 'qrLink', label: 'Loyalty or profile link', type: 'url', placeholder: 'https://…', help: 'Turned into a QR code on the end card and shown as text.' },
    { key: 'qrLabel', label: 'QR label', type: 'text', placeholder: 'Scan to view my Redfin profile' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '(310) 555-0123' },
    { key: 'email', label: 'Email', type: 'text', placeholder: 'name@redfin.com' },
    { key: 'dre', label: 'DRE license number', type: 'text', placeholder: '01234567' },
  ],
  plan(f) {
    const name = f.agentName || 'Agent name';
    const years = String(f.years || '').trim();
    const company = f.company || 'Redfin';
    const yearsText = years ? `${years} ${Number(years) === 1 ? 'year' : 'years'}` : 'Years';
    const stats = filled(f.stats);
    const areas = filled(f.areas);
    const photos = f.photos || [];
    const role = [f.agentTitle, f.specialty].filter(Boolean).join(' · ');
    const msg = f.message || 'Thank you for your amazing service.';
    return [
      {
        id: 'title', type: 'hero', dur: 4, shot: 'push', step: 'Celebrate',
        text: { eyebrow: f.date ? `Happy anniversary · ${f.date}` : 'Happy anniversary', headline: `Celebrating ${yearsText} at ${company}`, sub: name },
        data: { glyph: years || '★', glyphLabel: years ? (Number(years) === 1 ? 'Year' : 'Years') : '', accentWord: company },
      },
      {
        id: 'spotlight', type: 'portrait', dur: 4.2, shot: 'orbit',
        text: { eyebrow: `${yearsText} at ${company}`, headline: name, sub: role },
        data: { badge: years ? `${years} years${f.date ? ' · ' + f.date : ''}` : '' },
      },
      stats.length ? {
        id: 'numbers', type: 'stats', dur: 4.8, shot: 'push',
        text: { eyebrow: 'Career highlights', headline: `${yearsText} by the numbers`, sub: areas.join(' · ') },
        data: { stats },
      } : null,
      !stats.length && areas.length ? {
        id: 'areas', type: 'list', dur: Math.min(6, 2.6 + areas.length * 0.7), shot: 'push',
        text: { eyebrow: 'Local expertise', headline: f.specialty || 'Where they make it happen' },
        data: { mode: 'check', strike: false, items: areas },
      } : null,
      {
        id: 'homes', type: 'gallery', dur: Math.min(9, 4.5 + Math.max(photos.length, 4) * 0.45), shot: 'push',
        text: { eyebrow: f.galleryEyebrow || 'A year of closings', headline: f.galleryTitle || 'Homes closed this year', sub: '' },
      },
      {
        id: 'thanks', type: 'message', dur: 3.6, shot: 'static',
        text: { eyebrow: `${yearsText} at ${company}`, headline: msg },
        data: { accentWord: msg.match(/amazing|incredible|outstanding|service/i)?.[0] || '' },
      },
      {
        id: 'end', type: 'endcard', dur: 5.4, shot: 'static',
        text: { headline: `Celebrating ${yearsText} with ${company}`, sub: `Thank you, ${first(name) || name}.` },
        data: { cta: f.qrLink ? (f.qrLabel || 'Scan to view my Redfin profile') : '', linkText: f.qrLink || '' },
      },
    ];
  },
  validate(f) {
    const out = [];
    if (f.years && Number(f.years) > 60) out.push({ level: 'warn', field: 'years', msg: 'That is a lot of years. Double-check the number.' });
    if (!f.qrLink) out.push({ level: 'tip', field: 'qrLink', msg: 'Add a loyalty or profile link to put a QR code on the end card.' });
    return out;
  },
  sample: {
    agentName: 'Jordan Avery', years: 8, company: 'Redfin', agentTitle: 'Redfin Agent · Sample', date: 'Sample date',
    message: 'Thank you for your amazing service.', qrLink: 'https://www.redfin.com',
  },
};
