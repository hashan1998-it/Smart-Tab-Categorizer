/**
 * Shared application constants
 */

export const EXTENSION_NAME = 'Tabulo';
export const VERSION = '1.0.0';

export const CATEGORIES = {
  DEVELOPMENT: 'development',
  SOCIAL: 'social',
  PRODUCTIVITY: 'productivity',
  ENTERTAINMENT: 'entertainment',
  SHOPPING: 'shopping',
  NEWS: 'news',
  REFERENCE: 'reference',
  OTHER: 'other'
};

export const CATEGORY_ICONS = {
  [CATEGORIES.DEVELOPMENT]: '💻',
  [CATEGORIES.SOCIAL]: '🌐',
  [CATEGORIES.PRODUCTIVITY]: '📋',
  [CATEGORIES.ENTERTAINMENT]: '🎥',
  [CATEGORIES.SHOPPING]: '🛒',
  [CATEGORIES.NEWS]: '📰',
  [CATEGORIES.REFERENCE]: '📚',
  [CATEGORIES.OTHER]: '📁'
};

export const CATEGORY_ORDER = [
  CATEGORIES.DEVELOPMENT,
  CATEGORIES.SOCIAL,
  CATEGORIES.PRODUCTIVITY,
  CATEGORIES.ENTERTAINMENT,
  CATEGORIES.SHOPPING,
  CATEGORIES.NEWS,
  CATEGORIES.REFERENCE,
  CATEGORIES.OTHER
];

export const CATEGORY_RULES = {
  [CATEGORIES.DEVELOPMENT]: {
    domains: [
      'github.com',
      'stackoverflow.com',
      'developer.mozilla.org',
      'codepen.io',
      'gitlab.com',
      'bitbucket.org',
      'dev.to'
    ],
    keywords: [
      'api',
      'documentation',
      'code',
      'programming',
      'developer',
      'tutorial',
      'debug'
    ],
    weight: 1.0
  },
  [CATEGORIES.SOCIAL]: {
    domains: [
      'twitter.com',
      'facebook.com',
      'linkedin.com',
      'instagram.com',
      'reddit.com',
      'discord.com',
      'tiktok.com'
    ],
    keywords: ['social', 'post', 'feed', 'follow', 'chat', 'messenger'],
    weight: 0.9
  },
  [CATEGORIES.PRODUCTIVITY]: {
    domains: [
      'google.com/drive',
      'docs.google.com',
      'notion.so',
      'trello.com',
      'slack.com',
      'zoom.us',
      'asana.com',
      'monday.com'
    ],
    keywords: ['task', 'project', 'document', 'meeting', 'calendar', 'email'],
    weight: 0.8
  },
  [CATEGORIES.ENTERTAINMENT]: {
    domains: [
      'youtube.com',
      'netflix.com',
      'spotify.com',
      'twitch.tv',
      'hulu.com',
      'disneyplus.com'
    ],
    keywords: ['video', 'music', 'stream', 'movie', 'series', 'podcast'],
    weight: 0.7
  },
  [CATEGORIES.SHOPPING]: {
    domains: [
      'amazon.com',
      'ebay.com',
      'etsy.com',
      'walmart.com',
      'target.com',
      'aliexpress.com'
    ],
    keywords: ['shop', 'store', 'cart', 'checkout', 'buy', 'order'],
    weight: 0.6
  },
  [CATEGORIES.NEWS]: {
    domains: [
      'cnn.com',
      'bbc.com',
      'reuters.com',
      'nytimes.com',
      'theguardian.com',
      'news.google.com'
    ],
    keywords: ['news', 'breaking', 'latest', 'article', 'report'],
    weight: 0.6
  },
  [CATEGORIES.REFERENCE]: {
    domains: ['wikipedia.org', 'britannica.com', 'scholar.google.com'],
    keywords: [
      'wiki',
      'reference',
      'tutorial',
      'how to',
      'guide',
      'research',
      'study'
    ],
    weight: 0.6
  },
  [CATEGORIES.OTHER]: {
    domains: [],
    keywords: [],
    weight: 0.1
  }
};

export const MESSAGE_TYPES = {
  // Background to UI
  PING: 'ping',
  GET_ALL_TABS: 'getAllTabs',
  REFRESH_TABS: 'refreshTabs',
  FOCUS_TAB: 'focusTab',
  CLOSE_TAB: 'closeTab',
  MOVE_TABS: 'moveTabs',
  REORDER_TABS: 'reorderTabs',
  
  // Events
  BACKGROUND_EVENT: 'backgroundEvent',
  TAB_CREATED: 'tabCreated',
  TAB_UPDATED: 'tabUpdated',
  TAB_REMOVED: 'tabRemoved',
  TABS_MOVED: 'tabsMoved',
  TABS_REORDERED: 'tabsReordered'
};

export const STORAGE_KEYS = {
  TABS: 'tabs',
  SETTINGS: 'settings',
  CATEGORY_RULES: 'categoryRules',
  LAST_UPDATED: 'lastUpdated'
};

export const DEFAULT_SETTINGS = {
  autoOrganize: true,
  showNotifications: true,
  theme: 'light',
  categorization: 'auto'
};

export const DEBOUNCE_DELAYS = {
  SEARCH: 300,
  STORAGE_SAVE: 500,
  UI_UPDATE: 100
};

export const LIMITS = {
  MAX_TABS_PER_CATEGORY: 100,
  MAX_CUSTOM_RULES: 50,
  KEYWORD_THRESHOLD: 2,
  MIN_SCORE_THRESHOLD: 0.5
};

export const ANIMATION_DURATIONS = {
  SHORT: 150,
  MEDIUM: 300,
  LONG: 500
};

export const ERROR_MESSAGES = {
  INIT_FAILED: 'Failed to initialize extension',
  LOAD_TABS_FAILED: 'Failed to load tabs',
  SAVE_FAILED: 'Failed to save data',
  FOCUS_TAB_FAILED: 'Failed to focus tab',
  CLOSE_TAB_FAILED: 'Failed to close tab',
  BACKGROUND_NOT_READY: 'Background script not ready'
};

export const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};