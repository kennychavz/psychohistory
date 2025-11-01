/**
 * Dynamic icon selection using GPT-4-mini
 * Selects the most appropriate icon based on event content
 */

import { HuggingFaceClient } from './huggingface-client';

const iconSelectorClient = new HuggingFaceClient({
  model: 'Qwen/Qwen2.5-72B-Instruct',
  temperature: 0.3,
  maxTokens: 10,
});

// Available icons in /public/data/
const AVAILABLE_ICONS = [
  { name: 'economy', path: '/data/economy.svg', description: 'Economic, financial, market, trade, monetary topics' },
  { name: 'geopolitics', path: '/data/geopolitics.svg', description: 'War, conflict, international relations, diplomacy, military' },
  { name: 'technology', path: '/data/technology.svg', description: 'Technology, innovation, AI, digital, computing, automation' },
  { name: 'social', path: '/data/social.svg', description: 'Social issues, culture, demographics, society, human behavior' },
  { name: 'environment', path: '/data/environment.svg', description: 'Environment, climate, sustainability, ecology, nature' },
  { name: 'policy', path: '/data/policy.svg', description: 'Policy, governance, regulation, law, government actions' },
];

/**
 * Select the most appropriate icon for an event using GPT-4-mini
 */
export async function selectIconForEvent(eventText: string): Promise<string | undefined> {
  try {
    const prompt = `You are an icon selector. Given an event description, choose the most appropriate icon category.

Available icons:
${AVAILABLE_ICONS.map(icon => `- ${icon.name}: ${icon.description}`).join('\n')}

Respond with ONLY the icon name (economy, geopolitics, technology, social, environment, or policy). No explanation.

Event: ${eventText}`;

    const response = await iconSelectorClient.complete(prompt);
    const iconName = response.trim().toLowerCase();
    const selectedIcon = AVAILABLE_ICONS.find(icon => icon.name === iconName);

    if (selectedIcon) {
      console.log(`🎨 Selected icon "${selectedIcon.name}" for: ${eventText.substring(0, 60)}...`);
      return selectedIcon.path;
    }

    console.warn(`⚠️ Invalid icon selection: "${iconName}" for event: ${eventText.substring(0, 60)}...`);
    return undefined;
  } catch (error) {
    console.error('Error selecting icon:', error);
    return undefined;
  }
}

/**
 * Batch select icons for multiple events (more efficient)
 */
export async function selectIconsForEvents(events: string[]): Promise<Map<string, string>> {
  const iconMap = new Map<string, string>();

  // Process sequentially to avoid rate limits
  for (const event of events) {
    const iconPath = await selectIconForEvent(event);
    if (iconPath) {
      iconMap.set(event, iconPath);
    }
  }

  return iconMap;
}
