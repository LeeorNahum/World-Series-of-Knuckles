// --- Core Variables ---
let allWeekData = []; 
let playerChartInstance = null;
let playerPerformanceChartInstance = null; // Renamed from weeklyPerformanceChartInstance
let allTimePlayerNetProfitChartInstance = null; // Renamed from allTimePlayerProgressChartInstance
let appBaseDirHandle = null; // Renamed from rootDirHandle
const DB_NAME = 'KnucklesPokerDB';
const STORE_NAME = 'FileSystemHandles';
const ROOT_DIR_HANDLE_KEY = 'appBaseDirHandle'; // Key for the base app directory
let currentDashboardView = 'poker';
let canonicalPlayerNameMap = {}; // Map lowercase name to original cased name

// --- DOM Elements ---
const initialSetupOverlay = document.getElementById('initial-setup-overlay');
const setupDataDirButton = document.getElementById('setup-data-dir-button');
const weekSelector = document.getElementById('week-selector');
const playerEntriesContainer = document.getElementById('player-entries-container');
// const sessionIdInput = document.getElementById('session-id'); // Removed: No longer using numeric, visible ID input
const overallStatsContainer = document.getElementById('overall-stats');
const playerListContainer = document.getElementById('player-list');
const playerDetailsSection = document.getElementById('player-details-section');
const playerDetailNameEl = document.getElementById('player-detail-name');
const playerDetailContextEl = document.getElementById('player-detail-games-context');
const playerDetailAvatarEl = document.getElementById('player-detail-avatar');
const playerSpecificStatsContainer = document.getElementById('player-specific-stats');
const playerDetailNameGamesEl = document.getElementById('player-detail-name-games');
const playerGamesTableContainer = document.getElementById('player-games-table-container');
const playerPerformanceChartContainer = document.getElementById('player-performance-chart-container'); // Renamed weeklyPerformanceChartContainer
const playerPerformanceChartCanvas = document.getElementById('player-performance-chart'); // Renamed weeklyPerformanceChartCanvas
const allTimePlayerNetProfitChartContainer = document.getElementById('all-time-player-net-profit-chart-container'); // Renamed allTimePlayerProgressChartContainer
const allTimePlayerNetProfitChartCanvas = document.getElementById('all-time-player-net-profit-chart'); // Renamed allTimePlayerProgressChartCanvas
const manageDataWeekSelector = document.getElementById('manage-data-week-selector');
const editWeekDetailsForm = document.getElementById('edit-week-details-form');
const manageSessionNameInput = document.getElementById('manage-session-name');
const manageSessionDateInput = document.getElementById('manage-session-date');
const manageWeekMysteryDrinkNameInput = document.getElementById('manage-week-mystery-drink-name');
const manageWeekDrinkImageInput = document.getElementById('manage-week-drink-image');
const currentWeekDrinkImageDisplay = document.getElementById('current-week-drink-image-display');
const saveWeekChangesButton = document.getElementById('save-week-changes-button');
const deleteThisWeekButton = document.getElementById('delete-this-week-button');
const managePlayerEntriesContainer = document.getElementById('manage-player-entries-container');
const managePlayerAvatarsSection = document.getElementById('manage-player-avatars-section');
const manageAvatarPlayerSelector = document.getElementById('manage-avatar-player-selector');
const currentPlayerAvatarDisplay = document.getElementById('current-player-avatar-display');
const newPlayerAvatarInput = document.getElementById('new-player-avatar-input');
const savePlayerAvatarButton = document.getElementById('save-player-avatar-button');

