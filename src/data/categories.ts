/**
 * Predefined first-layer categories for event tree analysis
 */

export interface Category {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  promptContext: string; // Context to help LLM generate relevant outcomes
}

export const FIRST_LAYER_CATEGORIES: Category[] = [
  {
    id: 'economy',
    name: 'Economic Impact',
    description: 'Effects on markets, trade, prices, and financial systems',
    iconUrl: '/data/economy.svg',
    promptContext: 'economic consequences, market effects, financial impacts, trade implications, price changes, fiscal outcomes',
  },
  {
    id: 'geopolitics',
    name: 'Geopolitical Consequences',
    description: 'International relations, conflicts, alliances, and power dynamics',
    iconUrl: '/data/geopolitics.svg',
    promptContext: 'geopolitical shifts, international relations, military implications, diplomatic consequences, alliance changes, power dynamics',
  },
  {
    id: 'technology',
    name: 'Technological Development',
    description: 'Innovation, technological advancement, and digital transformation',
    iconUrl: '/data/technology.svg',
    promptContext: 'technological innovation, digital transformation, tech adoption, automation impacts, AI/ML developments, infrastructure changes',
  },
  {
    id: 'social',
    name: 'Social & Cultural Impact',
    description: 'Effects on society, culture, demographics, and human behavior',
    iconUrl: '/data/social.svg',
    promptContext: 'social changes, cultural shifts, demographic impacts, public opinion, behavioral changes, societal trends',
  },
  {
    id: 'environment',
    name: 'Environmental Effects',
    description: 'Climate, sustainability, natural resources, and ecological impact',
    iconUrl: '/data/environment.svg',
    promptContext: 'environmental impact, climate effects, sustainability outcomes, resource implications, ecological consequences, green transitions',
  },
  {
    id: 'policy',
    name: 'Policy & Governance',
    description: 'Regulatory changes, government actions, and institutional responses',
    iconUrl: '/data/policy.svg',
    promptContext: 'policy responses, regulatory changes, government actions, institutional reforms, legal implications, governance shifts',
  },
];
