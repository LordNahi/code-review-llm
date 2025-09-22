import * as vscode from "vscode";
import { CodeChange } from "./gitAnalyzer";

export interface CodeIssue {
  type: "error" | "warning" | "info" | "positive";
  title: string;
  description: string;
  lineNumber?: number;
  codeSnippet?: string;
  suggestion?: string;
}

export interface FileAnalysis {
  fileName: string;
  filePath: string;
  issues: CodeIssue[];
}

export interface AnalysisReport {
  summary: {
    filesAnalyzed: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    suggestions: number;
    overallScore: number;
  };
  files: FileAnalysis[];
  timestamp: string;
}

export class CodeAnalyzer {
  async analyzeChanges(changes: CodeChange[]): Promise<AnalysisReport> {
    try {
      // Check if Language Model API is available (VS Code) or if we're in Cursor
      if (vscode.lm && vscode.lm.selectChatModels) {
        const [model] = await vscode.lm.selectChatModels({
          vendor: "copilot",
          family: "gpt-4o",
        });

        // Build the prompt with all the git changes
        const prompt = this.buildPrompt(changes);

        // Send to LLM and get response
        const messages = [
          vscode.LanguageModelChatMessage.User(
            "You are an expert code reviewer. Analyze the provided code changes and provide detailed feedback in the exact JSON format specified."
          ),
          vscode.LanguageModelChatMessage.User(prompt),
        ];

        const response = await model.sendRequest(
          messages,
          {},
          new vscode.CancellationTokenSource().token
        );

        // Parse LLM response into our report format
        const analysis = await this.parseLLMResponse(response, changes);

        return analysis;
      } else {
        // Running in Cursor or VS Code without Language Model API
        console.log(
          "Language Model API not available, using rule-based analysis"
        );
        return this.performRuleBasedAnalysis(changes);
      }
    } catch (error) {
      console.error("LLM analysis failed:", error);

      // Fallback if LLM fails
      return this.performRuleBasedAnalysis(changes);
    }
  }

  private buildPrompt(changes: CodeChange[]): string {
    let prompt = `Please perform a comprehensive code review of these staged changes:\n\n`;

    changes.forEach((change, index) => {
      prompt += `## File ${index + 1}: ${change.fileName}\n`;
      prompt += `**Change Type:** ${change.changeType}\n`;
      prompt += `**File Path:** ${change.filePath}\n\n`;

      if (change.oldContent && change.oldContent.trim()) {
        prompt += `**Previous Content:**\n\`\`\`\n${change.oldContent}\n\`\`\`\n\n`;
      }

      prompt += `**New Content:**\n\`\`\`\n${change.newContent}\n\`\`\`\n\n`;
      prompt += `---\n\n`;
    });

    prompt += `Please analyze these changes and provide feedback in the following JSON format:

{
  "summary": {
    "overallScore": 8,
    "criticalIssues": 0,
    "warnings": 2,
    "suggestions": 3
  },
  "files": [
    {
      "fileName": "example.ts",
      "filePath": "/path/to/example.ts",
      "issues": [
        {
          "type": "error|warning|info|positive",
          "title": "Issue Title",
          "description": "Detailed description of the issue",
          "lineNumber": 42,
          "codeSnippet": "const result = someFunction();",
          "suggestion": "Consider adding error handling here"
        }
      ]
    }
  ]
}

Focus on:
- Bugs & Logic Errors
- Security Issues  
- Performance Issues
- Code Quality & Best Practices
- Architecture & Design
- Positive Aspects

Be thorough but concise. Provide actionable suggestions.`;

    return prompt;
  }

  private async parseLLMResponse(
    response: vscode.LanguageModelChatResponse,
    changes: CodeChange[]
  ): Promise<AnalysisReport> {
    try {
      // Collect all fragments from the streaming response
      let fullResponse = "";
      for await (const fragment of response.text) {
        fullResponse += fragment;
      }

      // Clean the response - remove any markdown formatting
      const cleanResponse = fullResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(cleanResponse);

      // Transform LLM response to our format
      const analysis: AnalysisReport = {
        summary: {
          filesAnalyzed: changes.length,
          totalIssues:
            (parsed.summary?.criticalIssues || 0) +
            (parsed.summary?.warnings || 0) +
            (parsed.summary?.suggestions || 0),
          errors: parsed.summary?.criticalIssues || 0,
          warnings: parsed.summary?.warnings || 0,
          suggestions: parsed.summary?.suggestions || 0,
          overallScore: parsed.summary?.overallScore || 5,
        },
        files: parsed.files || [],
        timestamp: new Date().toISOString(),
      };

      return analysis;
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      console.log("Raw response:", response);

      // Return fallback if parsing fails
      return this.createFallbackReport(changes);
    }
  }

