#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

class DayOneProcessor {
  constructor() {
    this.postsDir = path.join(__dirname, '..', 'posts');
    this.imagesDir = path.join(__dirname, '..', 'public', 'images');
    this.dataFile = '/tmp/dayone-downloads/Journal.json';
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [this.postsDir, this.imagesDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  processContent(entry) {
    let content = entry.text || '';
    
    // Process Day One image references
    content = content.replace(/!\[\]\(dayone-moment:\/\/([A-F0-9]+)\)/g, (match, momentId) => {
      // Find corresponding attachment
      const attachment = entry.attachments?.find(att => att.identifier === momentId);
      if (attachment) {
        const date = new Date(entry.creationDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const imagePath = `/images/${year}/${month}/${attachment.filename}`;
        return `![Image](${imagePath})`;
      }
      return match;
    });

    // Clean up escaped characters from Day One export
    content = content.replace(/\\!/g, '!');
    content = content.replace(/\\-/g, '-');
    content = content.replace(/\\\_/g, '_');
    content = content.replace(/\\\./g, '.');
    
    // Remove title from content if it's the first line
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    
    // If first line looks like a title, remove it from content
    if (firstLine && !firstLine.startsWith('#') && !firstLine.startsWith('!') && !firstLine.startsWith('http')) {
      content = lines.slice(1).join('\n').trim();
    }

    return content;
  }

  processImages(entry) {
    const processedImages = [];
    
    if (!entry.attachments || entry.attachments.length === 0) {
      return processedImages;
    }

    entry.attachments.forEach(attachment => {
      if (attachment.type?.startsWith('image/')) {
        const date = new Date(entry.creationDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        // Create year/month directory
        const imageDir = path.join(this.imagesDir, String(year), month);
        if (!fs.existsSync(imageDir)) {
          fs.mkdirSync(imageDir, { recursive: true });
        }

        const filename = attachment.filename;
        const imagePath = path.join(imageDir, filename);
        
        // Copy image from download directory to final location
        const downloadPath = path.join('/tmp/dayone-downloads', filename);
        if (fs.existsSync(downloadPath)) {
          console.log(`Copying image: ${filename}`);
          fs.copyFileSync(downloadPath, imagePath);
          console.log(`✅ Copied: /images/${year}/${month}/${filename}`);
          
          processedImages.push(filename);
        } else {
          console.warn(`⚠️  Image file not found: ${downloadPath}`);
        }
      }
    });

    return processedImages;
  }

  generateFrontmatter(entry, images) {
    // Extract title from first line of content
    const content = entry.text || '';
    const lines = content.split('\n').filter(line => line.trim());
    let title = 'Untitled';
    
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine && !firstLine.startsWith('#') && !firstLine.startsWith('!') && !firstLine.startsWith('http')) {
        title = firstLine;
      }
    }

    const frontmatter = {
      title: title,
      publishDate: new Date(entry.creationDate).toISOString(),
      editDate: new Date(entry.modifiedDate).toISOString(),
      uuid: entry.uuid,
      tags: entry.tags || [],
      category: 'general'
    };

    if (images && images.length > 0) {
      frontmatter.images = images;
    }

    if (entry.location) {
      frontmatter.location = {
        name: entry.location.placeName || entry.location.localityName,
        coordinates: [entry.location.longitude, entry.location.latitude]
      };
    }

    if (entry.weather) {
      frontmatter.weather = {
        description: entry.weather.description,
        temperature: entry.weather.tempCelsius
      };
    }

    return matter.stringify('', frontmatter);
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  processEntry(entry) {
    console.log(`Processing entry: ${entry.uuid}`);
    
    // Process content and images
    const processedContent = this.processContent(entry);
    const processedImages = this.processImages(entry);
    
    // Generate frontmatter and full content
    const frontmatterStr = this.generateFrontmatter(entry, processedImages);
    const fullContent = frontmatterStr + '\n' + processedContent;
    
    // Generate filename
    const title = entry.text?.split('\n')[0]?.trim() || 'untitled';
    const slug = this.generateSlug(title);
    const filename = `${slug}.md`;
    const filePath = path.join(this.postsDir, filename);
    
    // Write post file
    fs.writeFileSync(filePath, fullContent);
    console.log(`✅ Created post: ${filename}`);
    
    return { slug, filePath };
  }

  async run() {
    console.log('🚀 Processing existing Day One data...');
    
    if (!fs.existsSync(this.dataFile)) {
      console.error(`❌ Data file not found: ${this.dataFile}`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    console.log(`Found ${data.entries.length} entries to process`);
    
    for (const entry of data.entries) {
      try {
        this.processEntry(entry);
      } catch (error) {
        console.error(`❌ Failed to process entry ${entry.uuid}:`, error);
      }
    }
    
    console.log('✅ Processing complete!');
  }
}

// Run the processor
const processor = new DayOneProcessor();
processor.run().catch(console.error);