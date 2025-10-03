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

        try {
          await vscode.commands.executeCommand('git.openChange', absolutePath);
        } catch (error) {
          console.log('git.openChange failed:', error);

          const document = await vscode.workspace.openTextDocument(absolutePath);
          await vscode.window.showTextDocument(document);
        }

      } catch (error) {
        vscode.window.showErrorMessage(`Could not open file: ${error}`);
      }
    }
  );

  context.subscriptions.push(startReviewCommand);
  context.subscriptions.push(goToLineCommand);
}

export function deactivate() { }
