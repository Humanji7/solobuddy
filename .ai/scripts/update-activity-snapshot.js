#!/usr/bin/env node
/**
 * Cron script: updates activity-snapshot.json hourly
 * Run: node .ai/scripts/update-activity-snapshot.js
 */

const path = require('path');
const fs = require('fs').promises;

// Project root
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const LEGACY_HUB = path.join(PROJECT_ROOT, 'legacy', 'hub');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'activity-snapshot.json');

async function main() {
    try {
        // Change to legacy/hub directory for watcher module resolution
        process.chdir(LEGACY_HUB);

        // Dynamic require after chdir
        const watcher = require(path.join(LEGACY_HUB, 'watcher.js'));

        const snapshot = await watcher.exportActivitySnapshot();

        await fs.writeFile(OUTPUT_PATH, JSON.stringify(snapshot, null, 2));

        const activeCount = snapshot.projects.filter(p => p.isActive).length;
        const totalCount = snapshot.projects.length;

        console.log(`[${new Date().toISOString()}] Snapshot updated: ${activeCount}/${totalCount} active`);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error.message);
        process.exit(1);
    }
}

main();
