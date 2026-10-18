// The in-app guide: short, practical answers people need while they work.
import { h } from './ui.js';

export function guide() {
  const sec = (title, ...kids) => h('section', { class: 'guide' }, h('h3', null, title), ...kids);
  return [
    sec('How the studio works',
      h('ol', null,
        h('li', null, h('b', null, 'Start'), ' from a template, or describe what you want and drop in your files.'),
        h('li', null, h('b', null, 'Content:'), ' fill in names, numbers, photos and links. The checklist tells you what is missing.'),
        h('li', null, h('b', null, 'Look:'), ' choose a visual style. The Redfin brand switch keeps every look on-brand.'),
        h('li', null, h('b', null, 'Format & sound:'), ' pick sizes, length, music and sound effects.'),
        h('li', null, h('b', null, 'Polish:'), ' edit any scene’s words, timing and camera move, or reorder scenes.'),
        h('li', null, h('b', null, 'Export:'), ' download MP4, GIF, poster and storyboard, or hand off to Claude Code for a final render and delivery.'))),
    sec('Templates and looks',
      h('dl', null,
        h('dt', null, 'Template'), h('dd', null, 'The story: which scenes appear and what they say. Work Anniversary, Just Sold, Market Update…'),
        h('dt', null, 'Look'), h('dd', null, 'The visual world: Redfin Glass, Premium Clay, Holographic Globe, Luxury… Any template works in any look.'),
        h('dt', null, 'Scene'), h('dd', null, 'One beat of the video: a title, a photo gallery, numbers, a checklist, an end card.'),
        h('dt', null, 'Redfin brand switch'), h('dd', null, 'On by default. Re-skins every look with Redfin red, ink and the official Redfin Powered by Rocket logo.'))),
    sec('Tips for videos people finish watching',
      h('ul', null,
        h('li', null, 'Lead with the most impressive thing: the number, the photo, the person.'),
        h('li', null, 'Keep headlines under 8 words and list items under 7.'),
        h('li', null, '5–8 photos is the sweet spot for a gallery. Exterior shots read best on phones.'),
        h('li', null, 'Use 9:16 for Reels, TikTok and Stories; 16:9 for meetings and YouTube; 1:1 or 4:5 for feed posts.'),
        h('li', null, 'Only use numbers you have verified, and add the source and as-of date on data videos.'),
        h('li', null, 'Set privacy to "social" before posting team numbers publicly: names become initials.'))),
    sec('Compliance basics',
      h('p', null, 'End cards include the Equal Housing Opportunity mark and the brokerage name by default. Add the agent’s DRE number when the video promotes an agent or listing. Confirm the current requirements with your compliance team before posting, and keep any Rocket program wording to the approved, current language with its disclaimer.')),
    sec('Getting videos out',
      h('ul', null,
        h('li', null, h('b', null, 'Download'), ' works right here: MP4 (Chrome or Edge), GIF, poster PNG and storyboard.'),
        h('li', null, h('b', null, 'Slack, Google Drive, email and GitHub'), ' go through Claude: use "Send with Claude" on the Export step to copy a ready-made request, then paste it to Claude.'),
        h('li', null, h('b', null, 'Final render with Claude Code'), ' produces frame-perfect 60fps MP4s in every size, a transparent overlay for editing apps, GIFs and storyboards.'))),
    sec('If something looks off',
      h('dl', null,
        h('dt', null, 'Preview is slow'), h('dd', null, 'Switch preview quality to Fast. Exports always use full quality.'),
        h('dt', null, 'MP4 export is not available'), h('dd', null, 'Use Chrome or Edge on a computer, or export the project and render with Claude Code.'),
        h('dt', null, 'I see PLACEHOLDER images'), h('dd', null, 'That template needs more photos. Add them on the Content step, or remove the scene on Polish.'),
        h('dt', null, 'Start over'), h('dd', null, 'Use Reset in the top bar. Saved projects stay in Projects.'))),
    sec('Keyboard', h('p', null, h('span', { class: 'kbd' }, 'Space'), ' play or pause · ', h('span', { class: 'kbd' }, '←'), ' ', h('span', { class: 'kbd' }, '→'), ' step half a second on the timeline')),
  ];
}