  private performRuleBasedAnalysis(changes: CodeChange[]): AnalysisReport {
    const files: FileAnalysis[] = changes.map((change) => {
      const issues: CodeIssue[] = [];

      // Basic rule-based analysis
      this.analyzeFileContent(change, issues);

      return {
        fileName: change.fileName,
        filePath: change.filePath,
        issues,
      };
    });

    const totalIssues = files.reduce(
      (sum, file) => sum + file.issues.length,
      0
    );
    const errors = files.reduce(
      (sum, file) =>
        sum + file.issues.filter((issue) => issue.type === "error").length,
      0
    );
    const warnings = files.reduce(
      (sum, file) =>
        sum + file.issues.filter((issue) => issue.type === "warning").length,
      0
    );
    const suggestions = files.reduce(
      (sum, file) =>
        sum +
        file.issues.filter(
          (issue) => issue.type === "info" || issue.type === "positive"
        ).length,
      0
    );

    return {
      summary: {
        filesAnalyzed: changes.length,
        totalIssues,
        errors,
        warnings,
        suggestions,
        overallScore:
          totalIssues === 0 ? 9 : Math.max(1, 9 - errors * 2 - warnings),
      },
      files,
      timestamp: new Date().toISOString(),
    };
  }

  private analyzeFileContent(change: CodeChange, issues: CodeIssue[]): void {
    const content = change.newContent;
    const lines = content.split("\n");

    // Check for common issues
    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Check for console.log statements
      if (line.includes("console.log") && !line.includes("// TODO: Remove")) {
        issues.push({
          type: "warning",
          title: "Console.log Statement",
          description: "Console.log statement found in production code",
          lineNumber,
          codeSnippet: line.trim(),
          suggestion: "Consider removing or replacing with proper logging",
        });
      }

      // Check for TODO comments
      if (line.includes("TODO") || line.includes("FIXME")) {
        issues.push({
          type: "info",
          title: "TODO/FIXME Comment",
          description: "Code contains TODO or FIXME comment",
          lineNumber,
          codeSnippet: line.trim(),
          suggestion: "Address the TODO/FIXME item before finalizing",
        });
      }

      // Check for potential security issues
      if (line.includes("eval(") || line.includes("innerHTML =")) {
        issues.push({
          type: "error",
          title: "Potential Security Risk",
          description: "Code contains potentially unsafe operations",
          lineNumber,
          codeSnippet: line.trim(),
          suggestion: "Review for security implications",
        });
      }

      // Check for long lines
      if (line.length > 120) {
        issues.push({
          type: "info",
          title: "Long Line",
          description: "Line exceeds 120 characters",
          lineNumber,
          codeSnippet: line.trim(),
          suggestion: "Consider breaking into multiple lines for readability",
        });
      }
    });

    // Check for missing error handling in async functions
    if (
      content.includes("async ") &&
      !content.includes("try {") &&
      !content.includes(".catch(")
    ) {
      issues.push({
        type: "warning",
        title: "Missing Error Handling",
        description: "Async function without explicit error handling",
        suggestion: "Consider adding try-catch blocks or .catch() handlers",
      });
    }

    // Check for TypeScript-specific issues
    if (change.fileName.endsWith(".ts") || change.fileName.endsWith(".tsx")) {
      if (content.includes("any") && !content.includes("// eslint-disable")) {
        issues.push({
          type: "warning",
          title: "TypeScript 'any' Type",
          description: "Code uses 'any' type which reduces type safety",
          suggestion: "Consider using more specific types",
        });
      }
    }

    // If no issues found, add a positive note
    if (issues.length === 0) {
      issues.push({
        type: "positive",
        title: "Code Quality",
        description: "No obvious issues detected in this file",
        suggestion: "Good work! Continue following best practices",
      });
    }
  }

  private createFallbackReport(changes: CodeChange[]): AnalysisReport {
    const files: FileAnalysis[] = changes.map((change) => ({
      fileName: change.fileName,
      filePath: change.filePath,
      issues: [
        {
          type: "info",
          title: "LLM Analysis Unavailable",
          description:
            "Unable to perform AI-powered analysis. Please check your language model configuration.",
          suggestion:
            "Ensure you have a language model configured in VSCode settings.",
        },
      ],
    }));

    return {
      summary: {
        filesAnalyzed: changes.length,
        totalIssues: files.length,
        errors: 0,
        warnings: 0,
        suggestions: files.length,
        overallScore: 5,
      },
      files,
      timestamp: new Date().toISOString(),
    };
  }
}
