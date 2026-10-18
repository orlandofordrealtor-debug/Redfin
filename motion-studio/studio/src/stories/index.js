// Registry of story templates: ready-made frameworks people pick and fill in.
import anniversary from './anniversary.js';
import showcase from './showcase.js';

export const STORIES = {};
export const STORY_ORDER = [];

export function registerStory(story) {
  STORIES[story.id] = story;
  if (!STORY_ORDER.includes(story.id)) STORY_ORDER.push(story.id);
}

[anniversary, showcase].forEach(registerStory);
