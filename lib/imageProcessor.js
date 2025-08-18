const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifr = require('exifr');
const axios = require('axios');

class ImageProcessor {
  constructor(imagesDir) {
    this.imagesDir = imagesDir;
  }

  async processImage(imageUrl, filename, targetDir, options = {}) {
    try {
      console.log(`Processing image: ${filename}`);
      
      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const imagePath = path.join(targetDir, filename);
      
      // Download image if it's a URL
      let imageBuffer;
      if (imageUrl.startsWith('http')) {
        imageBuffer = await this.downloadImage(imageUrl);
      } else {
        imageBuffer = fs.readFileSync(imageUrl);
      }

      // Extract and log EXIF data before removal
      const exifData = await this.extractExifData(imageBuffer);
      
      // Process image with Sharp
      const processedBuffer = await this.optimizeImage(imageBuffer, options);
      
      // Save processed image
      fs.writeFileSync(imagePath, processedBuffer);

      return {
        filename,
        path: imagePath,
        originalSize: imageBuffer.length,
        processedSize: processedBuffer.length,
        exifRemoved: exifData,
        success: true
      };

    } catch (error) {
      console.error(`Error processing image ${filename}:`, error);
      return {
        filename,
        error: error.message,
        success: false
      };
    }
  }

  async downloadImage(url) {
    try {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'DayOne-Blog-Automation/1.0'
        }
      });

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download image from ${url}: ${error.message}`);
    }
  }

  async extractExifData(imageBuffer) {
    try {
      const exif = await exifr.parse(imageBuffer);
      
      if (!exif) {
        return { hasExif: false };
      }

      // Extract sensitive data that will be removed
      const sensitiveData = {
        hasExif: true,
        gps: exif.GPS || exif.latitude || exif.longitude ? true : false,
        location: {
          latitude: exif.latitude,
          longitude: exif.longitude,
          altitude: exif.altitude
        },
        camera: {
          make: exif.Make,
          model: exif.Model,
          software: exif.Software
        },
        timestamp: exif.DateTime || exif.DateTimeOriginal,
        userComment: exif.UserComment
      };

      // Log what sensitive data was found
      const sensitiveFields = [];
      if (sensitiveData.gps) sensitiveFields.push('GPS coordinates');
      if (sensitiveData.camera.make) sensitiveFields.push('camera info');
      if (sensitiveData.timestamp) sensitiveFields.push('timestamp');
      if (sensitiveData.userComment) sensitiveFields.push('user comments');

      return {
        ...sensitiveData,
        removedFields: sensitiveFields
      };

    } catch (error) {
      console.warn('Could not extract EXIF data:', error.message);
      return { hasExif: false, error: error.message };
    }
  }

  async optimizeImage(imageBuffer, options = {}) {
    const {
      format = 'png',
      quality = 90,
      maxWidth = 1200,
      maxHeight = 1200,
      removeExif = true
    } = options;

    let pipeline = sharp(imageBuffer);

    // Remove EXIF data (strips all metadata including GPS)
    if (removeExif) {
      pipeline = pipeline.withMetadata({
        exif: {},
        icc: true, // Keep color profile
      });
    }

    // Resize if too large
    const metadata = await pipeline.metadata();
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert format and optimize
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true
        });
        break;
      case 'webp':
        pipeline = pipeline.webp({ 
          quality,
          effort: 4
        });
        break;
      case 'png':
      default:
        pipeline = pipeline.png({ 
          compressionLevel: 8,
          adaptiveFiltering: true
        });
        break;
    }

    return await pipeline.toBuffer();
  }

  async processImagesFromEntry(entry, targetDir) {
    const results = [];
    
    if (!entry.photos || entry.photos.length === 0) {
      return results;
    }

    for (const [index, photo] of entry.photos.entries()) {
      const filename = this.generateImageFilename(photo, index, entry);
      const result = await this.processImage(
        photo.url || photo.path,
        filename,
        targetDir,
        {
          format: 'png',
          removeExif: true,
          maxWidth: 1200,
          maxHeight: 1200
        }
      );

      if (result.success) {
        result.altText = photo.caption || photo.altText || '';
        result.originalId = photo.identifier || photo.id;
      }

      results.push(result);
    }

    return results;
  }

  generateImageFilename(photo, index, entry) {
    // Use photo identifier if available, otherwise generate from entry
    const identifier = photo.identifier || photo.id || `${entry.uuid}-${index}`;
    
    // Clean identifier for filename
    const cleanId = identifier
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `${cleanId}.png`;
  }

  getImagePath(entry, filename) {
    const date = new Date(entry.creationDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return path.join(this.imagesDir, String(year), month, filename);
  }

  getRelativeImagePath(entry, filename) {
    const date = new Date(entry.creationDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `images/${year}/${month}/${filename}`;
  }

  logExifRemoval(results) {
    const removedData = results
      .filter(r => r.success && r.exifRemoved?.hasExif)
      .map(r => ({
        filename: r.filename,
        removedFields: r.exifRemoved.removedFields || []
      }));

    if (removedData.length > 0) {
      console.log('\nEXIF data removed from images:');
      removedData.forEach(({ filename, removedFields }) => {
        console.log(`  ${filename}: ${removedFields.join(', ')}`);
      });
    }

    return removedData;
  }
}

module.exports = ImageProcessor;