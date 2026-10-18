// Teaching stories: process explainers for agents, client journey explainers and Rocket
// mortgage explainers. Steps tick off one by one so people follow along.
import { CONTACT_FIELDS, filled, endScene, introScene } from './shared.js';

export const processExplainer = {
  id: 'process-explainer',
  name: 'How It Works',
  category: 'Teach',
  icon: 'steps',
  blurb: 'Explain any process in 3-6 steps, the way the "How RAG works" demo does: title, steps that tick off, the key idea, the payoff.',
  bestFor: 'Agent training, new tools, workflows, best practices',
  defaultLook: 'clay',
  defaultFormat: '16x9',
  durations: { min: 15, default: 30, max: 60 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'How a buyer consult works' },
    { key: 'why', label: 'Why it matters (one line)', type: 'text', placeholder: 'A great consult sets the tone for the whole search.' },
    { key: 'steps', label: 'Steps', type: 'list', max: 6, required: true, placeholder: ['Set expectations', 'Review finances with Rocket', 'Define must-haves', 'Plan the first tours'] },
    { key: 'keyNumber', label: 'A number that proves it (optional)', type: 'text', placeholder: '2x' },
    { key: 'keyNumberLabel', label: 'What the number means', type: 'text', placeholder: 'More offers written after a consult' },
    { key: 'screenshot', label: 'Screenshot of the tool (optional)', type: 'image' },
    { key: 'callouts', label: 'Callouts on the screenshot', type: 'callouts', max: 4, showIf: f => !!f.screenshot },
    { key: 'payoff', label: 'The payoff (closing message)', type: 'text', default: 'Do this every time and the results follow.' },
    { key: 'source', label: 'Source for any number (optional)', type: 'text' },
  ],
  plan(f) {
    const steps = filled(f.steps);
    const labels = steps.slice(0, 3).map((_, i) => `Step ${i + 1}`);
    return [
      introScene(f.title || 'How it works', 'Training', 3.2),
      { id: 'title', type: 'hero', dur: 4, text: { eyebrow: 'How it works', headline: f.title || 'How it works', sub: f.why || '' }, data: { glyph: String(steps.length || 3), glyphLabel: 'Steps' } },
      steps.length ? { id: 'steps', type: 'list', dur: Math.min(10, 3 + steps.length * 1.3), step: labels[0], text: { eyebrow: `${steps.length} steps`, headline: f.title || 'The steps' }, data: { mode: 'steps', items: steps } } : null,
      steps.length >= 3 ? { id: 'path', type: 'timeline', dur: Math.min(8, 3.5 + steps.length * 0.8), text: { eyebrow: 'The path', headline: 'From start to finish' }, data: { items: steps.slice(0, 6).map((s, i) => ({ label: `Step ${i + 1}`, title: s.length > 26 ? s.slice(0, 25) + '…' : s })) } } : null,
      f.screenshot ? { id: 'tool', type: 'screenshot', dur: 6, text: { eyebrow: 'In the tool', headline: 'Where to find it' }, data: { callouts: filled(f.callouts) } } : null,
      f.keyNumber ? { id: 'proof', type: 'hero', dur: 4.2, text: { eyebrow: 'Why it works', headline: f.keyNumberLabel || '', sub: f.source || '' }, data: { glyph: f.keyNumber.slice(0, 8) } } : null,
      { id: 'payoff', type: 'message', dur: 4, text: { eyebrow: 'The payoff', headline: f.payoff || 'Do this every time.' } },
    ];
  },
  sample: { title: 'Sample: How a buyer consult works', why: 'Sample one-line why.', steps: ['Sample step one', 'Sample step two', 'Sample step three', 'Sample step four'] },
};

