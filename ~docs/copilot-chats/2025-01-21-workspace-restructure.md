# Workspace Restructure - January 21, 2025

## Context

Reorganized the repository structure to support multiple related projects in a single workspace.

## Changes Made

### Directory Structure

**Before:**
```
OrganizedJihad/
├── src/
├── dist/
├── package.json
├── webpack.config.cjs
├── ~docs/
└── ~reference-code/
```

**After:**
```
OrganizedJihad/
├── userscript/              # Main TamperMonkey project
│   ├── src/
│   ├── dist/
│   ├── package.json
│   └── webpack.config.cjs
├── ~docs/                   # Shared documentation
├── ~reference-code/         # Reference implementations
└── .github/                 # Shared GitHub config
```

### Files Moved

Moved into `userscript/` subfolder:
- `src/` - Source code modules
- `dist/` - Compiled output
- `node_modules/` - Dependencies
- `package.json` - Project configuration
- `webpack.config.cjs` - Build configuration
- `yarn.lock` - Dependency lock file
- `.editorconfig` - Editor configuration
- `.eslintrc.json` - ESLint rules
- `.prettierignore` - Prettier ignore patterns
- `.prettierrc.json` - Prettier configuration
- `README.md` - Project-specific readme
- `LICENSE` - License file

### Files Kept at Root

- `.github/` - Shared GitHub configuration (copilot-instructions.md, workflows)
- `.gitignore` - Repository-wide ignore rules
- `~docs/` - Shared documentation and research
- `~reference-code/` - Reference code for analysis
- `README.md` - New workspace-level readme

## Rationale

### Multi-Project Support

The workspace is now structured to support multiple related projects:

1. **userscript/** - Current TamperMonkey userscript
2. **chrome-extension/** - Future Chrome extension (planned)
3. **desktop-app/** - Future Electron app (planned)
4. **web-dashboard/** - Future web interface (planned)
5. **data-analyzer/** - Future Python analysis tools (planned)

### Shared Resources

Common resources remain at the root:
- Documentation (`~docs/`)
- Reference code (`~reference-code/`)
- GitHub configuration (`.github/`)
- Git settings (`.gitignore`)

### Benefits

1. **Isolation** - Each project has its own dependencies and build system
2. **Clarity** - Clear separation of concerns
3. **Scalability** - Easy to add new related projects
4. **Consistency** - Shared formatting rules and documentation
5. **Collaboration** - Multiple developers can work on different projects

## Build Instructions

### TamperMonkey Userscript

```bash
cd userscript
yarn install
yarn build       # Production build
yarn dev         # Development with watch mode
yarn lint        # Run ESLint
yarn format      # Format with Prettier
```

Output: `userscript/dist/organized-jihad.user.js`

### Future Projects

When adding new projects, follow this pattern:

```bash
mkdir project-name
cd project-name
# Initialize project
# Add to workspace README.md
```

## Git Status

All changes have been tracked but not yet committed. The workspace restructure requires:

```bash
# Stage all changes
git add -A

# Commit the restructure
git commit -m "refactor: Restructure workspace to support multiple projects

- Move userscript into userscript/ subfolder
- Keep ~docs and ~reference-code at root for sharing
- Add workspace-level README.md
- Update documentation with new structure"

# Push to GitHub
git push origin main
```

## Next Steps

1. ✅ Restructure completed
2. ⏳ Test build system in new location
3. ⏳ Update GitHub Actions workflows if needed
4. ⏳ Commit and push changes
5. ⏳ Add additional projects as needed

## Notes

- The `.git` directory remains at the root (single repository)
- Each project can have its own `.editorconfig`, `.prettierrc.json`, etc.
- Shared settings in `.github/copilot-instructions.md` apply workspace-wide
- VS Code workspace settings can be added to `.vscode/` at root if needed