// --- UUID Generation ---
function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// --- IndexedDB & File System --- 
async function openDB() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(STORE_NAME)) { db.createObjectStore(STORE_NAME); } }; request.onsuccess = event => resolve(event.target.result); request.onerror = event => reject(event.target.error); }); }
async function saveHandle(key, handle) { const db = await openDB(); return new Promise((resolve, reject) => { const transaction = db.transaction(STORE_NAME, 'readwrite'); const store = transaction.objectStore(STORE_NAME); const request = store.put(handle, key); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); }
async function getHandle(key) { const db = await openDB(); return new Promise((resolve, reject) => { const transaction = db.transaction(STORE_NAME, 'readonly'); const store = transaction.objectStore(STORE_NAME); const request = store.get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
        
async function getAppBaseDirHandle(forceNew = false) {
    if (appBaseDirHandle && !forceNew) return appBaseDirHandle;
    
    const previousHandle = appBaseDirHandle; // Store previous handle in case forceNew is cancelled
    if (forceNew) {
        appBaseDirHandle = null; // Clear global handle to ensure we try to get a new one
    }

    // Try to retrieve from IndexedDB only if not forcing a new selection and no current handle
    if (!appBaseDirHandle && !forceNew) { 
        try {
            const storedHandle = await getHandle(ROOT_DIR_HANDLE_KEY);
            if (storedHandle) {
                if (await storedHandle.queryPermission({ mode: 'readwrite' }) === 'granted') {
                    appBaseDirHandle = storedHandle;
                    return appBaseDirHandle;
                } else if (await storedHandle.requestPermission({ mode: 'readwrite' }) === 'granted') {
                    appBaseDirHandle = storedHandle;
                    return appBaseDirHandle;
                }
            }
        } catch (e) {
            console.error("Error retrieving stored app base handle:", e);
        }
    }

    // If we still don't have a handle (either initial load, or forceNew, or stored handle failed/denied)
    // then show the directory picker.
    if (!appBaseDirHandle || forceNew) {
        try {
            console.log("Requesting directory picker for app base directory...");
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await saveHandle(ROOT_DIR_HANDLE_KEY, handle);
            appBaseDirHandle = handle; // Set the new handle
            initialSetupOverlay.style.display = 'none'; 
            return appBaseDirHandle;
        } catch (err) {
            console.error('User cancelled directory picker or error selecting app base directory:', err);
            // If forcing a new one and user cancelled, revert to previous if it existed, otherwise show overlay.
            if (forceNew) {
                appBaseDirHandle = previousHandle; // Revert to the handle before this forceNew attempt
                // No alert here, handleChangeDataFolderRequest will handle it.
                if (!appBaseDirHandle) { // If there was no previous handle either (e.g. initial setup truly cancelled)
                    initialSetupOverlay.style.display = 'flex';
                }
                return null; // Indicate cancellation of the forced new selection
            } else {
                // Standard initial setup failure
                alert("Selection of the main application directory is required. A 'Data' subfolder will be used inside it.");
                initialSetupOverlay.style.display = 'flex'; 
                return null;
            }
        }
    }
    return appBaseDirHandle; // Should ideally not be reached if logic is correct, but as a fallback.
}

async function getDataDirHandle(createIfNeeded = false) {
    const baseHandle = await getAppBaseDirHandle();
    if (!baseHandle) return null;
    try {
        // Use createIfNeeded when calling getDirectoryHandle
        const dataHandle = await baseHandle.getDirectoryHandle('Data', { create: createIfNeeded });
        return dataHandle;
    } catch (e) {
        // If createIfNeeded is false and directory doesn't exist, this might throw.
        // We only want to log/alert if it's an unexpected error or if creation was attempted.
        if (createIfNeeded || e.name !== 'NotFoundError') {
            console.error(`Error getting${createIfNeeded ? '/creating' : ''} 'Data' directory handle:`, e);
            alert(`Could not access${createIfNeeded ? ' or create' : ''} the 'Data' subdirectory. Please ensure permissions are correct and the directory exists if not creating.`);
        } else {
            // console.info("'Data' directory not found, and createIfNeeded is false."); // Optional: for debugging
        }
        return null;
    }
}

async function getPlayersDirHandle(createIfNeeded = false) {
    const baseHandle = await getAppBaseDirHandle();
    if (!baseHandle) {
        console.error("Application base directory handle not available for Players Directory.");
        return null;
    }
    try {
        // Ensure Data directory is potentially created first if we need to create Players
        const dataDir = await baseHandle.getDirectoryHandle('Data', { create: createIfNeeded });
        if (!dataDir) { // If Data dir couldn't be obtained/created
             if (createIfNeeded) console.error("Could not get/create Data directory to create Players directory.");
             return null;
        }
        const playersDirHandle = await dataDir.getDirectoryHandle('Players', { create: createIfNeeded });
        return playersDirHandle;
    } catch (e) {
        if (createIfNeeded || e.name !== 'NotFoundError') {
            console.error(`Error getting${createIfNeeded ? '/creating' : ''} 'Data/Players' directory handle:`, e);
            alert(`Could not access${createIfNeeded ? ' or create' : ''} the 'Data/Players' subdirectory.`);
        } else {
            // console.info("'Data/Players' directory not found, and createIfNeeded is false."); // Optional: for debugging
        }
        return null;
    }
}

async function loadAllWeekDataFromFS() {
    allWeekData = [];
    const dataDirHandle = await getDataDirHandle(false); 
    if (!dataDirHandle) {
        console.info("'Data' directory not found. No data loaded.");
        buildCanonicalPlayerNameMap(); 
        return; 
    }

    try {
        for await (const entry of dataDirHandle.values()) {
            if (entry.kind === 'directory' && entry.name !== 'Players') { 
                const sessionUUID = entry.name;
                try {
                    const dataFileHandle = await entry.getFileHandle('game_data.json', { create: false }); // Changed filename
                    const file = await dataFileHandle.getFile();
                    const content = await file.text();
                    const gameData = JSON.parse(content); // Renamed weekData to gameData

                    // Ensure gameData has a drinks array, even if empty, for consistent handling later
                    if (!gameData.drinks) {
                        gameData.drinks = [];
                    }
                    // Remove legacy single drink properties if they exist on load (for older data before manual migration)
                    delete gameData.weekMysteryDrinkName;
                    delete gameData.weekMysteryDrinkImagePath;
                    // Remove legacy MysteryDrinkRating from players (for older data)
                    if (gameData.players) {
                        gameData.players.forEach(player => {
                            delete player.MysteryDrinkRating;
                        });
                    }

                    if (!gameData.uuid) {
                        console.warn(`Game data in folder ${sessionUUID} is missing a UUID. Using folder name as UUID.`);
                        gameData.uuid = sessionUUID;
                    } else if (gameData.uuid !== sessionUUID) {
                        console.warn(`UUID mismatch for folder ${sessionUUID}. JSON UUID: ${gameData.uuid}. Prioritizing folder name.`);
                        gameData.uuid = sessionUUID; 
                    }
                    allWeekData.push(gameData); // gameData is the new structure
                } catch (e) {
                    console.warn(`Could not read game_data.json for ${entry.name}: `, e); // Changed filename
                }
            }
        }
        // Sort by date (ascending) then by UUID (ascending) for tie-breaking
        allWeekData.sort((a, b) => {
            const dateComparison = new Date(a.date) - new Date(b.date);
            if (dateComparison !== 0) return dateComparison;
            return a.uuid.localeCompare(b.uuid);
        });
        buildCanonicalPlayerNameMap();
    } catch (err) {
        console.error("Error loading week data from Data directory:", err);
        alert("Error loading data. Ensure the 'Data' directory is accessible and permissions are granted.");
    }
    return allWeekData;
}

async function saveWeekDataToFS(gameDataToSave) { // Renamed weekDataToSave to gameDataToSave
    const dataDirHandle = await getDataDirHandle(true); 
    if (!dataDirHandle) {
        alert("Failed to get or create the main 'Data' directory. Cannot save game."); // Updated message
        return false;
    }

    let processedGameData = { ...gameDataToSave }; 

    if (!processedGameData.uuid) { 
        processedGameData.uuid = generateUUID();
    }
    const gameFolderName = processedGameData.uuid; 

    try {
        const gameDirHandle = await dataDirHandle.getDirectoryHandle(gameFolderName, { create: true }); // Renamed weekDirHandle
        
        // Process drinks: save images and update paths
        if (processedGameData.drinks && Array.isArray(processedGameData.drinks)) {
            try {
                // Step 1: First collect all existing images to avoid name collisions later
                const existingImageFiles = [];
                try {
                    for await (const entry of gameDirHandle.values()) {
                        if (entry.kind === 'file' && entry.name.startsWith('drink_') && 
                           (entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || 
                            entry.name.endsWith('.jpeg') || entry.name.endsWith('.gif'))) {
                            existingImageFiles.push(entry.name);
                            console.log(`Found existing image: ${entry.name}`);
                        }
                    }
                } catch (err) {
                    console.log("Error scanning existing files or new folder:", err);
                    // Continue even if this fails - we'll just create new files
                }
                
                // Step 2: Clean up old image files if they exist and aren't referenced anymore
                if (existingImageFiles.length > 0) {
                    const newImagePaths = new Set();
                    // Add image paths that should be kept (will be overwritten if changed)
                    processedGameData.drinks.forEach((drink, index) => {
                        if (drink.drinkImagePath && !drink.drinkImageFile) {
                            // We're keeping this existing path
                            console.log(`Keeping reference to existing image: ${drink.drinkImagePath}`);
                            newImagePaths.add(drink.drinkImagePath);
                        }
                    });
                    
                    // Delete any images not referenced anymore
                    for (const oldFile of existingImageFiles) {
                        if (!newImagePaths.has(oldFile)) {
                            try {
                                console.log(`Removing unused drink image: ${oldFile}`);
                                await gameDirHandle.removeEntry(oldFile);
                            } catch (e) {
                                console.warn(`Could not delete unused image ${oldFile}:`, e);
                            }
                        }
                    }
                }
                
                // Step 3: Save all drink images with new consistent naming
                for (let i = 0; i < processedGameData.drinks.length; i++) {
                    const drink = processedGameData.drinks[i];
                    console.log(`Processing drink ${i+1}: ${drink.drinkName}`);
                    
                    // Generate the proper sequential filename
                    const imageFileName = `drink_${i+1}`;
                    
                    // If there's a new file to save
                    if (drink.drinkImageFile) {
                        try {
                            // Get file extension or default to png
                            let ext = 'png';
                            if (drink.drinkImageFile.name && drink.drinkImageFile.name.includes('.')) {
                                ext = drink.drinkImageFile.name.split('.').pop().toLowerCase();
                            } else if (drink.drinkImageFile.type) {
                                // Extract from MIME type (e.g., "image/jpeg" -> "jpeg")
                                ext = drink.drinkImageFile.type.split('/')[1] || 'png';
                            }
                            
                            // Create filename with proper extension
                            const drinkImageName = `${imageFileName}.${ext}`;
                            console.log(`Saving drink image as: ${drinkImageName}`);
                            
                            // Create file and write
                            const imageFileHandle = await gameDirHandle.getFileHandle(drinkImageName, { create: true });
            const imageWritable = await imageFileHandle.createWritable();
                            await imageWritable.write(drink.drinkImageFile);
            await imageWritable.close();
                            
                            // Update the path and remove the file object
                            drink.drinkImagePath = drinkImageName;
                            console.log(`Successfully saved image for ${drink.drinkName} as ${drinkImageName}`);
                            
                            // Always clean up the file object to avoid circular references
                            delete drink.drinkImageFile;
                        } catch (err) {
                            console.error(`Error saving image for drink ${drink.drinkName}:`, err);
                            // If error occurs, don't set the path
                            delete drink.drinkImagePath;
                            delete drink.drinkImageFile;
                        }
                    } 
                    // Handle case where we want to keep existing image but rename it to match new index
                    else if (drink.drinkImagePath) {
                        try {
                            const oldPath = drink.drinkImagePath;
                            const ext = oldPath.split('.').pop(); // Get extension from original file
                            const newPath = `${imageFileName}.${ext}`;
                            
                            if (oldPath !== newPath) {
                                console.log(`Renaming ${oldPath} to ${newPath}`);
                                // Get the old file and read its data
                                const oldFileHandle = await gameDirHandle.getFileHandle(oldPath, { create: false });
                                const oldFile = await oldFileHandle.getFile();
                                
                                // Create the new file with the updated name
                                const newFileHandle = await gameDirHandle.getFileHandle(newPath, { create: true });
                                const newWritable = await newFileHandle.createWritable();
                                await newWritable.write(oldFile);
                                await newWritable.close();
                                
                                // Delete the old file
                                await gameDirHandle.removeEntry(oldPath);
                                
                                // Update the path in the drink object
                                drink.drinkImagePath = newPath;
                                console.log(`Successfully renamed image for ${drink.drinkName} to ${newPath}`);
                            }
                        } catch (err) {
                            console.error(`Error renaming image for drink ${drink.drinkName}:`, err);
                            // If renaming fails, keep the old path
                        }
                    } else {
                        // No image for this drink
                        console.log(`No image for drink ${drink.drinkName}`);
                        delete drink.drinkImagePath;
                        delete drink.drinkImageFile;
                    }
                }
            } catch (err) {
                console.error("Error processing drink images:", err);
                // Continue with saving even if image processing fails
            }
        }

        // Remove legacy top-level drink properties before saving
        delete processedGameData.weekMysteryDrinkName;
        delete processedGameData.weekDrinkImageFile; 
        delete processedGameData.weekMysteryDrinkImagePath; 

        // Ensure players don't have the old MysteryDrinkRating property
        if (processedGameData.players) {
            processedGameData.players.forEach(player => {
                delete player.MysteryDrinkRating;
            });
        }
        
        const dataFileHandle = await gameDirHandle.getFileHandle('game_data.json', { create: true }); // Changed filename
        const writable = await dataFileHandle.createWritable();
        await writable.write(JSON.stringify(processedGameData, null, 2)); 
        await writable.close();
        return true;
    } catch (err) {
        console.error(`Error saving data for game ${processedGameData.uuid} in Data directory:`, err); // Updated message
        alert(`Failed to save game ${processedGameData.name} (${processedGameData.uuid}). Check console for errors.`); // Updated message
        return false;
    }
}

async function deleteWeekDataFS(gameUUID) { // Renamed sessionUUID to gameUUID
    const dataDirHandle = await getDataDirHandle();
    if (!dataDirHandle) return false;
    const gameFolderName = gameUUID; // Renamed weekFolderName
    const gameToDelete = allWeekData.find(w => w.uuid === gameUUID); // Renamed weekToDelete, sessionUUID
    const gameNameForConfirm = gameToDelete ? gameToDelete.name : gameUUID; // Renamed sessionNameForConfirm

    if (!confirm(`Are you sure you want to delete all data for game '${gameNameForConfirm}' (UUID: ${gameUUID}) from the Data directory? This is permanent.`)) { // Updated message
        return false;
    }
    try {
        await dataDirHandle.removeEntry(gameFolderName, { recursive: true });
        return true;
    } catch (err) {
        console.error(`Error deleting folder ${gameFolderName} from Data directory:`, err);
        alert(`Failed to delete game ${gameNameForConfirm}. Check console.`); // Updated message
        return false;
    }
}

// --- Initialization ---
window.onload = async () => {
    setupDataDirButton.onclick = async () => { 
        appBaseDirHandle = null; 
        await initializeApp(); 
    };
    await initializeApp();
};

async function initializeApp() {
    // Try to get the base directory handle first. This might show the picker.
    // If a handle is obtained (or was already there), hide the overlay.
    // If not (e.g., user cancels picker), getAppBaseDirHandle itself will show alert and overlay might stay.
    appBaseDirHandle = await getAppBaseDirHandle(); 

    if (!appBaseDirHandle) {
        initialSetupOverlay.style.display = 'flex'; // Show overlay if no base dir selected
        return; // Stop initialization if no base directory is set
    }
    initialSetupOverlay.style.display = 'none'; // Hide if we have a base dir

    await loadAllWeekDataFromFS(); 
    // No longer need this check as loadAllWeekDataFromFS handles no Data dir case
    // if (!appBaseDirHandle && allWeekData.length === 0) { 
    //     const tempHandle = await getHandle(ROOT_DIR_HANDLE_KEY);
    //     if (!tempHandle) {
    //         initialSetupOverlay.style.display = 'flex'; 
    //         return;
    //     }
    // }
    
    populateWeekSelector();
    initializeAvatarManagementSection(); // Moved up to ensure map is ready
    showTab('dashboard'); 
    prepareNewSessionForm();
    renderManageDataList();
    // Add event listener for the new button
    const changeDataFolderButton = document.getElementById('change-data-folder-button');
    if (changeDataFolderButton) {
        changeDataFolderButton.onclick = handleChangeDataFolderRequest;
    } else {
        console.warn("Change Data Folder button not found during initialization.");
    }
}
        
function prepareNewSessionForm() {
    // const existingIds = allWeekData.map(w => w.id); // Old ID logic removed
    // const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1; // Old ID logic removed
    // sessionIdInput.value = nextId; // Element removed
    document.getElementById('session-name').value = '';
    document.getElementById('session-date').valueAsDate = new Date();
    
    // Clear old single drink fields if they somehow still exist or were missed (belt and braces)
    const oldDrinkName = document.getElementById('week-mystery-drink-name');
    if (oldDrinkName) oldDrinkName.value = '';
    const oldDrinkImage = document.getElementById('week-drink-image');
    if (oldDrinkImage) oldDrinkImage.value = '';

    // Clear dynamic drink entries
    const newGameDrinksContainer = document.getElementById('new-game-drinks-container');
    if (newGameDrinksContainer) newGameDrinksContainer.innerHTML = '';
    // newGameDrinkEntryCount = 0; // Replaced with context specific reset
    drinkEntryIdCounter.new = 0; // Reset counter for new drink entries in 'new' context

    playerEntriesContainer.innerHTML = '';
    addPlayerEntryField(); // Add one default player field
    // updateAllDrinkRatingForms('new'); // Called by addPlayerEntryField if needed, or call here if first drink form is auto-added
}

// --- UI Navigation & General UI ---
function showTab(tabKey) { 
    const allTabs = document.querySelectorAll('.tab-content'); 
    allTabs.forEach(t => t.classList.remove('active')); 
    document.getElementById(tabKey).classList.add('active'); 
    const allNavButtons = document.querySelectorAll('nav button'); 
    allNavButtons.forEach(b => b.classList.remove('active')); 
    if (tabKey === 'dashboard') document.getElementById('nav-dashboard').classList.add('active'); 
    else if (tabKey === 'data-entry') document.getElementById('nav-entry').classList.add('active'); 
    else if (tabKey === 'manage-data') document.getElementById('nav-manage-data').classList.add('active');
    
    if (tabKey === 'dashboard') renderDashboardUI(getSelectedGameUUID()); 
    if (tabKey === 'data-entry') prepareNewSessionForm(); 
    if (tabKey === 'manage-data') renderManageDataList();
}

function populateWeekSelector() { 
    weekSelector.innerHTML = '<option value="all">All Time</option>'; 
    allWeekData.forEach(week => { // Assumes allWeekData is sorted by date
        const option = document.createElement('option'); 
        option.value = week.uuid; // Use UUID as value
        option.textContent = `${week.name} (Game Date: ${week.date})`; // Display name and date
        weekSelector.appendChild(option); 
    }); 
}

function getSelectedGameUUID() { return weekSelector.value; } // Renamed from getSelectedWeekId

function handleWeekSelectionChange() { 
    currentDashboardView = 'poker'; 
    renderDashboardUI(getSelectedGameUUID()); 
    playerDetailsSection.style.display = 'none'; 
}
function toggleDashboardView() { 
    currentDashboardView = (currentDashboardView === 'poker') ? 'drinks' : 'poker'; 
    renderDashboardUI(getSelectedGameUUID()); 
}
function sanitizeForFileName(name) { return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, ''); }
function formatCurrency(amount) { return (amount !== null && typeof amount !== 'undefined' ? amount : 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatPercentage(value) {
    if (value === null || typeof value === 'undefined') {
        return 'N/A';
    }
    if (!isFinite(value)) { // Handles Infinity and -Infinity
        return 'N/A'; 
    }
    return value.toFixed(1) + '%';
}
function getPlayerImagePath(canonicalPlayerName) { 
    if (!canonicalPlayerName) return 'knuckles.png';
    return `Data/Players/${sanitizeForFileName(canonicalPlayerName)}.png`;
}

// --- Data Entry Logic (High-level form save) ---
function addPlayerEntryField() {
    const entryCount = playerEntriesContainer.children.length;
    const playerDiv = document.createElement('div');
    playerDiv.classList.add('player-summary-card');
    
    // No longer nested - directly use the player-summary-card structure
    playerDiv.innerHTML = `
        <div class="player-info-card">
            <img src="knuckles.png" class="player-info-avatar" alt="Default Player Avatar" onerror="this.onerror=null;this.src='knuckles.png';">
            <div class="player-info-details">
                <input type="text" class="player-name" placeholder="Player Name" required style="font-size: 1.4em; font-weight: bold; background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); width: 100%; margin: 0; padding: 5px; border-radius: 4px;">
                <div class="player-info-games" style="font-size: 0.9em; color: var(--text-secondary); margin-top: 4px;">New Player</div>
            </div>
        </div>
        <div class="player-metrics-grid">
            <div class="metric-card">
                <div class="metric-card-label">BUY-IN AMOUNT</div>
                <input type="number" class="player-buyin metric-card-value" value="0" min="0" step="any" required style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); width: 100%; text-align: center; font-size: 1.5em; font-weight: bold; padding: 5px;">
            </div>
            <div class="metric-card">
                <div class="metric-card-label">FINAL AMOUNT</div>
                <input type="number" class="player-final-amount metric-card-value" value="0" min="0" step="any" required style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); width: 100%; text-align: center; font-size: 1.5em; font-weight: bold; padding: 5px;">
            </div>
        </div>
        <button type="button" class="remove-player" onclick="this.closest('.player-summary-card').remove(); updateAllDrinkRatingForms('new');">Remove Player</button>
    `;
    
    // Add event listener for player name input to update avatar and status
    const playerNameInput = playerDiv.querySelector('.player-name');
    const playerAvatar = playerDiv.querySelector('.player-info-avatar');
    const playerStatusText = playerDiv.querySelector('.player-info-games');
    
    playerNameInput.addEventListener('input', function() {
        const enteredName = playerNameInput.value.trim();
        const lcName = enteredName.toLowerCase();
        
        // Check if this is an existing player
        if (enteredName && canonicalPlayerNameMap[lcName]) {
            playerStatusText.textContent = "Existing Player";
            playerAvatar.src = getPlayerImagePath(canonicalPlayerNameMap[lcName]);
            playerAvatar.onerror = function() { this.src = 'knuckles.png'; };
        } else {
            playerStatusText.textContent = "New Player";
            playerAvatar.src = 'knuckles.png';
        }
        
        // Update all drink rating forms with the new name
        updateAllDrinkRatingForms('new');
    });
    
    playerEntriesContainer.appendChild(playerDiv);
    updateAllDrinkRatingForms('new'); // Update drink forms when a new player is added
}

// --- Drink Entry Form Management (New & Manage Game) ---
let drinkEntryIdCounter = { new: 0, manage: 0 }; // Context-aware counter

function addDrinkEntryForm(context) {
    drinkEntryIdCounter[context]++;
    const drinkId = drinkEntryIdCounter[context];

    const drinksContainerId = context === 'new' ? 'new-game-drinks-container' : 'manage-game-drinks-container';
    const drinksContainer = document.getElementById(drinksContainerId);
    if (!drinksContainer) {
        console.error(`Container for drink entries '${drinksContainerId}' not found.`);
        return null;
    }

    // Style like dashboard drink cards
    const drinkEntryDiv = document.createElement('div');
    drinkEntryDiv.classList.add('drink-card', 'detailed-drink-card');
    drinkEntryDiv.id = `drink-entry-${context}-${drinkId}`;
    drinkEntryDiv.dataset.drinkEntryId = drinkId;

    // Create the HTML structure similar to dashboard drink cards
    drinkEntryDiv.innerHTML = `
        <div class="drink-profile-image-container" id="drink-image-container-${context}-${drinkId}">
            <p class="image-not-found">Click to add image</p>
            <input type="file" id="drink-image-${context}-${drinkId}" class="drink-form-image hidden-file-input" accept="image/png, image/jpeg" style="display:none;">
        </div>
        
        <div class="drink-info-content">
            <input type="text" id="drink-name-${context}-${drinkId}" class="drink-form-name drink-name-input" placeholder="Enter Drink Name" required>
            
            <h5>Player Ratings</h5>
            <div class="drink-player-ratings-grid" id="player-ratings-for-drink-${context}-${drinkId}">
                <!-- Ratings cards will be added here -->
            </div>
            
            <button type="button" class="remove-drink-button" onclick="this.closest('.drink-card').remove()">Remove Drink</button>
        </div>
    `;
    
    drinksContainer.appendChild(drinkEntryDiv);
    
    // Add event listener for the drink name input to update the ratings grid title
    const drinkNameInput = drinkEntryDiv.querySelector('.drink-form-name');
    drinkNameInput.addEventListener('input', function() {
        // Update player ratings grid title if needed
        updateDrinkPlayerRatingsForm(drinkEntryDiv, context);
    });
    
    // Set up the click-to-upload functionality
    const imageContainer = drinkEntryDiv.querySelector(`.drink-profile-image-container`);
    const fileInput = drinkEntryDiv.querySelector('.drink-form-image');
    
    if (imageContainer && fileInput) {
        // Make the image container clickable to trigger file input
        imageContainer.style.cursor = 'pointer';
        imageContainer.addEventListener('click', function() {
            fileInput.click();
        });
        
        // Add hover effect
        imageContainer.addEventListener('mouseenter', function() {
            this.style.opacity = '0.8';
            this.style.background = 'rgba(0,0,0,0.4)';
        });
        
        imageContainer.addEventListener('mouseleave', function() {
            this.style.opacity = '1';
            this.style.background = 'var(--bg-tertiary)';
        });
        
        // Handle file selection
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const selectedFile = this.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    // Store the file directly on the container for later access
                    imageContainer.file = selectedFile;
                    
                    imageContainer.innerHTML = `
                        <img src="${e.target.result}" alt="Selected Image" class="drink-profile-image">
                        <input type="file" id="drink-image-${context}-${drinkId}" class="drink-form-image hidden-file-input" accept="image/png, image/jpeg" style="display:none;">
                    `;
                    
                    // Set a flag to indicate we have a file
                    imageContainer.dataset.hasImage = "true";
                    
                    // Get the updated file input
                    const newFileInput = imageContainer.querySelector('.drink-form-image');
                    
                    // Set up click event 
                    imageContainer.addEventListener('click', function() {
                        newFileInput.click();
                    });
                    
                    // Handle future file changes
                    newFileInput.addEventListener('change', function() {
                        if (this.files && this.files[0]) {
                            const newSelectedFile = this.files[0];
                            const newReader = new FileReader();
                            newReader.onload = function(e) {
                                // Update the container with the new image
                                imageContainer.innerHTML = `
                                    <img src="${e.target.result}" alt="Selected Image" class="drink-profile-image">
                                    <input type="file" id="drink-image-${context}-${drinkId}" class="drink-form-image hidden-file-input" accept="image/png, image/jpeg" style="display:none;">
                                `;
                                
                                // Update the stored file
                                imageContainer.file = newSelectedFile;
                                imageContainer.dataset.hasImage = "true";
                                
                                // Set up click event again
                                const newestFileInput = imageContainer.querySelector('.drink-form-image');
                                imageContainer.addEventListener('click', function() {
                                    newestFileInput.click();
                                });
                                
                                newestFileInput.addEventListener('change', this.onchange);
                            };
                            newReader.readAsDataURL(newSelectedFile);
                        }
                    });
                };
                reader.readAsDataURL(selectedFile);
                
                // Store the file reference directly
                console.log(`Selected file for drink ${drinkId} in ${context} context:`, selectedFile.name);
            }
        });
    }
    
    updateDrinkPlayerRatingsForm(drinkEntryDiv, context);
    return drinkEntryDiv;
}

function updateDrinkPlayerRatingsForm(drinkEntryDiv, context) {
    const ratingsContainer = drinkEntryDiv.querySelector('.drink-player-ratings-grid');
    if (!ratingsContainer) return;

    const drinkEntryId = drinkEntryDiv.dataset.drinkEntryId;
    const playerEntriesContainerId = context === 'new' ? 'player-entries-container' : 'manage-player-entries-container';
    const playersContainer = document.getElementById(playerEntriesContainerId);
    if (!playersContainer) return;

    const playerEntries = playersContainer.querySelectorAll(context === 'new' ? '.player-summary-card' : '.player-entry-manage');
    
    // Preserve existing ratings if any, keyed by player name
    const existingRatings = {};
    ratingsContainer.querySelectorAll('.drink-form-player-rating').forEach(input => {
        const playerName = input.dataset.playerName;
        if (playerName && input.value !== '') {
            existingRatings[playerName.toLowerCase()] = parseFloat(input.value);
        }
    });

    ratingsContainer.innerHTML = ''; // Clear existing rating fields

    if (playerEntries.length === 0) {
        ratingsContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Add players to rate this drink</p>';
        return;
    }

    playerEntries.forEach((playerEntry, index) => {
        const playerNameInput = playerEntry.querySelector(context === 'new' ? '.player-name' : '.player-name-manage');
        const playerName = playerNameInput ? playerNameInput.value.trim() : 'Player ' + (index + 1);
        const lcPlayerName = playerName.toLowerCase();
        
        if (!playerName) return; // Skip if player name is not yet entered

        const ratingValue = existingRatings[lcPlayerName] !== undefined ? existingRatings[lcPlayerName] : '';
        const displayName = canonicalPlayerNameMap[lcPlayerName] || playerName;

        // Create a player rating card similar to dashboard
        const ratingDiv = document.createElement('div');
        ratingDiv.classList.add('player-rating-metric');
        ratingDiv.innerHTML = `
            <div class="metric-card-label">${displayName}</div>
            <input type="number" id="${context}-drink-${drinkEntryId}-rating-${lcPlayerName}" 
                   class="drink-form-player-rating metric-card-value" 
                   data-player-name="${playerName}" 
                   value="${ratingValue}"
                   min="0" max="10" step="0.1"
                   style="text-align: center; font-weight: bold;">
        `;
        ratingsContainer.appendChild(ratingDiv);
        
        // Add change listener to rating input for real-time updates
        const ratingInput = ratingDiv.querySelector('.drink-form-player-rating');
        ratingInput.addEventListener('input', function() {
            // This could be used for immediate feedback or validation
            // For example, changing background color based on rating value
            if (this.value !== '') {
                const ratingVal = parseFloat(this.value);
                if (ratingVal >= 0 && ratingVal <= 10) {
                    this.style.backgroundColor = getRatingColor(ratingVal);
                    this.style.color = 'white';
                } else {
                    this.style.backgroundColor = '';
                    this.style.color = '';
                }
            } else {
                this.style.backgroundColor = '';
                this.style.color = '';
            }
        });
        
        // Trigger input event to apply initial styling
        if (ratingValue !== '') {
            const event = new Event('input', { bubbles: true });
            ratingInput.dispatchEvent(event);
        }
    });
}

function updateAllDrinkRatingForms(context) {
    const drinksContainerId = context === 'new' ? 'new-game-drinks-container' : 'manage-game-drinks-container';
    const drinksContainer = document.getElementById(drinksContainerId);
    if (!drinksContainer) return;

    drinksContainer.querySelectorAll('.drink-card').forEach(drinkEntryDiv => {
        updateDrinkPlayerRatingsForm(drinkEntryDiv, context);
    });
}
        
async function saveEnteredSessionData() { 
    const gameName = document.getElementById('session-name').value.trim();
    const gameDate = document.getElementById('session-date').value;

    if (!gameName) { alert("Game Name is required."); return; }
    if (!gameDate) { alert("Game Date is required."); return; }

    const newGameData = {
        name: gameName, 
        date: gameDate, 
        players: [],
        drinks: []
    };

    // Collect Player Data
    const playerEntries = playerEntriesContainer.querySelectorAll('.player-summary-card');
    if (playerEntries.length === 0) { alert("Add at least one player."); return; }

    let hasValidPlayer = false;
    for (const entry of playerEntries) {
        const playerName = entry.querySelector('.player-name').value.trim();
        const buyInStr = entry.querySelector('.player-buyin').value;
        const finalAmountStr = entry.querySelector('.player-final-amount').value;
        
        const buyIn = buyInStr !== '' ? parseFloat(buyInStr) : 0;
        const finalAmount = finalAmountStr !== '' ? parseFloat(finalAmountStr) : 0;

        if (playerName && !isNaN(buyIn) && !isNaN(finalAmount)) {
            newGameData.players.push({ PlayerName: playerName, BuyIn: buyIn, FinalAmount: finalAmount });
            hasValidPlayer = true;
        }
    }
    if (!hasValidPlayer) { alert("No valid player data entered."); return; }
    
    // Collect Drink Data
    const drinkForms = document.getElementById('new-game-drinks-container').querySelectorAll('.drink-card');
    drinkForms.forEach(drinkForm => {
        const drinkNameInput = drinkForm.querySelector('.drink-form-name');
        const imageContainer = drinkForm.querySelector('.drink-profile-image-container');
        
        const drinkName = drinkNameInput ? drinkNameInput.value.trim() : null;
        
        // Try to get the image file 
        let drinkImageFile = null;
        
        // Check if the image container has a file directly attached to it (best source)
        if (imageContainer.file) {
            console.log(`Using stored file from container for ${drinkName}`);
            drinkImageFile = imageContainer.file;
        }
        // Otherwise check if there's a file in the input 
        else {
            const fileInput = drinkForm.querySelector('.drink-form-image');
            
            if (fileInput && fileInput.files && fileInput.files[0]) {
                drinkImageFile = fileInput.files[0];
                console.log(`Using file from input for ${drinkName}`);
            } else {
                // If no file in the input, check for img element, which means an image was selected
                const imgElement = imageContainer.querySelector('img.drink-profile-image');
                if (imgElement && !imgElement.src.includes('knuckles.png')) {
                    // Extract file from the img src if it's a blob URL or data URL
                    const imgSrc = imgElement.getAttribute('src');
                    
                    // Try to find a hidden file input that may have the file
                    const hiddenFileInput = imageContainer.querySelector('.hidden-file-input');
                    if (hiddenFileInput && hiddenFileInput.files && hiddenFileInput.files[0]) {
                        drinkImageFile = hiddenFileInput.files[0];
                        console.log(`Using file from hidden input for ${drinkName}`);
                    } else if (imgSrc.startsWith('data:')) {
                        try {
                            // Convert data URL to blob for saving
                            const byteString = atob(imgSrc.split(',')[1]);
                            const mimeType = imgSrc.split(',')[0].split(':')[1].split(';')[0];
                            const ab = new ArrayBuffer(byteString.length);
                            const ia = new Uint8Array(ab);
                            for (let i = 0; i < byteString.length; i++) {
                                ia[i] = byteString.charCodeAt(i);
                            }
                            drinkImageFile = new Blob([ab], { type: mimeType });
                            drinkImageFile.name = `drink_${Date.now()}.${mimeType.split('/')[1]}`;
                            console.log(`Created blob from data URL for ${drinkName}`);
                        } catch (e) {
                            console.error("Error converting data URL to blob for drink:", drinkName, e);
                        }
                    }
                }
            }
        }

        if (drinkName) { // Only add drink if it has a name
            const currentDrinkRatings = [];
            const ratingInputs = drinkForm.querySelectorAll('.drink-form-player-rating');
            ratingInputs.forEach(ratingInput => {
                const playerName = ratingInput.dataset.playerName;
                const ratingValue = ratingInput.value;
                if (playerName && ratingValue !== '') {
                    currentDrinkRatings.push({
                        playerName: playerName,
                        rating: parseFloat(ratingValue)
                    });
                }
            });

            // Add the drink with all the collected data
            newGameData.drinks.push({
                drinkName: drinkName,
                drinkImageFile: drinkImageFile,
                playerRatings: currentDrinkRatings
            });
        }
    });
    
    const success = await saveWeekDataToFS(newGameData);
    if (success) {
        alert(`Game '${newGameData.name}' saved successfully!`);
        await loadAllWeekDataFromFS(); 
        populateWeekSelector();
        prepareNewSessionForm();
        renderManageDataList();
        showTab('dashboard');
    }
}

// --- Data Aggregation & Calculation ---
function getAggregatedStatsForContext(selectedGameUUID = "all") { // Renamed selectedSessionUUID
    const relevantWeeks = selectedGameUUID === "all" 
        ? allWeekData 
        : allWeekData.filter(w => w.uuid === selectedGameUUID);

    if (!relevantWeeks || relevantWeeks.length === 0 && selectedGameUUID !== "all") {
        return { overall: { totalGames: 0, uniquePlayers: 0, totalBuyIns: 0, totalFinalAmounts: 0 }, players: {} };
    }

    let totalBuyIns = 0;
    let totalFinalAmounts = 0;
    const uniqueLcPlayerNames = new Set();
    const playerAggregatedStats = {}; 

    relevantWeeks.forEach(week => {
        week.players.forEach(player => {
            const lcPlayerName = player.PlayerName.toLowerCase();
            const canonicalName = canonicalPlayerNameMap[lcPlayerName] || player.PlayerName;
            uniqueLcPlayerNames.add(lcPlayerName);
            totalBuyIns += (player.BuyIn || 0);
            totalFinalAmounts += (player.FinalAmount || 0);

            if (!playerAggregatedStats[lcPlayerName]) {
                playerAggregatedStats[lcPlayerName] = {
                    canonicalName: canonicalName,
                    gamesPlayed: 0, totalBuyIn: 0, totalFinalAmount: 0, netProfit: 0, wins: 0, 
                    gameHistory: [],
                };
            }
            const stats = playerAggregatedStats[lcPlayerName];
            const net = (player.FinalAmount || 0) - (player.BuyIn || 0);
            const profitPercentage = (player.BuyIn !== 0 && player.BuyIn !== null) ? (net / player.BuyIn) * 100 : null;

            stats.gamesPlayed++;
            stats.totalBuyIn += (player.BuyIn || 0);
            stats.totalFinalAmount += (player.FinalAmount || 0);
            stats.netProfit += net;
            if (net > 0) stats.wins++;
            
            stats.gameHistory.push({
                // sessionId: `${week.name} (${week.date})`, // This is more like a gameId or gameLabel now
                gameLabel: `${week.name} (${week.date})`, // Renamed for clarity
                date: week.date,
                net: net,
                buyIn: player.BuyIn || 0,
                finalAmount: player.FinalAmount || 0,
                profitPercentage: profitPercentage, 
                sessionUUID: week.uuid, // Keep this as sessionUUID if it refers to the game's unique ID (folder name)
                gameName: week.name 
            });

            if (selectedGameUUID !== "all") { 
                stats.profitPercentage = profitPercentage;
            }
        });
    });

    // Calculate averageProfitPercentage for "all time" view
    if (selectedGameUUID === "all") {
        Object.values(playerAggregatedStats).forEach(pStats => {
            pStats.averageProfitPercentage = (pStats.totalBuyIn !== 0 && pStats.totalBuyIn !== null) ? (pStats.netProfit / pStats.totalBuyIn) * 100 : null;
        });
    }

    Object.values(playerAggregatedStats).forEach(pStats => {
        pStats.gameHistory.sort((a,b) => new Date(a.date) - new Date(b.date));
    });
    
    return {
        overall: {
            totalGames: relevantWeeks.length, // This correctly represents games now
            uniquePlayers: uniqueLcPlayerNames.size,
            totalBuyIns: totalBuyIns,
            totalFinalAmounts: totalFinalAmounts
        },
        players: playerAggregatedStats
    };
}

// --- Dashboard Rendering ---
function renderDashboardUI(selectedGameUUID = "all") { // Parameter renamed
    const pokerStatsDiv = document.getElementById('dashboard-poker-stats');
    const drinkStatsDiv = document.getElementById('dashboard-drink-stats');
    const allTimeDrinkStatsContainer = document.getElementById('all-time-drink-stats-container');
    const playerChartSpecificContainer = document.getElementById('player-chart-container'); 

    playerDetailsSection.style.display = 'none';
    drinkStatsDiv.style.display = 'none';
    allTimeDrinkStatsContainer.style.display = 'none';
    if (playerPerformanceChartContainer) playerPerformanceChartContainer.style.display = 'none'; // Renamed weeklyPerformanceChartContainer
    if (allTimePlayerNetProfitChartContainer) allTimePlayerNetProfitChartContainer.style.display = 'none'; // Renamed allTimePlayerProgressChartContainer
    pokerStatsDiv.style.display = 'none';

    if (selectedGameUUID === "all") { 
        if (allTimePlayerNetProfitChartContainer) allTimePlayerNetProfitChartContainer.style.display = 'block'; // Renamed allTimePlayerProgressChartContainer
        pokerStatsDiv.style.display = 'block';
        allTimeDrinkStatsContainer.style.display = 'block';
        
        renderAllTimePlayerNetProfitChart(); // Renamed renderAllTimePlayerProgressChart
        renderOverallStats(selectedGameUUID); 
        renderPlayerList(selectedGameUUID); 
        renderAllTimeDrinkStats(); 

        // Player detail section always hidden now
        playerDetailsSection.style.display = 'none';
        if(playerChartSpecificContainer) playerChartSpecificContainer.style.display = 'none';

    } else { // Specific game selected
        if (allTimePlayerNetProfitChartContainer) allTimePlayerNetProfitChartContainer.style.display = 'none';
        pokerStatsDiv.style.display = 'block';
        drinkStatsDiv.style.display = 'block'; 
        if (playerPerformanceChartContainer) playerPerformanceChartContainer.style.display = 'block'; // Renamed weeklyPerformanceChartContainer

        renderOverallStats(selectedGameUUID); // Pass renamed param
        renderPlayerList(selectedGameUUID);  // Pass renamed param
        renderDrinkStatsForGame(selectedGameUUID); // Pass renamed param
        renderPlayerPerformanceChart(selectedGameUUID); // Renamed renderWeeklyPerformanceChart
        
        if(playerChartSpecificContainer) playerChartSpecificContainer.style.display = 'none';
    }
}

function renderOverallStats(selectedGameUUID = "all") { // Renamed selectedSessionUUID
    const { overall } = getAggregatedStatsForContext(selectedGameUUID); // Use renamed param
    
    let overallStatsHTML = '';
    if (selectedGameUUID === "all") { 
        overallStatsHTML += `<div class="stat-card"><h4>Total Games</h4><p>${overall.totalGames}</p></div>`; 
        overallStatsHTML += `<div class="stat-card"><h4>Unique Players</h4><p>${overall.uniquePlayers}</p></div>`;
    } else {
        overallStatsHTML += `<div class="stat-card"><h4>Players</h4><p>${overall.uniquePlayers}</p></div>`; // Changed label for single game view
    }
    overallStatsHTML += `
        <div class="stat-card"><h4>Total Buy-Ins</h4><p>${formatCurrency(overall.totalBuyIns)}</p></div>
        <div class="stat-card"><h4>Total Final Amounts</h4><p>${formatCurrency(overall.totalFinalAmounts)}</p></div> 
    `;
    overallStatsContainer.innerHTML = overallStatsHTML;
}

function renderPlayerList(selectedGameUUID = "all") { // Parameter renamed, search removed
    const { players: aggregatedPlayerStats } = getAggregatedStatsForContext(selectedGameUUID); // Use renamed param
    playerListContainer.innerHTML = '';

    const sortedLcPlayerNames = Object.keys(aggregatedPlayerStats)
        .sort((a, b) => aggregatedPlayerStats[b].netProfit - aggregatedPlayerStats[a].netProfit);

    if (sortedLcPlayerNames.length === 0) {
        playerListContainer.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">No players found for this context.</p>'; // Message updated
        return;
    }

    sortedLcPlayerNames.forEach(lcPlayerName => {
        const playerData = aggregatedPlayerStats[lcPlayerName];
        const canonicalName = playerData.canonicalName;
        const playerDiv = document.createElement('div');
        // playerDiv.classList.add('player-list-item'); // Old class
        playerDiv.classList.add('player-summary-card'); // New outer card class
        playerDiv.dataset.playerName = canonicalName; 
        
        const netProfit = playerData.netProfit;
        let profitClass = netProfit > 0 ? 'profit' : netProfit < 0 ? 'loss' : 'neutral';

        let gamesPlayedDisplay = playerData.gamesPlayed;

        if (selectedGameUUID === "all") { // Renamed selectedSessionUUID
            // Player click functionality removed
            
            let avgProfitPercentValue = playerData.averageProfitPercentage;
            let avgProfitPercentClass = (avgProfitPercentValue || 0) > 0 ? 'profit' : (avgProfitPercentValue || 0) < 0 ? 'loss' : 'neutral';
            if (avgProfitPercentValue === null || !isFinite(avgProfitPercentValue)) avgProfitPercentClass = 'neutral';

            playerDiv.innerHTML = `
                <div class="player-info-card">
                    <img src="${getPlayerImagePath(canonicalName)}" class="player-info-avatar" alt="${canonicalName}" onerror="this.onerror=null;this.src='knuckles.png';">
                    <div class="player-info-details">
                        <div class="player-info-name">${canonicalName}</div>
                        ${selectedGameUUID === "all" ? `<div class="player-info-games">Games: ${gamesPlayedDisplay}</div>` : ''} 
                    </div>
                </div>
                <div class="player-metrics-grid">
                    <div class="metric-card">
                        <div class="metric-card-label">Net Profit</div>
                        <div class="metric-card-value ${profitClass}">${formatCurrency(netProfit)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-card-label">Net Avg. Profit Percentage</div>
                        <div class="metric-card-value ${avgProfitPercentClass}">${formatPercentage(avgProfitPercentValue)}</div>
                    </div>
                </div>
            `;
        } else { // Single Week View
            playerDiv.classList.add('player-week-summary-card'); // More specific class if needed for single week variations

            let weeklyProfitPercentValue = playerData.profitPercentage;
            let weeklyProfitPercentClass = (weeklyProfitPercentValue || 0) > 0 ? 'profit' : (weeklyProfitPercentValue || 0) < 0 ? 'loss' : 'neutral';
            if (weeklyProfitPercentValue === null || !isFinite(weeklyProfitPercentValue)) weeklyProfitPercentClass = 'neutral';
            
            // For single week, gamesPlayed is always 1 for the context of that week's stats.
            // The original playerData.gamesPlayed refers to all-time games.
            // We are showing stats for *this* session.
            // gamesPlayedDisplay = 1; // This is not used anymore in the single week view for player card text

            playerDiv.innerHTML = `
                <div class="player-info-card">
                    <img src="${getPlayerImagePath(canonicalName)}" class="player-info-avatar" alt="${canonicalName}" onerror="this.onerror=null;this.src='knuckles.png';">
                    <div class="player-info-details">
                         <div class="player-info-name">${canonicalName}</div>
                         
                    </div>
                </div>
                <div class="player-metrics-grid">
                    <div class="metric-card">
                        <div class="metric-card-label">Buy-In</div>
                        <div class="metric-card-value">${formatCurrency(playerData.totalBuyIn)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-card-label">Final Amount</div>
                        <div class="metric-card-value">${formatCurrency(playerData.totalFinalAmount)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-card-label">Profit</div>
                        <div class="metric-card-value ${profitClass}">${formatCurrency(netProfit)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-card-label">Profit Percentage</div>
                        <div class="metric-card-value ${weeklyProfitPercentClass}">${formatPercentage(weeklyProfitPercentValue)}</div>
                    </div>
                </div>
            `;
        }
        playerListContainer.appendChild(playerDiv);
    });
}

// Player details function removed - deprecated functionality
        
// Player chart function removed - deprecated functionality

// Player games table function removed - deprecated functionality

async function renderDrinkStatsForGame(selectedGameUUID) { // Renamed from renderDrinkStatsForWeek
    const gameData = allWeekData.find(g => g.uuid === selectedGameUUID);
    document.getElementById('drink-stats-week-name').textContent = gameData ? `${gameData.name} (Game Date: ${gameData.date})` : 'N/A';

    const gameDrinksDisplayContainer = document.getElementById('game-drinks-display-container');
    if (!gameDrinksDisplayContainer) {
        console.error("Element with ID 'game-drinks-display-container' not found.");
        return;
    }
    gameDrinksDisplayContainer.innerHTML = '';

    if (!gameData || !gameData.drinks || gameData.drinks.length === 0) {
        gameDrinksDisplayContainer.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">No drinks recorded for this game.</p>';
        return;
    }

            const dataDir = await getDataDirHandle();

    for (const drink of gameData.drinks) {
        const drinkCard = document.createElement('div');
        // Apply similar classes as all-time drink stats for consistent styling
        drinkCard.classList.add('drink-card', 'detailed-drink-card', 'game-drink-item'); 

        let drinkImageHtml = '';
        if (drink.drinkImagePath && dataDir) {
            try {
                const gameDirHandle = await dataDir.getDirectoryHandle(gameData.uuid, { create: false });
                const imgFileHandle = await gameDirHandle.getFileHandle(drink.drinkImagePath, { create: false });
                const file = await imgFileHandle.getFile();
                const blobUrl = URL.createObjectURL(file);
                drinkImageHtml = `<div class="drink-profile-image-container"><img src="${blobUrl}" alt="${drink.drinkName}" class="drink-profile-image" onload="URL.revokeObjectURL(this.src)"></div>`;
            } catch (e) {
                console.warn(`Could not load drink image: ${drink.drinkImagePath} for game ${gameData.uuid}`, e);
                drinkImageHtml = '<div class="drink-profile-image-container"><p class="image-not-found">Image not found</p></div>';
            }
        } else {
            drinkImageHtml = '<div class="drink-profile-image-container"><p class="image-not-found">No Image</p></div>';
    }
    
    let totalRating = 0;
        let ratedPlayersCount = 0;
        const playerRatingsHtmlBits = [];

        if (drink.playerRatings && drink.playerRatings.length > 0) {
            const sortedPlayerRatings = [...drink.playerRatings].sort((a, b) => {
                if (a.rating === null && b.rating === null) return (canonicalPlayerNameMap[a.playerName.toLowerCase()] || a.playerName).localeCompare(canonicalPlayerNameMap[b.playerName.toLowerCase()] || b.playerName);
                if (a.rating === null) return 1;
                if (b.rating === null) return -1;
                if (b.rating !== a.rating) return b.rating - a.rating;
                return (canonicalPlayerNameMap[a.playerName.toLowerCase()] || a.playerName).localeCompare(canonicalPlayerNameMap[b.playerName.toLowerCase()] || b.playerName);
            });
            
            sortedPlayerRatings.forEach(pr => {
                if (pr.rating !== null && typeof pr.rating === 'number') {
                    totalRating += pr.rating;
                    ratedPlayersCount++;
                }
                const playerNameDisplay = canonicalPlayerNameMap[pr.playerName.toLowerCase()] || pr.playerName;
                // Use metric-card structure for player ratings
                playerRatingsHtmlBits.push(`
                    <div class="metric-card player-rating-metric">
                        <div class="metric-card-label">${playerNameDisplay}</div>
                        <div class="metric-card-value">${pr.rating !== null ? pr.rating.toFixed(1) : 'N/R'}</div>
                    </div>
                `);
        });
    } else {
            playerRatingsHtmlBits.push('<p style="font-size:0.9em; color:var(--text-secondary); grid-column: 1 / -1;">No player ratings for this drink.</p>');
        }
        
        const averageDrinkRating = ratedPlayersCount > 0 ? (totalRating / ratedPlayersCount).toFixed(1) : 'N/A';
        const avgRatingStyle = ratedPlayersCount > 0 ? `style="background-color: ${getRatingColor(parseFloat(averageDrinkRating))}; color: #fff;"` : '';
        const avgRatingDisplayVal = averageDrinkRating + (averageDrinkRating !== 'N/A' ? '/10' : '');

        drinkCard.innerHTML = `
            ${drinkImageHtml}
            <div class="drink-info-content">
                <h4>${drink.drinkName}</h4>
                <!-- No game-context paragraph here, as it's clear from the game view -->
                <div class="drink-metrics-summary">
                    <div class="metric-card average-rating-metric" ${avgRatingStyle}>
                        <div class="metric-card-label">Avg. Rating</div>
                        <div class="metric-card-value">${avgRatingDisplayVal}</div>
                    </div>
                </div>
                <div class="drink-player-ratings-grid">
                    ${playerRatingsHtmlBits.join('')}
                </div>
            </div>
        `;
        gameDrinksDisplayContainer.appendChild(drinkCard);
    }
}

async function renderAllTimeDrinkStats() {
    const container = document.getElementById('all-time-drink-stats-container');
    if (!container) {
        console.error("Element with ID 'all-time-drink-stats-container' not found.");
        return;
    }
    container.innerHTML = ''; 

    const allDrinksAcrossAllGames = [];

    for (const game of allWeekData) {
        if (game.drinks && game.drinks.length > 0) {
            for (const drink of game.drinks) {
                if (drink.drinkName && drink.drinkName.trim() !== '') {
            let totalRating = 0;
                    let ratedPlayersCount = 0;
                    if (drink.playerRatings) {
                        drink.playerRatings.forEach(pr => {
                            if (pr.rating !== null && typeof pr.rating === 'number') {
                                totalRating += pr.rating;
                                ratedPlayersCount++;
                    }
                });
            }
                    const averageRating = ratedPlayersCount > 0 ? (totalRating / ratedPlayersCount) : -1; // Use -1 for unrated to simplify sorting
                    
                    allDrinksAcrossAllGames.push({
                        drinkName: drink.drinkName,
                        drinkImagePath: drink.drinkImagePath,
                        gameName: game.name,
                        gameDate: game.date,
                        gameUUID: game.uuid,
                        averageRating: averageRating,
                        ratedPlayersCount: ratedPlayersCount,
                        playerRatings: drink.playerRatings ? [...drink.playerRatings] : [] // Include individual player ratings
                    });
                }
            }
        }
    }

    allDrinksAcrossAllGames.sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
            return b.averageRating - a.averageRating;
        }
        const nameComparison = a.drinkName.localeCompare(b.drinkName);
        if (nameComparison !== 0) {
            return nameComparison;
        }
        return new Date(b.gameDate) - new Date(a.gameDate);
    });

    if (allDrinksAcrossAllGames.length === 0) {
        container.innerHTML = '<h3>All Drinks (Across All Games)</h3><p style="text-align:center; color: var(--text-secondary);">No drinks with names recorded across any games.</p>';
        return;
    }

    let content = '<h3>All Drinks (Across All Games)</h3>';
    content += '<div class="drink-display-grid all-time-drinks-grid">';

                const dataDir = await getDataDirHandle();

    for (const drinkInstance of allDrinksAcrossAllGames) {
        let drinkImageHtml = '';
        if (drinkInstance.drinkImagePath && dataDir && drinkInstance.gameUUID) {
            try {
                const gameDirHandle = await dataDir.getDirectoryHandle(drinkInstance.gameUUID, { create: false });
                const imgFileHandle = await gameDirHandle.getFileHandle(drinkInstance.drinkImagePath, { create: false });
                    const file = await imgFileHandle.getFile();
                    const blobUrl = URL.createObjectURL(file);
                // Using a class for drink profile icon style
                drinkImageHtml = `<div class="drink-profile-image-container"><img src="${blobUrl}" alt="${drinkInstance.drinkName}" class="drink-profile-image" onload="URL.revokeObjectURL(this.src)"></div>`;
            } catch (e) {
                console.warn(`Could not load drink image for all-time view (${drinkInstance.drinkImagePath} in game ${drinkInstance.gameUUID}):`, e);
                drinkImageHtml = '<div class="drink-profile-image-container"><p class="image-not-found">Image not found</p></div>';
            }
        } else {
            drinkImageHtml = '<div class="drink-profile-image-container"><p class="image-not-found">No Image</p></div>';
        }

        const avgRatingDisplay = drinkInstance.ratedPlayersCount > 0 ? drinkInstance.averageRating.toFixed(1) : 'N/A';
        // Placeholder for dynamic background style based on rating
        const avgRatingStyle = drinkInstance.ratedPlayersCount > 0 ? `style="background-color: ${getRatingColor(drinkInstance.averageRating)}; color: #fff;"` : ''; 

        let playerRatingsHtml = '<div class="drink-player-ratings-grid">';
        if (drinkInstance.playerRatings && drinkInstance.playerRatings.length > 0) {
            // Sort player ratings for this drink instance: highest to lowest
            const sortedPlayerRatings = [...drinkInstance.playerRatings].sort((a, b) => {
                if (a.rating === null && b.rating === null) return (canonicalPlayerNameMap[a.playerName.toLowerCase()] || a.playerName).localeCompare(canonicalPlayerNameMap[b.playerName.toLowerCase()] || b.playerName);
                if (a.rating === null) return 1;
                if (b.rating === null) return -1;
                if (b.rating !== a.rating) return b.rating - a.rating;
                return (canonicalPlayerNameMap[a.playerName.toLowerCase()] || a.playerName).localeCompare(canonicalPlayerNameMap[b.playerName.toLowerCase()] || b.playerName);
            });

            sortedPlayerRatings.forEach(pr => {
                const playerNameDisplay = canonicalPlayerNameMap[pr.playerName.toLowerCase()] || pr.playerName;
                playerRatingsHtml += `
                    <div class="metric-card player-rating-metric">
                        <div class="metric-card-label">${playerNameDisplay}</div>
                        <div class="metric-card-value">${pr.rating !== null ? pr.rating.toFixed(1) : 'N/R'}</div>
                    </div>
                `;
            });
        } else {
            playerRatingsHtml += '<p style="font-size:0.9em; color:var(--text-secondary); grid-column: 1 / -1;">No individual player ratings for this drink instance.</p>';
        }
        playerRatingsHtml += '</div>';

        content += `
            <div class="drink-card all-time-drink-card detailed-drink-card">
                ${drinkImageHtml}
                <div class="drink-info-content">
                    <h4>${drinkInstance.drinkName}</h4>
                    <p class="game-context"><em>Game: ${drinkInstance.gameName} (${drinkInstance.gameDate})</em></p>
                    <div class="drink-metrics-summary">
                        <div class="metric-card average-rating-metric" ${avgRatingStyle}>
                            <div class="metric-card-label">Avg. Rating</div>
                            <div class="metric-card-value">${avgRatingDisplay}${avgRatingDisplay !== 'N/A' ? '/10' : ''}</div>
                        </div>
                    </div>
                    ${playerRatingsHtml}
                </div>
            </div>
        `;
    }
    content += '</div>';
    container.innerHTML = content;
}

