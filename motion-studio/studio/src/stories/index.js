// Registry of story templates: ready-made frameworks people pick and fill in.
import anniversary from './anniversary.js';
import showcase from './showcase.js';
import { LISTING_STORIES } from './listing.js';
import { agentSpotlight, teamWins, newReview } from './celebrate.js';
import { marketUpdate, dashboardRecap, leaderboardStory } from './data.js';
import { processExplainer, clientJourney, rocketExplainer } from './teach.js';
import { meetingOpener, recruiting, eventPromo } from './lead.js';

export const STORIES = {};
export const STORY_ORDER = [];

export function registerStory(story) {
  STORIES[story.id] = story;
  if (!STORY_ORDER.includes(story.id)) STORY_ORDER.push(story.id);
}

export const CATEGORIES = ['Celebrate', 'Listings', 'Market & data', 'Teach', 'Lead & grow'];

[
  anniversary, agentSpotlight, teamWins, newReview,
  ...LISTING_STORIES,
  marketUpdate, dashboardRecap, leaderboardStory,
  processExplainer, clientJourney, rocketExplainer,
  meetingOpener, recruiting, eventPromo,
  showcase,
].forEach(registerStory);
