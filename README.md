# World Series of Knuckles - Poker Tracker

The World Series of Knuckles is a vibrant and engaging web app built to manage and visualize ongoing poker league stats with friends. It tracks every game's buy-ins, final amounts, and net winnings per player, while generating dynamic charts to compare long-term progression and highlight top performers. Each game can feature multiple drinks that players rate, turning every poker night into a blend of competition and taste-testing. With features like searchable player profiles, editable avatars, detailed game histories, and exportable CSV summaries, it offers a fun and polished hub for game nights that go beyond the cards.

Track your poker league's stats, relive game nights, and see who's truly the "King of Knuckles"! This web app helps you manage poker games, player performance, and even track and rate drinks, all stored locally on your computer.

![image](https://github.com/user-attachments/assets/16e90775-2123-4b8e-9eda-89f945684fea)

## Key Features

* **Detailed Game Logging:** Record game dates, player buy-ins, final amounts, and net results.
* **Drink Tracking:** Add multiple drinks per game with individual images and player ratings.
* **Dynamic Dashboard:**
  * View "All Time" stats or stats for a specific poker game.
  * **Overall Performance:** See total buy-ins, final amounts, and unique players.
  * **Player Leaderboards:** Quickly identify top earners and track individual player stats.
  * **Visual Charts:**
    * "All Time Player Net Profit": See everyone's winnings grow (or shrink!) over time.
    * Individual Player Graphs: Deep dive into a player's game-by-game performance.
    * "Player Performance": Compare buy-ins vs. final amounts for all players in a game.
* **Interactive UI:**
  * Real-time player status updates and avatar loading as you type player names
  * Dynamic drink rating forms with color-coded feedback
  * Responsive card-based layout that adapts to content
* **Player Profiles:**
  * Upload custom avatars for each player
  * Avatars update instantly when selecting existing players
  * Search and view detailed game history for any player
* **Easy Data Management:**
  * Create new games with an intuitive form
  * Edit existing game details, including player scores, names, and drink information
  * Add and manage multiple drink images per game with consistent naming and cleanup
  * Delete games if needed
* **Data Export:**
  * Get a CSV summary of all your poker data
* **Local & Private:** All data is stored on your computer using your browser's File System Access API. No cloud accounts needed.

## Quick Start

1. Download the project files
2. Open `World Series of Knuckles.html` in a modern web browser (like Chrome or Edge)
3. The first time you run it, the app will ask you to choose a folder on your computer to store all its data
4. Start tracking your games!

## Technology

Built with HTML, CSS, and Vanilla JavaScript. Uses Chart.js for graphs and the File System Access API for local data storage.

## Technical Details

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Data Storage:** File System Access API (browser local file system), IndexedDB (for storing the root directory handle)
* **Charting:** Chart.js library for dynamic graphs and visualizations
* **Player Name Handling:** Player names are stored with their original casing but are treated case-insensitively for lookups and aggregation. A canonical name map is built to maintain consistent display casing
* **Game Identification:** Games are identified internally by a unique UUID. Data is primarily sorted and displayed by date
* **Drink Management:** Drinks are stored with sequential filenames for easy management, and unused image files are automatically cleaned up when drinks are deleted or reordered

## Contributing

This is a personal project, but feel free to fork, modify, and adapt for your own poker group!
If you find bugs or have suggestions, you can open an issue (if on a platform like GitHub).