// Helper function to get color based on rating (0-10)
// Green (high rating) to Red (low rating)
function getRatingColor(rating) {
    if (rating === null || rating < 0) return 'var(--bg-tertiary)'; // Default for N/A or unrated
    const r = Math.max(0, Math.min(255, Math.floor(255 * (1 - (rating / 10)))));
    const g = Math.max(0, Math.min(255, Math.floor(255 * (rating / 10))));
    // Ensure text is readable on darker shades by keeping blue low, or by setting text color dynamically.
    // For simplicity here, we'll primarily use R and G.
    // A more sophisticated approach might involve HSL color space or predefined color stops.
    return `rgb(${r}, ${g}, 50)`; 
}

function renderAllTimePlayerNetProfitChart() { // Renamed from renderAllTimePlayerProgressChart
    if (allTimePlayerNetProfitChartInstance) { // Renamed allTimePlayerProgressChartInstance
        allTimePlayerNetProfitChartInstance.destroy(); // Renamed allTimePlayerProgressChartInstance
        allTimePlayerNetProfitChartInstance = null; // Renamed allTimePlayerProgressChartInstance
    }
    if (!allWeekData || allWeekData.length === 0) {
        if (allTimePlayerNetProfitChartCanvas) allTimePlayerNetProfitChartCanvas.style.display = 'none'; // Renamed allTimePlayerProgressChartCanvas
        return;
    }
    if (allTimePlayerNetProfitChartCanvas) allTimePlayerNetProfitChartCanvas.style.display = 'block'; // Renamed allTimePlayerProgressChartCanvas

    // Assumes allWeekData is already sorted by date, then uuid by loadAllWeekDataFromFS()
    const sortedWeeks = allWeekData; 
    const weekLabels = sortedWeeks.map(week => `${week.name.substring(0,15)} (${week.date})`); // Updated label

    const datasets = [];
    const playerCumulativeNet = {}; 
    const playerFinalCumulativeNet = {}; // To store the final cumulative net for sorting

    Object.keys(canonicalPlayerNameMap).forEach(lcName => {
        playerCumulativeNet[lcName] = Array(sortedWeeks.length).fill(null); 
        playerFinalCumulativeNet[lcName] = 0; // Initialize final net
    });

    sortedWeeks.forEach((week, weekIndex) => {
        Object.keys(canonicalPlayerNameMap).forEach(lcPlayerName => {
            let currentWeekNetForPlayer = 0;
            const playerInWeek = week.players.find(p => p.PlayerName.toLowerCase() === lcPlayerName);
            
            if (playerInWeek) {
                currentWeekNetForPlayer = (playerInWeek.FinalAmount || 0) - (playerInWeek.BuyIn || 0);
            }
            const previousCumulativeNet = weekIndex > 0 ? (playerCumulativeNet[lcPlayerName][weekIndex - 1] || 0) : 0;
            const currentCumulativeNet = previousCumulativeNet + currentWeekNetForPlayer;
            
            if (playerInWeek || previousCumulativeNet !== 0) { 
                 playerCumulativeNet[lcPlayerName][weekIndex] = currentCumulativeNet;
            }
            if (weekIndex === sortedWeeks.length - 1) { // Store the last cumulative value
                playerFinalCumulativeNet[lcPlayerName] = currentCumulativeNet;
            }
        });
    });

    // Sort player names based on their final cumulative net profit (descending)
    const sortedPlayerLcNames = Object.keys(canonicalPlayerNameMap).sort((a, b) => {
        return (playerFinalCumulativeNet[b] || 0) - (playerFinalCumulativeNet[a] || 0);
    });

    sortedPlayerLcNames.forEach(lcPlayerName => {
        const canonicalName = canonicalPlayerNameMap[lcPlayerName];
        if (playerCumulativeNet[lcPlayerName].some(val => val !== null)) { // Only add if they have some data
            datasets.push({
                label: canonicalName, data: playerCumulativeNet[lcPlayerName],
                fill: false, borderColor: getRandomColor(), tension: 0.1, spanGaps: true
            });
        }
    });

    if (!allTimePlayerNetProfitChartCanvas) { console.error("allTimePlayerNetProfitChartCanvas is not defined"); return; } // Renamed allTimePlayerProgressChartCanvas
    const chartCtx = allTimePlayerNetProfitChartCanvas.getContext('2d'); // Renamed allTimePlayerProgressChartCanvas
    if (!chartCtx) { console.error("Failed to get 2D context from allTimePlayerNetProfitChartCanvas"); return; } // Renamed

    allTimePlayerNetProfitChartInstance = new Chart(chartCtx, { // Renamed allTimePlayerProgressChartInstance
        type: 'line', data: { labels: weekLabels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                tooltip: { mode: 'index', intersect: false, callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) label += formatCurrency(context.parsed.y); return label; }}},
                legend: { 
                    position: 'top',
                    labels: {
                        color: 'rgba(230, 230, 230, 0.9)' // Legend text color
                    }
                }
            },
            scales: {
                y: { beginAtZero: false, ticks: { color: 'rgba(230, 230, 230, 0.9)', callback: function(value) { return formatCurrency(value); }}, grid: { color: 'rgba(100, 100, 100, 0.3)' }},
                x: { ticks: { color: 'rgba(230, 230, 230, 0.9)' }, grid: { color: 'rgba(100, 100, 100, 0.3)' }}
            }
        }
    });
}

