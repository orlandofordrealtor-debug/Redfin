// Work anniversary / milestone: years in 3D, the person, the homes, the numbers, the thank-you,
// and an end card with their photo, QR code and link.
const first = name => String(name || '').trim().split(/\s+/)[0] || '';

export default {
  id: 'anniversary',
  name: 'Work Anniversary',
  category: 'Celebrate',
  icon: 'medal',
  blurb: 'Celebrate an agent\'s years with Redfin: their photo, the homes they closed, their numbers and a heartfelt thank-you.',
  bestFor: 'Anniversaries, milestones, retirements, service awards',
  defaultLook: 'brand-glass',
  defaultFormat: '9x16',
  durations: { min: 15, default: 24, max: 45 },
  minPhotos: 4,
  fields: [
    { key: 'agentName', label: 'Agent name', type: 'text', required: true, placeholder: 'Heidi Ludwig', help: 'Shown in the title, spotlight and end card.' },
    { key: 'years', label: 'Years with the company', type: 'number', required: true, placeholder: '11', min: 1, max: 60, help: 'Becomes the big 3D number.' },
    { key: 'company', label: 'Company', type: 'text', default: 'Redfin' },
    { key: 'agentTitle', label: 'Title or role', type: 'text', placeholder: 'Redfin Agent' },
    { key: 'headshot', label: 'Headshot', type: 'image', required: true, help: 'A clear, well-lit photo, face centered. Square or portrait works best.' },
    { key: 'photos', label: 'Homes they closed', type: 'images', min: 3, max: 12, recommended: '5–8', unit: 'home photos', captions: true, help: 'Front exterior shots read best. Add the city or street as a caption if you like.' },
    { key: 'stats', label: 'Numbers to celebrate', type: 'stats', max: 3, help: 'Optional. Only use numbers you have verified, e.g. "Homes closed this year".', placeholder: [{ value: '', label: 'Homes closed this year' }, { value: '', label: 'Years with Redfin' }] },
    { key: 'message', label: 'Thank-you message', type: 'textarea', default: 'Thank you for your amazing service.', help: 'One or two short sentences land best.' },
    { key: 'qrLink', label: 'Loyalty or landing page link', type: 'url', placeholder: 'https://…', help: 'Turned into a QR code on the end card and shown as text.' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '(310) 555-0123' },
    { key: 'email', label: 'Email', type: 'text', placeholder: 'name@redfin.com' },
    { key: 'dre', label: 'DRE license number', type: 'text', placeholder: '01234567' },
  ],
  plan(f) {
    const name = f.agentName || 'Agent name';
    const years = String(f.years || '').trim();
    const company = f.company || 'Redfin';
    const yearsText = years ? `${years} ${Number(years) === 1 ? 'year' : 'years'}` : 'Years';
    const stats = (f.stats || []).filter(s => s && String(s.value ?? '').trim());
    const photos = f.photos || [];
    const scenes = [
      {
        id: 'title', type: 'hero', dur: 4.2, shot: 'push', step: 'Celebrate',
        text: { eyebrow: 'Happy anniversary', headline: `Celebrating ${yearsText} with ${company}`, sub: name },
        data: { glyph: years || '★', glyphLabel: years ? (Number(years) === 1 ? 'Year' : 'Years') : '', accentWord: company },
      },
      {
        id: 'spotlight', type: 'portrait', dur: 4.2, shot: 'orbit',
        text: { eyebrow: `${yearsText} with ${company}`, headline: name, sub: f.agentTitle || '' },
        data: { badge: years ? `${years} years` : '' },
      },
      {
        id: 'homes', type: 'gallery', dur: Math.min(9, 4.5 + Math.max(photos.length, 4) * 0.45), shot: 'push',
        text: { eyebrow: 'A year of closings', headline: 'Homes closed this year', sub: '' },
      },
      stats.length ? {
        id: 'numbers', type: 'stats', dur: 4.6, shot: 'dolly',
        text: { eyebrow: 'By the numbers', headline: `${first(name) || 'Their'}${first(name) ? '’s' : ''} year`, sub: '' },
        data: { stats },
      } : null,
      {
        id: 'thanks', type: 'message', dur: 3.8, shot: 'static',
        text: { eyebrow: `${yearsText} with ${company}`, headline: f.message || 'Thank you for your amazing service.' },
        data: { accentWord: (f.message || 'Thank you for your amazing service.').match(/amazing|incredible|outstanding|service/i)?.[0] || '' },
      },
      {
        id: 'end', type: 'endcard', dur: 5.2, shot: 'static',
        text: { headline: `Celebrating ${yearsText} with ${company}`, sub: `Thank you, ${first(name) || name}.` },
        data: { cta: f.qrLink ? 'Scan for my loyalty link' : '', linkText: f.qrLink || '' },
      },
    ];
    return scenes;
  },
  validate(f) {
    const out = [];
    if (f.years && Number(f.years) > 60) out.push({ level: 'warn', field: 'years', msg: 'That is a lot of years. Double-check the number.' });
    if (!f.qrLink) out.push({ level: 'tip', field: 'qrLink', msg: 'Add a loyalty or landing page link to put a QR code on the end card.' });
    return out;
  },
  sample: {
    agentName: 'Jordan Avery', years: 8, company: 'Redfin', agentTitle: 'Redfin Agent · Sample',
    message: 'Thank you for your amazing service.', qrLink: 'https://www.redfin.com',
  },
};
