import * as vscode from "vscode";
import * as path from "path";
import { CodeChange } from "./gitAnalyzer";
import { CodeAnalyzer } from "./codeAnalyzer";

export class CodeReviewPanel {
  public static currentPanel: CodeReviewPanel | undefined;
  public static readonly viewType = "codeReviewPanel";
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, changes: CodeChange[]) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (CodeReviewPanel.currentPanel) {
      CodeReviewPanel.currentPanel._panel.reveal(column);
      CodeReviewPanel.currentPanel._update(changes);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      CodeReviewPanel.viewType,
      "Code Review",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    CodeReviewPanel.currentPanel = new CodeReviewPanel(
      panel,
      extensionUri,
      changes
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    changes: CodeChange[]
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update(changes);

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "exportReport":
            this._exportReport(message.report);
            return;
          case "refreshAnalysis":
            // Trigger a refresh by calling the parent method if available
            vscode.commands.executeCommand('codeReview.startReview');
            return;
          case "openSettings":
            // Open VS Code settings
            vscode.commands.executeCommand('workbench.action.openSettings', 'languageModel');
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public async _update(changes: CodeChange[]) {
    const webview = this._panel.webview;

    try {
      // Analyze the code changes
      const analyzer = new CodeAnalyzer();
      const analysis = await analyzer.analyzeChanges(changes);

      this._panel.webview.html = this._getHtmlForWebview(webview, analysis);
    } catch (error) {
      // Show error message if analysis fails
      this._panel.webview.html = this._getErrorHtml(webview, error);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, analysis: any) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Review</title>
    <style>
        :root {
            --shadow-light: 0 2px 8px rgba(0, 0, 0, 0.1);
            --shadow-medium: 0 4px 16px rgba(0, 0, 0, 0.15);
            --shadow-heavy: 0 8px 32px rgba(0, 0, 0, 0.2);
            --border-radius: 8px;
            --border-radius-large: 12px;
            --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            --spacing-xs: 4px;
            --spacing-sm: 8px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
            --spacing-xl: 32px;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.6;
            color: var(--vscode-foreground);
            background: linear-gradient(135deg, 
                var(--vscode-editor-background) 0%, 
                var(--vscode-sideBar-background) 100%);
            margin: 0;
            padding: var(--spacing-lg);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .header {
            text-align: center;
            padding: var(--spacing-xl) 0;
            margin-bottom: var(--spacing-lg);
            position: relative;
        }

        .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 100px;
            height: 3px;
            background: linear-gradient(90deg, 
                var(--vscode-charts-blue) 0%, 
                var(--vscode-charts-purple) 100%);
            border-radius: 2px;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin: 0 0 var(--spacing-sm) 0;
            background: linear-gradient(135deg, 
                var(--vscode-charts-blue) 0%, 
                var(--vscode-charts-purple) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header-subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 1.1rem;
            margin: 0;
        }

        .summary {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius-large);
            padding: var(--spacing-lg);
            margin-bottom: var(--spacing-xl);
            box-shadow: var(--shadow-light);
            position: relative;
            overflow: hidden;
            transition: var(--transition);
        }

        .summary::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, 
                var(--vscode-charts-green) 0%, 
                var(--vscode-charts-blue) 50%, 
                var(--vscode-charts-purple) 100%);
        }

        .summary h3 {
            margin: 0 0 var(--spacing-md) 0;
            font-size: 1.3rem;
            font-weight: 600;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: var(--spacing-md);
            margin-top: var(--spacing-lg);
            padding-top: var(--spacing-lg);
            border-top: 1px solid var(--vscode-panel-border);
        }

        .stat-item {
            text-align: center;
            padding: var(--spacing-md);
            background: var(--vscode-panel-background);
            border-radius: var(--border-radius);
        }

        .stat-value {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: var(--spacing-xs);
        }

        .stat-label {
            font-size: 0.85rem;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .files-container {
            display: grid;
            gap: var(--spacing-lg);
        }

        .file-section {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius-large);
            overflow: hidden;
            box-shadow: var(--shadow-light);
            transition: var(--transition);
            animation: slideInLeft 0.6s ease-out;
        }



        @keyframes slideInLeft {
            from {
                opacity: 0;
                transform: translateX(-30px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .file-header {
            background: linear-gradient(135deg, 
                var(--vscode-panel-background) 0%, 
                var(--vscode-sideBar-background) 100%);
            padding: var(--spacing-md) var(--spacing-lg);
            font-weight: 600;
            font-size: 1.1rem;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            cursor: pointer;
            transition: var(--transition);
        }

        .file-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .file-header .toggle-icon {
            margin-left: auto;
            transition: var(--transition);
            font-size: 1.2rem;
        }

        .file-section.collapsed .toggle-icon {
            transform: rotate(-90deg);
        }

        .file-issues {
            transition: var(--transition);
            overflow: hidden;
        }

        .file-section.collapsed .file-issues {
            max-height: 0;
        }

        .issue {
            padding: var(--spacing-lg);
            border-bottom: 1px solid var(--vscode-panel-border);
            transition: var(--transition);
            position: relative;
        }

        .issue:last-child {
            border-bottom: none;
        }

        .issue:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .issue-header {
            display: flex;
            align-items: flex-start;
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-md);
        }

        .issue-type {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-xs);
            padding: var(--spacing-xs) var(--spacing-md);
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            flex-shrink: 0;
            transition: var(--transition);
        }



        .issue-type.error {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }

        .issue-type.warning {
            background: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
        }

        .issue-type.info {
            background: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
        }

        .issue-type.positive {
            background: rgba(0, 184, 148, 0.1);
            color: var(--vscode-charts-green);
            border: 1px solid var(--vscode-charts-green);
        }

        .issue-content {
            flex: 1;
        }

        .issue-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0 0 var(--spacing-sm) 0;
        }

        .issue-description {
            margin: 0 0 var(--spacing-md) 0;
            line-height: 1.7;
        }

        .code-block {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius);
            padding: var(--spacing-md);
            margin: var(--spacing-md) 0;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            overflow-x: auto;
            position: relative;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .code-block::before {
            content: 'CODE';
            position: absolute;
            top: var(--spacing-xs);
            right: var(--spacing-sm);
            font-size: 0.6rem;
            color: var(--vscode-descriptionForeground);
            opacity: 0.7;
        }

        .suggestion {
            background: var(--vscode-panel-background);
            border-left: 4px solid var(--vscode-charts-green);
            border-radius: 0 var(--border-radius) var(--border-radius) 0;
            padding: var(--spacing-md);
            margin-top: var(--spacing-md);
            position: relative;
        }

        .suggestion::before {
            content: '💡';
            position: absolute;
            top: var(--spacing-sm);
            left: calc(-2px - var(--spacing-sm));
            background: var(--vscode-panel-background);
            padding: var(--spacing-xs);
            border-radius: 50%;
        }

        .suggestion strong {
            color: var(--vscode-charts-green);
        }

        .actions-bar {
            display: flex;
            gap: var(--spacing-md);
            justify-content: center;
            margin-top: var(--spacing-xl);
            padding-top: var(--spacing-lg);
            border-top: 1px solid var(--vscode-panel-border);
        }

        .action-button {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-sm);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            padding: var(--spacing-md) var(--spacing-lg);
            border-radius: var(--border-radius);
            cursor: pointer;
            font-weight: 500;
            text-decoration: none;
            transition: var(--transition);
            font-size: 0.9rem;
        }

        .action-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .action-button:active {
            background: var(--vscode-button-background);
            transform: translateY(1px);
        }

        .action-button.primary {
            background: var(--vscode-button-background);
            border-color: var(--vscode-button-background);
        }

        .action-button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-color: var(--vscode-button-border);
        }

        .action-button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Responsive design */
        @media (max-width: 768px) {
            body {
                padding: var(--spacing-md);
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .actions-bar {
                flex-direction: column;
                align-items: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Code Review</h1>
            <p class="header-subtitle">AI-powered analysis of your staged changes</p>
        </div>

        <div class="summary">
            <h3>Review Summary</h3>
            <p>${analysis.summary}</p>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value" style="color: var(--vscode-charts-blue);">${analysis.files.length}</div>
                    <div class="stat-label">Files</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: var(--vscode-charts-red);">${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === 'error').length, 0)}</div>
                    <div class="stat-label">Errors</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: var(--vscode-charts-orange);">${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === 'warning').length, 0)}</div>
                    <div class="stat-label">Warnings</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: var(--vscode-charts-green);">${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === 'positive').length, 0)}</div>
                    <div class="stat-label">Improvements</div>
                </div>
            </div>
        </div>
        
        <div class="files-container">
            ${analysis.files
        .map(
          (file: any, index: number) => `
                <div class="file-section" data-file-index="${index}">
                    <div class="file-header" onclick="toggleFileSection(${index})">
                        ${file.fileName}
                        <span class="toggle-icon">▼</span>
                    </div>
                    <div class="file-issues">
                        ${file.issues
              .map(
                (issue: any, issueIndex: number) => `
                            <div class="issue ${issue.type}" data-issue-id="${index}-${issueIndex}">
                                <div class="issue-header">
                                    <span class="issue-type ${issue.type}">${issue.type.toUpperCase()}</span>
                                    <div class="issue-content">
                                        <h4 class="issue-title">${issue.title}</h4>
                                        <p class="issue-description">${issue.description}</p>
                                        ${issue.codeSnippet
                    ? `<div class="code-block">${issue.codeSnippet}</div>`
                    : ""
                  }
                                        ${issue.suggestion
                    ? `<div class="suggestion"><strong>Suggestion:</strong> ${issue.suggestion}</div>`
                    : ""
                  }
                                    </div>
                                </div>
                            </div>
                        `
              )
              .join("")}
                    </div>
                </div>
            `
        )
        .join("")}
        </div>

        <div class="actions-bar">
            <button class="action-button primary" onclick="exportReport()">
                Export Report
            </button>
            <button class="action-button secondary" onclick="refreshAnalysis()">
                Refresh Analysis
            </button>
            <button class="action-button secondary" onclick="showFilterOptions()">
                Filter Issues
            </button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const analysisData = ${JSON.stringify(analysis)};
        let currentFilter = 'all';
        
        // Initialize interactive features
        document.addEventListener('DOMContentLoaded', function() {
            // Add staggered animation to file sections
            const fileSections = document.querySelectorAll('.file-section');
            fileSections.forEach((section, index) => {
                section.style.animationDelay = (index * 0.1) + 's';
            });

            // Add keyboard navigation
            document.addEventListener('keydown', handleKeyPress);
            
            // Save current state
            vscode.setState({ analysisData, currentFilter });
        });

        function toggleFileSection(index) {
            const fileSection = document.querySelector(\`[data-file-index="\${index}"]\`);
            const isCollapsed = fileSection.classList.contains('collapsed');
            
            fileSection.classList.toggle('collapsed');
            
            // Animate the toggle
            const fileIssues = fileSection.querySelector('.file-issues');
            if (isCollapsed) {
                fileIssues.style.maxHeight = fileIssues.scrollHeight + 'px';
                setTimeout(() => {
                    fileIssues.style.maxHeight = 'none';
                }, 300);
            } else {
                fileIssues.style.maxHeight = fileIssues.scrollHeight + 'px';
                setTimeout(() => {
                    fileIssues.style.maxHeight = '0';
                }, 10);
            }
        }

        function exportReport() {
            const button = document.querySelector('.export-button');
            const originalContent = button.innerHTML;
            
            // Show loading state
            button.innerHTML = '<span class="loading-spinner"></span> Exporting...';
            button.disabled = true;
            
            vscode.postMessage({
                command: 'exportReport',
                report: analysisData
            });
            
            // Reset button after delay
            setTimeout(() => {
                button.innerHTML = originalContent;
                button.disabled = false;
            }, 2000);
        }

        function refreshAnalysis() {
            const button = event.target;
            const originalContent = button.innerHTML;
            
            button.innerHTML = '<span class="loading-spinner"></span> Refreshing...';
            button.disabled = true;
            
            // Add refresh animation to container
            const container = document.querySelector('.container');
            container.style.opacity = '0.7';
            container.style.transform = 'scale(0.98)';
            
            setTimeout(() => {
                container.style.opacity = '1';
                container.style.transform = 'scale(1)';
                button.innerHTML = originalContent;
                button.disabled = false;
                
                // Trigger refresh command
                vscode.postMessage({
                    command: 'refreshAnalysis'
                });
            }, 1500);
        }

        function showFilterOptions() {
            const filterTypes = ['all', 'error', 'warning', 'info', 'positive'];
            const currentIndex = filterTypes.indexOf(currentFilter);
            const nextIndex = (currentIndex + 1) % filterTypes.length;
            const newFilter = filterTypes[nextIndex];
            
            filterIssues(newFilter);
        }

        function filterIssues(filterType) {
            currentFilter = filterType;
            const issues = document.querySelectorAll('.issue');
            const fileSections = document.querySelectorAll('.file-section');
            
            // Update filter button
            const filterButton = document.querySelector('[onclick="showFilterOptions()"]');
            const filterLabels = { all: 'All Issues', error: 'Errors Only', warning: 'Warnings Only', info: 'Info Only', positive: 'Improvements Only' };
            filterButton.innerHTML = filterLabels[filterType];
            
            // Apply filter with animation
            issues.forEach((issue, index) => {
                const shouldShow = filterType === 'all' || issue.classList.contains(filterType);
                
                if (shouldShow) {
                    issue.style.display = 'block';
                    issue.style.animation = \`fadeInUp 0.3s ease-out \${index * 0.05}s both\`;
                } else {
                    issue.style.animation = 'fadeOut 0.2s ease-out both';
                    setTimeout(() => {
                        issue.style.display = 'none';
                    }, 200);
                }
            });
            
            // Hide empty file sections
            fileSections.forEach(section => {
                const visibleIssues = section.querySelectorAll('.issue:not([style*="display: none"])');
                const fileIssuesContainer = section.querySelector('.file-issues');
                
                if (visibleIssues.length === 0) {
                    section.style.opacity = '0.5';
                    section.style.transform = 'scale(0.95)';
                } else {
                    section.style.opacity = '1';
                    section.style.transform = 'scale(1)';
                }
            });
            
            // Save state
            vscode.setState({ analysisData, currentFilter });
        }

        function handleKeyPress(event) {
            // Keyboard shortcuts
            if (event.ctrlKey || event.metaKey) {
                switch(event.key) {
                    case 'e':
                        event.preventDefault();
                        exportReport();
                        break;
                    case 'r':
                        event.preventDefault();
                        refreshAnalysis();
                        break;
                    case 'f':
                        event.preventDefault();
                        showFilterOptions();
                        break;
                }
            }
            
            // Arrow key navigation
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                const issues = Array.from(document.querySelectorAll('.issue:not([style*="display: none"])'));
                const currentFocus = document.activeElement;
                const currentIndex = issues.findIndex(issue => issue.contains(currentFocus));
                
                let newIndex;
                if (event.key === 'ArrowUp') {
                    newIndex = currentIndex > 0 ? currentIndex - 1 : issues.length - 1;
                } else {
                    newIndex = currentIndex < issues.length - 1 ? currentIndex + 1 : 0;
                }
                
                if (issues[newIndex]) {
                    issues[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    issues[newIndex].style.outline = '2px solid var(--vscode-focusBorder)';
                    
                    // Remove outline from other issues
                    issues.forEach((issue, index) => {
                        if (index !== newIndex) {
                            issue.style.outline = 'none';
                        }
                    });
                }
                
                event.preventDefault();
            }
        }

        // Add CSS animations for fade effects
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-10px); }
            }
        \`;
        document.head.appendChild(style);

        // Restore previous state if available
        const previousState = vscode.getState();
        if (previousState && previousState.currentFilter && previousState.currentFilter !== 'all') {
            setTimeout(() => {
                filterIssues(previousState.currentFilter);
            }, 500);
        }
    </script>
</body>
</html>`;
  }

  private _getErrorHtml(webview: vscode.Webview, error: any) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Review - Error</title>
    <style>
        :root {
            --shadow-light: 0 2px 8px rgba(0, 0, 0, 0.1);
            --shadow-medium: 0 4px 16px rgba(0, 0, 0, 0.15);
            --border-radius: 8px;
            --border-radius-large: 12px;
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            --spacing-sm: 8px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
            --spacing-xl: 32px;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.6;
            color: var(--vscode-foreground);
            background: linear-gradient(135deg, 
                var(--vscode-editor-background) 0%, 
                var(--vscode-sideBar-background) 100%);
            margin: 0;
            padding: var(--spacing-lg);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .error-container {
            max-width: 600px;
            width: 100%;
            background: var(--vscode-editor-background);
            border-radius: var(--border-radius-large);
            box-shadow: var(--shadow-medium);
            padding: var(--spacing-xl);
            text-align: center;
            position: relative;
            overflow: hidden;
            animation: slideInUp 0.6s ease-out;
        }

        .error-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #ff6b6b, #ee5a52);
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .error-icon {
            font-size: 64px;
            margin-bottom: var(--spacing-lg);
        }

        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
                transform: translateY(0);
            }
            40% {
                transform: translateY(-10px);
            }
            60% {
                transform: translateY(-5px);
            }
        }

        .error-title {
            font-size: 2rem;
            font-weight: 700;
            color: var(--vscode-inputValidation-errorForeground);
            margin-bottom: var(--spacing-md);
            background: linear-gradient(135deg, #ff6b6b, #ee5a52);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .error-subtitle {
            color: var(--vscode-descriptionForeground);
            margin-bottom: var(--spacing-xl);
            font-size: 1.1rem;
        }

        .error-message {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: var(--border-radius);
            padding: var(--spacing-lg);
            margin-bottom: var(--spacing-xl);
            text-align: left;
            font-family: var(--vscode-editor-font-family);
            position: relative;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }



        .suggestions {
            text-align: left;
            background: var(--vscode-panel-background);
            border-radius: var(--border-radius);
            padding: var(--spacing-lg);
            margin-bottom: var(--spacing-lg);
        }

        .suggestions h4 {
            margin: 0 0 var(--spacing-md) 0;
            color: var(--vscode-charts-blue);
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
        }



        .suggestion-item {
            display: flex;
            align-items: flex-start;
            gap: var(--spacing-sm);
            margin-bottom: var(--spacing-md);
            padding: var(--spacing-sm);
            background: var(--vscode-editor-background);
            border-radius: var(--border-radius);
            transition: var(--transition);
        }

        .suggestion-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .suggestion-item::before {
            content: '→';
            color: var(--vscode-charts-green);
            font-weight: bold;
            flex-shrink: 0;
        }

        .action-buttons {
            display: flex;
            gap: var(--spacing-md);
            justify-content: center;
            flex-wrap: wrap;
        }

        .action-button {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-sm);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            padding: var(--spacing-md) var(--spacing-lg);
            border-radius: var(--border-radius);
            cursor: pointer;
            font-weight: 500;
            text-decoration: none;
            transition: var(--transition);
            font-size: 0.9rem;
        }

        .action-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        @media (max-width: 600px) {
            .error-container {
                margin: var(--spacing-md);
                padding: var(--spacing-lg);
            }
            
            .error-title {
                font-size: 1.5rem;
            }
            
            .action-buttons {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1 class="error-title">Analysis Failed</h1>
        <p class="error-subtitle">We encountered an issue while analyzing your code changes</p>
        
        <div class="error-message">
            ${error.message || "An unknown error occurred during code analysis."}
        </div>
        
        <div class="suggestions">
            <h4>Troubleshooting Steps</h4>
            <div class="suggestion-item">
                Ensure you have a language model configured in VS Code settings
            </div>
            <div class="suggestion-item">
                Check your GitHub Copilot or AI assistant setup
            </div>
            <div class="suggestion-item">
                Verify you have staged changes in your Git repository
            </div>
            <div class="suggestion-item">
                Try refreshing VS Code and running the analysis again
            </div>
        </div>
        
        <div class="action-buttons">
            <button class="action-button" onclick="retryAnalysis()">
                Retry Analysis
            </button>
            <button class="action-button" onclick="openSettings()">
                Open Settings
            </button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function retryAnalysis() {
            const button = event.target;
            const originalContent = button.innerHTML;
            
            button.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: white; animation: spin 1s linear infinite;"></span> Retrying...';
            button.disabled = true;
            
            setTimeout(() => {
                vscode.postMessage({ command: 'refreshAnalysis' });
            }, 1000);
        }
        
        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }
        
        // Add spin animation
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        \`;
        document.head.appendChild(style);
    </script>
</body>
</html>`;
  }

  private async _exportReport(report: any) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found");
        return;
      }

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(
          workspaceFolder.uri,
          "code-review-report.json"
        ),
        filters: {
          JSON: ["json"],
          Markdown: ["md"],
        },
      });

      if (uri) {
        const content = JSON.stringify(report, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
        vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export report: ${error}`);
    }
  }

  public dispose() {
    CodeReviewPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
