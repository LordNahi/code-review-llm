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
  };
  files: FileAnalysis[];
  timestamp: string;
}

export class CodeAnalyzer {
  async analyzeChanges(changes: CodeChange[]): Promise<AnalysisReport> {
    const fileAnalyses: FileAnalysis[] = [];
    let totalIssues = 0;
    let errors = 0;
    let warnings = 0;
    let suggestions = 0;

    for (const change of changes) {
      const analysis = this.analyzeFile(change);
      fileAnalyses.push(analysis);

      totalIssues += analysis.issues.length;
      analysis.issues.forEach((issue) => {
        switch (issue.type) {
          case "error":
            errors++;
            break;
          case "warning":
            warnings++;
            break;
          case "info":
          case "positive":
            suggestions++;
            break;
        }
      });
    }

    return {
      summary: {
        filesAnalyzed: changes.length,
        totalIssues,
        errors,
        warnings,
        suggestions,
      },
      files: fileAnalyses,
      timestamp: new Date().toISOString(),
    };
  }

  private analyzeFile(change: CodeChange): FileAnalysis {
    const issues: CodeIssue[] = [];

    // Basic analysis rules
    this.checkForTypos(change, issues);
    this.checkForCodeStyle(change, issues);
    this.checkForPotentialBugs(change, issues);
    this.checkForSecurityIssues(change, issues);
    this.checkForPerformanceIssues(change, issues);
    this.checkForPositiveChanges(change, issues);

    return {
      fileName: change.fileName,
      filePath: change.filePath,
      issues,
    };
  }

  private checkForTypos(change: CodeChange, issues: CodeIssue[]) {
    const commonTypos = [
      { typo: "recieve", correct: "receive" },
      { typo: "seperate", correct: "separate" },
      { typo: "definately", correct: "definitely" },
      { typo: "occured", correct: "occurred" },
      { typo: "begining", correct: "beginning" },
      { typo: "teh", correct: "the" },
      { typo: "adn", correct: "and" },
      { typo: "fucntion", correct: "function" },
      { typo: "varibale", correct: "variable" },
      { typo: "retrun", correct: "return" },
    ];

    for (const { typo, correct } of commonTypos) {
      if (change.newContent.toLowerCase().includes(typo)) {
        issues.push({
          type: "warning",
          title: "Potential Typo",
          description: `Found "${typo}" which might be a typo. Did you mean "${correct}"?`,
          codeSnippet: this.extractContext(change.newContent, typo),
          suggestion: `Consider replacing "${typo}" with "${correct}"`,
        });
      }
    }
  }

  private checkForCodeStyle(change: CodeChange, issues: CodeIssue[]) {
    const lines = change.newContent.split("\n");

    lines.forEach((line, index) => {
      // Check for trailing whitespace
      if (line.match(/\s+$/)) {
        issues.push({
          type: "info",
          title: "Trailing Whitespace",
          description: "Line contains trailing whitespace",
          lineNumber: index + 1,
          codeSnippet: `Line ${index + 1}: "${line}"`,
          suggestion: "Remove trailing whitespace",
        });
      }

      // Check for very long lines
      if (line.length > 120) {
        issues.push({
          type: "warning",
          title: "Long Line",
          description: `Line is ${line.length} characters long (recommended max: 120)`,
          lineNumber: index + 1,
          codeSnippet: `Line ${index + 1}: ${line.substring(0, 100)}...`,
          suggestion: "Consider breaking this line into multiple lines",
        });
      }

      // Check for TODO/FIXME comments
      if (
        line.toLowerCase().includes("todo") ||
        line.toLowerCase().includes("fixme")
      ) {
        issues.push({
          type: "info",
          title: "TODO/FIXME Comment",
          description: "Found TODO or FIXME comment",
          lineNumber: index + 1,
          codeSnippet: `Line ${index + 1}: ${line.trim()}`,
          suggestion: "Consider addressing this before committing",
        });
      }
    });
  }