function getRandomColor() { 
    const r = Math.floor(Math.random() * 200); 
    const g = Math.floor(Math.random() * 200);
    const b = Math.floor(Math.random() * 200);
    return `rgb(${r},${g},${b})`;
}

function renderPlayerPerformanceChart(selectedGameUUID) { // Renamed from renderWeeklyPerformanceChart
    if (playerPerformanceChartInstance) { // Renamed weeklyPerformanceChartInstance
        playerPerformanceChartInstance.destroy(); // Renamed weeklyPerformanceChartInstance
        playerPerformanceChartInstance = null; // Renamed weeklyPerformanceChartInstance
    }
    const weekData = allWeekData.find(w => w.uuid === selectedGameUUID); 

    if (!playerPerformanceChartCanvas) { // Renamed weeklyPerformanceChartCanvas
        console.error("Global playerPerformanceChartCanvas is not initialized."); // Renamed
        return; 
    }
    if (!weekData || !weekData.players || weekData.players.length === 0) {
        if (playerPerformanceChartCanvas) playerPerformanceChartCanvas.style.display = 'none'; // Renamed weeklyPerformanceChartCanvas
        return;
    }
    if (playerPerformanceChartCanvas) playerPerformanceChartCanvas.style.display = 'block'; // Renamed weeklyPerformanceChartCanvas
    const chartCtx = playerPerformanceChartCanvas.getContext('2d'); // Renamed weeklyPerformanceChartCanvas
    if (!chartCtx) {
        console.error("Failed to get 2D context from player-performance-chart canvas."); // Renamed
        if (playerPerformanceChartCanvas) playerPerformanceChartCanvas.style.display = 'none'; // Renamed
        return;
    }

    // Sort players by net profit for this week (descending)
    const sortedPlayers = [...weekData.players].sort((a, b) => {
        const netA = (a.FinalAmount || 0) - (a.BuyIn || 0);
        const netB = (b.FinalAmount || 0) - (b.BuyIn || 0);
        return netB - netA; // Sort descending
    });

    const labels = sortedPlayers.map(p => canonicalPlayerNameMap[p.PlayerName.toLowerCase()] || p.PlayerName);
    const buyInData = sortedPlayers.map(p => p.BuyIn || 0);
    const finalAmountData = sortedPlayers.map(p => p.FinalAmount || 0);

    playerPerformanceChartInstance = new Chart(chartCtx, { // Renamed weeklyPerformanceChartInstance
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Buy-In', data: buyInData, backgroundColor: 'rgba(220, 53, 69, 0.7)', borderColor: 'rgba(220, 53, 69, 1)', borderWidth: 1 },
                { label: 'Final Amount', data: finalAmountData, backgroundColor: 'rgba(40, 167, 69, 0.7)', borderColor: 'rgba(40, 167, 69, 1)', borderWidth: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) label += formatCurrency(context.parsed.y); return label; }}},
                legend: {
                    labels: {
                        color: 'rgba(230, 230, 230, 0.9)' // Legend text color
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: 'rgba(230, 230, 230, 0.9)', callback: function(value) { return formatCurrency(value); }}, grid: { color: 'rgba(100, 100, 100, 0.3)' }},
                x: { ticks: { color: 'rgba(230, 230, 230, 0.9)' }, grid: { color: 'rgba(100, 100, 100, 0.3)' }}
            }
        }
    });
}

