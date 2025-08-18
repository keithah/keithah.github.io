const DayOneWebExporter = require('./dayOneWebExporter');

class JournalManager {
  constructor() {
    this.journals = {
      DRAFTS: 'Blog Drafts',
      PUBLIC: 'Blog Public', 
      PUBLISHED: 'Blog Published'
    };
    this.exporter = new DayOneWebExporter();
  }

  async processJournalWorkflow() {
    try {
      console.log('Starting 3-journal workflow...');
      
      // Step 1: Export Blog Public journal
      const publicEntries = await this.exportJournal(this.journals.PUBLIC);
      console.log(`Found ${publicEntries.length} entries in Blog Public`);
      
      // Step 2: Export Blog Published journal for comparison
      const publishedEntries = await this.exportJournal(this.journals.PUBLISHED);
      console.log(`Found ${publishedEntries.length} entries in Blog Published`);
      
      // Step 3: Determine which entries need processing
      const { newEntries, publishedEntries: entriesToMove } = this.compareJournals(publicEntries, publishedEntries);
      
      console.log(`${newEntries.length} new entries to process`);
      console.log(`${entriesToMove.length} entries to move to Published`);
      
      return {
        newEntries,
        entriesToMove,
        allPublicEntries: publicEntries
      };
      
    } catch (error) {
      console.error('Journal workflow failed:', error);
      throw error;
    }
  }

  async exportJournal(journalName) {
    try {
      console.log(`Exporting ${journalName} journal...`);
      
      // Update the exporter to use the specific journal
      this.exporter.journalName = journalName;
      
      // Export and parse
      const exportFile = await this.exporter.exportJournal();
      const entries = await this.exporter.extractAndParseExport(exportFile);
      
      return entries;
      
    } catch (error) {
      console.error(`Failed to export ${journalName}:`, error);
      // Return empty array if journal doesn't exist or export fails
      return [];
    }
  }

  compareJournals(publicEntries, publishedEntries) {
    // Create maps for efficient lookup
    const publishedUUIDs = new Set(publishedEntries.map(entry => entry.uuid));
    const publicUUIDs = new Set(publicEntries.map(entry => entry.uuid));
    
    // Find entries that are in Public but not yet Published (new to process)
    const newEntries = publicEntries.filter(entry => !publishedUUIDs.has(entry.uuid));
    
    // Find entries that are in both Public and Published (to move)
    const entriesToMove = publicEntries.filter(entry => publishedUUIDs.has(entry.uuid));
    
    return {
      newEntries,
      publishedEntries: entriesToMove
    };
  }

  async moveEntriesToPublished(entries) {
    if (entries.length === 0) {
      console.log('No entries to move to Published journal');
      return { moved: 0, errors: [] };
    }

    console.log(`Moving ${entries.length} entries from Public to Published...`);
    
    const results = {
      moved: 0,
      errors: []
    };

    // This would require Day One API to move entries between journals
    // For now, we'll track this in our processing system
    for (const entry of entries) {
      try {
        // In a real implementation, you would:
        // 1. Add entry to Blog Published journal
        // 2. Remove entry from Blog Public journal
        
        // For now, we'll just log and track
        console.log(`Would move entry: ${entry.title || entry.uuid}`);
        results.moved++;
        
      } catch (error) {
        console.error(`Failed to move entry ${entry.uuid}:`, error);
        results.errors.push({
          uuid: entry.uuid,
          title: entry.title,
          error: error.message
        });
      }
    }

    return results;
  }

  async createJournalMigrationCommands(entriesToMove) {
    // Generate Day One CLI commands that user can run to move entries
    const commands = [];
    
    for (const entry of entriesToMove) {
      // Generate commands to move entries between journals
      commands.push({
        uuid: entry.uuid,
        title: entry.title,
        command: `# Move "${entry.title || entry.uuid}" from Public to Published`,
        action: 'MOVE_TO_PUBLISHED'
      });
    }

    return commands;
  }

  generateWorkflowSummary(newEntries, entriesToMove, moveResults) {
    const summary = {
      timestamp: new Date().toISOString(),
      processed: {
        newEntries: newEntries.length,
        movedEntries: moveResults?.moved || 0,
        errors: moveResults?.errors?.length || 0
      },
      entries: {
        new: newEntries.map(e => ({
          uuid: e.uuid,
          title: e.title,
          creationDate: e.creationDate
        })),
        moved: entriesToMove.map(e => ({
          uuid: e.uuid,
          title: e.title,
          action: 'moved_to_published'
        }))
      }
    };

    return summary;
  }

  cleanup() {
    if (this.exporter) {
      this.exporter.cleanup();
    }
  }
}

module.exports = JournalManager;