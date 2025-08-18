const fs = require('fs');
const path = require('path');

class JournalStateTracker {
  constructor() {
    this.stateFile = path.join(__dirname, '..', 'data', 'journal-state.json');
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      }
    } catch (error) {
      console.warn('Failed to load journal state:', error);
    }

    return {
      lastProcessed: null,
      journals: {
        'Blog Public': {
          lastExport: null,
          entries: {},
          totalEntries: 0
        },
        'Blog Published': {
          lastExport: null,
          entries: {},
          totalEntries: 0
        }
      },
      migrations: {
        pending: [],
        completed: []
      }
    };
  }

  saveState() {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('Failed to save journal state:', error);
    }
  }

  updateJournalSnapshot(journalName, entries) {
    const snapshot = {
      lastExport: new Date().toISOString(),
      entries: {},
      totalEntries: entries.length
    };

    // Create entry map for efficient lookups
    entries.forEach(entry => {
      snapshot.entries[entry.uuid] = {
        title: entry.title,
        creationDate: entry.creationDate,
        modifiedDate: entry.modifiedDate,
        lastSeen: new Date().toISOString()
      };
    });

    this.state.journals[journalName] = snapshot;
    this.state.lastProcessed = new Date().toISOString();
    this.saveState();
  }

  getEntryChanges(journalName, currentEntries) {
    const previousSnapshot = this.state.journals[journalName];
    if (!previousSnapshot) {
      // First time processing this journal
      return {
        added: currentEntries,
        modified: [],
        removed: [],
        unchanged: []
      };
    }

    const currentUUIDs = new Set(currentEntries.map(e => e.uuid));
    const previousUUIDs = new Set(Object.keys(previousSnapshot.entries));

    const changes = {
      added: [],
      modified: [],
      removed: [],
      unchanged: []
    };

    // Check for added and modified entries
    currentEntries.forEach(entry => {
      const previousEntry = previousSnapshot.entries[entry.uuid];
      
      if (!previousEntry) {
        changes.added.push(entry);
      } else if (entry.modifiedDate !== previousEntry.modifiedDate) {
        changes.modified.push(entry);
      } else {
        changes.unchanged.push(entry);
      }
    });

    // Check for removed entries
    previousUUIDs.forEach(uuid => {
      if (!currentUUIDs.has(uuid)) {
        changes.removed.push({
          uuid,
          ...previousSnapshot.entries[uuid]
        });
      }
    });

    return changes;
  }

  trackMigrationRequest(entries, migrationId = null) {
    const migration = {
      id: migrationId || `migration-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
      entries: entries.map(entry => ({
        uuid: entry.uuid,
        title: entry.title,
        creationDate: entry.creationDate
      }))
    };

    this.state.migrations.pending.push(migration);
    this.saveState();

    return migration.id;
  }

  completeMigration(migrationId, completedEntries = []) {
    const pendingIndex = this.state.migrations.pending.findIndex(m => m.id === migrationId);
    
    if (pendingIndex === -1) {
      console.warn(`Migration ${migrationId} not found in pending list`);
      return;
    }

    const migration = this.state.migrations.pending[pendingIndex];
    migration.status = 'completed';
    migration.completedAt = new Date().toISOString();
    migration.completedEntries = completedEntries;

    // Move from pending to completed
    this.state.migrations.pending.splice(pendingIndex, 1);
    this.state.migrations.completed.push(migration);

    this.saveState();
  }

  getPendingMigrations() {
    return this.state.migrations.pending;
  }

  getCompletedMigrations(limit = 10) {
    return this.state.migrations.completed
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, limit);
  }

  getJournalSummary() {
    return {
      lastProcessed: this.state.lastProcessed,
      journals: Object.keys(this.state.journals).map(name => ({
        name,
        lastExport: this.state.journals[name].lastExport,
        totalEntries: this.state.journals[name].totalEntries
      })),
      pendingMigrations: this.state.migrations.pending.length,
      completedMigrations: this.state.migrations.completed.length
    };
  }

  detectJournalMovements(publicEntries, publishedEntries) {
    // Compare current state with previous to detect movements
    const previousPublic = this.state.journals['Blog Public']?.entries || {};
    const previousPublished = this.state.journals['Blog Published']?.entries || {};

    const currentPublicUUIDs = new Set(publicEntries.map(e => e.uuid));
    const currentPublishedUUIDs = new Set(publishedEntries.map(e => e.uuid));

    const movements = {
      movedToPublished: [],
      movedFromPublished: [],
      newInPublic: [],
      newInPublished: []
    };

    // Detect entries that moved from Public to Published
    Object.keys(previousPublic).forEach(uuid => {
      if (!currentPublicUUIDs.has(uuid) && currentPublishedUUIDs.has(uuid)) {
        movements.movedToPublished.push({
          uuid,
          ...previousPublic[uuid],
          detectedAt: new Date().toISOString()
        });
      }
    });

    // Detect entries that moved from Published back to Public (rare)
    Object.keys(previousPublished).forEach(uuid => {
      if (!currentPublishedUUIDs.has(uuid) && currentPublicUUIDs.has(uuid)) {
        movements.movedFromPublished.push({
          uuid,
          ...previousPublished[uuid],
          detectedAt: new Date().toISOString()
        });
      }
    });

    // Detect completely new entries
    publicEntries.forEach(entry => {
      if (!previousPublic[entry.uuid]) {
        movements.newInPublic.push(entry);
      }
    });

    publishedEntries.forEach(entry => {
      if (!previousPublished[entry.uuid]) {
        movements.newInPublished.push(entry);
      }
    });

    return movements;
  }

  generateStateReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: this.getJournalSummary(),
      recentMigrations: this.getCompletedMigrations(5),
      pendingActions: this.getPendingMigrations(),
      statistics: {
        totalProcessingRuns: this.state.migrations.completed.length + this.state.migrations.pending.length,
        avgEntriesPerMigration: this.calculateAverageEntriesPerMigration(),
        oldestPendingMigration: this.getOldestPendingMigration()
      }
    };

    return report;
  }

  calculateAverageEntriesPerMigration() {
    const allMigrations = [...this.state.migrations.completed, ...this.state.migrations.pending];
    if (allMigrations.length === 0) return 0;

    const totalEntries = allMigrations.reduce((sum, migration) => sum + migration.entries.length, 0);
    return Math.round(totalEntries / allMigrations.length * 100) / 100;
  }

  getOldestPendingMigration() {
    if (this.state.migrations.pending.length === 0) return null;

    return this.state.migrations.pending
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
  }
}

module.exports = JournalStateTracker;