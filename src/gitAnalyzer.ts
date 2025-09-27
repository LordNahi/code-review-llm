import * as vscode from "vscode";
import { GitExtension } from "../@types/git";

export interface CodeChange {
  filePath: string;
  fileName: string;
  diff: string;
  changeType: "added" | "modified" | "deleted";
  lineNumber?: number;
}

export class GitAnalyzer {
  async getStagedChanges(): Promise<CodeChange[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder found");
    }

    const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
    if (!gitExtension) {
      throw new Error("Git extension not found");
    }

    const git = gitExtension.getAPI(1);
    const repository = git.repositories.find(repo =>
      workspaceFolder.uri.fsPath.startsWith(repo.rootUri.fsPath)
    );

    if (!repository) {
      throw new Error("No git repository found for current workspace");
    }

    const changes: CodeChange[] = [];
    const stagedChanges = repository.state.indexChanges;

    for (const change of stagedChanges) {
      try {
        const filePath = change.uri.fsPath;
        const fileName = change.uri.fsPath.split(/[\\/]/).pop() || "";

        let diff = "";
        if (this.getChangeType(change.status) === "deleted") {
          diff = await repository.diffWith("HEAD", change.uri.fsPath);
        } else {
          diff = await repository.diffIndexWithHEAD(change.uri.fsPath);
        }

        if (diff) {
          changes.push({
            filePath,
            fileName,
            diff,
            changeType: this.getChangeType(change.status),
          });
        }
      } catch (error) {
        console.warn(`Skipping file ${change.uri.fsPath}: ${error}`);
        continue;
      }
    }

    return changes;
  }

  private getChangeType(status: number): "added" | "modified" | "deleted" {
    // VSCode Git API status constants
    const Status = {
      INDEX_MODIFIED: 1,
      INDEX_ADDED: 2,
      INDEX_DELETED: 4,
      INDEX_RENAMED: 8,
      INDEX_COPIED: 16
    };

    if (status & Status.INDEX_DELETED) return "deleted";
    if (status & Status.INDEX_ADDED) return "added";
    return "modified";
  }
}