export function getIconForEvent(event: string, domain?: string): string | undefined {
  const eventLower = event.toLowerCase();

  if (domain === 'economics' ||
      eventLower.includes('gold') ||
      eventLower.includes('economic') ||
      eventLower.includes('market') ||
      eventLower.includes('trade') ||
      eventLower.includes('price')) {
    return '/data/gold.png';
  }

  if (domain === 'geopolitics' ||
      eventLower.includes('war') ||
      eventLower.includes('conflict') ||
      eventLower.includes('military') ||
      eventLower.includes('invasion') ||
      eventLower.includes('attack')) {
    return '/data/war.png';
  }

  return undefined;
}
