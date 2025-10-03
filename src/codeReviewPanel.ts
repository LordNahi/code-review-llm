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
          case "goToCode":
            await this._goToCode(message.fileName, message.lineNumber);
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

  private async _goToCode(fileName: string, lineNumber: number = 0) {
    try {
      if (!fileName) {
        vscode.window.showWarningMessage('No file specified');
        return;
      }

      // Find the file in the workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      // Extract basename for searching
      const baseFileName = fileName.split(/[\\/]/).pop() || fileName;

      let fileUri: vscode.Uri | undefined;

      // Strategy 1: Try exact path match if it looks like a relative path
      if (fileName.includes('/') || fileName.includes('\\')) {
        const exactPath = vscode.Uri.joinPath(workspaceFolders[0].uri, fileName);
        try {
          await vscode.workspace.fs.stat(exactPath);
          fileUri = exactPath;
        } catch {
          // File not found at exact path, continue with other strategies
        }
      }

      // Strategy 2: If no exact match, search for files with the same basename
      if (!fileUri) {
        const files = await vscode.workspace.findFiles(`**/${baseFileName}`, '**/node_modules/**', 10);

        if (files.length > 0) {
          // If we have a relative path hint from fileName, try to match it
          if (fileName.includes('/') || fileName.includes('\\')) {
            // Look for a file that ends with the same relative path structure
            const relativePart = fileName.replace(/^.*?([^\/\\]*[\/\\][^\/\\]+)$/, '$1');
            const matchingFile = files.find(uri =>
              vscode.workspace.asRelativePath(uri).endsWith(relativePart)
            );
            if (matchingFile) {
              fileUri = matchingFile;
            }
          }

          // If no smart match found, use the first result
          if (!fileUri) {
            fileUri = files[0];
          }

          // If multiple files, let user choose (unless we found a smart match)
          if (files.length > 1 && !fileName.includes('/') && !fileName.includes('\\')) {
            const items = files.map(uri => ({
              label: vscode.workspace.asRelativePath(uri),
              description: uri.fsPath,
              uri: uri
            }));

            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: `Multiple files named "${baseFileName}" found. Select one:`
            });

            if (selected) {
              fileUri = selected.uri;
            } else {
              return; // User cancelled
            }
          }
        }
      }

      // If still no file found, show appropriate error message
      if (!fileUri) {
        if (fileName.includes('/') || fileName.includes('\\')) {
          const baseFileName = fileName.split(/[\\/]/).pop() || fileName;
          vscode.window.showWarningMessage(
            `File "${baseFileName}" not found in current workspace. ` +
            `It may be from a different project (original path: ${fileName})`
          );
        } else {
          vscode.window.showWarningMessage(`File "${fileName}" not found in workspace`);
        }
        return;
      }

      if (fileUri) {
        // Open the file
        const document = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(document);

        // Navigate to the specific line if provided
        if (lineNumber > 0) {
          const position = new vscode.Position(Math.max(0, lineNumber - 1), 0);
          const range = new vscode.Range(position, position);

          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
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