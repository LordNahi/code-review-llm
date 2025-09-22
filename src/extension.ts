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

  context.subscriptions.push(startReviewCommand);
}

export function deactivate() {}
