#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const sharp = require('sharp');
const exifr = require('exifr');
const DayOneApiExporter = require('../lib/dayOneApiExporter');

class DayOneProcessor {
  constructor() {
    this.email = process.env.DAYONE_EMAIL;
    this.password = process.env.DAYONE_PASSWORD;
    this.journalName = process.env.DAYONE_JOURNAL_ID || 'Blog Public';
    this.processedEntriesPath = path.join(__dirname, '..', 'data', 'processed.json');
    this.postsDir = path.join(__dirname, '..', 'posts');
    this.imagesDir = path.join(__dirname, '..', 'public', 'images');
    
    this.ensureDirectories();
    this.processedEntries = this.loadProcessedEntries();
    this.apiExporter = new DayOneApiExporter();
  }

  ensureDirectories() {
    const dirs = [
      path.dirname(this.processedEntriesPath),
      this.postsDir,
      this.imagesDir
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadProcessedEntries() {
    if (fs.existsSync(this.processedEntriesPath)) {
      return JSON.parse(fs.readFileSync(this.processedEntriesPath, 'utf8'));
    }
    return {};
  }

  saveProcessedEntries() {
    fs.writeFileSync(
      this.processedEntriesPath, 
      JSON.stringify(this.processedEntries, null, 2)
    );
  }

  async fetchDayOneEntries() {
    try {
      console.log('🚀 Starting Day One API export...');
      
      // Export journal using API
      const exportFile = await this.apiExporter.exportJournal();
      console.log(`✅ Export file created: ${exportFile}`);
      
      // Parse the export
      const entries = await this.apiExporter.extractAndParseExport(exportFile);
      console.log(`✅ Found ${entries.length} entries`);
      
      // Filter out already processed entries
      const newEntries = entries.filter(entry => {
        const lastModified = entry.modifiedDate || entry.creationDate;
        return !this.processedEntries[entry.uuid] || 
               this.processedEntries[entry.uuid].lastModified < lastModified;
      });
      
      console.log(`Found ${newEntries.length} new/updated entries to process`);
      return newEntries;
      
    } catch (error) {
      console.error('Error in Day One API export:', error);
      throw error;
    }
  }

  async processEntry(entry) {
    const uuid = entry.uuid;
    const lastModified = entry.modifiedDate || entry.creationDate;
    
    // Check if entry needs processing
    if (this.processedEntries[uuid] && 
        this.processedEntries[uuid].lastModified >= lastModified) {
      console.log(`Skipping unchanged entry: ${entry.title || uuid}`);
      return;
    }

    console.log(`Processing entry: ${entry.title || uuid}`);

    try {
      // Process content
      const processedContent = await this.processContent(entry);
      const processedImages = await this.processImages(entry);
      const processedLinks = await this.processLinks(entry);

      // Generate frontmatter and markdown
      const frontmatter = this.generateFrontmatter(entry, processedImages);
      const markdown = this.generateMarkdown(processedContent, processedLinks);
      
      // Write post file
      const postPath = this.generatePostPath(entry);
      this.writePost(postPath, frontmatter, markdown);

      // Update processed entries
      this.processedEntries[uuid] = {
        lastModified,
        postPath,
        title: entry.title,
        processedAt: new Date().toISOString()
      };

      console.log(`Successfully processed: ${entry.title || uuid}`);
      
    } catch (error) {
      console.error(`Error processing entry ${uuid}:`, error);
      await this.createGitHubIssue(`Processing Error for Entry: ${entry.title || uuid}`, error);
      throw error;
    }
  }

  async processContent(entry) {
    // Convert Day One markdown content
    let content = entry.text || '';
    
    // Process Day One image references
    content = content.replace(/!\[\]\(dayone-moment:\/\/([A-F0-9]+)\)/g, (match, momentId) => {
      // Find corresponding attachment
      const attachment = entry.attachments?.find(att => att.identifier === momentId);
      if (attachment) {
        const date = new Date(entry.creationDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const imagePath = `images/${year}/${month}/${attachment.filename}`;
        return `![Image](${imagePath})`;
      }
      return match;
    });

    // Remove title from content if it's the first line (to avoid duplication in frontmatter)
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    
    // If first line looks like a title (not a header, image, or URL), remove it from content
    if (firstLine && !firstLine.startsWith('#') && !firstLine.startsWith('!') && !firstLine.startsWith('http')) {
      content = lines.slice(1).join('\n').trim();
    }

    return content;
  }

  async processImages(entry) {
    const processedImages = [];
    
    if (!entry.attachments || entry.attachments.length === 0) {
      return processedImages;
    }

    for (const attachment of entry.attachments) {
      try {
        const imageInfo = await this.processAttachment(attachment, entry);
        processedImages.push(imageInfo);
      } catch (error) {
        console.error(`Error processing attachment ${attachment.identifier}:`, error);
        await this.createGitHubIssue(
          `Image Processing Error: ${attachment.identifier}`, 
          error
        );
      }
    }

    return processedImages;
  }

  async processAttachment(attachment, entry) {
    const date = new Date(entry.creationDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const imageDir = path.join(this.imagesDir, String(year), month);
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const filename = attachment.filename;
    const imagePath = path.join(imageDir, filename);
    const relativePath = `images/${year}/${month}/${filename}`;

    // Copy image from download directory to final location
    const downloadPath = path.join('/tmp/dayone-downloads', filename);
    if (fs.existsSync(downloadPath)) {
      console.log(`Processing image: ${filename}`);
      
      try {
        // Strip EXIF data and optimize image
        await sharp(downloadPath)
          .rotate() // Auto-rotate based on EXIF
          .jpeg({ quality: 90 })
          .toFile(imagePath);
        
        console.log(`✅ Processed and saved: ${relativePath}`);
      } catch (error) {
        console.warn(`Failed to process with Sharp, copying directly: ${error.message}`);
        fs.copyFileSync(downloadPath, imagePath);
      }
    } else {
      console.warn(`⚠️  Attachment file not found: ${downloadPath}`);
    }

    return {
      filename,
      path: relativePath,
      altText: '',
      originalId: attachment.identifier
    };
  }

  async processLinks(entry) {
    // Extract and process links from markdown content
    const content = entry.text || '';
    const links = [];
    
    // Simple regex to find URLs in markdown content
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const matches = content.match(urlRegex) || [];
    
    for (const url of matches) {
      links.push({
        original: url,
        cleaned: this.cleanUrl(url),
        text: url
      });
    }

    return links;
  }

  cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Remove tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'twclid',
        'ref', 'source', 'campaign'
      ];

      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      // Clean Amazon URLs
      if (urlObj.hostname.includes('amazon.')) {
        const pathParts = urlObj.pathname.split('/');
        const dpIndex = pathParts.indexOf('dp');
        if (dpIndex !== -1 && pathParts[dpIndex + 1]) {
          urlObj.pathname = `/dp/${pathParts[dpIndex + 1]}/`;
          urlObj.search = '';
        }
      }

      return urlObj.toString();
    } catch (error) {
      console.warn(`Failed to clean URL: ${url}`, error);
      return url;
    }
  }

  generateFrontmatter(entry, images) {
    // Extract title from first line or use default
    const content = entry.text || '';
    const firstLine = content.split('\n')[0].trim();
    
    // Use first line as title if it's not empty, otherwise fallback to entry.title or 'Untitled'
    let title = firstLine;
    if (!title || title.startsWith('!') || title.startsWith('http')) {
      // Skip if first line is empty, an image, or a URL
      const lines = content.split('\n').filter(line => line.trim());
      title = lines.find(line => !line.startsWith('!') && !line.startsWith('http') && line.trim()) || entry.title || 'Untitled';
    }
    
    // Remove markdown headers if present
    if (title.startsWith('#')) {
      title = title.replace(/^#+\s*/, '');
    }
    
    return {
      title: title,
      publishDate: new Date(entry.creationDate).toISOString(),
      editDate: new Date(entry.modifiedDate || entry.creationDate).toISOString(),
      uuid: entry.uuid,
      tags: entry.tags || [],
      images: images.map(img => img.filename),
      location: entry.location ? {
        name: entry.location.placeName || entry.location.localityName,
        coordinates: [entry.location.longitude, entry.location.latitude]
      } : null,
      weather: entry.weather ? {
        description: entry.weather.description,
        temperature: entry.weather.tempCelsius
      } : null
    };
  }


  generateMarkdown(content, links) {
    // Replace original links with cleaned versions
    let processedContent = content;
    
    links.forEach(link => {
      if (link.original !== link.cleaned) {
        processedContent = processedContent.replace(link.original, link.cleaned);
      }
    });

    return processedContent;
  }

  generatePostPath(entry) {
    // Extract title the same way we do in generateFrontmatter
    const content = entry.text || '';
    const firstLine = content.split('\n')[0].trim();
    let title = firstLine;
    if (!title || title.startsWith('!') || title.startsWith('http')) {
      const lines = content.split('\n').filter(line => line.trim());
      title = lines.find(line => !line.startsWith('!') && !line.startsWith('http') && line.trim()) || entry.title || 'untitled';
    }
    if (title.startsWith('#')) {
      title = title.replace(/^#+\s*/, '');
    }
    
    const slug = this.generateSlug(title);
    
    // Simple flat structure - all posts in posts directory
    return path.join(this.postsDir, `${slug}.md`);
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  writePost(postPath, frontmatter, content) {
    const dir = path.dirname(postPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileContent = matter.stringify(content, frontmatter);
    fs.writeFileSync(postPath, fileContent);
  }

  async createGitHubIssue(title, error) {
    // In GitHub Actions, this would use the GitHub API
    console.error(`Would create GitHub issue: ${title}`, error);
  }

  async run() {
    try {
      console.log('🚀 Starting Day One processing...');
      
      const entries = await this.fetchDayOneEntries();
      console.log(`Found ${entries.length} entries to process`);

      if (entries.length === 0) {
        console.log('✅ No new entries to process');
        return;
      }

      // Process new entries
      for (const entry of entries) {
        await this.processEntry(entry);
      }

      this.saveProcessedEntries();
      console.log('✅ Day One processing completed successfully');
      
    } catch (error) {
      console.error('❌ Day One processing failed:', error);
      await this.createGitHubIssue('Day One Processing Failed', error);
      process.exit(1);
    } finally {
      // Cleanup
      if (this.apiExporter) {
        this.apiExporter.cleanup();
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  const processor = new DayOneProcessor();
  processor.run();
}

module.exports = DayOneProcessor;