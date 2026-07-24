const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const appDir = path.join(require('os').homedir(), '.expo', 'state', 'sqlite'); // Expo sqlite path? No.
// expo-sqlite stores databases in the app's document directory. 
// Wait, the user is running on iOS Simulator or Android Emulator or physical device. I cannot easily read the SQLite db from here unless it's in the project folder.
