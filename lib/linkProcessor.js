const axios = require('axios');
const cheerio = require('cheerio');

class LinkProcessor {
  constructor() {
    this.trackingParams = [
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
    ];

    this.amazonPatterns = [
      /\/dp\/([A-Z0-9]{10})/,
      /\/gp\/product\/([A-Z0-9]{10})/,
      /\/product\/([A-Z0-9]{10})/
    ];
  }

  async processLinks(content) {
    const $ = cheerio.load(content);
    const links = [];
    const processedLinks = new Map();

    // Extract all links
    $('a').each((i, elem) => {
      const $link = $(elem);
      const originalUrl = $link.attr('href');
      const text = $link.text().trim();

      if (originalUrl && originalUrl.startsWith('http')) {
        links.push({
          element: $link,
          originalUrl,
          text,
          index: i
        });
      }
    });

    // Process each unique URL
    for (const link of links) {
      if (!processedLinks.has(link.originalUrl)) {
        try {
          const processed = await this.processUrl(link.originalUrl);
          processedLinks.set(link.originalUrl, processed);
        } catch (error) {
          console.warn(`Failed to process URL ${link.originalUrl}:`, error.message);
          processedLinks.set(link.originalUrl, {
            cleanedUrl: link.originalUrl,
            wasExpanded: false,
            wasCleaned: false,
            error: error.message
          });
        }
      }

      // Update the link in the content
      const processed = processedLinks.get(link.originalUrl);
      if (processed.cleanedUrl !== link.originalUrl) {
        link.element.attr('href', processed.cleanedUrl);
      }
    }

    return {
      processedContent: $.html(),
      linkChanges: Array.from(processedLinks.entries()).map(([original, processed]) => ({
        original,
        cleaned: processed.cleanedUrl,
        changes: {
          expanded: processed.wasExpanded,
          cleaned: processed.wasCleaned,
          trackingRemoved: processed.trackingRemoved || []
        }
      }))
    };
  }

  async processUrl(url) {
    let currentUrl = url;
    let wasExpanded = false;
    let wasCleaned = false;
    let trackingRemoved = [];

    try {
      // First, expand shortened URLs
      if (this.isShortenedUrl(currentUrl)) {
        const expanded = await this.expandUrl(currentUrl);
        if (expanded !== currentUrl) {
          currentUrl = expanded;
          wasExpanded = true;
        }
      }

      // Then clean the URL
      const cleaned = this.cleanUrl(currentUrl);
      if (cleaned.url !== currentUrl) {
        currentUrl = cleaned.url;
        wasCleaned = true;
        trackingRemoved = cleaned.removedParams;
      }

      return {
        cleanedUrl: currentUrl,
        wasExpanded,
        wasCleaned,
        trackingRemoved
      };

    } catch (error) {
      console.warn(`Error processing URL ${url}:`, error.message);
      return {
        cleanedUrl: url,
        wasExpanded: false,
        wasCleaned: false,
        error: error.message
      };
    }
  }

  isShortenedUrl(url) {
    const shorteners = [
      'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
      'short.link', 'tiny.cc', 'is.gd', 'buff.ly',
      'amzn.to', 'amzn.com', 'amazon.com/dp'
    ];

    return shorteners.some(domain => url.includes(domain));
  }

  async expandUrl(url, maxRedirects = 10) {
    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount < maxRedirects) {
      try {
        const response = await axios.head(currentUrl, {
          maxRedirects: 0,
          validateStatus: status => status < 400,
          timeout: 10000,
          headers: {
            'User-Agent': 'DayOne-Blog-Automation/1.0'
          }
        });

        // If no redirect, we're done
        if (response.status < 300 || response.status >= 400) {
          break;
        }

        // Follow redirect
        const location = response.headers.location;
        if (!location) {
          break;
        }

        // Handle relative redirects
        currentUrl = new URL(location, currentUrl).toString();
        redirectCount++;

      } catch (error) {
        // If it's a redirect error, try to get the location
        if (error.response && error.response.headers.location) {
          currentUrl = new URL(error.response.headers.location, currentUrl).toString();
          redirectCount++;
        } else {
          console.warn(`Failed to expand URL ${currentUrl}:`, error.message);
          break;
        }
      }
    }

