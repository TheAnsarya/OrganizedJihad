# OrganizedJihad - Hero Wars Tracker

A comprehensive TamperMonkey userscript for tracking and managing your Hero Wars gameplay with an interactive browser overlay.

## Features

- **Game Data Tracking**: Automatically tracks heroes, resources, battles, and game events
- **Goals Management**: Set and track short-term and long-term goals with progress tracking
- **Calendar & Events**: Track game events, daily tasks, and custom reminders
- **Smart Suggestions**: Get intelligent recommendations based on your gameplay patterns
- **Detailed Reports**: View comprehensive statistics and progress reports
- **Data Export/Import**: Backup and restore your tracking data
- **Customizable UI**: Draggable overlay with multiple views and themes

## Installation

### Prerequisites

1. Install [TamperMonkey](https://www.tampermonkey.net/) browser extension:
   - [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   - [Safari](https://apps.apple.com/us/app/tampermonkey/id1482490089)

### Install the Userscript

1. Build the project (see Development section)
2. Open `dist/organized-jihad.user.js` in your browser
3. TamperMonkey will prompt you to install the script
4. Click "Install" to confirm

Alternatively, you can:
1. Open TamperMonkey dashboard
2. Click "Create a new script"
3. Copy and paste the contents of `dist/organized-jihad.user.js`
4. Save the script

## Usage

### Accessing the Overlay

- **Automatic**: The overlay appears automatically when you visit Hero Wars (if enabled in settings)
- **Keyboard Shortcut**: Press `Ctrl+Shift+H` to toggle the overlay visibility
- **Position**: Drag the header to reposition the overlay anywhere on screen

### Navigation

The overlay includes several tabs:

1. **Dashboard**: Quick overview of your stats, suggestions, and upcoming events
2. **Goals**: Manage short-term and long-term goals
3. **Calendar**: View and manage events and reminders
4. **Heroes**: Track your hero roster and stats
5. **Resources**: Monitor your in-game resources
6. **Reports**: View detailed statistics and analytics
7. **Settings**: Configure the tracker and manage your data

### Managing Goals

1. Click the **Goals** tab
2. Click **+ Add Goal** to create a new goal
3. Choose between "Short Term" or "Long Term" tabs
4. Track progress automatically or manually update

### Calendar Features

1. Click the **Calendar** tab
2. Add custom events with **+ Add Event**
3. View upcoming events for the next 7-30 days
4. Set reminders for important events

### Viewing Suggestions

The tracker analyzes your gameplay and provides suggestions:
- Goal priorities based on progress
- Resource management tips
- Hero development recommendations
- Battle activity reminders

Dismiss suggestions you've addressed by clicking "Dismiss"

### Data Management

In the **Settings** tab:

- **Export Data**: Download a JSON backup of all your tracking data
- **Import Data**: Restore data from a previous backup
- **Clear All Data**: Reset the tracker (use with caution!)

## Development

### Setup

```powershell
# Clone the repository
git clone https://github.com/yourusername/OrganizedJihad.git
cd OrganizedJihad

# Install dependencies
npm install
```

### Build

```powershell
# Development build (with watch mode)
npm run dev

# Production build
npm run build
```

The compiled userscript will be in `dist/organized-jihad.user.js`

### Project Structure

```
OrganizedJihad/
├── src/
│   ├── index.js                    # Main entry point
│   ├── modules/
│   │   ├── gameTracker.js          # Game data tracking
│   │   ├── goalsManager.js         # Goals management
│   │   ├── calendarManager.js      # Calendar & events
│   │   ├── suggestionsEngine.js    # Smart suggestions
│   │   ├── storageManager.js       # Data persistence
│   │   └── uiManager.js            # UI overlay
│   └── styles/
│       └── main.css                # Styles
├── dist/                           # Compiled userscript
├── package.json
├── webpack.config.js
└── README.md
```

### Customization

#### Adding New Tracking Features

Edit `src/modules/gameTracker.js` to add new data capture methods:

```javascript
captureNewGameData(element) {
	// Your custom tracking logic here
}
```

#### Customizing the UI

Edit `src/styles/main.css` to modify colors, layout, and styling.

#### Adding New Modules

Create a new module in `src/modules/` and import it in `src/index.js`.

## Troubleshooting

### Script Not Loading

- Ensure TamperMonkey is enabled
- Check that the script is enabled in TamperMonkey dashboard
- Verify you're on the correct domain (hero-wars.com)

### Data Not Tracking

- The game's DOM structure may have changed
- Open browser console (F12) to check for errors
- The script looks for specific CSS classes - these may need updating

### Overlay Not Appearing

- Press `Ctrl+Shift+H` to toggle visibility
- Check Settings to ensure "Show overlay on page load" is enabled
- Clear browser cache and reload

### Performance Issues

- Reduce the frequency of data sync in settings
- Clear old data periodically
- Disable features you don't use

## Privacy & Data

- All data is stored **locally** in your browser
- No data is sent to external servers
- Data persists using TamperMonkey's GM_setValue API or localStorage
- Export your data regularly to prevent loss

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Known Issues

- Game data tracking requires manual calibration for specific DOM selectors
- Some game events may not be auto-detected
- Calendar reminders don't persist across browser sessions (planned feature)

## Future Enhancements

- [ ] Auto-sync with game API (if available)
- [ ] Team composition optimizer
- [ ] Resource farming calculator
- [ ] Guild management features
- [ ] Dark/Light theme toggle
- [ ] Mobile-responsive overlay
- [ ] Export reports as PDF

## License

MIT License - see LICENSE file for details

## Disclaimer

This is a fan-made tool and is not affiliated with or endorsed by Hero Wars or its developers. Use at your own discretion.

## Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/yourusername/OrganizedJihad/issues)
- Check existing issues for solutions

## Changelog

### Version 1.0.0 (Initial Release)
- Core game tracking functionality
- Goals management system
- Calendar and events
- Suggestions engine
- Interactive UI overlay
- Data export/import
- Keyboard shortcuts

---

**Happy Gaming! May your heroes always be organized! 🎮⚔️**
