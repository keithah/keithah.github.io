import { marked } from 'marked'

export async function markdownToHtml(markdown) {
  // Ensure markdown is a string
  if (typeof markdown !== 'string') {
    console.warn('markdownToHtml received non-string input:', typeof markdown, markdown);
    return '';
  }

  // Configure marked options for v14+
  marked.use({
    breaks: true,
    gfm: true,
    renderer: {
      image(token) {
        const href = String(token.href || '');
        const title = String(token.title || '');
        const text = String(token.text || 'Image');
        
        // Add leading slash for images if needed
        let finalHref = href;
        if (href.startsWith('images/')) {
          finalHref = '/' + href;
        }
        
        return `<img src="${finalHref}" alt="${text}" title="${title}" class="post-image" loading="lazy" />`;
      },
      
      link(token) {
        const href = String(token.href || '');
        const title = String(token.title || '');
        const text = String(token.text || '');
        
        const isExternal = href.startsWith('http') && !href.includes(process.env.NEXT_PUBLIC_SITE_URL || '')
        const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
        const titleAttr = title ? ` title="${title}"` : ''
        
        return `<a href="${href}"${titleAttr}${target}>${text}</a>`
      },
      
      code(token) {
        const code = String(token.text || '');
        const language = String(token.lang || '');
        const validLanguage = language && /^[a-zA-Z0-9_+-]*$/.test(language) ? language : ''
        return `<pre><code class="language-${validLanguage}">${code}</code></pre>`
      }
    }
  })
  
  try {
    const result = marked(markdown)
    return result
  } catch (error) {
    console.error('Error parsing markdown:', error);
    console.error('Markdown input:', markdown);
    return `<p>Error rendering content: ${error.message}</p>`;
  }
}