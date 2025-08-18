const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

class DayOneApiExporter {
  constructor() {
    this.email = process.env.DAYONE_EMAIL;
    this.password = process.env.DAYONE_PASSWORD;
    this.journalName = process.env.DAYONE_JOURNAL_ID || 'Blog Public';
    this.downloadDir = '/tmp/dayone-downloads';
    this.authToken = null;
    this.userAgent = 'DayOneWeb/2025.17.2 (en-US; MacIntel/0.0.0; Safari 18; Desktop; Release/1; Core/1.0.0)';
    this.deviceInfo = 'Id="e22d75ff8c18b9a7268ca5670efb952a"; Model="MacIntel Safari 18"; Name="WebApp Safari 18"; Language="en-US"; Country="US"; app_id="com.bloombuilt.dayone-web"';
    
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  async login() {
    console.log('🔐 Authenticating with Day One API...');
    
    try {
      const response = await axios.post('https://dayone.me/api/users/login', {
        email: this.email,
        password: this.password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
          'X-User-Agent': this.userAgent,
          'Origin': 'https://dayone.me',
          'Referer': 'https://dayone.me/login'
        }
      });
      
      if (response.data && response.data.token) {
        this.authToken = response.data.token;
        console.log('✅ Authentication successful');
        return true;
      } else {
        throw new Error('No token received from login');
      }
    } catch (error) {
      console.error('❌ Authentication failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async findJournalId() {
    console.log(`🔍 Finding journal: ${this.journalName}`);
    
    try {
      // Try to get user settings which might contain journal info
      const response = await axios.get('https://dayone.me/api/user-settings', {
        headers: {
          'Authorization': this.authToken,
          'X-User-Agent': this.userAgent,
          'Device-Info': this.deviceInfo,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
        }
      });
      
      console.log('📋 User settings retrieved');
      console.log('📋 Journal order:', response.data.journalOrder);
      
      // From Charles capture: "journalOrder":[109981876727,104652358800,108646068876,230798,101957531475]
      // Try each journal ID to find the one with entries
      const journalIds = response.data.journalOrder || [109981876727,104652358800,108646068876,230798,101957531475];
      
      for (const journalId of journalIds) {
        console.log(`🔍 Checking journal ID: ${journalId}`);
        try {
          const entriesResponse = await axios.get(`https://dayone.me/api/v2/sync/entries/${journalId}/feed`, {
            params: {
              excludeDeleted: true,
              groups: journalId
            },
            headers: {
              'Authorization': this.authToken,
              'X-User-Agent': this.userAgent,
              'Device-Info': this.deviceInfo,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
            }
          });
          
          // Parse NDJSON response to count entries
          const responseText = entriesResponse.data;
          let entryCount = 0;
          if (responseText && typeof responseText === 'string') {
            const lines = responseText.split('\n').filter(line => line.trim());
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                if (entry.id && entry.body) {
                  entryCount++;
                }
              } catch (parseError) {
                // Skip invalid lines
              }
            }
          }
          console.log(`   📊 Journal ${journalId} has ${entryCount} entries`);
          
          if (entryCount > 0) {
            console.log(`✅ Found journal with entries: ${journalId}`);
            return journalId.toString();
          }
        } catch (err) {
          console.log(`   ❌ Failed to check journal ${journalId}:`, err.response?.status || err.message);
        }
      }
      
      throw new Error(`No journal found with entries. Checked: ${journalIds.join(', ')}`);
      
    } catch (error) {
      console.error('❌ Failed to find journal ID:', error.response?.data || error.message);
      throw error;
    }
  }

  async getJournalEntries(journalId) {
    console.log(`📑 Fetching entries for journal ${journalId}`);
    
    try {
      const response = await axios.get(`https://dayone.me/api/v2/sync/entries/${journalId}/feed`, {
        params: {
          excludeDeleted: true,
          groups: journalId
        },
        headers: {
          'Authorization': this.authToken,
          'X-User-Agent': this.userAgent,
          'Device-Info': this.deviceInfo,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
        }
      });
      
      // Response is NDJSON (newline-delimited JSON), not a regular JSON array
      const responseText = response.data;
      if (!responseText || typeof responseText !== 'string') {
        console.log(`📊 No entries found (empty response)`);
        return [];
      }
      
      // Parse each line as JSON
      const lines = responseText.split('\n').filter(line => line.trim());
      const entries = [];
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Skip metadata lines, only process actual entries
          if (entry.id && entry.body) {
            entries.push(entry);
          }
        } catch (parseError) {
          console.log(`⚠️  Skipping invalid JSON line: ${line.substring(0, 100)}...`);
        }
      }
      
