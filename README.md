# Code Review Assistant

A VSCode extension that provides AI-powered code review functionality to help catch issues before committing changes.

## Features

- **Git Integration**: Seamlessly integrates with VSCode's Git tab
- **Staged Changes Analysis**: Analyzes only staged changes for focused review
- **Comprehensive Checks**:
  - Typo detection
  - Code style issues
  - Potential bugs
  - Security concerns
  - Performance issues
  - Positive feedback for good practices
- **Interactive Report**: Beautiful webview panel with detailed analysis
- **Export Functionality**: Export reports as JSON for further processing

## How to Use

1. Stage your changes in the Git tab
2. Click the "Review" button above the "Commit" button
3. Review the analysis in the new panel
4. Export the report if needed
5. Make any necessary fixes before committing

## Development

### Prerequisites

- Node.js
- VSCode
- Git

### Setup

1. Clone this repository
2. Run `npm install`
3. Press F5 to run the extension in a new Extension Development Host window

### Building

```bash
npm run compile
```

### Testing

1. Open the extension in VSCode
2. Press F5 to launch Extension Development Host
3. Stage some changes in a Git repository
4. Click the "Review" button in the Git tab

## Architecture

- **extension.ts**: Main extension entry point
- **gitAnalyzer.ts**: Handles Git integration and change detection
- **codeAnalyzer.ts**: Performs code analysis and issue detection
- **codeReviewPanel.ts**: Manages the webview panel and UI

## Future Enhancements

- AI-powered analysis using external APIs
- Customizable analysis rules
- Integration with CI/CD pipelines
- Team collaboration features
- Advanced diff visualization
