// --- Core Variables ---
let allWeekData = []; 
let playerChartInstance = null;
let weeklyPerformanceChartInstance = null; // For the new weekly chart
let allTimePlayerProgressChartInstance = null; // For the new all-time player progress chart
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
const playerDetailContextEl = document.getElementById('player-detail-context');
const playerDetailAvatarEl = document.getElementById('player-detail-avatar');
const playerSpecificStatsContainer = document.getElementById('player-specific-stats');
const playerDetailNameGamesEl = document.getElementById('player-detail-name-games');
const playerDetailGamesContextEl = document.getElementById('player-detail-games-context');
const playerGamesTableContainer = document.getElementById('player-games-table-container');
const weeklyPerformanceChartContainer = document.getElementById('weekly-performance-chart-container'); 
const weeklyPerformanceChartCanvas = document.getElementById('weekly-performance-chart'); 
const allTimePlayerProgressChartContainer = document.getElementById('all-time-player-progress-chart-container'); 
const allTimePlayerProgressChartCanvas = document.getElementById('all-time-player-progress-chart'); 
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
        
async function getAppBaseDirHandle() {
    if (appBaseDirHandle) return appBaseDirHandle;
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
    try {
        console.log("Requesting directory picker for app base directory...");
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await saveHandle(ROOT_DIR_HANDLE_KEY, handle);
        appBaseDirHandle = handle;
        return appBaseDirHandle;
    } catch (err) {
        console.error('User cancelled directory picker or error selecting app base directory:', err);
        alert("Selection of the main application directory is required. A 'Data' subfolder will be used inside it.");
        return null;
    }
}

async function getDataDirHandle() {
    const baseHandle = await getAppBaseDirHandle();
    if (!baseHandle) return null;
    try {
        const dataHandle = await baseHandle.getDirectoryHandle('Data', { create: true });
        return dataHandle;
    } catch (e) {
        console.error("Error getting/creating 'Data' directory handle:", e);
        alert("Could not access or create the 'Data' subdirectory. Please ensure permissions are correct.");
        return null;
    }
}

async function getPlayersDirHandle() {
    const baseHandle = await getAppBaseDirHandle();
    if (!baseHandle) {
        console.error("Application base directory handle not available for Players Directory.");
        return null;
    }
    try {
        const playersDirHandle = await baseHandle.getDirectoryHandle('Data', { create: true })
                                         .then(dataDir => dataDir.getDirectoryHandle('Players', { create: true }));
        return playersDirHandle;
    } catch (e) {
        console.error("Error getting/creating 'Data/Players' directory handle:", e);
        alert("Could not access or create the 'Data/Players' subdirectory.");
        return null;
    }
}

