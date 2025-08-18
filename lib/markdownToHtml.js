import { marked } from 'marked'

export async function markdownToHtml(markdown) {
  // Ensure markdown is a string
  if (typeof markdown !== 'string') {
    console.warn('markdownToHtml received non-string input:', typeof markdown, markdown);
    return '';
  }

  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false, // Be careful with this in production
    smartLists: true,
    smartypants: true
  })

  // Custom renderer for images to add proper classes
  const renderer = new marked.Renderer()
  
  renderer.image = function(href, title, text) {
    // Ensure all parameters are strings
    href = String(href || '');
    title = String(title || '');
    text = String(text || '');
    
    // Add leading slash for images
    if (href.startsWith('images/')) {
      href = '/' + href;
    }
    
    return `<img src="${href}" alt="${text}" title="${title}" class="post-image" loading="lazy" />`;
  }
  
  renderer.link = function(href, title, text) {
    // Ensure all parameters are strings
    href = String(href || '');
    title = String(title || '');
    text = String(text || '');
    
    const isExternal = href.startsWith('http') && !href.includes(process.env.NEXT_PUBLIC_SITE_URL || '')
    const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
    const titleAttr = title ? ` title="${title}"` : ''
    
    return `<a href="${href}"${titleAttr}${target}>${text}</a>`
  }
  
  renderer.code = function(code, language) {
    code = String(code || '');
    const validLanguage = language && /^[a-zA-Z0-9_+-]*$/.test(language) ? language : ''
    return `<pre><code class="language-${validLanguage}">${code}</code></pre>`
  }
  
  marked.use({ renderer })
  
  try {
    const result = marked(markdown)
    return result
  } catch (error) {
    console.error('Error parsing markdown:', error);
    console.error('Markdown input:', markdown);
    return `<p>Error rendering content: ${error.message}</p>`;
  }
}