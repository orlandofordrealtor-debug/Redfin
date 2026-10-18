// Registry of scene types. Stories are sequences of these; users can add, remove and reorder them.
import intro from './intro.js';
import hero from './hero.js';
import portrait from './portrait.js';
import gallery from './gallery.js';
import property from './property.js';
import stats from './stats.js';
import chart from './chart.js';
import leaderboard from './leaderboard.js';
import list from './list.js';
import quote from './quote.js';
import screenshot from './screenshot.js';
import timeline from './timeline.js';
import message from './message.js';
import endcard from './endcard.js';

export const SCENES = {};
[intro, hero, portrait, gallery, property, stats, chart, leaderboard, list, quote, screenshot, timeline, message, endcard].forEach(s => { SCENES[s.type] = s; });

export const SCENE_ORDER = Object.keys(SCENES);

export function registerScene(s) { SCENES[s.type] = s; if (!SCENE_ORDER.includes(s.type)) SCENE_ORDER.push(s.type); }
