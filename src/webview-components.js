/**
 * Webview Components - Reusable HTML generation components
 * Separates presentation logic from template building
 */

class HtmlUtils {
    /**
     * Escape HTML to prevent XSS and formatting issues
     */
    static escape(text) {
        if (typeof text !== 'string') {
            return String(text || '');
        }
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Safely render code snippets with proper escaping
     */
    static escapeCode(code) {
        if (typeof code !== 'string') {
            return '';
        }
        return code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}

class IssueComponent {
    /**
     * Render a single issue with proper HTML structure
     * @param {Object} issue - The issue object
     * @param {number} fileIndex - File index for unique IDs
     * @param {number} issueIndex - Issue index for unique IDs
     * @returns {string} HTML string for the issue
     */
    static render(issue, fileIndex, issueIndex) {
        const issueId = `${fileIndex}-${issueIndex}`;
        const escapedTitle = HtmlUtils.escape(issue.title || 'No title');
        const escapedDescription = HtmlUtils.escape(issue.description || 'No description');
        const issueType = HtmlUtils.escape(issue.type || 'info');

        // Handle code snippet if present
        const codeSnippetHtml = issue.codeSnippet
            ? `<div class="code-block">${HtmlUtils.escapeCode(issue.codeSnippet)}</div>`
            : '';

        // Handle suggestion if present
        const suggestionHtml = issue.suggestion
            ? `<div class="suggestion"><strong>Suggestion:</strong> ${HtmlUtils.escape(issue.suggestion)}</div>`
            : '';

        return `
            <div class="issue ${issueType}" data-issue-id="${issueId}">
                <div class="issue-header"> 
                    <div class="issue-content">
                        <h4 class="issue-title">${escapedTitle}</h4>
                        <p class="issue-description">${escapedDescription}</p>
                        ${codeSnippetHtml}
                        ${suggestionHtml}
                    </div>
                    <span class="issue-type ${issueType}">${issueType.toUpperCase()}</span>
                </div>
            </div>
        `;
    }
}

class FileSection {
    /**
     * Render a complete file section with all its issues
     * @param {Object} file - The file object containing fileName and issues
     * @param {number} index - File index for unique IDs
     * @returns {string} HTML string for the file section
     */
    static render(file, index) {
        const escapedFileName = HtmlUtils.escape(file.fileName || 'Unknown file');

        // Render all issues for this file
        const issuesHtml = (file.issues || [])
            .map((issue, issueIndex) => IssueComponent.render(issue, index, issueIndex))
            .join('');

        return `
            <div class="file-section" data-file-index="${index}">
                <div class="file-header" onclick="toggleFileSection(${index})">
                    ${escapedFileName}
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="file-issues">
                    ${issuesHtml}
                </div>
            </div>
        `;
    }
}

class TemplateRenderer {
    /**
     * Generate the complete files content HTML
     * @param {Array} files - Array of file objects
     * @returns {string} Complete HTML for all files
     */
    static renderFilesContent(files) {
        if (!Array.isArray(files)) {
            return '<div class="no-files">No files to display</div>';
        }

        return files
            .map((file, index) => FileSection.render(file, index))
            .join('');
    }

    /**
     * Calculate statistics from analysis data
     * @param {Object} analysis - The complete analysis object
     * @returns {Object} Statistics object
     */
    static calculateStats(analysis) {
        const files = analysis.files || [];

        return {
            filesCount: files.length,
            errorsCount: files.reduce((acc, file) => {
                return acc + (file.issues || []).filter(issue => issue.type === 'error').length;
            }, 0),
            warningsCount: files.reduce((acc, file) => {
                return acc + (file.issues || []).filter(issue => issue.type === 'warning').length;
            }, 0),
            improvementsCount: files.reduce((acc, file) => {
                return acc + (file.issues || []).filter(issue => issue.type === 'positive').length;
            }, 0)
        };
    }

    /**
     * Process template with analysis data
     * @param {string} template - The HTML template
     * @param {Object} analysis - The analysis data
     * @returns {string} Processed template
     */
    static processMainTemplate(template, analysis) {
        const stats = this.calculateStats(analysis);
        const filesContent = this.renderFilesContent(analysis.files);
        const escapedSummary = HtmlUtils.escape(analysis.summary || 'No summary available');

        return template
            // Handle custom elements
            .replace(/<analysis_summary\s*\/>/g, escapedSummary)
            .replace(/<files_count\s*\/>/g, stats.filesCount.toString())
            .replace(/<errors_count\s*\/>/g, stats.errorsCount.toString())
            .replace(/<warnings_count\s*\/>/g, stats.warningsCount.toString())
            .replace(/<improvements_count\s*\/>/g, stats.improvementsCount.toString())
            .replace(/<files_content\s*\/>/g, filesContent)
            // Handle legacy {{}} syntax for backwards compatibility
            .replace(/\{\{\s*ANALYSIS_SUMMARY\s*\}\}/g, escapedSummary)
            .replace(/\{\{\s*FILES_COUNT\s*\}\}/g, stats.filesCount.toString())
            .replace(/\{\{\s*ERRORS_COUNT\s*\}\}/g, stats.errorsCount.toString())
            .replace(/\{\{\s*WARNINGS_COUNT\s*\}\}/g, stats.warningsCount.toString())
            .replace(/\{\{\s*IMPROVEMENTS_COUNT\s*\}\}/g, stats.improvementsCount.toString())
            .replace(/\{\{\s*FILES_CONTENT\s*\}\}/g, filesContent)
            // Handle legacy <!-- --> comment syntax for backwards compatibility
            .replace(/<!--\s*ANALYSIS_SUMMARY\s*-->/g, escapedSummary)
            .replace(/<!--\s*FILES_COUNT\s*-->/g, stats.filesCount.toString())
            .replace(/<!--\s*ERRORS_COUNT\s*-->/g, stats.errorsCount.toString())
            .replace(/<!--\s*WARNINGS_COUNT\s*-->/g, stats.warningsCount.toString())
            .replace(/<!--\s*IMPROVEMENTS_COUNT\s*-->/g, stats.improvementsCount.toString())
            .replace(/<!--\s*FILES_CONTENT\s*-->/g, filesContent);
    }
}

module.exports = {
    HtmlUtils,
    IssueComponent,
    FileSection,
    TemplateRenderer
};