    return currentUrl;
  }

  cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      const removedParams = [];

      // Remove tracking parameters
      this.trackingParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.delete(param);
          removedParams.push(param);
        }
      });

      // Special handling for different domains
      if (urlObj.hostname.includes('amazon.')) {
        const amazonResult = this.cleanAmazonUrl(urlObj);
        return {
          url: amazonResult.url,
          removedParams: [...removedParams, ...amazonResult.removedParams]
        };
      }

      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        const youtubeResult = this.cleanYouTubeUrl(urlObj);
        return {
          url: youtubeResult.url,
          removedParams: [...removedParams, ...youtubeResult.removedParams]
        };
      }

      return {
        url: urlObj.toString(),
        removedParams
      };

    } catch (error) {
      console.warn(`Failed to clean URL: ${url}`, error);
      return {
        url,
        removedParams: []
      };
    }
  }

  cleanAmazonUrl(urlObj) {
    const removedParams = [];

    // Extract product ID using patterns
    let productId = null;
    for (const pattern of this.amazonPatterns) {
      const match = urlObj.pathname.match(pattern);
      if (match) {
        productId = match[1];
        break;
      }
    }

    if (productId) {
      // Create clean Amazon URL
      urlObj.pathname = `/dp/${productId}/`;
      urlObj.search = '';
      removedParams.push('affiliate-tags', 'tracking-params');
    } else {
      // Just remove known Amazon tracking params
      const amazonTrackingParams = [
        'tag', 'linkCode', 'creativeASIN', 'linkId',
        'ref', 'ref_', 'pf_rd_p', 'pf_rd_r', 'pf_rd_s',
        'ie', 'qid', 'sr', 'keywords'
      ];

      amazonTrackingParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.delete(param);
          removedParams.push(param);
        }
      });
    }

    return {
      url: urlObj.toString(),
      removedParams
    };
  }

  cleanYouTubeUrl(urlObj) {
    const removedParams = [];
    const keepParams = ['v', 't', 'list', 'index'];

    // Get all current params
    const allParams = Array.from(urlObj.searchParams.keys());
    
    // Remove everything except essential params
    allParams.forEach(param => {
      if (!keepParams.includes(param)) {
        urlObj.searchParams.delete(param);
        removedParams.push(param);
      }
    });

    return {
      url: urlObj.toString(),
      removedParams
    };
  }

  async archiveUrl(url) {
    try {
      const archiveUrl = `https://web.archive.org/save/${encodeURIComponent(url)}`;
      
      const response = await axios.post(archiveUrl, {}, {
        timeout: 30000,
        headers: {
          'User-Agent': 'DayOne-Blog-Automation/1.0'
        }
      });

      if (response.status === 200) {
        console.log(`Archived URL: ${url}`);
        return true;
      }

    } catch (error) {
      console.warn(`Failed to archive URL ${url}:`, error.message);
    }

    return false;
  }

  async extractLinkMetadata(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'DayOne-Blog-Automation/1.0'
        }
      });

      const $ = cheerio.load(response.data);

      return {
        title: $('title').text().trim() || 
               $('meta[property="og:title"]').attr('content') ||
               $('meta[name="twitter:title"]').attr('content'),
        
        description: $('meta[name="description"]').attr('content') ||
                    $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="twitter:description"]').attr('content'),
        
        image: $('meta[property="og:image"]').attr('content') ||
               $('meta[name="twitter:image"]').attr('content'),
        
        siteName: $('meta[property="og:site_name"]').attr('content')
      };

    } catch (error) {
      console.warn(`Failed to extract metadata from ${url}:`, error.message);
      return null;
    }
  }
}

module.exports = LinkProcessor;