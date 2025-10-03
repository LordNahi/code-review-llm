import * as vscode from "vscode";
import { CodeReviewPanel } from "./codeReviewPanel";
import { GitAnalyzer } from "./gitAnalyzer";

export function activate(context: vscode.ExtensionContext) {
  console.log("Code Review Extension is now active!");

  // Register the command to start code review
  const startReviewCommand = vscode.commands.registerCommand(
    "codeReview.startReview",
    async () => {
      try {
        // Get git changes
        const gitAnalyzer = new GitAnalyzer();
        const changes = await gitAnalyzer.getStagedChanges();

        if (changes.length === 0) {
          vscode.window.showInformationMessage(
            "No staged changes found. Please stage some files first."
          );
          return;
        }

        // Create and show the review panel
        CodeReviewPanel.createOrShow(context.extensionUri, changes);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start code review: ${error}`);
      }
    }
  );

  const goToLineCommand = vscode.commands.registerCommand(
    'codeReview.goToLine',
    async (filePath: string, lineNumber: number) => {
      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        // Resolve relative path to absolute
        const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

        const document = await vscode.workspace.openTextDocument(absolutePath);
        const editor = await vscode.window.showTextDocument(document);

        // Convert to 0-based line number and go to that position
        const position = new vscode.Position(Math.max(0, lineNumber - 1), 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

      } catch (error) {
        vscode.window.showErrorMessage(`Could not open file: ${error}`);
      }
    }
  );

  context.subscriptions.push(startReviewCommand);
  context.subscriptions.push(goToLineCommand);
}

export function deactivate() { }