// --- Manage Data Tab ---
function renderManageDataList() {
    editWeekDetailsForm.style.display = 'none';
    manageDataWeekSelector.innerHTML = '<option value="">Select a game to edit...</option>'; // "session" to "game"
    allWeekData.forEach(week => { // Assumes sorted by date
        const option = document.createElement('option');
        option.value = week.uuid; // Use UUID
        option.textContent = `${week.name} (Game Date: ${week.date})`; // Display name and date, "Session" context removed
        manageDataWeekSelector.appendChild(option);
    });

    manageDataWeekSelector.onchange = () => {
        const selectedGameUUID = manageDataWeekSelector.value; // Renamed selectedSessionUUID
        if (selectedGameUUID) { // Use renamed var
            loadWeekDetailsForEditing(selectedGameUUID); // Pass renamed UUID
            editWeekDetailsForm.style.display = 'block';
        } else {
            editWeekDetailsForm.style.display = 'none';
            currentWeekDrinkImageDisplay.innerHTML = '';
        }
    };
    saveWeekChangesButton.onclick = saveModifiedWeekData;
    deleteThisWeekButton.onclick = deleteThisWeekInForm;
    managePlayerEntriesContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center; margin-bottom:10px;"><em>Player information for the selected game will appear here once a game is chosen.</em></p>'; // "session" to "game"
    initializeAvatarManagementSection();
}