export const clientJourney = {
  id: 'client-journey',
  name: 'Client Journey',
  category: 'Teach',
  icon: 'route',
  blurb: 'Walk buyers or sellers through what happens next: offer to escrow to keys, or prep to list to sold.',
  bestFor: 'Escrow timelines, buyer consults, listing presentations, first-time buyers',
  defaultLook: 'brand-glass',
  defaultFormat: '9x16',
  durations: { min: 15, default: 30, max: 60 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Your escrow timeline' },
    { key: 'audience', label: 'For', type: 'select', options: [{ value: 'buyers', label: 'Buyers' }, { value: 'sellers', label: 'Sellers' }, { value: 'both', label: 'Buyers and sellers' }], default: 'buyers' },
    { key: 'milestones', label: 'Milestones (label and timing)', type: 'milestones', max: 6, required: true, placeholder: [{ label: 'Offer accepted', title: 'Day 0' }, { label: 'Inspection', title: 'Days 1-7' }, { label: 'Appraisal', title: 'Days 7-14' }, { label: 'Loan approval', title: 'Days 14-21' }, { label: 'Close & keys', title: 'Day 30' }] },
    { key: 'tips', label: 'What you do at each stage (optional)', type: 'list', max: 5 },
    { key: 'note', label: 'Fine print', type: 'text', default: 'Typical timeline. Every transaction is different; your agent will confirm your dates.' },
    { key: 'message', label: 'Closing line', type: 'text', default: 'You will always know what comes next.' },
    ...CONTACT_FIELDS,
  ],
  plan(f) {
    const ms = filled(f.milestones).filter(m => m.label);
    const tips = filled(f.tips);
    return [
      { id: 'title', type: 'hero', dur: 3.8, text: { eyebrow: f.audience === 'sellers' ? 'For sellers' : f.audience === 'both' ? 'Buyers & sellers' : 'For buyers', headline: f.title || 'What happens next', sub: f.note || '' }, data: { glyph: String(ms.length || 5), glyphLabel: 'Milestones' } },
      ms.length ? { id: 'timeline', type: 'timeline', dur: Math.min(9, 3.5 + ms.length * 1), text: { eyebrow: 'Your timeline', headline: f.title || 'The timeline', sub: f.note || '' }, data: { items: ms } } : null,
      ms.length ? { id: 'checklist', type: 'list', dur: Math.min(8, 3 + ms.length * 0.9), text: { eyebrow: 'Step by step', headline: 'What happens when' }, data: { mode: 'steps', items: ms.map(m => ({ text: m.label, note: m.title })) } } : null,
      tips.length ? { id: 'tips', type: 'list', dur: Math.min(7, 2.8 + tips.length), text: { eyebrow: 'Your part', headline: 'What you do' }, data: { mode: 'check', strike: false, items: tips } } : null,
      { id: 'message', type: 'message', dur: 3.6, text: { eyebrow: f.title || '', headline: f.message || 'You will always know what comes next.' } },
      endScene(f, { headline: 'Questions? I’m here.', sub: f.agentName || '', cta: 'Scan to connect' }),
    ];
  },
  sample: { title: 'Sample escrow timeline', milestones: [{ label: 'Sample offer', title: 'Day 0' }, { label: 'Sample inspection', title: 'Day 7' }, { label: 'Sample appraisal', title: 'Day 14' }, { label: 'Sample close', title: 'Day 30' }] },
};

export const rocketExplainer = {
  id: 'rocket-explainer',
  name: 'Rocket Mortgage Explainer',
  category: 'Teach',
  icon: 'rocket',
  blurb: 'Explain the Redfin + Rocket advantage for buyers: the steps, the benefits, and how to get started. Uses only the facts you enter.',
  bestFor: 'Attach conversations, buyer consults, agent training on the Rocket handoff',
  defaultLook: 'brand-night',
  defaultFormat: '9x16',
  durations: { min: 15, default: 28, max: 50 },
  minPhotos: 0,
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, default: 'Buying with Redfin + Rocket', placeholder: 'Buying with Redfin + Rocket' },
    { key: 'audience', label: 'For', type: 'select', options: [{ value: 'clients', label: 'Buyers (client-facing)' }, { value: 'agents', label: 'Agents (training)' }], default: 'clients' },
    { key: 'steps', label: 'Steps', type: 'list', max: 5, required: true, placeholder: ['Meet your Rocket loan officer', 'Get verified approval', 'Shop with confidence', 'Close on time'] },
    { key: 'benefits', label: 'Benefits (verified, approved wording)', type: 'list', max: 4, help: 'Only use program details you have confirmed with current Rocket materials.' },
    { key: 'disclaimer', label: 'Disclaimer', type: 'textarea', default: 'Program availability, eligibility and terms are subject to change and lender approval.', help: 'Keep the current approved disclaimer here.' },
    { key: 'message', label: 'Closing line', type: 'text', default: 'Ready to see what you can afford?' },
    ...CONTACT_FIELDS,
  ],
  plan(f) {
    const steps = filled(f.steps), benefits = filled(f.benefits);
    return [
      introScene(f.title || 'Redfin + Rocket', f.audience === 'agents' ? 'Training' : 'For buyers', 3.4),
      steps.length ? { id: 'steps', type: 'list', dur: Math.min(9, 3 + steps.length * 1.2), text: { eyebrow: 'How it works', headline: f.title || 'How it works' }, data: { mode: 'steps', items: steps } } : null,
      benefits.length ? { id: 'benefits', type: 'list', dur: Math.min(7, 2.8 + benefits.length), text: { eyebrow: 'Why it matters', headline: 'The advantage', sub: f.disclaimer || '' }, data: { mode: 'check', strike: false, items: benefits } } : null,
      { id: 'message', type: 'message', dur: 3.8, text: { eyebrow: 'Redfin + Rocket', headline: f.message || 'Ready when you are.' } },
      endScene(f, { headline: f.message || 'Let’s get you started', sub: f.disclaimer || '', cta: 'Scan to get started' }),
    ];
  },
  sample: { title: 'Sample: Buying with Redfin + Rocket', steps: ['Sample step one', 'Sample step two', 'Sample step three'] },
};