  private checkForPotentialBugs(change: CodeChange, issues: CodeIssue[]) {
    const content = change.newContent;

    // Check for console.log statements
    if (content.includes("console.log")) {
      issues.push({
        type: "warning",
        title: "Console.log Statement",
        description: "Found console.log statement in code",
        codeSnippet: this.extractContext(content, "console.log"),
        suggestion:
          "Consider removing console.log statements before committing",
      });
    }

    // Check for debugger statements
    if (content.includes("debugger")) {
      issues.push({
        type: "error",
        title: "Debugger Statement",
        description: "Found debugger statement in code",
        codeSnippet: this.extractContext(content, "debugger"),
        suggestion: "Remove debugger statements before committing",
      });
    }

    // Check for empty catch blocks
    if (content.match(/catch\s*\(\s*[^)]*\s*\)\s*{\s*}/)) {
      issues.push({
        type: "warning",
        title: "Empty Catch Block",
        description: "Found empty catch block",
        codeSnippet: this.extractContext(content, "catch"),
        suggestion: "Consider adding error handling or logging in catch blocks",
      });
    }
  }

  private checkForSecurityIssues(change: CodeChange, issues: CodeIssue[]) {
    const content = change.newContent;

    // Check for hardcoded passwords or secrets
    const secretPatterns = [
      /password\s*=\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]+['"]/i,
      /token\s*=\s*['"][^'"]+['"]/i,
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        issues.push({
          type: "error",
          title: "Potential Hardcoded Secret",
          description:
            "Found what appears to be a hardcoded password, API key, or secret",
          codeSnippet: this.extractContext(content, pattern),
          suggestion:
            "Use environment variables or secure configuration management",
        });
      }
    }
  }

  private checkForPerformanceIssues(change: CodeChange, issues: CodeIssue[]) {
    const content = change.newContent;

    // Check for potential infinite loops
    if (content.includes("while(true)") || content.includes("for(;;)")) {
      issues.push({
        type: "warning",
        title: "Potential Infinite Loop",
        description: "Found potential infinite loop",
        codeSnippet: this.extractContext(content, "while(true)"),
        suggestion: "Ensure there is a proper exit condition",
      });
    }

    // Check for synchronous file operations in Node.js
    if (
      content.includes("fs.readFileSync") ||
      content.includes("fs.writeFileSync")
    ) {
      issues.push({
        type: "info",
        title: "Synchronous File Operation",
        description: "Found synchronous file operation",
        codeSnippet: this.extractContext(content, "readFileSync"),
        suggestion:
          "Consider using asynchronous file operations for better performance",
      });
    }
  }

  private checkForPositiveChanges(change: CodeChange, issues: CodeIssue[]) {
    const content = change.newContent;

    // Check for good practices
    if (content.includes("try") && content.includes("catch")) {
      issues.push({
        type: "positive",
        title: "Good Error Handling",
        description: "Found proper try-catch error handling",
        codeSnippet: this.extractContext(content, "try"),
        suggestion: "Great job on implementing proper error handling!",
      });
    }

    if (content.includes("// TODO:") || content.includes("// FIXME:")) {
      issues.push({
        type: "positive",
        title: "Well-Documented TODO",
        description: "Found well-formatted TODO comment",
        codeSnippet: this.extractContext(content, "// TODO:"),
        suggestion: "Good practice to document future improvements!",
      });
    }
  }

  private extractContext(
    content: string,
    searchTerm: string | RegExp,
    contextLines: number = 2
  ): string {
    const lines = content.split("\n");
    const searchRegex =
      typeof searchTerm === "string" ? new RegExp(searchTerm, "i") : searchTerm;

    for (let i = 0; i < lines.length; i++) {
      if (searchRegex.test(lines[i])) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines + 1);
        const contextLines_ = lines.slice(start, end);

        return contextLines_
          .map((line, index) => {
            const lineNum = start + index + 1;
            const marker = lineNum === i + 1 ? ">>> " : "    ";
            return `${marker}${lineNum}: ${line}`;
          })
          .join("\n");
      }
    }

    return `Found: ${searchTerm}`;
  }
}