async function loadAllWeekDataFromFS() {
    allWeekData = [];
    const dataDirHandle = await getDataDirHandle();
    if (!dataDirHandle) {
        initialSetupOverlay.style.display = 'flex';
        return;
    }
    initialSetupOverlay.style.display = 'none'; 
    try {
        for await (const entry of dataDirHandle.values()) {
            if (entry.kind === 'directory' && entry.name !== 'Players') { // Folder name is UUID
                const sessionUUID = entry.name;
                try {
                    const dataFileHandle = await entry.getFileHandle('session_data.json', { create: false });
                    const file = await dataFileHandle.getFile();
                    const content = await file.text();
                    const weekData = JSON.parse(content);
                    
                    // Ensure UUID from folder name matches if it exists in JSON, or add it.
                    // User's provided files already have 'uuid' in JSON, so this should align.
                    if (!weekData.uuid) {
                        console.warn(`Session data in folder ${sessionUUID} is missing a UUID. Using folder name as UUID.`);
                        weekData.uuid = sessionUUID;
                    } else if (weekData.uuid !== sessionUUID) {
                        console.warn(`UUID mismatch for folder ${sessionUUID}. JSON UUID: ${weekData.uuid}. Prioritizing folder name.`);
                        weekData.uuid = sessionUUID; // Or handle error differently
                    }
                    allWeekData.push(weekData);
                } catch (e) {
                    console.warn(`Could not read session_data.json for ${entry.name}: `, e);
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

async function saveWeekDataToFS(weekData) { // This is the low-level save function
    const dataDirHandle = await getDataDirHandle();
    if (!dataDirHandle) return false;

    if (!weekData.uuid) { // If it's a new session, generate UUID
        weekData.uuid = generateUUID();
    }
    const weekFolderName = weekData.uuid; // Folder name is the UUID

    try {
        const weekDirHandle = await dataDirHandle.getDirectoryHandle(weekFolderName, { create: true });
        if (weekData.weekDrinkImageFile) {
            const ext = weekData.weekDrinkImageFile.name.split('.').pop();
            const drinkImageName = `drink_image.${ext}`;
            const imageFileHandle = await weekDirHandle.getFileHandle(drinkImageName, { create: true });
            const imageWritable = await imageFileHandle.createWritable();
            await imageWritable.write(weekData.weekDrinkImageFile);
            await imageWritable.close();
            weekData.weekMysteryDrinkImagePath = drinkImageName; 
            delete weekData.weekDrinkImageFile;
        }
        const dataFileHandle = await weekDirHandle.getFileHandle('session_data.json', { create: true });
        const writable = await dataFileHandle.createWritable();
        await writable.write(JSON.stringify(weekData, null, 2));
        await writable.close();
        buildCanonicalPlayerNameMap();
        return true;
    } catch (err) {
        console.error(`Error saving data for session ${weekData.uuid} in Data directory:`, err);
        alert(`Failed to save session ${weekData.name} (${weekData.uuid}). Check console for errors.`);
        return false;
    }
}

async function deleteWeekDataFS(sessionUUID) {
    const dataDirHandle = await getDataDirHandle();
    if (!dataDirHandle) return false;
    const weekFolderName = sessionUUID; // Folder name is the UUID
    const weekToDelete = allWeekData.find(w => w.uuid === sessionUUID);
    const sessionNameForConfirm = weekToDelete ? weekToDelete.name : sessionUUID;

    if (!confirm(`Are you sure you want to delete all data for session '${sessionNameForConfirm}' (UUID: ${sessionUUID}) from the Data directory? This is permanent.`)) {
        return false;
    }
    try {
        await dataDirHandle.removeEntry(weekFolderName, { recursive: true });
        buildCanonicalPlayerNameMap();
        return true;
    } catch (err) {
        console.error(`Error deleting folder ${weekFolderName} from Data directory:`, err);
        alert(`Failed to delete session ${sessionNameForConfirm}. Check console.`);
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
    await loadAllWeekDataFromFS(); 
    if (!appBaseDirHandle && allWeekData.length === 0) { 
        const tempHandle = await getHandle(ROOT_DIR_HANDLE_KEY);
        if (!tempHandle) {
            initialSetupOverlay.style.display = 'flex'; 
            return;
        }
    }
    initialSetupOverlay.style.display = 'none';
    
    populateWeekSelector();
    showTab('dashboard'); 
    prepareNewSessionForm();
    renderManageDataList();
}
        
function prepareNewSessionForm() {
    // const existingIds = allWeekData.map(w => w.id); // Old ID logic removed
    // const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1; // Old ID logic removed
    // sessionIdInput.value = nextId; // Element removed
    document.getElementById('session-name').value = '';
    document.getElementById('session-date').valueAsDate = new Date();
    document.getElementById('week-mystery-drink-name').value = '';
    document.getElementById('week-drink-image').value = '';
    playerEntriesContainer.innerHTML = '';
    addPlayerEntryField();
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
    
    if (tabKey === 'dashboard') renderDashboardUI(getSelectedSessionUUID()); 
    if (tabKey === 'data-entry') prepareNewSessionForm(); 
    if (tabKey === 'manage-data') renderManageDataList();
}

function populateWeekSelector() { 
    weekSelector.innerHTML = '<option value="all">All Time</option>'; 
    allWeekData.forEach(week => { // Assumes allWeekData is sorted by date
        const option = document.createElement('option'); 
        option.value = week.uuid; // Use UUID as value
        option.textContent = `${week.name} (${week.date})`; // Display name and date
        weekSelector.appendChild(option); 
    }); 
}

function getSelectedSessionUUID() { return weekSelector.value; } // Renamed from getSelectedWeekId

function handleWeekSelectionChange() { 
    currentDashboardView = 'poker'; 
    renderDashboardUI(getSelectedSessionUUID()); 
    playerDetailsSection.style.display = 'none'; 
}
function toggleDashboardView() { 
    currentDashboardView = (currentDashboardView === 'poker') ? 'drinks' : 'poker'; 
    renderDashboardUI(getSelectedSessionUUID()); 
}
function sanitizeForFileName(name) { return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, ''); }
function formatCurrency(amount) { return (amount !== null && typeof amount !== 'undefined' ? amount : 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function getPlayerImagePath(canonicalPlayerName) { 
    if (!canonicalPlayerName) return 'knuckles.png';
    return `Data/Players/${sanitizeForFileName(canonicalPlayerName)}.png`;
}

// --- Data Entry Logic (High-level form save) ---
function addPlayerEntryField() {
    const entryCount = playerEntriesContainer.children.length;
    const playerDiv = document.createElement('div');
    playerDiv.classList.add('player-entry');
    playerDiv.innerHTML = `
        <h4>Player ${entryCount + 1}</h4>
        <div class="form-group"><label>Player Name:</label><input type="text" class="player-name" required></div>
        <div class="form-group"><label>Buy-In Amount:</label><input type="number" class="player-buyin" value="0" min="0" step="any" required></div>
        <div class="form-group"><label>Cash-Out Amount:</label><input type="number" class="player-cashout" value="0" min="0" step="any" required></div>
        <div class="form-group"><label>Rating for Week's Drink (0-10, Optional):</label><input type="number" class="player-mystery-drink-rating" min="0" max="10"></div>
        <button onclick="this.parentElement.remove()" style="background-color: #5A5A5A;">Remove Player</button>
    `;
    playerEntriesContainer.appendChild(playerDiv);
}
        
async function saveEnteredSessionData() { // Renamed from saveSessionDataFS to avoid confusion with low-level one
    const weekName = document.getElementById('session-name').value.trim();
    const weekDate = document.getElementById('session-date').value;
    const weekMysteryDrinkName = document.getElementById('week-mystery-drink-name').value.trim() || null;
    const weekDrinkImageFile = document.getElementById('week-drink-image').files[0] || null;

    if (!weekName) { alert("Session Name is required."); return; }
    if (!weekDate) { alert("Session Date is required."); return; }

    // Note: No longer checking for existing ID as UUID will be unique.
    // Could add a check for duplicate name+date if desired, but not implemented here.

    const newWeekData = { 
        // uuid will be generated by saveWeekDataToFS (low-level)
        name: weekName, 
        date: weekDate, 
        weekMysteryDrinkName, 
        weekDrinkImageFile, // This will be processed by saveWeekDataToFS
        players: [] 
    };

    const playerEntries = playerEntriesContainer.querySelectorAll('.player-entry');
    if (playerEntries.length === 0) { alert("Add at least one player."); return; }

    let hasValidPlayer = false;
    for (const entry of playerEntries) {
        const playerName = entry.querySelector('.player-name').value.trim();
        const buyInStr = entry.querySelector('.player-buyin').value;
        const cashOutStr = entry.querySelector('.player-cashout').value;
        const mysteryDrinkRatingInput = entry.querySelector('.player-mystery-drink-rating').value;
        
        const buyIn = buyInStr !== '' ? parseFloat(buyInStr) : 0;
        const cashOut = cashOutStr !== '' ? parseFloat(cashOutStr) : 0;
        const mysteryDrinkRating = mysteryDrinkRatingInput ? parseInt(mysteryDrinkRatingInput) : null;

        if (playerName && !isNaN(buyIn) && !isNaN(cashOut)) {
            newWeekData.players.push({ PlayerName: playerName, BuyIn: buyIn, CashOut: cashOut, MysteryDrinkRating: mysteryDrinkRating });
            hasValidPlayer = true;
        }
    }
    if (!hasValidPlayer) { alert("No valid player data entered."); return; }
    
    const success = await saveWeekDataToFS(newWeekData); // Call the low-level save function
    if (success) {
        alert(`Session '${newWeekData.name}' saved successfully!`);
        await loadAllWeekDataFromFS(); 
        populateWeekSelector();
        prepareNewSessionForm();
        renderManageDataList();
        showTab('dashboard');
    }
}

// --- Data Aggregation & Calculation ---
function getAggregatedStatsForContext(selectedSessionUUID = "all") { // Parameter renamed
    const relevantWeeks = selectedSessionUUID === "all" 
        ? allWeekData 
        : allWeekData.filter(w => w.uuid === selectedSessionUUID);

    if (!relevantWeeks || relevantWeeks.length === 0 && selectedSessionUUID !== "all") {
        return { overall: { totalGames: 0, uniquePlayers: 0, totalBuyIns: 0, totalCashOuts: 0 }, players: {} };
    }

    let totalBuyIns = 0;
    let totalCashOuts = 0;
    const uniqueLcPlayerNames = new Set();
    const playerAggregatedStats = {}; 

    relevantWeeks.forEach(week => {
        week.players.forEach(player => {
            const lcPlayerName = player.PlayerName.toLowerCase();
            const canonicalName = canonicalPlayerNameMap[lcPlayerName] || player.PlayerName;
            uniqueLcPlayerNames.add(lcPlayerName);
            totalBuyIns += (player.BuyIn || 0);
            totalCashOuts += (player.CashOut || 0);

            if (!playerAggregatedStats[lcPlayerName]) {
                playerAggregatedStats[lcPlayerName] = {
                    canonicalName: canonicalName,
                    gamesPlayed: 0, totalBuyIn: 0, totalCashOut: 0, netProfit: 0, wins: 0, gameHistory: []
                };
            }
            const stats = playerAggregatedStats[lcPlayerName];
            const net = (player.CashOut || 0) - (player.BuyIn || 0);
            stats.gamesPlayed++;
            stats.totalBuyIn += (player.BuyIn || 0);
            stats.totalCashOut += (player.CashOut || 0);
            stats.netProfit += net;
            if (net > 0) stats.wins++;
            stats.gameHistory.push({
                sessionId: `${week.name} (${week.date})`, // Changed from W{id}
                date: week.date,
                net: net,
                buyIn: player.BuyIn || 0,
                cashOut: player.CashOut || 0,
                sessionUUID: week.uuid // Store for reference
            });
        });
    });

    Object.values(playerAggregatedStats).forEach(pStats => {
        pStats.gameHistory.sort((a,b) => new Date(a.date) - new Date(b.date));
    });
    
    return {
        overall: {
            totalGames: relevantWeeks.length,
            uniquePlayers: uniqueLcPlayerNames.size,
            totalBuyIns: totalBuyIns,
            totalCashOuts: totalCashOuts
        },
        players: playerAggregatedStats
    };
}

// --- Dashboard Rendering ---
function renderDashboardUI(selectedSessionUUID = "all") { // Parameter renamed
    const pokerStatsDiv = document.getElementById('dashboard-poker-stats');
    const drinkStatsDiv = document.getElementById('dashboard-drink-stats');
    const allTimeDrinkStatsContainer = document.getElementById('all-time-drink-stats-container');
    const playerChartSpecificContainer = document.getElementById('player-chart-container'); 

    playerDetailsSection.style.display = 'none';
    drinkStatsDiv.style.display = 'none';
    allTimeDrinkStatsContainer.style.display = 'none';
    weeklyPerformanceChartContainer.style.display = 'none';
    if (allTimePlayerProgressChartContainer) allTimePlayerProgressChartContainer.style.display = 'none';
    pokerStatsDiv.style.display = 'none';

    if (selectedSessionUUID === "all") {
        if (allTimePlayerProgressChartContainer) allTimePlayerProgressChartContainer.style.display = 'block';
        pokerStatsDiv.style.display = 'block';
        allTimeDrinkStatsContainer.style.display = 'block';
        
        renderAllTimePlayerProgressChart(); 
        renderOverallStats(selectedSessionUUID);
        renderPlayerList(selectedSessionUUID);
        renderAllTimeDrinkStats(); 

        const currentDetailedPlayer = playerDetailNameEl.textContent;
        if(currentDetailedPlayer && document.getElementById('player-list').querySelector(`[data-player-name="${currentDetailedPlayer}"]`)) {
            const { players: aggregatedPlayerStatsAllTime } = getAggregatedStatsForContext("all");
            if (aggregatedPlayerStatsAllTime[currentDetailedPlayer.toLowerCase()]) {
                showPlayerDetails(currentDetailedPlayer, "all"); 
            } else {
                 playerDetailsSection.style.display = 'none';
            }
        } else {
             playerDetailsSection.style.display = 'none';
        }
        if(playerChartSpecificContainer) playerChartSpecificContainer.style.display = playerDetailsSection.style.display === 'block' ? 'block' : 'none';

    } else { // Specific session selected
        if (allTimePlayerProgressChartContainer) allTimePlayerProgressChartContainer.style.display = 'none';
        pokerStatsDiv.style.display = 'block';
        drinkStatsDiv.style.display = 'block'; 
        weeklyPerformanceChartContainer.style.display = 'block'; 

        renderOverallStats(selectedSessionUUID);
        renderPlayerList(selectedSessionUUID); 
        renderDrinkStatsForWeek(selectedSessionUUID);
        renderWeeklyPerformanceChart(selectedSessionUUID); 
        
        if(playerChartSpecificContainer) playerChartSpecificContainer.style.display = 'none';
    }
}

function renderOverallStats(selectedSessionUUID = "all") { // Parameter renamed
    const { overall } = getAggregatedStatsForContext(selectedSessionUUID);
    overallStatsContainer.innerHTML = `
        <div class="stat-card"><h4>Total Sessions</h4><p>${overall.totalGames}</p></div>
        <div class="stat-card"><h4>Unique Players</h4><p>${overall.uniquePlayers}</p></div>
        <div class="stat-card"><h4>Total Buy-Ins</h4><p>${formatCurrency(overall.totalBuyIns)}</p></div>
        <div class="stat-card"><h4>Total Cash-Outs</h4><p>${formatCurrency(overall.totalCashOuts)}</p></div>
    `;
}

function renderPlayerList(selectedSessionUUID = "all") { // Parameter renamed
    const { players: aggregatedPlayerStats } = getAggregatedStatsForContext(selectedSessionUUID);
    const searchTerm = document.getElementById('player-search').value.toLowerCase();
    playerListContainer.innerHTML = '';

    const sortedLcPlayerNames = Object.keys(aggregatedPlayerStats)
        .filter(lcName => aggregatedPlayerStats[lcName].canonicalName.toLowerCase().includes(searchTerm))
        .sort((a, b) => aggregatedPlayerStats[b].netProfit - aggregatedPlayerStats[a].netProfit);

    if (sortedLcPlayerNames.length === 0) {
        playerListContainer.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">No players found for this context or search.</p>';
        return;
    }

    sortedLcPlayerNames.forEach(lcPlayerName => {
        const playerData = aggregatedPlayerStats[lcPlayerName];
        const canonicalName = playerData.canonicalName;
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('player-list-item');
        playerDiv.dataset.playerName = canonicalName; 
        
        const netProfit = playerData.netProfit;
        let profitClass = netProfit > 0 ? 'profit' : netProfit < 0 ? 'loss' : 'neutral';

        if (selectedSessionUUID === "all") {
            playerDiv.onclick = () => showPlayerDetails(canonicalName, "all");
            playerDiv.innerHTML = `
                <img src="${getPlayerImagePath(canonicalName)}" class="player-avatar" alt="${canonicalName}" onerror="this.onerror=null;this.src='knuckles.png';">
                <span style="flex-grow: 1;">
                    <strong>${canonicalName}</strong> <br>
                    <small>Games: ${playerData.gamesPlayed}, Net: <span class="${profitClass}">${formatCurrency(netProfit)}</span></small>
                </span>
            `;
        } else {
            playerDiv.innerHTML = `
                <img src="${getPlayerImagePath(canonicalName)}" class="player-avatar" alt="${canonicalName}" onerror="this.onerror=null;this.src='knuckles.png';">
                <div class="player-list-item-details">
                    <strong>${canonicalName}</strong><br>
                    <small>
                        Buy-In: ${formatCurrency(playerData.totalBuyIn)} | 
                        Cash-Out: ${formatCurrency(playerData.totalCashOut)} | 
                        Net: <span class="${profitClass}">${formatCurrency(playerData.netProfit)}</span>
                    </small>
                </div>
            `;
        }
        playerListContainer.appendChild(playerDiv);
    });
}

function showPlayerDetails(canonicalPlayerName, selectedSessionUUID = "all") { // Parameter renamed
    if (selectedSessionUUID !== "all") {
        playerDetailsSection.style.display = 'none';
        if (document.getElementById('player-chart-container')) document.getElementById('player-chart-container').style.display = 'none';
        return;
    }

    const { players: aggregatedPlayerStats } = getAggregatedStatsForContext(selectedSessionUUID);
    const lcPlayerName = canonicalPlayerName.toLowerCase();
    const playerData = aggregatedPlayerStats[lcPlayerName];
    const playerChartSpecificContainer = document.getElementById('player-chart-container');

    if (!playerData) {
        playerDetailsSection.style.display = 'none';
        if(playerChartSpecificContainer) playerChartSpecificContainer.style.display = 'none'; 
        console.warn(`No data for player ${canonicalPlayerName} (lc: ${lcPlayerName}) in context ${selectedSessionUUID}`);
        return;
    }

    playerDetailsSection.style.display = 'block';
    const contextText = "All Time"; 
    playerDetailNameEl.textContent = canonicalPlayerName;
    playerDetailContextEl.textContent = contextText;
    playerDetailContextEl.dataset.contextSessionUuid = selectedSessionUUID; // Store "all" or actual UUID
    playerDetailAvatarEl.src = getPlayerImagePath(canonicalPlayerName);
    playerDetailAvatarEl.onerror = () => { playerDetailAvatarEl.src = 'knuckles.png'; };

    const winPercentage = playerData.gamesPlayed > 0 ? (playerData.wins / playerData.gamesPlayed * 100).toFixed(1) : 0;
    const avgNetPerGame = playerData.gamesPlayed > 0 ? (playerData.netProfit / playerData.gamesPlayed) : 0;
    
    playerSpecificStatsContainer.innerHTML = `
        <div class="stat-card"><h4>Games Played</h4><p>${playerData.gamesPlayed}</p></div>
        <div class="stat-card"><h4>Total Buy-In</h4><p>${formatCurrency(playerData.totalBuyIn)}</p></div>
        <div class="stat-card"><h4>Total Cash-Out</h4><p>${formatCurrency(playerData.totalCashOut)}</p></div>
        <div class="stat-card"><h4>Net Profit/Loss</h4><p class="${playerData.netProfit > 0 ? 'profit' : playerData.netProfit < 0 ? 'loss' : 'neutral'}">${formatCurrency(playerData.netProfit)}</p></div>
        <div class="stat-card"><h4>Win % (Net > 0)</h4><p>${winPercentage}%</p></div>
        <div class="stat-card"><h4>Avg. Net/Game</h4><p class="${avgNetPerGame > 0 ? 'profit' : avgNetPerGame < 0 ? 'loss' : 'neutral'}">${formatCurrency(avgNetPerGame)}</p></div>
    `;
    
    if(playerChartSpecificContainer) playerChartSpecificContainer.style.display = 'block';
    renderPlayerChart(canonicalPlayerName, selectedSessionUUID, playerData.gameHistory); 
    
    renderPlayerGamesTable(canonicalPlayerName, selectedSessionUUID);
    
    playerDetailNameGamesEl.textContent = canonicalPlayerName;
    playerDetailGamesContextEl.textContent = contextText;
    playerDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
        
function renderPlayerChart(canonicalPlayerName, selectedSessionUUID, gameHistoryForChart) { // Parameter renamed
    if (playerChartInstance) playerChartInstance.destroy();
    if (!gameHistoryForChart || gameHistoryForChart.length === 0) {
        document.getElementById('player-chart').style.display = 'none';
        return;
    }
    document.getElementById('player-chart').style.display = 'block';

    const labels = gameHistoryForChart.map(game => game.sessionId); // sessionId already updated format
    const dataPoints = gameHistoryForChart.map(game => game.net);
    
    let cumulativeNet = 0;
    const cumulativeDataPoints = dataPoints.map(net => {
        cumulativeNet += net;
        return cumulativeNet;
    });

    const chartCtx = document.getElementById('player-chart').getContext('2d');
    playerChartInstance = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Net Winnings per Game', data: dataPoints,
                borderColor: 'rgba(220, 53, 69, 0.8)', backgroundColor: 'rgba(220, 53, 69, 0.2)',
                tension: 0.1, fill: true, yAxisID: 'yNet'
            },{
                label: 'Cumulative Net Winnings', data: cumulativeDataPoints,
                borderColor: 'rgba(255, 193, 7, 0.8)', backgroundColor: 'rgba(255, 193, 7, 0.1)',
                tension: 0.1, fill: false, yAxisID: 'yCumulative'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                tooltip: { 
                    callbacks: { 
                        label: function(context) { 
                            let label = context.dataset.label || ''; 
                            if (label) label += ': '; 
                            if (context.parsed.y !== null) label += formatCurrency(context.parsed.y); 
                            if (context.dataset.label === 'Net Winnings per Game' && gameHistoryForChart[context.dataIndex]) { 
                                const gameData = gameHistoryForChart[context.dataIndex]; 
                                label += ` (Buy: ${formatCurrency(gameData.buyIn)}, Out: ${formatCurrency(gameData.cashOut)})`;
                            } 
                            return label; 
                        } 
                    }
                }
            },
            scales: { 
                x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }, 
                yNet: { position: 'left', beginAtZero: false, ticks: { color: 'var(--text-secondary)', callback: function(value) { return formatCurrency(value); }}, grid: { color: 'var(--border-color)' } }, 
                yCumulative: { position: 'right', beginAtZero: false, ticks: { color: 'var(--text-secondary)', callback: function(value) { return formatCurrency(value); }}, grid: { drawOnChartArea: false } } 
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

function renderPlayerGamesTable(canonicalPlayerName, selectedSessionUUID = "all") { // Parameter renamed
    const relevantWeeks = selectedSessionUUID === "all" 
        ? allWeekData 
        : allWeekData.filter(w => w.uuid === selectedSessionUUID);
    let playerGames = [];

    relevantWeeks.forEach(week => {
        week.players.forEach(p => {
            if (p.PlayerName.toLowerCase() === canonicalPlayerName.toLowerCase()) { 
                playerGames.push({
                    SessionName: week.name, 
                    Date: week.date,
                    BuyIn: p.BuyIn, CashOut: p.CashOut,
                    Net: (p.CashOut || 0) - (p.BuyIn || 0),
                    MysteryDrinkName: week.weekMysteryDrinkName, 
                    MysteryDrinkRating: p.MysteryDrinkRating,
                    sessionUUID: week.uuid
                });
            }
        });
    });
    playerGames.sort((a,b) => new Date(a.Date) - new Date(b.Date));

    if (playerGames.length === 0) {
        playerGamesTableContainer.innerHTML = "<p style='text-align:center; color: var(--text-secondary);'>No games played by this player in this context.</p>";
        return;
    }
    
    let tableHTML = '<table><thead><tr><th>Session</th><th>Date</th><th>Buy-In</th><th>Cash-Out</th><th>Net</th><th>Week\'s Drink</th><th>Your Rating</th></tr></thead><tbody>';
    playerGames.forEach(record => {
        let netClass = record.Net > 0 ? 'profit' : record.Net < 0 ? 'loss' : 'neutral';
        tableHTML += '<tr>';
        tableHTML +=   '<td>' + record.SessionName + '</td>';
        tableHTML +=   '<td>' + record.Date + '</td>';
        tableHTML +=   '<td>' + formatCurrency(record.BuyIn) + '</td>';
        tableHTML +=   '<td>' + formatCurrency(record.CashOut) + '</td>';
        tableHTML +=   '<td class="' + netClass + '">' + formatCurrency(record.Net) + '</td>';
        tableHTML +=   '<td>' + (record.MysteryDrinkName || 'N/A') + '</td>';
        tableHTML +=   '<td>' + (record.MysteryDrinkRating !== null ? record.MysteryDrinkRating + '/10' : 'N/A') + '</td>';
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    playerGamesTableContainer.innerHTML = tableHTML;
}

async function renderDrinkStatsForWeek(sessionUUID) { // Parameter renamed
    const week = allWeekData.find(w => w.uuid === sessionUUID);
    document.getElementById('drink-stats-week-name').textContent = week ? `${week.name} (${week.date})` : 'N/A'; // Updated display
    
    const weekDrinkInfoContainer = document.getElementById('week-drink-info-container');
    const playerRatingsDisplay = document.getElementById('player-drink-ratings-display');
    weekDrinkInfoContainer.innerHTML = '';
    playerRatingsDisplay.innerHTML = '';

    if (!week) {
        document.getElementById('avg-drink-rating').textContent = 'N/A';
        return;
    }

    let weekDrinkImageHtml = '';
    if (week.weekMysteryDrinkImagePath) {
         try {
            const dataDir = await getDataDirHandle();
            if (dataDir) {
                const weekDir = await dataDir.getDirectoryHandle(week.uuid, {create:false}); // Use UUID for folder
                const imgFileHandle = await weekDir.getFileHandle(week.weekMysteryDrinkImagePath, {create:false});
                const file = await imgFileHandle.getFile();
                const blobUrl = URL.createObjectURL(file);
                weekDrinkImageHtml = `<img src="${blobUrl}" alt="${week.weekMysteryDrinkName || 'Week Drink'}" class="week-drink-image" onload="URL.revokeObjectURL(this.src)">`;
            }
        } catch (e) { console.warn("Could not load week's drink image: " + week.weekMysteryDrinkImagePath, e); }
    }
    weekDrinkInfoContainer.innerHTML = `
        <h4>Week's Drink: ${week.weekMysteryDrinkName || 'N/A'}</h4>
        ${weekDrinkImageHtml}
    `;
    
    let totalRating = 0;
    let ratedDrinksCount = 0;
    if (week.players && week.players.length > 0) {
        week.players.forEach(player => {
            if (player.MysteryDrinkRating !== null && typeof player.MysteryDrinkRating === 'number') {
                totalRating += player.MysteryDrinkRating;
                ratedDrinksCount++;
            }
            const ratingItem = document.createElement('div');
            ratingItem.classList.add('player-drink-rating-item');
            ratingItem.innerHTML = `<strong>${player.PlayerName}:</strong> ${player.MysteryDrinkRating !== null ? player.MysteryDrinkRating + '/10' : 'Not Rated'}`;
            playerRatingsDisplay.appendChild(ratingItem);
        });
    } else {
         playerRatingsDisplay.innerHTML = '<p>No player ratings for this week.</p>';
    }

    const avgRating = ratedDrinksCount > 0 ? (totalRating / ratedDrinksCount).toFixed(1) : 'N/A';
    document.getElementById('avg-drink-rating').textContent = avgRating + (avgRating !== 'N/A' ? '/10' : '');
}

async function renderAllTimeDrinkStats() {
    const container = document.getElementById('all-time-drink-stats-container');
    container.innerHTML = ''; 

    const drinksWithAvgRating = allWeekData
        .filter(week => week.weekMysteryDrinkName && week.weekMysteryDrinkName.trim() !== '')
        .map(week => {
            let totalRating = 0;
            let ratedDrinksCount = 0;
            if (week.players) {
                week.players.forEach(player => {
                    if (player.MysteryDrinkRating !== null && typeof player.MysteryDrinkRating === 'number') {
                        totalRating += player.MysteryDrinkRating;
                        ratedDrinksCount++;
                    }
                });
            }
            const averageRating = ratedDrinksCount > 0 ? (totalRating / ratedDrinksCount) : -1;
            return { ...week, averageRating, ratedDrinksCount }; 
        })
        .sort((a, b) => b.averageRating - a.averageRating); 

    if (drinksWithAvgRating.length === 0) {
        container.innerHTML = '<h3>All Mystery Drinks</h3><p style="text-align:center; color: var(--text-secondary);">No mystery drinks recorded across any sessions.</p>';
        return;
    }

    let content = '<h3>All Mystery Drinks (Across All Sessions)</h3>';
    content += '<div class="drink-display-grid">';

    for (const week of drinksWithAvgRating) { 
        let weekDrinkImageHtml = '';
        if (week.weekMysteryDrinkImagePath) {
            try {
                const dataDir = await getDataDirHandle();
                if (dataDir) {
                    const weekDir = await dataDir.getDirectoryHandle(week.uuid, { create: false }); // Use UUID
                    const imgFileHandle = await weekDir.getFileHandle(week.weekMysteryDrinkImagePath, { create: false });
                    const file = await imgFileHandle.getFile();
                    const blobUrl = URL.createObjectURL(file);
                    weekDrinkImageHtml = `<img src="${blobUrl}" alt="${week.weekMysteryDrinkName}" class="week-drink-image" onload="URL.revokeObjectURL(this.src)">`;
                }
            } catch (e) {
                console.warn(`Could not load week's drink image for all-time view (${week.weekMysteryDrinkImagePath}):`, e);
                weekDrinkImageHtml = '<p style="font-size:0.8em; color:var(--text-secondary);">Image not found</p>';
            }
        }
        const avgRatingForWeekDisplay = week.ratedDrinksCount > 0 ? week.averageRating.toFixed(1) + '/10' : 'Not Rated';
        content += `
            <div class="drink-card">
                <h4>${week.weekMysteryDrinkName}</h4>
                <p style="font-size:0.9em; color:var(--text-secondary); margin-bottom:5px;"><em>Session: ${week.name} (${week.date})</em></p>
                ${weekDrinkImageHtml}
                <p><strong>Avg. Rating:</strong> ${avgRatingForWeekDisplay}</p>
            </div>
        `;
    }
    content += '</div>';
    container.innerHTML = content;
}

function renderAllTimePlayerProgressChart() {
    if (allTimePlayerProgressChartInstance) {
        allTimePlayerProgressChartInstance.destroy();
        allTimePlayerProgressChartInstance = null;
    }
    if (!allWeekData || allWeekData.length === 0) {
        if (allTimePlayerProgressChartCanvas) allTimePlayerProgressChartCanvas.style.display = 'none';
        return;
    }
    if (allTimePlayerProgressChartCanvas) allTimePlayerProgressChartCanvas.style.display = 'block';

    // Assumes allWeekData is already sorted by date, then uuid by loadAllWeekDataFromFS()
    const sortedWeeks = allWeekData; 
    const weekLabels = sortedWeeks.map(week => `${week.name.substring(0,15)} (${week.date})`); // Updated label

    const datasets = [];
    const playerCumulativeNet = {}; 

    Object.keys(canonicalPlayerNameMap).forEach(lcName => {
        playerCumulativeNet[lcName] = Array(sortedWeeks.length).fill(null); 
    });

    sortedWeeks.forEach((week, weekIndex) => {
        Object.keys(canonicalPlayerNameMap).forEach(lcPlayerName => {
            let currentWeekNetForPlayer = 0;
            const playerInWeek = week.players.find(p => p.PlayerName.toLowerCase() === lcPlayerName);
            
            if (playerInWeek) {
                currentWeekNetForPlayer = (playerInWeek.CashOut || 0) - (playerInWeek.BuyIn || 0);
            }
            const previousCumulativeNet = weekIndex > 0 ? (playerCumulativeNet[lcPlayerName][weekIndex - 1] || 0) : 0;
            if (playerInWeek || previousCumulativeNet !== 0) { // Only carry forward if player played or had a balance
                 playerCumulativeNet[lcPlayerName][weekIndex] = previousCumulativeNet + currentWeekNetForPlayer;
            }
        });
    });

    Object.keys(canonicalPlayerNameMap).forEach(lcPlayerName => {
        const canonicalName = canonicalPlayerNameMap[lcPlayerName];
        if (playerCumulativeNet[lcPlayerName].some(val => val !== null)) {
            datasets.push({
                label: canonicalName, data: playerCumulativeNet[lcPlayerName],
                fill: false, borderColor: getRandomColor(), tension: 0.1, spanGaps: true
            });
        }
    });

    if (!allTimePlayerProgressChartCanvas) { console.error("allTimePlayerProgressChartCanvas is not defined"); return; }
    const chartCtx = allTimePlayerProgressChartCanvas.getContext('2d');
    if (!chartCtx) { console.error("Failed to get 2D context from allTimePlayerProgressChartCanvas"); return; }

    allTimePlayerProgressChartInstance = new Chart(chartCtx, {
        type: 'line', data: { labels: weekLabels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                tooltip: { mode: 'index', intersect: false, callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) label += formatCurrency(context.parsed.y); return label; }}},
                legend: { position: 'top'}
            },
            scales: {
                y: { beginAtZero: false, ticks: { color: 'var(--text-secondary)', callback: function(value) { return formatCurrency(value); }}, grid: { color: 'var(--border-color)' }},
                x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' }}
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

function renderWeeklyPerformanceChart(sessionUUID) { // Parameter renamed
    if (weeklyPerformanceChartInstance) {
        weeklyPerformanceChartInstance.destroy();
        weeklyPerformanceChartInstance = null;
    }
    const weekData = allWeekData.find(w => w.uuid === sessionUUID); // Find by UUID

    if (!weeklyPerformanceChartCanvas) {
        console.error("Global weeklyPerformanceChartCanvas is not initialized.");
        return; 
    }
    if (!weekData || !weekData.players || weekData.players.length === 0) {
        weeklyPerformanceChartCanvas.style.display = 'none'; 
        return;
    }
    weeklyPerformanceChartCanvas.style.display = 'block';
    const chartCtx = weeklyPerformanceChartCanvas.getContext('2d');
    if (!chartCtx) {
        console.error("Failed to get 2D context from weekly-performance-chart canvas.");
        weeklyPerformanceChartCanvas.style.display = 'none';
        return;
    }
    const labels = weekData.players.map(p => canonicalPlayerNameMap[p.PlayerName.toLowerCase()] || p.PlayerName);
    const buyInData = weekData.players.map(p => p.BuyIn || 0);
    const cashOutData = weekData.players.map(p => p.CashOut || 0);
    weeklyPerformanceChartInstance = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Buy-In', data: buyInData, backgroundColor: 'rgba(220, 53, 69, 0.7)', borderColor: 'rgba(220, 53, 69, 1)', borderWidth: 1 },
                { label: 'Cash-Out', data: cashOutData, backgroundColor: 'rgba(40, 167, 69, 0.7)', borderColor: 'rgba(40, 167, 69, 1)', borderWidth: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) label += formatCurrency(context.parsed.y); return label; }}}},
            scales: {
                y: { beginAtZero: true, ticks: { color: 'var(--text-secondary)', callback: function(value) { return formatCurrency(value); }}, grid: { color: 'var(--border-color)' }},
                x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' }}
            }
        }
    });
}

// --- Manage Data Tab ---
function renderManageDataList() {
    editWeekDetailsForm.style.display = 'none';
    manageDataWeekSelector.innerHTML = '<option value="">Select a session to edit...</option>';
    allWeekData.forEach(week => { // Assumes sorted by date
        const option = document.createElement('option');
        option.value = week.uuid; // Use UUID
        option.textContent = `${week.name} (${week.date})`; // Display name and date
        manageDataWeekSelector.appendChild(option);
    });

    manageDataWeekSelector.onchange = () => {
        const selectedSessionUUID = manageDataWeekSelector.value;
        if (selectedSessionUUID) {
            loadWeekDetailsForEditing(selectedSessionUUID); // Pass UUID
            editWeekDetailsForm.style.display = 'block';
        } else {
            editWeekDetailsForm.style.display = 'none';
            currentWeekDrinkImageDisplay.innerHTML = '';
        }
    };
    saveWeekChangesButton.onclick = saveModifiedWeekData;
    deleteThisWeekButton.onclick = deleteThisWeekInForm;
    managePlayerEntriesContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center; margin-bottom:10px;"><em>Player information for the selected session will appear here once a session is chosen.</em></p>';
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
    if (!selectedCanonicalPlayerName) { alert("Please select a player first."); return; }
    const avatarFile = newPlayerAvatarInput.files[0];
    if (!avatarFile) { alert("Please select an image file to upload."); return; }
    const playersDir = await getPlayersDirHandle();
    if (!playersDir) { alert("Could not access the Players directory. Avatar cannot be saved."); return; }
    const fileName = sanitizeForFileName(selectedCanonicalPlayerName) + '.png'; 
    try {
        const fileHandle = await playersDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(avatarFile);
        await writable.close();
        alert(`Avatar for ${selectedCanonicalPlayerName} saved successfully as ${fileName}!`);
        await loadPlayerAvatarForEditing(selectedCanonicalPlayerName);
        if (document.getElementById('dashboard').classList.contains('active')) {
             renderDashboardUI(getSelectedSessionUUID());
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
                const imgFileHandle = await weekDir.getFileHandle(weekData.weekMysteryDrinkImagePath, { create: false });
                const file = await imgFileHandle.getFile();
                const blobUrl = URL.createObjectURL(file);
                displayElement.innerHTML = `<p>Current Image:</p><img src="${blobUrl}" alt="${weekData.weekMysteryDrinkName || 'Week Drink'}" class="week-drink-image" style="max-height: 100px; margin-bottom:10px;" onload="URL.revokeObjectURL(this.src)">`;
            }
        } catch (e) {
            console.warn("Could not load current week's drink image for form: " + weekData.weekMysteryDrinkImagePath, e);
            displayElement.innerHTML = '<p style="font-size:0.8em; color:var(--text-secondary);">Current image not found or cannot be displayed.</p>';
        }
    } else {
        displayElement.innerHTML = '<p style="font-size:0.8em; color:var(--text-secondary);">No current image for this session.</p>';
    }
}

async function loadWeekDetailsForEditing(sessionUUID) { // Parameter renamed
    const week = allWeekData.find(w => w.uuid === sessionUUID); // Find by UUID
    if (!week) {
        alert("Selected session not found!");
        editWeekDetailsForm.style.display = 'none';
        return;
    }
    // manageSessionIdInput.value = week.id; // Element removed, UUID is week.uuid
    manageSessionNameInput.value = week.name;
    manageSessionDateInput.value = week.date;
    manageWeekMysteryDrinkNameInput.value = week.weekMysteryDrinkName || '';
    manageWeekDrinkImageInput.value = ''; 
    await renderDrinkImageInForm(week, currentWeekDrinkImageDisplay);
    // managePlayerEntriesContainer.innerHTML = `<p><em>Player data for session '${week.name}' will be editable here.</em></p>`; // Old placeholder

    // Populate player edit fields
    managePlayerEntriesContainer.innerHTML = ''; // Clear previous entries
    if (week.players && week.players.length > 0) {
        week.players.forEach(player => {
            addPlayerEntryFieldInManageForm(player); // Pass existing player data
        });
    } else {
        managePlayerEntriesContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center; margin-bottom:10px;"><em>No players in this session. Add one below.</em></p>';
    }
}

async function saveModifiedWeekData() {
    const sessionUUID = manageDataWeekSelector.value; // Get UUID from selector
    if (!sessionUUID) {
        alert("No session selected to save.");
        return;
    }

    const weekIndex = allWeekData.findIndex(w => w.uuid === sessionUUID);
    if (weekIndex === -1) {
        alert("Original session data not found to save changes.");
        return;
    }

    const originalWeekData = allWeekData[weekIndex];
    const updatedWeekData = { ...originalWeekData }; // Clone

    updatedWeekData.name = manageSessionNameInput.value.trim();
    updatedWeekData.date = manageSessionDateInput.value;
    updatedWeekData.weekMysteryDrinkName = manageWeekMysteryDrinkNameInput.value.trim() || null;
    
    const newDrinkImageFile = manageWeekDrinkImageInput.files[0] || null;
    if (newDrinkImageFile) {
        updatedWeekData.weekDrinkImageFile = newDrinkImageFile; 
    } else {
        delete updatedWeekData.weekDrinkImageFile; 
    }

    if (!updatedWeekData.name) { alert("Session Name is required."); return; }
    if (!updatedWeekData.date) { alert("Session Date is required."); return; }

    // Process edited player data
    const editedPlayers = [];
    const playerEntryDivs = managePlayerEntriesContainer.querySelectorAll('.player-entry-manage');
    
    for (const entryDiv of playerEntryDivs) {
        const nameInput = entryDiv.querySelector('.player-name-manage');
        const buyInStr = entryDiv.querySelector('.player-buyin-manage').value;
        const cashOutStr = entryDiv.querySelector('.player-cashout-manage').value;
        const ratingStr = entryDiv.querySelector('.player-rating-manage').value;

        const playerName = nameInput.value.trim(); // This will be read-only value for existing, or new value for new player
        const buyIn = buyInStr !== '' ? parseFloat(buyInStr) : 0;
        const cashOut = cashOutStr !== '' ? parseFloat(cashOutStr) : 0;
        const mysteryDrinkRating = ratingStr !== '' ? parseInt(ratingStr) : null;

        if (!playerName) {
            // If it's a new player input field (not read-only) and it's empty, skip it.
            // Existing players always have a name (read-only field).
            if (nameInput.classList.contains('new-player-name-manage')) {
                continue; 
            }
            // This case should ideally not be hit for existing players due to readonly name, but as a safeguard:
            alert("A player name is missing. Please ensure all players have names.");
            return;
        }
        if (isNaN(buyIn) || isNaN(cashOut)) {
            alert(`Invalid buy-in or cash-out for player ${playerName}. Please enter valid numbers.`);
            return;
        }

        editedPlayers.push({
            PlayerName: playerName,
            BuyIn: buyIn,
            CashOut: cashOut,
            MysteryDrinkRating: mysteryDrinkRating
        });
    }
    updatedWeekData.players = editedPlayers;

    const success = await saveWeekDataToFS(updatedWeekData); // Low-level save
    if (success) {
        alert(`Session '${updatedWeekData.name}' updated successfully!`);
        await loadAllWeekDataFromFS(); 
        populateWeekSelector(); 
        renderManageDataList(); 
        
        if (manageDataWeekSelector.value === sessionUUID){
            loadWeekDetailsForEditing(sessionUUID);
        } else {
            manageDataWeekSelector.value = sessionUUID;
            if (sessionUUID) loadWeekDetailsForEditing(sessionUUID);
        }
        if (document.getElementById('dashboard').classList.contains('active')) {
            renderDashboardUI(getSelectedSessionUUID());
        }
    } else {
        alert(`Failed to update session '${updatedWeekData.name}'.`);
    }
}

async function deleteThisWeekInForm() {
    const sessionUUID = manageDataWeekSelector.value; // Get UUID from selector
    if (!sessionUUID) {
        alert("No session selected for deletion.");
        return;
    }
    const weekToDelete = allWeekData.find(w => w.uuid === sessionUUID);
    const sessionName = weekToDelete ? weekToDelete.name : sessionUUID;

    const success = await deleteWeekDataFS(sessionUUID); // Pass UUID
    if (success) {
        alert(`Session '${sessionName}' and its data deleted successfully!`);
        await loadAllWeekDataFromFS();
        populateWeekSelector(); 
        renderManageDataList(); 
        editWeekDetailsForm.style.display = 'none'; 
        currentWeekDrinkImageDisplay.innerHTML = '';
        if (document.getElementById('dashboard').classList.contains('active')) {
            renderDashboardUI(getSelectedSessionUUID());
        }
    } else {
        alert(`Failed to delete session '${sessionName}'.`);
    }
}

// --- CSV Export ---
function exportAllDataToCSV() {
    if (allWeekData.length === 0) { alert('No data to export.'); return; }
    // Headers: WeekUUID,WeekName,WeekDate,WeekMysteryDrinkName,PlayerName,BuyIn,CashOut,PlayerDrinkRating
    // Using UUID internally but for CSV export, maybe name/date is more human-readable if not exporting UUID.
    // For now, let's stick to not exporting UUID directly to user CSV unless specifically requested.
    const headers = "SessionName,SessionDate,WeekMysteryDrinkName,PlayerName,BuyIn,CashOut,PlayerDrinkRating";
    let csvRows = [headers];
    allWeekData.forEach(week => {
        week.players.forEach(player => {
            csvRows.push([
                `"${(week.name || '').replace(/"/g, '""')}"`, week.date,
                `"${(week.weekMysteryDrinkName || '').replace(/"/g, '""')}"`, 
                `"${(player.PlayerName || '').replace(/"/g, '""')}"`,
                player.BuyIn || 0, player.CashOut || 0,
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
    alert("To export all data as a ZIP file, please manually navigate to your application's root directory, find the 'Data' subfolder, and create a ZIP archive of it using your operating system's built-in tools (e.g., right-click -> Send to -> Compressed (zipped) folder on Windows, or right-click -> Compress on macOS).");
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
                    console.warn("Skipping player with missing or invalid PlayerName in week:", week.uuid, player);
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
    const container = managePlayerEntriesContainer; // Global const for this container
    const playerDiv = document.createElement('div');
    playerDiv.classList.add('player-entry-manage'); // Use a different class if needed for styling/selection
    playerDiv.style.border = "1px solid var(--border-color-subtle)";
    playerDiv.style.padding = "10px";
    playerDiv.style.marginBottom = "10px";
    playerDiv.style.borderRadius = "4px";

    const playerName = player ? player.PlayerName : "";
    const buyIn = player ? (player.BuyIn || 0) : 0;
    const cashOut = player ? (player.CashOut || 0) : 0;
    const rating = player ? player.MysteryDrinkRating : "";
    // const isExistingPlayer = player ? true : false; // No longer needed for read-only logic

    // Player name is always editable
    const playerNameHTML = `<label>Player Name:</label><input type="text" class="player-name-manage" value="${playerName}" placeholder="Enter Player Name" required>`;

    playerDiv.innerHTML = `
        <div class="form-group">${playerNameHTML}</div>
        <div class="form-group"><label>Buy-In:</label><input type="number" class="player-buyin-manage" value="${buyIn}" min="0" step="any" required></div>
        <div class="form-group"><label>Cash-Out:</label><input type="number" class="player-cashout-manage" value="${cashOut}" min="0" step="any" required></div>
        <div class="form-group"><label>Drink Rating (0-10):</label><input type="number" class="player-rating-manage" value="${rating}" min="0" max="10"></div>
        <button type="button" onclick="this.parentElement.remove()" class="danger" style="font-size:0.85em; padding: 5px 8px;">Remove Player</button>
    `;
    container.appendChild(playerDiv);
} 