function initializeAvatarManagementSection(){
    manageAvatarPlayerSelector.innerHTML = '<option value="">Select a player...</option>';
    console.log("Building avatar player selector. canonicalPlayerNameMap:", JSON.parse(JSON.stringify(canonicalPlayerNameMap))); // Log map state
    const sortedCanonicalNames = Object.values(canonicalPlayerNameMap).sort((a,b) => a.localeCompare(b));
    sortedCanonicalNames.forEach(canonicalName => {
        const option = document.createElement('option');
        option.value = canonicalName; option.textContent = canonicalName;
        manageAvatarPlayerSelector.appendChild(option);
    });
    manageAvatarPlayerSelector.onchange = () => {
        const selectedCanonicalPlayerName = manageAvatarPlayerSelector.value;
        if (selectedCanonicalPlayerName) loadPlayerAvatarForEditing(selectedCanonicalPlayerName);
        else currentPlayerAvatarDisplay.innerHTML = ''; 
    };
    newPlayerAvatarInput.value = ''; 
    currentPlayerAvatarDisplay.innerHTML = ''; 
    savePlayerAvatarButton.onclick = savePlayerAvatar;
}

async function loadPlayerAvatarForEditing(canonicalPlayerName) {
    currentPlayerAvatarDisplay.innerHTML = ''; 
    newPlayerAvatarInput.value = ''; 
    if (!canonicalPlayerName) return;
    const imagePath = getPlayerImagePath(canonicalPlayerName);
    currentPlayerAvatarDisplay.innerHTML = `
        <p>Current Avatar for ${canonicalPlayerName}:</p>
        <img src="${imagePath}" alt="${canonicalPlayerName} Avatar" class="player-avatar" style="width:100px; height:100px; margin-bottom:10px;" onerror="this.onerror=null; this.src='knuckles.png'; this.alt='Default Avatar'">
    `;
}

async function savePlayerAvatar() {
    const selectedCanonicalPlayerName = manageAvatarPlayerSelector.value;
    const fileInput = newPlayerAvatarInput;

    if (!selectedCanonicalPlayerName) {
        alert("Please select a player.");
        return;
    }
    if (fileInput.files.length === 0) {
        alert("Please select an image file to upload.");
        return;
    }

    const file = fileInput.files[0];
    const playersDir = await getPlayersDirHandle(true); // CREATE Players dir if not exists

    if (!playersDir) {
        alert("Could not access or create the 'Data/Players' directory. Avatar cannot be saved.");
        return;
    }
    const fileName = sanitizeForFileName(selectedCanonicalPlayerName) + '.png'; 
    try {
        const fileHandle = await playersDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        alert(`Avatar for ${selectedCanonicalPlayerName} saved successfully as ${fileName}!`);
        await loadPlayerAvatarForEditing(selectedCanonicalPlayerName);
        if (document.getElementById('dashboard').classList.contains('active')) {
             renderDashboardUI(getSelectedGameUUID());
        }
    } catch (err) {
        console.error(`Error saving avatar for ${selectedCanonicalPlayerName}:`, err);
        alert(`Failed to save avatar. Check console for errors. Error: ${err.message}`);
    }
}

