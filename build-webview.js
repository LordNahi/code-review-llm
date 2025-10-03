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
        // Add Prism.js for syntax highlighting
        const prismCSS = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">`;
        const prismJS = `
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
            <script>
                // Auto-highlight code blocks after page load
                document.addEventListener('DOMContentLoaded', function() {
                    Prism.highlightAll();
                });
            </script>
        `;

        return templateContent
            // Handle custom elements
            .replace(/<css_bundle\s*\/>/g, `${prismCSS}<style>${cssBundle}</style>`)
            .replace(/<js_bundle\s*\/>/g, `<script>${jsBundle}</script>${prismJS}`)
            // Handle legacy {{}} and <!-- --> comment syntax for backwards compatibility
            .replace(/\{\{\s*CSS_BUNDLE\s*\}\}/g, `${prismCSS}${cssBundle}`)
            .replace(/\{\{\s*JS_BUNDLE\s*\}\}/g, `${jsBundle}${prismJS}`)
            .replace(/<!--\s*CSS_BUNDLE\s*-->/g, `${prismCSS}${cssBundle}`)
            .replace(/<!--\s*JS_BUNDLE\s*-->/g, `${jsBundle}${prismJS}`);
    }

    generateMainTemplate() {
        const templatePath = path.join(this.srcDir, 'templates', 'main.html');
        const template = this.readFile(templatePath);

        const cssBundle = this.bundleCSS(['common.css', 'main.css']);
        const jsBundle = this.bundleJS(['main.js']);

        const processedTemplate = this.processTemplate(template, cssBundle, jsBundle);

        return `export function getMainTemplate(analysis: any): string {
    const { TemplateRenderer } = require('./webview-components');
    const processedHtml = TemplateRenderer.processMainTemplate(\`${processedTemplate
                .replace(/`/g, '\\`')
                .replace(/\$\{/g, '\\${')}\`, analysis);
    return processedHtml;
}`;
    }

    generateLoadingTemplate() {
        const templatePath = path.join(this.srcDir, 'templates', 'loading.html');
        const template = this.readFile(templatePath);

        const cssBundle = this.bundleCSS(['common.css', 'loading.css']);
        const processedTemplate = this.processTemplate(template, cssBundle, '');

        return `export function getLoadingTemplate(): string {
    return \`${processedTemplate.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\`;
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
                .replace(/\$\{/g, '\\${')
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

        // Copy webview-components.js to the output directory
        const componentsSource = path.join(__dirname, 'src', 'webview-components.js');
        const componentsTarget = path.join(__dirname, 'out', 'webview-components.js');

        try {
            const componentsContent = this.readFile(componentsSource);
            if (componentsContent) {
                // Ensure out directory exists
                const outDir = path.dirname(componentsTarget);
                if (!fs.existsSync(outDir)) {
                    fs.mkdirSync(outDir, { recursive: true });
                }
                fs.writeFileSync(componentsTarget, componentsContent, 'utf8');
                console.log('📦 Copied webview-components.js to out directory');
            }
        } catch (error) {
            console.error('❌ Failed to copy webview-components.js:', error.message);
        }

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

        // Also watch the webview-components.js file itself
        const componentsFile = path.join(__dirname, 'src', 'webview-components.js');
        if (fs.existsSync(componentsFile)) {
            fs.watch(componentsFile, rebuild);
        }

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