      console.log(`✅ Found ${entries.length} entries`);
      return entries;
      
    } catch (error) {
      console.error('❌ Failed to fetch entries:', error.response?.data || error.message);
      throw error;
    }
  }

  async downloadAttachment(journalId, attachmentId, filename) {
    console.log(`📎 Downloading attachment: ${attachmentId}`);
    
    try {
      // First get the download URL (might redirect to S3)
      const response = await axios.get(`https://dayone.me/api/journals/${journalId}/attachments/${attachmentId}/download`, {
        params: {
          thumbnail: false
        },
        headers: {
          'Authorization': this.authToken,
          'X-User-Agent': this.userAgent,
          'Device-Info': this.deviceInfo,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
        },
        maxRedirects: 5,
        responseType: 'stream'
      });
      
      // Save the attachment
      const attachmentPath = path.join(this.downloadDir, filename);
      const writer = fs.createWriteStream(attachmentPath);
      
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ Downloaded: ${filename}`);
          resolve(attachmentPath);
        });
        writer.on('error', reject);
      });
      
    } catch (error) {
      console.error(`❌ Failed to download attachment ${attachmentId}:`, error.message);
      return null;
    }
  }

  async exportJournal() {
    console.log('🚀 Starting Day One API export...');
    
    try {
      // Step 1: Login
      await this.login();
      
      // Step 2: Find journal
      const journalId = await this.findJournalId();
      
      // Step 3: Get entries
      const entries = await this.getJournalEntries(journalId);
      
      if (entries.length === 0) {
        throw new Error('No entries found in journal');
      }
      
      // Step 4: Download attachments and create export
      console.log('📦 Creating export package...');
      const zip = new AdmZip();
      
      // Add journal metadata
      const exportData = {
        metadata: {
          version: '1.0',
          exportDate: new Date().toISOString(),
          journalName: this.journalName,
          entryCount: entries.length
        },
        entries: []
      };
      
      // Process each entry
      for (const [index, entry] of entries.entries()) {
        console.log(`Processing entry ${index + 1}/${entries.length}: ${entry.id}`);
        
        const processedEntry = {
          uuid: entry.id,
          text: entry.body,
          creationDate: entry.date,
          modifiedDate: entry.userEditDate,
          title: entry.title || null,
          tags: entry.tags || [],
          location: entry.location,
          weather: entry.weather,
          attachments: []
        };
        
        // Download moments (attachments) for this entry
        if (entry.moments && entry.moments.length > 0) {
          for (const moment of entry.moments) {
            const filename = `${entry.id}_${moment.id}.${moment.contentType?.split('/')[1] || 'jpg'}`;
            const attachmentPath = await this.downloadAttachment(journalId, moment.id, filename);
            
            if (attachmentPath) {
              // Add to ZIP
              zip.addLocalFile(attachmentPath);
              processedEntry.attachments.push({
                identifier: moment.id,
                filename: filename,
                type: moment.contentType,
                width: moment.width,
                height: moment.height,
                md5: moment.md5
              });
            }
          }
        }
        
        exportData.entries.push(processedEntry);
      }
      
      // Add JSON to ZIP
      zip.addFile('Journal.json', Buffer.from(JSON.stringify(exportData, null, 2)));
      
      // Save export
      const exportPath = path.join(this.downloadDir, `${this.journalName.replace(/\s+/g, '_')}_export_${Date.now()}.zip`);
      zip.writeZip(exportPath);
      
      console.log(`✅ Export completed: ${exportPath}`);
      return exportPath;
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  async extractAndParseExport(filePath) {
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      
      const jsonEntry = entries.find(entry => entry.entryName === 'Journal.json');
      if (!jsonEntry) {
        throw new Error('No Journal.json found in export');
      }
      
      const jsonData = JSON.parse(jsonEntry.getData().toString('utf8'));
      console.log(`Found ${jsonData.entries.length} entries in export`);
      
      return jsonData.entries;
      
    } catch (error) {
      console.error('Error parsing export:', error);
      throw error;
    }
  }

  cleanup() {
    // Clean up temporary files
    if (fs.existsSync(this.downloadDir)) {
      const files = fs.readdirSync(this.downloadDir);
      files.forEach(file => {
        if (file.includes('temp') || file.includes('debug')) {
          fs.unlinkSync(path.join(this.downloadDir, file));
        }
      });
    }
  }
}

module.exports = DayOneApiExporter;