// Blog configuration constants

export const CATEGORIES = {
  HARDWARE: 'hardware',
  SOFTWARE: 'software', 
  HACKING: 'hacking',
  PERSONAL: 'personal',
  HOMEAUTOMATION: 'homeautomation',
  TRAVEL: 'travel',
  FINANCE: 'finance',
  STR: 'str',
  BIZ: 'biz',
  AIDEV: 'aidev',
  PRODUCTMANAGEMENT: 'productmanagement',
  GENERAL: 'general'
}

export const TOP_LEVEL_CATEGORIES = [
  CATEGORIES.HARDWARE,
  CATEGORIES.SOFTWARE,
  CATEGORIES.HACKING,
  CATEGORIES.PERSONAL,
  CATEGORIES.HOMEAUTOMATION,
  CATEGORIES.TRAVEL,
  CATEGORIES.FINANCE,
  CATEGORIES.STR,
  CATEGORIES.BIZ,
  CATEGORIES.AIDEV,
  CATEGORIES.PRODUCTMANAGEMENT
]

export const DEFAULT_CATEGORY = CATEGORIES.GENERAL

export const IMAGE_CONFIG = {
  MAX_WIDTH: 1200,
  MAX_HEIGHT: 1200,
  QUALITY: 90,
  FORMAT: 'png',
  REMOVE_EXIF: true
}

export const PROCESSING_CONFIG = {
  GITHUB_ACTIONS_INTERVAL: '*/15 * * * *', // Every 15 minutes
  MAX_POSTS_PER_RUN: 50,
  IMAGE_TIMEOUT: 30000,
  LINK_TIMEOUT: 10000
}

export const URL_STRUCTURE = {
  POSTS: '/blog/[category]/[slug]',
  CATEGORY: '/blog/[category]',
  TAG: '/blog/tag/[tag]',
  IMAGES: '/images/[year]/[month]/[filename]'
}

export const TRACKING_PARAMS = [
  // UTM parameters
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform',
  
  // Social media tracking
  'fbclid', 'gclid', 'msclkid', 'twclid', 'li_fat_id',
  
  // General tracking
  'ref', 'source', 'campaign', 'medium', 'content',
  '_hsenc', '_hsmi', 'hsCtaTracking',
  
  // Email tracking
  'mc_cid', 'mc_eid',
  
  // Other common trackers
  'igshid', 'feature', 'app', 'si'
]

export const SHORTENED_URL_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
  'short.link', 'tiny.cc', 'is.gd', 'buff.ly',
  'amzn.to', 'amzn.com'
]

export const META_FIELDS = {
  REQUIRED: ['title', 'publishDate', 'uuid'],
  OPTIONAL: ['editDate', 'tags', 'category', 'images', 'excerpt'],
  COMPUTED: ['slug']
}