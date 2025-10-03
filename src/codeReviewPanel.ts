import * as vscode from "vscode";
import { CodeChange } from "./gitAnalyzer";
import { CodeAnalyzer } from "./codeAnalyzer";
import { getMainTemplate, getLoadingTemplate, getErrorTemplate } from "./webviewTemplates";

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
      async (message) => {
        switch (message.command || message.type) {
          case "exportReport":
            this._exportReport(message.report);
            return;
          case 'goToCode':
            vscode.commands.executeCommand(
              'codeReview.goToLine',
              message.fileName,
              message.lineNumber
            );
            break;
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

    // Show loading state first
    this._panel.webview.html = getLoadingTemplate();

    try {
      // Analyze the code changes
      const analyzer = new CodeAnalyzer();
      const analysis = await analyzer.analyzeChanges(changes);

      this._panel.webview.html = getMainTemplate(analysis);
    } catch (error) {
      // Show error message if analysis fails
      this._panel.webview.html = getErrorTemplate(error);
    }
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