async function renderDrinkImageInForm(weekData, displayElement) {
    displayElement.innerHTML = '';
    if (weekData && weekData.weekMysteryDrinkImagePath) {
        try {
            const dataDir = await getDataDirHandle();
            if (dataDir) {
                const weekDir = await dataDir.getDirectoryHandle(weekData.uuid, { create: false }); // Use UUID
                const imgFileHandle = await weekDir.getFileHandle(weekData.weekMysteryDrinkImagePath, {create:false});
                const file = await imgFileHandle.getFile();
                const blobUrl = URL.createObjectURL(file);
                displayElement.innerHTML = `<p>Current Image:</p><img src="${blobUrl}" alt="${weekData.weekMysteryDrinkName || 'Game Drink'}" class="week-drink-image" style="max-height: 100px; margin-bottom:10px;" onload="URL.revokeObjectURL(this.src)">`; // "Week Drink" to "Game Drink"
            }
        } catch (e) {
            console.warn("Could not load current game's drink image for form: " + weekData.weekMysteryDrinkImagePath, e); // "week's" to "game's"
            displayElement.innerHTML = '<p style="font-size:0.8em; color:var(--text-secondary);">Current image not found or cannot be displayed.</p>';
        }
    } else {
        displayElement.innerHTML = '<p style="font-size:0.8em; color:var(--text-secondary);">No current image for this game.</p>'; // "session" to "game"
    }
}

