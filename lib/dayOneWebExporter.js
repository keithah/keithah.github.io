const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class DayOneWebExporter {
  constructor() {
    this.email = process.env.DAYONE_EMAIL;
    this.password = process.env.DAYONE_PASSWORD;
    this.journalName = process.env.DAYONE_JOURNAL_ID || 'Blog Public';
    this.downloadDir = '/tmp/dayone-downloads';
    
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  async exportJournal() {
    let browser;
    
    try {
      console.log('Starting Day One web export...');
      console.log('Email:', this.email ? 'Set' : 'Missing');
      console.log('Password:', this.password ? 'Set' : 'Missing');
      console.log('Journal Name:', this.journalName);
      
      const launchOptions = {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--disable-features=VizDisplayCompositor'
        ]
      };

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      
      // Set realistic user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });
      
      // Set download behavior to allow downloads 
      const client = await page.createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadDir
      });
      
      // Anti-bot detection measures
      await page.evaluateOnNewDocument(() => {
        // Hide webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Add realistic properties
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        // Mock chrome runtime
        window.chrome = {
          runtime: {},
        };
        
        // Override permission query
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });
      
      // Listen for download events
      this.downloadStarted = false;
      this.downloadFile = null;
      
      client.on('Browser.downloadWillBegin', (event) => {
        console.log('🚀 Download will begin:', event.url);
        this.downloadStarted = true;
      });
      
      client.on('Browser.downloadProgress', (event) => {
        if (event.state === 'completed') {
          console.log('✅ Download completed:', event.url);
          this.downloadFile = event.url;
        } else if (event.state === 'inProgress') {
          console.log('📥 Download in progress:', event.totalBytes, 'bytes');
        }
      });
      
      // Enhanced download monitoring based on HAR analysis
      this.monitorResponses = false;
      this.blobUrls = [];
      
      // Inject script to monitor blob URL creation
      await page.evaluateOnNewDocument(() => {
        // Override createObjectURL to catch blob generation
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(object) {
          const url = originalCreateObjectURL.call(this, object);
          console.log('🎯 Blob URL created:', url);
          
          // Store blob info globally for Puppeteer to access
          if (!window.__dayOneBlobUrls) window.__dayOneBlobUrls = [];
          window.__dayOneBlobUrls.push({
            url: url,
            size: object.size || 0,
            type: object.type || 'unknown',
            timestamp: Date.now()
          });
          
          return url;
        };
        
        // Monitor for programmatic downloads and DOM mutations
        const originalClick = HTMLElement.prototype.click;
        HTMLElement.prototype.click = function() {
          if (this.tagName === 'A' && this.download && this.href.startsWith('blob:')) {
            console.log('📥 Blob download triggered:', this.href, 'filename:', this.download);
            if (!window.__dayOneDownloads) window.__dayOneDownloads = [];
            window.__dayOneDownloads.push({
              url: this.href,
              filename: this.download,
              timestamp: Date.now()
            });
          }
          return originalClick.call(this);
        };
        
        // Monitor DOM for download links being created
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // Element node
                // Check if it's a download link
                if (node.tagName === 'A' && node.download) {
                  console.log('📎 Download link added to DOM:', node.href, 'filename:', node.download);
                  if (!window.__dayOneDownloadLinks) window.__dayOneDownloadLinks = [];
                  window.__dayOneDownloadLinks.push({
                    url: node.href,
                    filename: node.download,
                    timestamp: Date.now(),
                    element: node
                  });
                }
                
                // Check child elements for download links
                const downloadLinks = node.querySelectorAll && node.querySelectorAll('a[download]');
                if (downloadLinks && downloadLinks.length > 0) {
                  downloadLinks.forEach(link => {
                    console.log('📎 Child download link found:', link.href, 'filename:', link.download);
                    if (!window.__dayOneDownloadLinks) window.__dayOneDownloadLinks = [];
                    window.__dayOneDownloadLinks.push({
                      url: link.href,
                      filename: link.download,
                      timestamp: Date.now(),
                      element: link
                    });
                  });
                }
              }
            });
          });
        });
        observer.observe(document.body, { 
          childList: true, 
          subtree: true,
          attributes: true,
          attributeFilter: ['href', 'download']
        });
      });
      
      page.on('response', async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        // Monitor for API calls that might trigger client-side export generation
        if (url.includes('/sync/entries') || url.includes('/attachments') || url.includes('/download')) {
          console.log(`📡 API call: ${url} (${response.status()})`);
          
          if (url.includes('/download') && url.includes('attachments')) {
            console.log(`🎯 ATTACHMENT DOWNLOAD API: ${url}`);
            // This might be the actual download trigger
          }
        }
        
        // Only log responses when we're actively monitoring (after include media click)
        if (this.monitorResponses) {
          console.log(`📥 Response: ${url} (${contentType})`);
        }
      });

      // Navigate to Day One web
      await page.goto('https://dayone.me/login', { waitUntil: 'networkidle2' });
      
      // Login
      await this.login(page);
      
      // Navigate to export
      await this.navigateToExport(page);
      
      // Select journal and export
      const exportedFile = await this.performExport(page);
      
      console.log(`Export completed: ${exportedFile}`);
      return exportedFile;
      
    } catch (error) {
      console.error('Day One web export failed:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async login(page) {
    console.log('Logging into Day One...');
    
    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Enter credentials
    await page.type('input[type="email"]', this.email);
    await page.type('input[type="password"]', this.password);
    
    // Submit login
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"], input[type="submit"]')
    ]);
    
    // Check if login was successful
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      throw new Error('Login failed - check credentials');
    }
    
    console.log('Login successful');
  }

  async navigateToExport(page) {
    console.log('Navigating to export page...');
    
    try {
      // Step 1: First open the journals sidebar and select the specific journal
      console.log(`Selecting journal: ${this.journalName}`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page to fully load
      
      // Open journals sidebar if it's not visible
      try {
        console.log('Opening journals sidebar...');
        await page.click('button[aria-label="Toggle Journals Sidebar"]');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.log('Sidebar toggle not found or already open');
      }
      
      // Try to click on the journal name in sidebar
      try {
        console.log('Looking for journal in sidebar...');
        // Use a more reliable selector for the journal link
        const journalSelectors = [
          `a:contains("${this.journalName}")`,
          `[title="${this.journalName}"]`,
          `[aria-label="${this.journalName}"]`
        ];
        
        let journalClicked = false;
        
        // Try XPath approach first - look for the span with journal name
        try {
          const journalSpans = await page.$x(`//span[@title='${this.journalName}' and contains(@class, 'components-truncate')]`);
          if (journalSpans.length > 0) {
            console.log('Found journal span via XPath, clicking...');
            await journalSpans[0].click();
            journalClicked = true;
          }
        } catch (e) {
          console.log('XPath approach failed, trying alternatives...');
        }
        
        if (!journalClicked) {
          // Try CSS selector approach
          const journalLink = await page.$(`a[title*="${this.journalName}"], a[aria-label*="${this.journalName}"]`);
          if (journalLink) {
            console.log('Found journal link via CSS selector, clicking...');
            await journalLink.click();
            journalClicked = true;
          }
        }
        
        if (journalClicked) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log('Journal selected, waiting for interface to load...');
          
          // Take a screenshot to confirm we're in the journal
          await page.screenshot({ path: 'debug-in-journal.png' });
          console.log('In journal screenshot saved');
          
          // Verify we can see entries in the journal
          await new Promise(resolve => setTimeout(resolve, 2000));
          const entryCountText = await page.$eval('body', el => el.textContent);
          
          // Look for entry count
          const entryCountMatch = entryCountText.match(/(\d+)\s+Entries/);
          if (entryCountMatch) {
            const entryCount = parseInt(entryCountMatch[1]);
            console.log(`✓ Journal contains ${entryCount} entries`);
          } else {
            console.log('Could not determine entry count, proceeding with export...');
          }
        } else {
          throw new Error('Could not find journal in sidebar');
        }
      } catch (e) {
        console.log('Could not select specific journal:', e.message);
        throw new Error('Failed to select journal: ' + e.message);
      }
      
      // Step 2: Now we should be in the journal, click Edit Journal dropdown
      console.log('Step 2: Clicking Edit Journal dropdown...');
      await page.waitForSelector('button[aria-label="Edit Journal"]', { timeout: 10000 });
      await page.click('button[aria-label="Edit Journal"]');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Click Journal Settings from dropdown
      console.log('Step 3: Clicking Journal Settings...');
      
      // Wait for dropdown menu to appear and find Journal Settings option
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try multiple approaches to find and click Journal Settings
      let journalSettingsClicked = false;
      
      // Approach 1: XPath for text content
      try {
        const journalSettingsElements = await page.$x("//button[contains(text(), 'Journal Settings')]");
        if (journalSettingsElements.length > 0) {
          console.log('Found Journal Settings via XPath, clicking...');
          await journalSettingsElements[0].click();
          journalSettingsClicked = true;
        }
      } catch (e) {
        console.log('XPath approach failed:', e.message);
      }
      
      // Approach 2: CSS selector for button with text
      if (!journalSettingsClicked) {
        try {
          const buttons = await page.$$('button');
          for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text && text.includes('Journal Settings')) {
              console.log('Found Journal Settings via text search, clicking...');
              await button.click();
              journalSettingsClicked = true;
              break;
            }
          }
        } catch (e) {
          console.log('Text search approach failed:', e.message);
        }
      }
      
      if (!journalSettingsClicked) {
        throw new Error('Could not find Journal Settings button in dropdown');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Click Export Journal button in modal
      console.log('Step 4: Clicking Export Journal...');
      
      // Wait for modal to appear
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try multiple approaches to find and click Export Journal
      let exportJournalClicked = false;
      
      // Approach 1: Find button by text content
      try {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && text.includes('Export Journal')) {
            console.log('Found Export Journal via text search, clicking...');
            await button.click();
            exportJournalClicked = true;
            break;
          }
        }
      } catch (e) {
        console.log('Text search approach for Export Journal failed:', e.message);
      }
      
      if (!exportJournalClicked) {
        throw new Error('Could not find Export Journal button in modal');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Successfully navigated to export');
      
      // Take a screenshot to see the export interface
      await page.screenshot({ path: 'debug-export-interface.png' });
      console.log('Export interface screenshot saved');
      
    } catch (error) {
      console.error('Failed to navigate to export:', error);
      await page.screenshot({ path: 'export-error-screenshot.png' });
      throw new Error(`Could not navigate to export: ${error.message}`);
    }
  }

  async performExport(page) {
    console.log('Performing export...');
    
    try {
      // Step 5: Click Export journal JSON file button
      console.log('Step 5: Clicking Export journal JSON file button...');
      
      // Wait for export interface to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to find the "Export journal JSON file" button by text
      let exportJsonClicked = false;
      
      try {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && text.includes('Export journal JSON file')) {
            console.log('Found Export journal JSON file via text search, clicking...');
            await button.click();
            exportJsonClicked = true;
            break;
          }
        }
      } catch (e) {
        console.log('Text search approach for Export JSON failed:', e.message);
      }
      
      if (!exportJsonClicked) {
        throw new Error('Could not find Export journal JSON file button');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 6: Click Include media button
      console.log('Step 6: Clicking Include media button...');
      
      // Wait for the modal to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Take a screenshot to see the modal
      await page.screenshot({ path: 'debug-media-modal.png' });
      console.log('Media modal screenshot saved');
      
      // Check if this is actually a sync requirement modal instead of media modal
      const pageText = await page.$eval('body', el => el.textContent);
      
      if (pageText.includes('not yet been synced') || pageText.includes('must be synced before')) {
        console.log('🔄 Journal needs to be synced before export!');
        
        // Look for and click the sync button
        const buttons = await page.$$('button, div[role="button"]');
        let syncClicked = false;
        
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && (text.includes('Syncing') || text.includes('Sync'))) {
            console.log('Found sync button, clicking...');
            await button.click();
            syncClicked = true;
            break;
          }
        }
        
        if (!syncClicked) {
          throw new Error('Journal must be synced before export, but could not find sync button. Please sync the journal manually in Day One first.');
        }
        
        // Wait for sync to complete
        console.log('⏳ Waiting for journal sync to complete...');
        let syncCompleted = false;
        let syncAttempts = 0;
        const maxSyncAttempts = 60; // 120 seconds
        
        while (!syncCompleted && syncAttempts < maxSyncAttempts) {
          syncAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const currentText = await page.$eval('body', el => el.textContent);
          
          // Check if sync is done and export button is available
          if ((!currentText.includes('Syncing') || currentText.includes('Sync complete')) && 
              (currentText.includes('Export journal JSON file') || currentText.includes('Include media'))) {
            syncCompleted = true;
            console.log('✅ Journal sync completed!');
            break;
          }
          
          // Also check if the button is enabled (not disabled)
          try {
            const exportButtons = await page.$$('button');
            for (const button of exportButtons) {
              const text = await page.evaluate(el => el.textContent, button);
              const isDisabled = await page.evaluate(el => el.disabled, button);
              if (text && text.includes('Export journal JSON file') && !isDisabled) {
                syncCompleted = true;
                console.log('✅ Journal sync completed - export button is enabled!');
                break;
              }
            }
          } catch (e) {
            // Ignore button check errors
          }
          
          console.log(`Sync attempt ${syncAttempts}/${maxSyncAttempts}...`);
        }
        
        if (!syncCompleted) {
          throw new Error('Journal sync did not complete within 120 seconds. Please check the journal sync status manually.');
        }
        
        // Now try to click the export button again
        console.log('Clicking Export journal JSON file button after sync...');
        const exportButtons = await page.$$('button');
        let exportClicked = false;
        
        for (const button of exportButtons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && text.includes('Export journal JSON file')) {
            await button.click();
            exportClicked = true;
            console.log('Export button clicked after sync');
            break;
          }
        }
        
        if (!exportClicked) {
          throw new Error('Could not find Export journal JSON file button after sync');
        }
        
        // Wait for the include media modal to appear
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.screenshot({ path: 'debug-after-sync-export.png' });
        console.log('Screenshot taken after sync and export click');
      }
      
      // Find the "Include media" button using text search
      let mediaButtonClicked = false;
      
      try {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && text.includes('Include media')) {
            console.log('Found Include media button via text search, clicking...');
            
            // Add human-like interaction
            const box = await button.boundingBox();
            if (box) {
              // Move mouse to button area with slight randomness
              const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
              const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10;
              await page.mouse.move(x, y);
              await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
            }
            
            // Try multiple click approaches to bypass detection
            await button.focus();
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Dispatch mouse events manually
            await page.evaluate((element) => {
              element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }, button);
            
            // Also try regular click as backup
            await button.click();
            mediaButtonClicked = true;
            break;
          }
        }
      } catch (e) {
        console.log('Error finding Include media button:', e.message);
      }
      
      if (!mediaButtonClicked) {
        console.log('Include media button not found, trying Export without media...');
        
        // Try to click "Export without media" as fallback
        try {
          const buttons = await page.$$('button');
          for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text && text.includes('Export without media')) {
              console.log('Found Export without media button, clicking...');
              await button.click();
              mediaButtonClicked = true;
              break;
            }
          }
        } catch (e) {
          console.log('Error finding Export without media button:', e.message);
        }
      }
      
      if (mediaButtonClicked) {
        console.log('Media choice made, monitoring for download...');
        
        // Enable response monitoring to catch the download
        this.monitorResponses = true;
        
        // Wait a bit for any immediate processing
        console.log('⏳ Waiting 3 seconds for export processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check what happened immediately after button click
        const initialBlobUrls = await page.evaluate(() => window.__dayOneBlobUrls || []);
        const initialDownloads = await page.evaluate(() => window.__dayOneDownloads || []);
        const initialDownloadLinks = await page.evaluate(() => window.__dayOneDownloadLinks || []);
        
        console.log(`📊 Initial state after button click:`);
        console.log(`  - Blob URLs: ${initialBlobUrls.length}`);
        console.log(`  - Downloads: ${initialDownloads.length}`);
        console.log(`  - Download Links: ${initialDownloadLinks.length}`);
        
        // Enhanced monitoring for blob downloads and client-side generation
        let downloadDetected = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds - increased for blob generation
        
        while (!downloadDetected && attempts < maxAttempts) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if any traditional download events occurred
          if (this.downloadStarted || this.downloadFile) {
            downloadDetected = true;
            console.log('✅ Traditional download activity detected!');
            break;
          }
          
          // Check for blob URLs created by client-side export
          try {
            const blobUrls = await page.evaluate(() => window.__dayOneBlobUrls || []);
            const downloads = await page.evaluate(() => window.__dayOneDownloads || []);
            const downloadLinks = await page.evaluate(() => window.__dayOneDownloadLinks || []);
            
            if (blobUrls.length > 0) {
              console.log(`🎯 Found ${blobUrls.length} blob URL(s):`, blobUrls);
              
              // Filter for likely export blobs (larger files, not images)
              const exportBlobs = blobUrls.filter(blob => {
                // Look for ZIP files or larger JSON files (export should be bigger than image thumbnails)
                return (blob.type.includes('zip') || 
                        blob.type.includes('json') || 
                        blob.type.includes('octet-stream') ||
                        blob.size > 100000); // Larger than 100KB - likely not a thumbnail
              });
              
              console.log(`📦 Filtering for export blobs: ${exportBlobs.length} candidates`);
              
              // Try to download the export blob content
              for (const blobInfo of exportBlobs) {
                try {
                  console.log(`📥 Attempting to download export blob: ${blobInfo.url} (${blobInfo.type}, ${blobInfo.size} bytes)`);
                  
                  const content = await page.evaluate(async (url) => {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    return Array.from(new Uint8Array(arrayBuffer));
                  }, blobInfo.url);
                  
                  const filename = `dayone-export-${Date.now()}.zip`;
                  const filepath = path.join(this.downloadDir, filename);
                  fs.writeFileSync(filepath, Buffer.from(content));
                  
                  console.log(`✅ Successfully downloaded export blob to: ${filepath}`);
                  downloadDetected = true;
                  break;
                } catch (blobError) {
                  console.log(`Failed to download blob: ${blobError.message}`);
                }
              }
              
              // If no export blobs found yet, continue monitoring
              if (exportBlobs.length === 0) {
                console.log(`⏳ No export blobs yet, found only: ${blobUrls.map(b => b.type).join(', ')}`);
              }
            }
            
            if (downloads.length > 0) {
              console.log(`📥 Found ${downloads.length} programmatic download(s):`, downloads);
              downloadDetected = true;
              break;
            }
            
            if (downloadLinks.length > 0) {
              console.log(`📎 Found ${downloadLinks.length} download link(s):`, downloadLinks);
              
              // Try to trigger any download links
              for (const linkInfo of downloadLinks) {
                try {
                  console.log(`🔗 Attempting to trigger download link: ${linkInfo.url}`);
                  
                  // Check if it's a blob URL we can download
                  if (linkInfo.url.startsWith('blob:')) {
                    const content = await page.evaluate(async (url) => {
                      const response = await fetch(url);
                      const arrayBuffer = await response.arrayBuffer();
                      return Array.from(new Uint8Array(arrayBuffer));
                    }, linkInfo.url);
                    
                    const filename = linkInfo.filename || `dayone-export-${Date.now()}.zip`;
                    const filepath = path.join(this.downloadDir, filename);
                    fs.writeFileSync(filepath, Buffer.from(content));
                    
                    console.log(`✅ Successfully downloaded via link to: ${filepath}`);
                    downloadDetected = true;
                    break;
                  } else {
                    // Try to click the link
                    await page.evaluate((timestamp) => {
                      const links = window.__dayOneDownloadLinks || [];
                      const link = links.find(l => l.timestamp === timestamp);
                      if (link && link.element) {
                        link.element.click();
                      }
                    }, linkInfo.timestamp);
                    console.log(`🖱️ Clicked download link`);
                  }
                } catch (linkError) {
                  console.log(`Failed to process download link: ${linkError.message}`);
                }
              }
              
              if (downloadDetected) break;
            }
          } catch (e) {
            console.log(`Blob check error: ${e.message}`);
          }
          
          // Also check for new files in download directory
          try {
            const files = fs.readdirSync(this.downloadDir);
            const newFile = files.find(f => {
              const stats = fs.statSync(path.join(this.downloadDir, f));
              return stats.mtime > new Date(Date.now() - 10000) && // Within last 10 seconds
                     (f.endsWith('.json') || f.endsWith('.zip')) &&
                     !f.includes('.png');
            });
            
            if (newFile) {
              console.log(`📁 New download file detected: ${newFile}`);
              downloadDetected = true;
              break;
            }
          } catch (e) {
            // Ignore directory read errors
          }
          
          console.log(`Enhanced monitoring attempt ${attempts}/${maxAttempts}...`);
        }
        
        if (!downloadDetected) {
          console.log('⚠️  No download detected after clicking include media');
        }
        
      } else {
        throw new Error('Could not find either Include media or Export without media button');
      }
      
      // Wait longer for the download to start and monitor more aggressively
      console.log('Waiting for download to start (checking every 2 seconds for 30 seconds)...');
      
      let downloadFound = false;
      let attempts = 0;
      const maxAttempts = 15; // 30 seconds total
      
      while (!downloadFound && attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts}/${maxAttempts}: Checking for download...`);
        
        // Check our download directory
        try {
          if (fs.existsSync(this.downloadDir)) {
            const files = fs.readdirSync(this.downloadDir);
            const recentFile = files.find(f => {
              const filePath = path.join(this.downloadDir, f);
              const stats = fs.statSync(filePath);
              const isRecent = stats.mtime > new Date(Date.now() - 60000); // Within last minute
              const isExportFile = (f.endsWith('.json') || f.endsWith('.zip')) && 
                                  !f.includes('.png') && !f.includes('.jpg') && 
                                  !f.includes('debug') && !f.includes('screenshot');
              
              return isRecent && isExportFile;
            });
            
            if (recentFile) {
              console.log(`📁 Found export file: ${recentFile}`);
              downloadFound = true;
              break;
            }
          }
        } catch (error) {
          console.log(`Error checking directory: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Check for downloaded files using multiple approaches
      let exportFile = null;
      
      // Approach 1: Check our download directory
      console.log('Checking download directory...');
      try {
        const files = fs.readdirSync(this.downloadDir);
        const recentFile = files.find(f => 
          (f.includes('export') || f.includes('journal') || f.includes('Blog_Public') || f.endsWith('.json') || f.endsWith('.zip')) &&
          fs.statSync(path.join(this.downloadDir, f)).mtime > new Date(Date.now() - 60000) // Within last minute
        );
        
        if (recentFile) {
          exportFile = path.join(this.downloadDir, recentFile);
          console.log(`Found export file in download directory: ${recentFile}`);
        }
      } catch (error) {
        console.log('Could not check download directory:', error.message);
      }
      
      // Approach 2: Check common download locations
      if (!exportFile) {
        console.log('Checking common download locations...');
        const downloadLocations = [
          '/tmp',
          '/tmp/dayone-downloads',
          '/home/keith/Downloads',
          process.cwd(),
          '/var/tmp',
          process.env.HOME + '/Downloads'
        ];
        
        for (const location of downloadLocations) {
          try {
            if (fs.existsSync(location)) {
              const files = fs.readdirSync(location);
              const recentExport = files.find(f => 
                (f.includes('export') || f.includes('journal') || f.includes('dayone') || f.endsWith('.json') || f.endsWith('.zip')) &&
                fs.statSync(path.join(location, f)).mtime > new Date(Date.now() - 60000)
              );
              
              if (recentExport) {
                const originalPath = path.join(location, recentExport);
                const targetPath = path.join(this.downloadDir, recentExport);
                
                // Copy to our download directory
                fs.copyFileSync(originalPath, targetPath);
                exportFile = targetPath;
                console.log(`Found and copied export file from ${location}: ${recentExport}`);
                break;
              }
            }
          } catch (error) {
            console.log(`Could not check ${location}:`, error.message);
          }
        }
      }
      
      if (!exportFile) {
        throw new Error('No export file found. The download may not have completed or may be in an unexpected location.');
      }
      
      console.log(`Export completed successfully! Saved as: ${exportFile}`);
      return exportFile;
      
    } catch (error) {
      console.error('Export execution failed:', error);
      await page.screenshot({ path: 'export-execution-error.png' });
      
      // Fallback: check if file was downloaded to default download directory
      try {
        const files = fs.readdirSync(this.downloadDir);
        const exportFile = files.find(f => 
          f.includes('export') || 
          f.includes('journal') || 
          f.endsWith('.json') || 
          f.endsWith('.zip')
        );
        
        if (exportFile) {
          console.log('Found export file via fallback method:', exportFile);
          return path.join(this.downloadDir, exportFile);
        }
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
      }
      
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  async extractAndParseExport(filePath) {
    try {
      let jsonData;
      
      if (filePath.endsWith('.zip')) {
        // Handle ZIP file
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(filePath);
        const entries = zip.getEntries();
        
        const jsonEntry = entries.find(entry => entry.entryName.endsWith('.json'));
        if (!jsonEntry) {
          throw new Error('No JSON file found in export ZIP');
        }
        
        jsonData = JSON.parse(jsonEntry.getData().toString('utf8'));
      } else {
        // Handle direct JSON file
        jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      
      // Filter entries for the specific journal
      const entries = jsonData.entries || [];
      const blogEntries = entries.filter(entry => {
        const journal = entry.journal || entry.journalName || '';
        return journal.toLowerCase().includes(this.journalName.toLowerCase());
      });
      
      console.log(`Found ${blogEntries.length} entries in ${this.journalName} journal`);
      return blogEntries;
      
    } catch (error) {
      console.error('Error parsing export file:', error);
      throw error;
    }
  }

  cleanup() {
    // Clean up temporary files
    if (fs.existsSync(this.downloadDir)) {
      const files = fs.readdirSync(this.downloadDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.downloadDir, file));
      });
    }
  }
}

module.exports = DayOneWebExporter;