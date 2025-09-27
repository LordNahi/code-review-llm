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
  summary: string;
  files: FileAnalysis[];
  timestamp: string;
}

export class CodeAnalyzer {
  async analyzeChanges(changes: CodeChange[]): Promise<AnalysisReport> {
    const token = new vscode.CancellationTokenSource();

    try {
      if (!vscode.lm || !vscode.lm.selectChatModels) {
        throw new Error("Language Model API not available");
      }

      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o',
      });

      if (!models.length) {
        throw new Error("No language models available");
      }

      const model = models[0];
      const prompt = this.buildPrompt(changes);

      const messages = [
        vscode.LanguageModelChatMessage.User(
          "You are an expert code reviewer. Analyze the provided code changes and provide detailed feedback in the exact JSON format specified."
        ),
        vscode.LanguageModelChatMessage.User(prompt),
      ];

      const response = await model.sendRequest(
        messages,
        {},
        token.token
      );

      const analysis = await this.parseLLMResponse(response, changes);
      return analysis;

    } catch (error) {
      console.error("LLM analysis failed:", error);
      return this.createFallbackReport(changes);
    } finally {
      token.dispose();
    }
  }

  private buildPrompt(changes: CodeChange[]): string {
    let prompt = `Please perform a comprehensive code review of these staged changes:\n\n`;

    changes.forEach((change, index) => {
      prompt += `## File ${index + 1}: ${change.fileName}\n`;
      prompt += `**Change Type:** ${change.changeType}\n`;
      prompt += `**File Path:** ${change.filePath}\n\n`;
      prompt += `**Git Diff:**\n\`\`\`diff\n${change.diff}\n\`\`\`\n\n`;
      prompt += `---\n\n`;
    });

    prompt += `Please analyze these changes and provide feedback in the following JSON format:

{
  "summary": "Brief overall assessment of the changes",
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

CRITICAL: Return ONLY the JSON object. No explanatory text before or after.

Focus on:
- Bugs & Logic Errors
- Security Issues  
- Performance Issues
- Code Quality & Best Practices
- Architecture & Design
- Positive Aspects
- Use code snippets for suggestions if applicable

Be thorough but concise. Provide actionable suggestions.`;

    return prompt;
  }

  private async parseLLMResponse(
    response: vscode.LanguageModelChatResponse,
    changes: CodeChange[]
  ): Promise<AnalysisReport> {
    let fullResponse = "";

    try {
      // Collect all fragments from the streaming response
      for await (const fragment of response.text) {
        fullResponse += fragment;
      }

      // Extract JSON more robustly
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.summary || !Array.isArray(parsed.files)) {
        throw new Error("Invalid response structure");
      }

      const analysis: AnalysisReport = {
        summary: parsed.summary,
        files: parsed.files.map((file: any) => ({
          fileName: file.fileName || "",
          filePath: file.filePath || "",
          issues: Array.isArray(file.issues) ? file.issues : []
        })),
        timestamp: new Date().toISOString(),
      };

      return analysis;

    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      console.error("Raw response:", fullResponse);
      return this.createFallbackReport(changes);
    }
  }

  private createFallbackReport(changes: CodeChange[]): AnalysisReport {
    const files: FileAnalysis[] = changes.map((change) => ({
      fileName: change.fileName,
      filePath: change.filePath,
      issues: [
        {
          type: "info",
          title: "Analysis Unavailable",
          description: "Unable to perform AI-powered analysis. Please check your language model configuration.",
          suggestion: "Ensure you have a language model configured in VSCode settings.",
        },
      ],
    }));

    return {
      summary: "Analysis failed - fallback report generated",
      files,
      timestamp: new Date().toISOString(),
    };
  }
}