async function loadWeekDetailsForEditing(selectedGameUUID) {
    console.log(`loadWeekDetailsForEditing called for UUID: ${selectedGameUUID}`);
    const week = allWeekData.find(w => w.uuid === selectedGameUUID);
    if (!week) {
        alert("Selected game not found!");
        console.error(`Game with UUID ${selectedGameUUID} not found in allWeekData.`);
        editWeekDetailsForm.style.display = 'none';
        return;
    }
    console.log("Found game:", JSON.parse(JSON.stringify(week)));

    manageSessionNameInput.value = week.name;
    manageSessionDateInput.value = week.date;
    console.log("Set name and date for form.");

    drinkEntryIdCounter.manage = 0;
    const manageDrinksContainer = document.getElementById('manage-game-drinks-container');
    if (!manageDrinksContainer) {
        console.error('CRITICAL: #manage-game-drinks-container not found in HTML.');
        editWeekDetailsForm.style.display = 'none';
        return;
    }
    manageDrinksContainer.innerHTML = '';
    console.log("Cleared manageDrinksContainer.");

    const playerEntriesContainerRef = document.getElementById('manage-player-entries-container');
    if (!playerEntriesContainerRef) {
        console.error("CRITICAL: #manage-player-entries-container not found in HTML.");
        return; // Cannot proceed without player container
    }
    playerEntriesContainerRef.innerHTML = '';
    console.log("Cleared managePlayerEntriesContainer.");

    if (week.players && Array.isArray(week.players) && week.players.length > 0) {
        console.log("Processing players:", week.players);
        week.players.forEach((player, index) => {
            console.log(`Adding player entry ${index + 1}:`, player);
            addPlayerEntryFieldInManageForm(player);
        });
    } else {
        console.log("No players found in game data or players array is invalid. Displaying placeholder.", week.players);
        playerEntriesContainerRef.innerHTML = '<p style="color:var(--text-secondary); text-align:center; margin-bottom:10px;"><em>No players recorded in this game. You can add them below.</em></p>';
    }

    if (week.drinks && Array.isArray(week.drinks) && week.drinks.length > 0) {
        console.log("Processing drinks:", week.drinks);
        week.drinks.forEach(async (drinkData, index) => {
            console.log(`Adding drink entry ${index + 1}:`, drinkData.drinkName);
            const drinkEntryDiv = addDrinkEntryForm('manage');
            if (!drinkEntryDiv) {
                console.error("Failed to create drink entry form in manage context for drink:", drinkData.drinkName);
                return; // Skip this drink if form creation failed
            }
            
            // Set the drink name
            const nameInput = drinkEntryDiv.querySelector('.drink-form-name');
            if (nameInput) {
                nameInput.value = drinkData.drinkName || '';
            }

            // Update drink image preview
            const imageContainer = drinkEntryDiv.querySelector('.drink-profile-image-container');
            const fileInput = drinkEntryDiv.querySelector('.drink-form-image');
            
            if (drinkData.drinkImagePath) {
                try {
                    const dataDir = await getDataDirHandle();
                    if (dataDir) {
                        const gameDirHandle = await dataDir.getDirectoryHandle(week.uuid, { create: false });
                        const imgFileHandle = await gameDirHandle.getFileHandle(drinkData.drinkImagePath, { create: false });
                        const file = await imgFileHandle.getFile();
                        const blobUrl = URL.createObjectURL(file);
                        
                        // Update the image preview with the actual image
                        if (imageContainer) {
                            imageContainer.innerHTML = `
                                <img src="${blobUrl}" alt="${drinkData.drinkName}" class="drink-profile-image" onload="URL.revokeObjectURL(this.src)">
                                <input type="file" class="drink-form-image hidden-file-input" accept="image/png, image/jpeg" style="display:none;">
                            `;
                            
                            // Store the existing image path for later use
                            imageContainer.dataset.existingImagePath = drinkData.drinkImagePath;
                            
                            // Reattach event listeners
                            const newFileInput = imageContainer.querySelector('.drink-form-image');
                            imageContainer.style.cursor = 'pointer';
                            
                            imageContainer.addEventListener('click', function() {
                                newFileInput.click();
                            });
                            
                            imageContainer.addEventListener('mouseenter', function() {
                                this.style.opacity = '0.8';
                                this.style.background = 'rgba(0,0,0,0.4)';
                            });
                            
                            imageContainer.addEventListener('mouseleave', function() {
                                this.style.opacity = '1';
                                this.style.background = 'transparent';
                            });
                            
                            newFileInput.addEventListener('change', function() {
                                if (this.files && this.files[0]) {
                                    const reader = new FileReader();
                                    reader.onload = function(e) {
                                        imageContainer.innerHTML = `
                                            <img src="${e.target.result}" alt="Selected Image" class="drink-profile-image">
                                            <input type="file" id="drink-image-${context}-${drinkId}" class="drink-form-image hidden-file-input" accept="image/png, image/jpeg" style="display:none;">
                                        `;
                                        
                                        // Reattach the event listeners to the new container
                                        const newImageContainer = document.getElementById(`drink-image-container-${context}-${drinkId}`);
                                        const newFileInput = newImageContainer.querySelector('.drink-form-image');
                                        
                                        newImageContainer.addEventListener('click', function() {
                                            newFileInput.click();
                                        });
                                        
                                        newImageContainer.addEventListener('mouseenter', function() {
                                            this.style.opacity = '0.8';
                                            this.style.background = 'rgba(0,0,0,0.4)';
                                        });
                                        
                                        newImageContainer.addEventListener('mouseleave', function() {
                                            this.style.opacity = '1';
                                            this.style.background = 'transparent';
                                        });
                                        
                                        newFileInput.addEventListener('change', fileInput.onchange);
                                    };
                                    reader.readAsDataURL(this.files[0]);
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`Could not load drink image: ${drinkData.drinkImagePath}`, e);
                    if (imageContainer) {
                        imageContainer.innerHTML = `
                            <p class="image-not-found">Click to add image</p>
                            <input type="file" class="drink-form-image hidden-file-input" accept="image/png, image/jpeg" style="display:none;">
                        `;
                    }
                }
            }

            // Set player ratings
            if (drinkData.playerRatings && Array.isArray(drinkData.playerRatings)) {
                drinkData.playerRatings.forEach(playerRating => {
                    const ratingInput = drinkEntryDiv.querySelector(`.drink-form-player-rating[data-player-name="${playerRating.playerName}"]`);
                    if (ratingInput) {
                        ratingInput.value = playerRating.rating;
                    }
                });
            }
        });
    }
    editWeekDetailsForm.style.display = 'block';
}

// Function to handle the removal of a drink image in the manage form
function handleRemoveManageDrinkImage(buttonElement) {
    const drinkForm = buttonElement.closest('.drink-entry-form-item');
    if (drinkForm) {
        drinkForm.dataset.imageRemoved = 'true'; // Mark that the image is to be removed
        
        // Reset the image preview
        const imagePreviewEl = drinkForm.querySelector('.drink-form-image-preview');
        if (imagePreviewEl) {
            imagePreviewEl.innerHTML = '<p class="image-not-found">Image will be removed</p>';
        }
        
        // Update the image info container
        const imageInfoContainer = drinkForm.querySelector('.drink-image-preview-container');
        if (imageInfoContainer) {
            imageInfoContainer.innerHTML = '<p class="no-current-image-text">Image will be removed on save.</p>';
        }
        
        // Reset the file input in case it had a value
        const fileInput = drinkForm.querySelector('.drink-form-image');
        if (fileInput) {
            fileInput.value = '';
        }
    } else {
        console.warn("Could not find parent drink form for image removal button.");
    }
}

async function saveModifiedWeekData() {
    const selectedGameUUID = manageDataWeekSelector.value; // Get UUID from selector, renamed selectedSessionUUID
    if (!selectedGameUUID) { // Use renamed var
        alert("No game selected to save."); // "session" to "game"
        return;
    }

    const weekIndex = allWeekData.findIndex(w => w.uuid === selectedGameUUID); // Use renamed var
    if (weekIndex === -1) {
        alert("Original game data not found to save changes."); // "session" to "game"
        return;
    }

    const originalWeekData = allWeekData[weekIndex];
    const updatedWeekData = { ...originalWeekData }; // Clone

    updatedWeekData.name = manageSessionNameInput.value.trim();
    updatedWeekData.date = manageSessionDateInput.value;
    // updatedWeekData.weekMysteryDrinkName = manageWeekMysteryDrinkNameInput.value.trim() || null; // REMOVED OLD
    
    // const newDrinkImageFile = manageWeekDrinkImageInput.files[0] || null; // REMOVED OLD
    // if (newDrinkImageFile) { // REMOVED OLD
    //     updatedWeekData.weekDrinkImageFile = newDrinkImageFile; // REMOVED OLD
    // } else { // REMOVED OLD
    //     delete updatedWeekData.weekDrinkImageFile; // REMOVED OLD
    // } // REMOVED OLD

    if (!updatedWeekData.name) { alert("Game Name is required."); return; } 
    if (!updatedWeekData.date) { alert("Game Date is required."); return; } 

    // Initialize drinks array for the updated data
    updatedWeekData.drinks = [];
    const drinkForms = document.getElementById('manage-game-drinks-container').querySelectorAll('.drink-card');

    drinkForms.forEach(drinkForm => {
        const drinkName = drinkForm.querySelector('.drink-form-name').value.trim();
        if (!drinkName) return; // Skip if drink name is empty

        const imageContainer = drinkForm.querySelector('.drink-profile-image-container');
        
        // First try to get the existing image path if it exists
        const existingImagePath = imageContainer ? imageContainer.dataset.existingImagePath : null;
        
        // Try multiple approaches to get the image file
        let drinkImageFile = null;
        
        // Check if the image container has a file directly attached to it
        if (imageContainer.file) {
            console.log(`Using stored file from container for ${drinkName}`);
            drinkImageFile = imageContainer.file;
        }
        // Otherwise check if there's a file in the input 
        else {
            // 1. Check file input
            const fileInput = drinkForm.querySelector('.drink-form-image');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                drinkImageFile = fileInput.files[0];
                console.log(`Using file from input for ${drinkName}`);
            } 
            // 2. If no file in input but there's an image element, try to get the file from there
            else {
                const imgElement = imageContainer.querySelector('img.drink-profile-image');
                if (imgElement && !imgElement.src.includes('knuckles.png')) {
                    // Get the image source
                    const imgSrc = imgElement.getAttribute('src');
                    
                    // Try to find hidden file input
                    const hiddenFileInput = imageContainer.querySelector('.hidden-file-input');
                    if (hiddenFileInput && hiddenFileInput.files && hiddenFileInput.files[0]) {
                        drinkImageFile = hiddenFileInput.files[0];
                        console.log(`Using file from hidden input for ${drinkName}`);
                    }
                    // If it's a data URL, convert to blob
                    else if (imgSrc.startsWith('data:')) {
                        try {
                            const byteString = atob(imgSrc.split(',')[1]);
                            const mimeType = imgSrc.split(',')[0].split(':')[1].split(';')[0];
                            const ab = new ArrayBuffer(byteString.length);
                            const ia = new Uint8Array(ab);
                            for (let i = 0; i < byteString.length; i++) {
                                ia[i] = byteString.charCodeAt(i);
                            }
                            drinkImageFile = new Blob([ab], { type: mimeType });
                            drinkImageFile.name = `drink_${Date.now()}.${mimeType.split('/')[1]}`;
                            console.log(`Created blob from data URL for ${drinkName}`);
                        } catch (e) {
                            console.error("Error converting data URL to blob:", e);
                        }
                    }
                }
            }
        }

        // Collect player ratings
        const currentPlayerRatings = [];
        const ratingInputs = drinkForm.querySelectorAll('.drink-form-player-rating');
        ratingInputs.forEach(ratingInput => {
            const playerName = ratingInput.dataset.playerName;
            const ratingValue = ratingInput.value;
            if (playerName && ratingValue !== '') {
                currentPlayerRatings.push({ playerName: playerName, rating: parseFloat(ratingValue) });
            }
        });

        // Create drink entry with all collected data
        const drinkEntry = {
            drinkName: drinkName,
            playerRatings: currentPlayerRatings
        };

        // Assign image file or path based on what we found
        if (drinkImageFile) {
            drinkEntry.drinkImageFile = drinkImageFile;
        } else if (existingImagePath) {
            drinkEntry.drinkImagePath = existingImagePath;
        }

        updatedWeekData.drinks.push(drinkEntry);
    });

    // Process edited player data
    const editedPlayers = [];
    const playerEntryDivs = managePlayerEntriesContainer.querySelectorAll('.player-entry-manage');
    
    for (const entryDiv of playerEntryDivs) {
        const nameInput = entryDiv.querySelector('.player-name-manage');
        const buyInStr = entryDiv.querySelector('.player-buyin-manage').value;
        const finalAmountStr = entryDiv.querySelector('.player-final-amount-manage').value;

        const playerName = nameInput.value.trim(); 
        const buyIn = buyInStr !== '' ? parseFloat(buyInStr) : 0;
        const finalAmount = finalAmountStr !== '' ? parseFloat(finalAmountStr) : 0;

        if (!playerName) {
            if (nameInput.classList.contains('new-player-name-manage')) {
                continue; 
            }
            alert("A player name is missing. Please ensure all players have names.");
            return;
        }
        if (isNaN(buyIn) || isNaN(finalAmount)) {
            alert(`Invalid buy-in or final amount for player ${playerName}. Please enter valid numbers.`);
            return;
        }

        editedPlayers.push({
            PlayerName: playerName,
            BuyIn: buyIn,
            FinalAmount: finalAmount
        });
    }
    updatedWeekData.players = editedPlayers;

    const success = await saveWeekDataToFS(updatedWeekData);
    if (success) {
        alert(`Game '${updatedWeekData.name}' updated successfully!`);
        await loadAllWeekDataFromFS(); 
        populateWeekSelector(); 
        renderManageDataList(); 
        
        if (manageDataWeekSelector.value === selectedGameUUID){
            loadWeekDetailsForEditing(selectedGameUUID);
        } else {
            manageDataWeekSelector.value = selectedGameUUID;
            if (selectedGameUUID) loadWeekDetailsForEditing(selectedGameUUID);
        }
        if (document.getElementById('dashboard').classList.contains('active')) {
            renderDashboardUI(getSelectedGameUUID());
        }
    } else {
        alert(`Failed to update game '${updatedWeekData.name}'.`);
    }
}

async function deleteThisWeekInForm() {
    const selectedGameUUID = manageDataWeekSelector.value; // Get UUID from selector, renamed selectedSessionUUID
    if (!selectedGameUUID) { // Use renamed var
        alert("No game selected for deletion."); // "session" to "game"
        return;
    }
    const weekToDelete = allWeekData.find(w => w.uuid === selectedGameUUID); // Use renamed var
    const gameName = weekToDelete ? weekToDelete.name : selectedGameUUID; // Renamed sessionName to gameName

    const success = await deleteWeekDataFS(selectedGameUUID); // Pass UUID, use renamed var
    if (success) {
        alert(`Game '${gameName}' and its data deleted successfully!`); // "Session" to "Game"
        await loadAllWeekDataFromFS();
        populateWeekSelector(); 
        renderManageDataList(); 
        editWeekDetailsForm.style.display = 'none'; 
        currentWeekDrinkImageDisplay.innerHTML = '';
        if (document.getElementById('dashboard').classList.contains('active')) {
            renderDashboardUI(getSelectedGameUUID());
        }
    } else {
        alert(`Failed to delete game '${gameName}'.`); // "session" to "game"
    }
}

// --- CSV Export ---
function exportAllDataToCSV() {
    if (allWeekData.length === 0) { alert('No data to export.'); return; }
    const headers = "GameName,GameDate,GameMysteryDrinkName,PlayerName,BuyIn,Final Amount,PlayerDrinkRating"; // "SessionName" to "GameName", etc.
    let csvRows = [headers];
    allWeekData.forEach(week => {
        week.players.forEach(player => {
            csvRows.push([
                `"${(week.name || '').replace(/"/g, '""')}"`, week.date,
                `"${(week.weekMysteryDrinkName || '').replace(/"/g, '""')}"`, 
                `"${(player.PlayerName || '').replace(/"/g, '""')}"`,
                player.BuyIn || 0, player.FinalAmount || 0,
                player.MysteryDrinkRating !== null ? player.MysteryDrinkRating : ''
            ].join(','));
        });
    });
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url); link.setAttribute('download', 'world_series_of_knuckles_ALL_DATA.csv');
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
}

function exportAllDataZIPPlaceholder() {
    alert("Manual ZIP Export: Please navigate to your selected data folder, then to the 'Data' subfolder. Right-click the 'Data' subfolder and choose 'Send to > Compressed (zipped) folder' or your OS equivalent.");
}

function buildCanonicalPlayerNameMap() {
    canonicalPlayerNameMap = {}; // Reset the map
    allWeekData.forEach(week => {
        if (week && week.players && Array.isArray(week.players)) {
            week.players.forEach(player => {
                if (player && player.PlayerName && typeof player.PlayerName === 'string' && player.PlayerName.trim() !== '') {
                    const lcName = player.PlayerName.trim().toLowerCase();
                    if (!canonicalPlayerNameMap[lcName]) {
                        canonicalPlayerNameMap[lcName] = player.PlayerName.trim(); // Store the trimmed, original casing
                    }
                } else {
                    // console.warn("Skipping player with missing or invalid PlayerName in week:", week.uuid, player); // Keep this commented unless debugging
                }
            });
        } else {
            // This case might be normal if a week legitimately has no players.
            // console.warn("Week data missing or has malformed/empty players array:", week.uuid);
        }
    });
}

// Function to add a player entry field to the Manage Data form
function addPlayerEntryFieldInManageForm(player = null) {
    const container = managePlayerEntriesContainer;
    // Filter out placeholder if it exists
    const placeholder = container.querySelector('p.placeholder-message');
    if (placeholder) placeholder.remove();

    const playerDiv = document.createElement('div');
    playerDiv.classList.add('player-entry-manage', 'player-summary-card');
    
    const playerName = player ? player.PlayerName : '';
    const buyIn = player ? (player.BuyIn || 0) : 0;
    const finalAmount = player ? (player.FinalAmount || 0) : 0;
    
    // Get player avatar if it exists
    const avatarSrc = playerName ? getPlayerImagePath(playerName) : 'knuckles.png';
    
    // For existing players, name is read-only. For new players, it's editable.
    const nameInputHtml = player 
        ? `<input type="text" class="player-name-manage" value="${playerName}" readonly style="font-size: 1.4em; font-weight: bold; background-color: var(--bg-secondary); border: none; color: var(--text-primary); width: 100%; margin: 0; padding: 0;">` 
        : `<input type="text" class="player-name-manage new-player-name-manage" placeholder="New Player Name" required style="font-size: 1.4em; font-weight: bold; background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); width: 100%; margin: 0; padding: 5px; border-radius: 4px;">`;

    // Use the exact same structure as the dashboard player cards
    playerDiv.innerHTML = `
        <div class="player-info-card">
            <img src="${avatarSrc}" class="player-info-avatar" alt="${playerName || 'Default'} Avatar" onerror="this.onerror=null;this.src='knuckles.png';">
            <div class="player-info-details">
                ${nameInputHtml}
                <div class="player-info-games" style="font-size: 0.9em; color: var(--text-secondary); margin-top: 4px;">${player ? `Existing Player` : `New Player`}</div>
            </div>
        </div>
        <div class="player-metrics-grid">
            <div class="metric-card">
                <div class="metric-card-label">BUY-IN AMOUNT</div>
                <input type="number" class="player-buyin-manage metric-card-value" value="${buyIn}" min="0" step="any" required style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); width: 100%; text-align: center; font-size: 1.5em; font-weight: bold; padding: 5px;">
            </div>
            <div class="metric-card">
                <div class="metric-card-label">FINAL AMOUNT</div>
                <input type="number" class="player-final-amount-manage metric-card-value" value="${finalAmount}" min="0" step="any" required style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); width: 100%; text-align: center; font-size: 1.5em; font-weight: bold; padding: 5px;">
            </div>
        </div>
        <button type="button" class="remove-player" onclick="this.closest('.player-entry-manage').remove(); updateAllDrinkRatingForms('manage');">Remove Player</button>
    `;
    
    container.appendChild(playerDiv);
    
    // For new players, add event listener to the name input
    if (!player) {
        const playerNameInput = playerDiv.querySelector('.player-name-manage');
        const playerAvatar = playerDiv.querySelector('.player-info-avatar');
        const playerStatusText = playerDiv.querySelector('.player-info-games');
        
        playerNameInput.addEventListener('input', function() {
            const enteredName = playerNameInput.value.trim();
            const lcName = enteredName.toLowerCase();
            
            // Check if this is an existing player
            if (enteredName && canonicalPlayerNameMap[lcName]) {
                playerStatusText.textContent = "Existing Player";
                playerAvatar.src = getPlayerImagePath(canonicalPlayerNameMap[lcName]);
                playerAvatar.onerror = function() { this.src = 'knuckles.png'; };
            } else {
                playerStatusText.textContent = "New Player";
                playerAvatar.src = 'knuckles.png';
            }
            
            // Update all drink rating forms with the new name
            updateAllDrinkRatingForms('manage');
        });
        
        // If it's a new player added to the form, update drink ratings immediately
        updateAllDrinkRatingForms('manage');
    }
}

// --- New Function to handle changing data folder location ---
async function handleChangeDataFolderRequest() {
    if (!confirm("Are you sure you want to change the data folder location? This will reload the application and attempt to load data from the new location. Make sure to select the parent folder where a 'Data' subfolder exists or will be created.")) {
        return;
    }

    const currentAppBaseDirHandleBeforeChange = appBaseDirHandle; 
    const newHandleAttempt = await getAppBaseDirHandle(true); // forceNew = true

    if (newHandleAttempt && newHandleAttempt !== currentAppBaseDirHandleBeforeChange) { 
        appBaseDirHandle = newHandleAttempt; // Ensure the global handle is updated (used by getAppBaseDirHandle on reload via IndexedDB)
        alert("Data folder location has been changed. The application will now reload.");
        window.location.reload(); // Hard reload the page
    } else if (!newHandleAttempt) { 
        alert("Data folder location change was cancelled. The previous location will continue to be used.");
        appBaseDirHandle = currentAppBaseDirHandleBeforeChange; 
        if (!appBaseDirHandle) {
             initialSetupOverlay.style.display = 'flex';
        }
    } else { 
        alert("The selected folder is the same as the current one, or the selection process was not completed. No changes made.");
    }
}

async function resetAndReloadAppWithNewBaseDir() {
    // 1. Clear existing data and UI elements
    allWeekData = [];
    canonicalPlayerNameMap = {};
    if (playerChartInstance) playerChartInstance.destroy();
    if (playerPerformanceChartInstance) playerPerformanceChartInstance.destroy();
    if (allTimePlayerNetProfitChartInstance) allTimePlayerNetProfitChartInstance.destroy();
    
    weekSelector.innerHTML = '<option value="all">All Time</option>';
    manageDataWeekSelector.innerHTML = '<option value="">Select Week to Edit</option>';
    playerListContainer.innerHTML = '';
    overallStatsContainer.innerHTML = '';
    playerDetailsSection.style.display = 'none';
    playerSpecificStatsContainer.innerHTML = '';
    playerGamesTableContainer.innerHTML = '';
    document.getElementById('all-time-drink-stats-container').innerHTML = '';
    managePlayerEntriesContainer.innerHTML = '<p>Select a week to see player entries.</p>'; // Reset placeholder
    manageAvatarPlayerSelector.innerHTML = '<option value="">Select Player</option>';
    if (currentPlayerAvatarDisplay) currentPlayerAvatarDisplay.innerHTML = ''; // Check if element exists
    if (currentWeekDrinkImageDisplay) currentWeekDrinkImageDisplay.innerHTML = ''; // Check if element exists
    if (editWeekDetailsForm) editWeekDetailsForm.reset();


    // 2. Reload data from the new FS location (initializeApp essentials)
    await loadAllWeekDataFromFS(); // This will use the new appBaseDirHandle

    // 3. Re-populate UI (initializeAppUI essentials)
    populateWeekSelector();
    initializeAvatarManagementSection(); // Re-initialize avatar section with new data/map
    prepareNewSessionForm(); // Reset new session form (though it's mostly static)
    renderManageDataList();  // Refresh the manage data list

    // 4. Show a default tab (e.g., dashboard) and refresh it
    showTab('dashboard'); // This will also call renderDashboardUI which uses new data
    
    console.log("Application reloaded with new data folder location.");
} 