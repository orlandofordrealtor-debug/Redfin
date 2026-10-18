// Registry of looks. Each look is a visual world: backdrop, floor, lights, materials,
// palette (native + Redfin brand re-skin), post-processing and camera feel.
import brandGlass, { brandGlassNight } from './brand-glass.js';
import clay from './clay.js';
import glassStudio from './glass-studio.js';
import glassExplainer from './glass-explainer.js';
import globe from './globe.js';
import neighborhood from './neighborhood.js';
import luxury from './luxury.js';
import celebration from './celebration.js';
import newsroom from './newsroom.js';
import kinetic from './kinetic.js';
import architectural from './architectural.js';

export const LOOKS = {};
export const LOOK_ORDER = [];

export function registerLook(look) {
  LOOKS[look.id] = look;
  if (!LOOK_ORDER.includes(look.id)) LOOK_ORDER.push(look.id);
}

[brandGlass, brandGlassNight, clay, glassStudio, glassExplainer, globe, luxury, celebration, newsroom, kinetic, neighborhood, architectural].forEach(registerLook);
