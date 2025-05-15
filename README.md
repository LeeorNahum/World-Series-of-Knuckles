# World Series of Knuckles - Poker Tracker

The World Series of Knuckles is a vibrant and engaging web app built to manage and visualize ongoing poker league stats with friends. It tracks every session’s buy-ins, cash-outs, and net winnings per player, while generating dynamic charts to compare long-term progression and highlight top performers. Each week also features a “Mystery Drink” that players rate, turning every game into a blend of competition and taste-testing. With features like searchable player profiles, editable avatars, detailed session histories, and exportable CSV summaries, it offers a fun and polished hub for game nights that go beyond the cards.

Track your poker league's stats, relive game nights, and see who's truly the "King of Knuckles"! This web app helps you manage poker sessions, player performance, and even the week's mystery drink, all stored locally on your computer.

![image](https://github.com/user-attachments/assets/16e90775-2123-4b8e-9eda-89f945684fea)

## Key Features

* **Detailed Session Logging:** Record game dates, player buy-ins, cash-outs, and net results.
* **Mystery Drink Tracking:** Note the week's special beverage and how everyone rated it!
* **Dynamic Dashboard:**
  * View "All Time" stats or stats for a specific poker session.
  * **Overall Performance:** See total buy-ins, cash-outs, and unique players.
  * **Player Leaderboards:** Quickly identify top earners and track individual player stats.
  * **Visual Charts:**
    * "All Time Player Net Progression": See everyone's winnings grow (or shrink!) over time.
    * Individual Player Graphs: Deep dive into a player's game-by-game performance.
    * "Weekly Performance": Compare buy-ins vs. cash-outs for all players in a session.
* **Player Profiles:**
  * Upload custom avatars for each player.
  * Search and view detailed game history for any player.
* **Easy Data Management:**
  * Create new game sessions with an intuitive form.
  * Edit existing session details, including player scores, names, and drink info.
  * Delete sessions if needed.
* **Data Export:**
  * Get a CSV summary of all your poker data.
* **Local & Private:** All data is stored on your computer using your browser's File System Access API. No cloud accounts needed.

## Quick Start

1. Download the project files.
2. Open `World Series of Knuckles.html` in a modern web browser (like Chrome or Edge).
3. The first time you run it, the app will ask you to choose a folder on your computer to store all its data.
4. Start tracking your games!

## Technology

Built with HTML, CSS, and Vanilla JavaScript. Uses Chart.js for graphs and the File System Access API for local data storage.

## File Structure

* `World Series of Knuckles.html`: The main HTML file for the application.
* `styles/main.css`: Contains all CSS styling for the application.
* `scripts/app.js`: Contains all JavaScript logic for application functionality, data handling, and UI rendering.
* `knuckles.png`: The application icon/logo.
* `Data/`: (Initially contains example data, then managed by the user)
  * `<session_uuid>/session_data.json`: JSON file storing data for a specific game session. Folder name is a unique UUID.
  * `Players/`: Stores player avatar images (e.g., `alex.png`).
* `README.md`: This file.
* `.gitignore`: Specifies intentionally untracked files by Git (like the `Data/` folder after initial setup).

## Technical Details

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Data Storage:** File System Access API (browser local file system), IndexedDB (for storing the root directory handle).
* **Charting:** Chart.js library for dynamic graphs and visualizations.
* **Player Name Handling:** Player names are stored with their original casing but are treated case-insensitively for lookups and aggregation. A canonical name map is built to maintain consistent display casing.
* **Session Identification:** Sessions are identified internally by a unique UUID. Data is primarily sorted and displayed by date.

## Contributing

This is a personal project, but feel free to fork, modify, and adapt for your own poker group!
If you find bugs or have suggestions, you can open an issue (if on a platform like GitHub).
