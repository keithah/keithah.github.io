import { getAllPosts } from './posts'

export function getAllTagsWithCounts() {
  const posts = getAllPosts(['tags'])
  const tagCounts = {}

  posts.forEach(post => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    }
  })

  return Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function getAllCategoriesWithCounts() {
  const posts = getAllPosts(['category'])
  const categoryCounts = {}

  posts.forEach(post => {
    const category = post.category || 'general'
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  })

  return Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function getRelatedPosts(currentPost, limit = 5) {
  if (!currentPost.tags || currentPost.tags.length === 0) {
    return []
  }

  const allPosts = getAllPosts(['title', 'slug', 'category', 'tags', 'publishDate', 'uuid'])
  
  // Filter out current post
  const otherPosts = allPosts.filter(post => post.uuid !== currentPost.uuid)
  
  // Calculate relevance score based on shared tags
  const scoredPosts = otherPosts.map(post => {
    if (!post.tags || post.tags.length === 0) {
      return { ...post, score: 0 }
    }

    const sharedTags = currentPost.tags.filter(tag => post.tags.includes(tag))
    const score = sharedTags.length / Math.max(currentPost.tags.length, post.tags.length)
    
    return { ...post, score, sharedTags }
  })

  // Sort by relevance score and return top results
  return scoredPosts
    .filter(post => post.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function categorizeTag(tag) {
  const topLevelCategories = ['hardware', 'software', 'hacking', 'personal', 'homeautomation', 'travel', 'finance', 'str', 'biz', 'aidev', 'productmanagement']
  const normalizedTag = tag.toLowerCase()
  
  if (topLevelCategories.includes(normalizedTag)) {
    return 'category'
  }
  
  return 'tag'
}

export function determinePostCategory(tags) {
  if (!tags || tags.length === 0) {
    return 'general'
  }

  const topLevelCategories = ['hardware', 'software', 'hacking', 'personal', 'homeautomation', 'travel', 'finance', 'str', 'biz', 'aidev', 'productmanagement']
  
  // Look for a top-level category in the tags
  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase()
    if (topLevelCategories.includes(normalizedTag)) {
      return normalizedTag
    }
  }
  
  return 'general'
}

export function getTagsByCategory() {
  const allTags = getAllTagsWithCounts()
  const categorized = {
    categories: [],
    tags: []
  }

  allTags.forEach(tag => {
    const type = categorizeTag(tag.name)
    categorized[type === 'category' ? 'categories' : 'tags'].push(tag)
  })

  return categorized
}

export function validateTags(tags) {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
    .map(tag => tag.trim().toLowerCase())
    .filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates
}

export function suggestTags(content, existingTags = []) {
  // Simple keyword extraction for tag suggestions
  const commonTechTerms = [
    'javascript', 'python', 'react', 'nextjs', 'nodejs', 'api',
    'database', 'mongodb', 'postgresql', 'docker', 'kubernetes',
    'aws', 'azure', 'gcp', 'linux', 'macos', 'windows',
    'ios', 'android', 'mobile', 'web', 'frontend', 'backend',
    'ai', 'ml', 'automation', 'devops', 'security', 'privacy'
  ]

  const contentLower = content.toLowerCase()
  const suggestions = []

  commonTechTerms.forEach(term => {
    if (contentLower.includes(term) && !existingTags.includes(term)) {
      suggestions.push(term)
    }
  })

  return suggestions.slice(0, 5) // Limit suggestions
}