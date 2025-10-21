<!-- Use this file to provide workspace-specific custom instructions to Copilot. -->

## Project: OrganizedJihad - Hero Wars Tracker
A TamperMonkey userscript for tracking and managing Hero Wars gameplay with an interactive browser overlay.

## Code Style & Formatting Rules

**CRITICAL**: Always follow these formatting preferences:
- **Line Endings**: CRLF (`\r\n`) on all files
- **Indentation**: TABS (not spaces) with tab width of 4
- **Charset**: UTF-8
- **Modern Standards**: Use ES2024+ features, async/await, optional chaining, nullish coalescing
- **Comments**: Comprehensive comments including JSDoc, inline explanations, and links to relevant documentation
- **Package Manager**: Use `yarn` instead of `npm`
- **Quote Style**: Single quotes for strings
- **Semicolons**: Always use semicolons

## Project Setup Status

- [x] **Verify copilot-instructions.md** - Configuration file created
- [x] **Clarify Project Requirements** - TamperMonkey userscript for Hero Wars game tracking
- [x] **Scaffold the Project** - Project structure created with modern JavaScript modules
- [x] **Customize the Project** - All core modules implemented (tracking, UI, goals, calendar, suggestions)
- [x] **Install Dependencies** - Yarn packages installed successfully
- [x] **Compile the Project** - Webpack build configuration complete
- [x] **Documentation** - Comprehensive README.md with installation and usage instructions
- [x] **Git Repository** - Initialized and committed

## Project Structure

```
OrganizedJihad/
├── src/
│   ├── index.js                    # Main entry point with TamperMonkey metadata
│   ├── modules/
│   │   ├── gameTracker.js          # Game data tracking via DOM observation
│   │   ├── goalsManager.js         # Short/long-term goals management
│   │   ├── calendarManager.js      # Events and reminders system
│   │   ├── suggestionsEngine.js    # AI-driven gameplay suggestions
│   │   ├── storageManager.js       # Data persistence (GM API/localStorage)
│   │   └── uiManager.js            # Interactive browser overlay UI
│   └── styles/
│       └── main.css                # Complete UI styling
├── dist/                           # Compiled userscript output
├── .editorconfig                   # TABS, CRLF, UTF-8 configuration
├── .eslintrc.json                  # ESLint with tab support
├── .prettierrc.json                # Prettier with tabs and CRLF
├── webpack.config.js               # Build configuration
└── package.json                    # Project dependencies

## Build Commands

- `yarn build` - Production build
- `yarn dev` - Development build with watch mode
- `yarn lint` - Run ESLint
- `yarn format` - Format all files with Prettier

## Next Steps

1. **Build the userscript**: Run `yarn build` to create `dist/organized-jihad.user.js`
2. **Install in TamperMonkey**: Open the dist file in browser to install
3. **Test on Hero Wars**: Visit https://www.hero-wars.com to see the overlay
4. **Create GitHub Repository**: Push to GitHub for version control
5. **Customize DOM Selectors**: Update `gameTracker.js` with actual Hero Wars element selectors

## Development Guidelines

- All code must include comprehensive JSDoc comments
- Use modern ES2024+ syntax (optional chaining, nullish coalescing, private fields)
- Include links to documentation in comments where applicable
- Follow the established module pattern for new features
- Test changes in TamperMonkey before committing
- Keep the UI responsive and performant
