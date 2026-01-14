#!/usr/bin/env node
/**
 * Cron script: updates activity-snapshot.json hourly
 * Run: node hub/scripts/update-activity-snapshot.js
 */

const path = require('path');
const fs = require('fs').promises;

// Change to hub directory for proper module resolution
process.chdir(path.join(__dirname, '..'));

const watcher = require('../watcher.js');

const OUTPUT_PATH = path.join(__dirname, '..', '..', 'data', 'activity-snapshot.json');

async function main() {
    try {
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
