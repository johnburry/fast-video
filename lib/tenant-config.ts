export interface TenantConfig {
  name: string;
  domain: string;
  logo: {
    type: 'text' | 'image';
    text?: string;
    imageUrl?: string;
    altText: string;
  };
  tagline?: string;
  searchPlaceholder: string;
  searchResultsHeading: string;
  features?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  colors?: {
    primary: string;
    secondary: string;
  };
}

const tenantConfigs: Record<string, TenantConfig> = {
  'playsermons.com': {
    name: 'Play Sermons',
    domain: 'playsermons.com',
    logo: {
      type: 'image',
      imageUrl: '/logo.svg',
      altText: 'Play Sermons',
    },
    tagline: 'Search and discover sermons from churches worldwide',
    searchPlaceholder: 'Search all churches',
    searchResultsHeading: 'Searching across all church sermons',
    features: [
      {
        icon: '🎯',
        title: 'Precise Search',
        description: 'Find exact moments in sermons with AI-powered search',
      },
      {
        icon: '⚡',
        title: 'Instant Results',
        description: 'Get results in milliseconds, not minutes',
      },
      {
        icon: '📱',
        title: 'Watch & Share',
        description: 'Start videos at the exact moment you searched for',
      },
    ],
  },
  'fast.video': {
    name: 'Fast.Video',
    domain: 'fast.video',
    logo: {
      type: 'text',
      text: 'Fast.Video',
      altText: 'Fast.Video',
    },
    searchPlaceholder: 'Search all videos',
    searchResultsHeading: 'Searching videos across all channels',
  },
};

export function getTenantConfig(hostname?: string): TenantConfig {
  if (!hostname) {
    if (typeof window !== 'undefined') {
      hostname = window.location.hostname;
    } else {
      // Default to playsermons.com for SSR
      return tenantConfigs['playsermons.com'];
    }
  }

  // Remove port if present (e.g., localhost:3000)
  const domain = hostname.split(':')[0];

  // Check for exact match
  if (tenantConfigs[domain]) {
    return tenantConfigs[domain];
  }

  // Check for subdomain matches (e.g., www.playsermons.com)
  for (const [configDomain, config] of Object.entries(tenantConfigs)) {
    if (domain.endsWith(configDomain)) {
      return config;
    }
  }

  // Default to playsermons.com
  return tenantConfigs['playsermons.com'];
}

// Hook for client-side usage
export function useTenantConfig(): TenantConfig {
  if (typeof window === 'undefined') {
    return tenantConfigs['playsermons.com'];
  }
  return getTenantConfig(window.location.hostname);
}
