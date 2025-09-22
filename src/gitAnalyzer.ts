import * as vscode from "vscode";

export interface CodeChange {
  filePath: string;
  fileName: string;
  oldContent: string;
  newContent: string;
  changeType: "added" | "modified" | "deleted";
  lineNumber?: number;
}

export class GitAnalyzer {
  async getStagedChanges(): Promise<CodeChange[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder found");
    }

    // Get git extension
    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (!gitExtension) {
      throw new Error("Git extension not found");
    }

    const git = gitExtension.exports.getAPI(1);
    const repository = git.repositories[0];

    if (!repository) {
      throw new Error("No git repository found");
    }

    const changes: CodeChange[] = [];

    // Get staged changes
    const stagedChanges = repository.state.indexChanges;

    for (const change of stagedChanges) {
      try {
        const filePath = change.uri.fsPath;
        const fileName = change.uri.path.split("/").pop() || "";

        // Read current file content
        const currentContent = await vscode.workspace.fs.readFile(change.uri);
        const newContent = Buffer.from(currentContent).toString("utf8");

        // For now, we'll get the original content from git
        // In a real implementation, you'd want to get the actual diff
        const oldContent = await this.getOriginalContent(
          repository,
          change.uri
        );

        changes.push({
          filePath,
          fileName,
          oldContent,
          newContent,
          changeType: this.getChangeType(change.status),
        });
      } catch (error) {
        console.error(`Error processing file ${change.uri.fsPath}:`, error);
      }
    }

    return changes;
  }

  private async getOriginalContent(
    repository: any,
    uri: vscode.Uri
  ): Promise<string> {
    try {
      // This is a simplified approach - in reality you'd want to get the actual diff
      // For now, we'll return empty content as a placeholder
      return "";
    } catch (error) {
      console.error("Error getting original content:", error);
      return "";
    }
  }

  private getChangeType(status: number): "added" | "modified" | "deleted" {
    // Git status codes: 1 = added, 2 = modified, 3 = deleted
    switch (status) {
      case 1:
        return "added";
      case 2:
        return "modified";
      case 3:
        return "deleted";
      default:
        return "modified";
    }
  }
}
