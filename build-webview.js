const fs = require('fs');
const path = require('path');

class WebviewBuilder {
    constructor() {
        this.srcDir = path.join(__dirname, 'src', 'webview');
        this.outputFile = path.join(__dirname, 'src', 'webviewTemplates.ts');
        this.watchMode = process.argv.includes('--watch');
    }

    readFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error.message);
            return '';
        }
    }

    bundleCSS(cssFiles) {
        return cssFiles
            .map(file => {
                const filePath = path.join(this.srcDir, 'styles', file);
                return this.readFile(filePath);
            })
            .join('\n')
            .replace(/\s+/g, ' ')  // Simple minification
            .trim();
    }

    bundleJS(jsFiles) {
        return jsFiles
            .map(file => {
                const filePath = path.join(this.srcDir, 'scripts', file);
                return this.readFile(filePath);
            })
            .join('\n');
    }

    processTemplate(templateContent, cssBundle, jsBundle) {
        return templateContent
            // Handle custom elements
            .replace(/<css_bundle\s*\/>/g, `<style>${cssBundle}</style>`)
            .replace(/<js_bundle\s*\/>/g, `<script>${jsBundle}</script>`)
            // Handle legacy {{}} and <!-- --> comment syntax for backwards compatibility
            .replace(/\{\{\s*CSS_BUNDLE\s*\}\}/g, cssBundle)
            .replace(/\{\{\s*JS_BUNDLE\s*\}\}/g, jsBundle)
            .replace(/<!--\s*CSS_BUNDLE\s*-->/g, cssBundle)
            .replace(/<!--\s*JS_BUNDLE\s*-->/g, jsBundle);
    }

    generateMainTemplate() {
        const templatePath = path.join(this.srcDir, 'templates', 'main.html');
        const template = this.readFile(templatePath);

        const cssBundle = this.bundleCSS(['common.css', 'main.css']);
        const jsBundle = this.bundleJS(['main.js']);

        const processedTemplate = this.processTemplate(template, cssBundle, jsBundle);

        // TODO: Try move below out in a way that keeps out HTML inside html files, just don't like this
        // sitting cramped up here ...

        return `export function getMainTemplate(analysis: any): string {
    const filesContent = analysis.files
        .map((file: any, index: number) => \`
            <div class="file-section" data-file-index="\${index}">
                <div class="file-header" onclick="toggleFileSection(\${index})">
                    \${file.fileName}
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="file-issues">
                    \${file.issues
                        .map((issue: any, issueIndex: number) => \`
                            <div class="issue \${issue.type}" data-issue-id="\${index}-\${issueIndex}">
                                <div class="issue-header"> 
                                    <div class="issue-content">
                                        <h4 class="issue-title">\${issue.title}</h4>
                                        <p class="issue-description">\${issue.description}</p>
                                        \${issue.codeSnippet ? \`<div class="code-block">\${issue.codeSnippet}</div>\` : ""}
                                        \${issue.suggestion ? \`<div class="suggestion"><strong>Suggestion:</strong> \${issue.suggestion}</div>\` : ""}
                                    </div>
                                    <span class="issue-type \${issue.type}">\${issue.type.toUpperCase()}</span>
                                </div>
                            </div>
                        \`)
                        .join("")}
                </div>
            </div>
        \`)
        .join("");

    return \`${processedTemplate
                .replace(/`/g, '\\`')
                .replace(/\$\{/g, '\\${')
                // Handle custom elements
                .replace(/<analysis_summary\s*\/>/g, '${analysis.summary}')
                .replace(/<files_count\s*\/>/g, '${analysis.files.length}')
                .replace(/<errors_count\s*\/>/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "error").length, 0)}')
                .replace(/<warnings_count\s*\/>/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "warning").length, 0)}')
                .replace(/<improvements_count\s*\/>/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "positive").length, 0)}')
                .replace(/<files_content\s*\/>/g, '${filesContent}')
                // Handle legacy {{}} and <!-- --> comment syntax for backwards compatibility
                .replace(/\{\{\s*ANALYSIS_SUMMARY\s*\}\}/g, '${analysis.summary}')
                .replace(/\{\{\s*FILES_COUNT\s*\}\}/g, '${analysis.files.length}')
                .replace(/\{\{\s*ERRORS_COUNT\s*\}\}/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "error").length, 0)}')
                .replace(/\{\{\s*WARNINGS_COUNT\s*\}\}/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "warning").length, 0)}')
                .replace(/\{\{\s*IMPROVEMENTS_COUNT\s*\}\}/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "positive").length, 0)}')
                .replace(/\{\{\s*FILES_CONTENT\s*\}\}/g, '${filesContent}')
                .replace(/<!--\s*ANALYSIS_SUMMARY\s*-->/g, '${analysis.summary}')
                .replace(/<!--\s*FILES_COUNT\s*-->/g, '${analysis.files.length}')
                .replace(/<!--\s*ERRORS_COUNT\s*-->/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "error").length, 0)}')
                .replace(/<!--\s*WARNINGS_COUNT\s*-->/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "warning").length, 0)}')
                .replace(/<!--\s*IMPROVEMENTS_COUNT\s*-->/g, '${analysis.files.reduce((acc: number, file: any) => acc + file.issues.filter((i: any) => i.type === "positive").length, 0)}')
                .replace(/<!--\s*FILES_CONTENT\s*-->/g, '${filesContent}')}\`;
}`;
    }

    generateLoadingTemplate() {
        const templatePath = path.join(this.srcDir, 'templates', 'loading.html');
        const template = this.readFile(templatePath);

        const cssBundle = this.bundleCSS(['common.css', 'loading.css']);
        const processedTemplate = this.processTemplate(template, cssBundle, '');

        return `export function getLoadingTemplate(): string {
    return \`${processedTemplate.replace(/`/g, '\\`').replace(/\$\{/g, '\\${}')}\`;
}`;
    }

    generateErrorTemplate() {
        const templatePath = path.join(this.srcDir, 'templates', 'error.html');
        const template = this.readFile(templatePath);

        const cssBundle = this.bundleCSS(['common.css', 'error.css']);
        const jsBundle = this.bundleJS(['error.js']);

        const processedTemplate = this.processTemplate(template, cssBundle, jsBundle);

        return `export function getErrorTemplate(error: any): string {
    return \`${processedTemplate
                .replace(/`/g, '\\`')
                .replace(/\$\{/g, '\\${}')
                // Handle custom elements
                .replace(/<error_message\s*\/>/g, '${error.message || "An unknown error occurred during code analysis."}')
                // Handle legacy {{}} and <!-- --> comment syntax for backwards compatibility
                .replace(/\{\{\s*ERROR_MESSAGE\s*\}\}/g, '${error.message || "An unknown error occurred during code analysis."}')
                .replace(/<!--\s*ERROR_MESSAGE\s*-->/g, '${error.message || "An unknown error occurred during code analysis."}')}\`;
}`;
    }

    build() {
        console.log('🔨 Building webview templates...');

        const mainTemplate = this.generateMainTemplate();
        const loadingTemplate = this.generateLoadingTemplate();
        const errorTemplate = this.generateErrorTemplate();

        const output = `// Auto-generated file - do not edit manually
// Generated at: ${new Date().toISOString()}

${mainTemplate}

${loadingTemplate}

${errorTemplate}
`;

        fs.writeFileSync(this.outputFile, output, 'utf8');
        console.log('✅ Webview templates built successfully!');
    }

    watch() {
        console.log('👀 Watching webview files for changes...');

        const watchPaths = [
            path.join(this.srcDir, 'templates'),
            path.join(this.srcDir, 'styles'),
            path.join(this.srcDir, 'scripts')
        ];

        let timeout;
        const rebuild = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                console.log('🔄 Files changed, rebuilding...');
                this.build();
            }, 100);
        };

        watchPaths.forEach(watchPath => {
            if (fs.existsSync(watchPath)) {
                fs.watch(watchPath, { recursive: true }, rebuild);
            }
        });

        // Initial build
        this.build();
    }

    run() {
        if (this.watchMode) {
            this.watch();
        } else {
            this.build();
        }
    }
}

// Run the builder
new WebviewBuilder().run();