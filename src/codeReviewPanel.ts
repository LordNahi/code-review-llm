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
        }
      },
      null,
      this._disposables
    );
  }

  public async _update(changes: CodeChange[]) {
    const webview = this._panel.webview;

    // Analyze the code changes
    const analyzer = new CodeAnalyzer();
    const analysis = await analyzer.analyzeChanges(changes);

    this._panel.webview.html = this._getHtmlForWebview(webview, analysis);
  }

  private _getHtmlForWebview(webview: vscode.Webview, analysis: any) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Review</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .summary {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .file-section {
            margin-bottom: 30px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }
        .file-header {
            background-color: var(--vscode-panel-background);
            padding: 10px 15px;
            font-weight: bold;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .issue {
            padding: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .issue:last-child {
            border-bottom: none;
        }
        .issue-type {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
        }
        .issue-type.error {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
        .issue-type.warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
        }
        .issue-type.info {
            background-color: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
        }
        .issue-type.positive {
            background-color: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
        }
        .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            overflow-x: auto;
        }
        .export-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 20px;
        }
        .export-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Code Review Report</h1>
        <p>Analysis of your staged changes</p>
    </div>
    
    <div class="summary">
        <h3>Summary</h3>
        <p>Files analyzed: ${analysis.summary.filesAnalyzed}</p>
        <p>Issues found: ${analysis.summary.totalIssues}</p>
        <p>Errors: ${analysis.summary.errors}</p>
        <p>Warnings: ${analysis.summary.warnings}</p>
        <p>Suggestions: ${analysis.summary.suggestions}</p>
    </div>
    
    ${analysis.files
      .map(
        (file: any) => `
        <div class="file-section">
            <div class="file-header">${file.fileName}</div>
            ${file.issues
              .map(
                (issue: any) => `
                <div class="issue">
                    <span class="issue-type ${
                      issue.type
                    }">${issue.type.toUpperCase()}</span>
                    <strong>${issue.title}</strong>
                    <p>${issue.description}</p>
                    ${
                      issue.codeSnippet
                        ? `<div class="code-block">${issue.codeSnippet}</div>`
                        : ""
                    }
                    ${
                      issue.suggestion
                        ? `<p><strong>Suggestion:</strong> ${issue.suggestion}</p>`
                        : ""
                    }
                </div>
            `
              )
              .join("")}
        </div>
    `
      )
      .join("")}
    
    <button class="export-button" onclick="exportReport()">Export Report (JSON)</button>
    
    <script>
        const vscode = acquireVsCodeApi();
        const analysisData = ${JSON.stringify(analysis)};
        
        function exportReport() {
            vscode.postMessage({
                command: 'exportReport',
                report: analysisData
            });
        }
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
