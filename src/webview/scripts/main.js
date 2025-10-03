const vscode = acquireVsCodeApi();
let analysisData = null;
let currentFilter = 'all';

// Initialize interactive features
document.addEventListener('DOMContentLoaded', function () {
    // Get analysis data from global variable set by template
    if (window.ANALYSIS_DATA) {
        analysisData = window.ANALYSIS_DATA;
    }

    // Add staggered animation to file sections
    const fileSections = document.querySelectorAll('.file-section');
    fileSections.forEach((section, index) => {
        section.style.animationDelay = (index * 0.1) + 's';
    });

    // Add keyboard navigation
    document.addEventListener('keydown', handleKeyPress);

    // Save current state
    vscode.setState({ analysisData, currentFilter });
});

function toggleFileSection(index) {
    const fileSection = document.querySelector(`[data-file-index="` + index + `"]`);
    const isCollapsed = fileSection.classList.contains('collapsed');

    fileSection.classList.toggle('collapsed');

    // Animate the toggle
    const fileIssues = fileSection.querySelector('.file-issues');
    if (isCollapsed) {
        fileIssues.style.maxHeight = fileIssues.scrollHeight + 'px';
        setTimeout(() => {
            fileIssues.style.maxHeight = 'none';
        }, 300);
    } else {
        fileIssues.style.maxHeight = fileIssues.scrollHeight + 'px';
        setTimeout(() => {
            fileIssues.style.maxHeight = '0';
        }, 10);
    }
}

function exportReport() {
    const button = document.querySelector('.export-button') || event.target;
    const originalContent = button.innerHTML;

    // Show loading state
    button.innerHTML = '<span class="loading-spinner"></span> Exporting...';
    button.disabled = true;

    vscode.postMessage({
        command: 'exportReport',
        report: analysisData
    });

    // Reset button after delay
    setTimeout(() => {
        button.innerHTML = originalContent;
        button.disabled = false;
    }, 2000);
}

function refreshAnalysis() {
    const button = event.target;
    const originalContent = button.innerHTML;

    button.innerHTML = '<span class="loading-spinner"></span> Refreshing...';
    button.disabled = true;

    // Add refresh animation to container
    const container = document.querySelector('.container');
    if (container) {
        container.style.opacity = '0.7';
        container.style.transform = 'scale(0.98)';
    }

    setTimeout(() => {
        if (container) {
            container.style.opacity = '1';
            container.style.transform = 'scale(1)';
        }
        button.innerHTML = originalContent;
        button.disabled = false;

        // Trigger refresh command
        vscode.postMessage({
            command: 'refreshAnalysis'
        });
    }, 1500);
}

function showFilterOptions() {
    const filterTypes = ['all', 'error', 'warning', 'info', 'positive'];
    const currentIndex = filterTypes.indexOf(currentFilter);
    const nextIndex = (currentIndex + 1) % filterTypes.length;
    const newFilter = filterTypes[nextIndex];

    filterIssues(newFilter);
}

function filterIssues(filterType) {
    currentFilter = filterType;
    const issues = document.querySelectorAll('.issue');
    const fileSections = document.querySelectorAll('.file-section');

    // Update filter button
    const filterButton = document.querySelector('[onclick="showFilterOptions()"]');
    const filterLabels = { all: 'All Issues', error: 'Errors Only', warning: 'Warnings Only', info: 'Info Only', positive: 'Improvements Only' };
    if (filterButton) {
        filterButton.innerHTML = filterLabels[filterType];
    }

    // Apply filter with animation
    issues.forEach((issue, index) => {
        const shouldShow = filterType === 'all' || issue.classList.contains(filterType);

        if (shouldShow) {
            issue.style.display = 'block';
            issue.style.animation = `fadeInUp 0.3s ease-out ${index * 0.05}s both`;
        } else {
            issue.style.animation = 'fadeOut 0.2s ease-out both';
            setTimeout(() => {
                issue.style.display = 'none';
            }, 200);
        }
    });

    // Hide empty file sections
    fileSections.forEach(section => {
        const visibleIssues = section.querySelectorAll('.issue:not([style*="display: none"])');

        if (visibleIssues.length === 0) {
            section.style.opacity = '0.5';
            section.style.transform = 'scale(0.95)';
        } else {
            section.style.opacity = '1';
            section.style.transform = 'scale(1)';
        }
    });

    // Save state
    vscode.setState({ analysisData, currentFilter });
}

function handleKeyPress(event) {
    // Keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'e':
                event.preventDefault();
                exportReport();
                break;
            case 'r':
                event.preventDefault();
                refreshAnalysis();
                break;
            case 'f':
                event.preventDefault();
                showFilterOptions();
                break;
        }
    }

    // Arrow key navigation
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const issues = Array.from(document.querySelectorAll('.issue:not([style*="display: none"])'));
        const currentFocus = document.activeElement;
        const currentIndex = issues.findIndex(issue => issue.contains(currentFocus));

        let newIndex;
        if (event.key === 'ArrowUp') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : issues.length - 1;
        } else {
            newIndex = currentIndex < issues.length - 1 ? currentIndex + 1 : 0;
        }

        if (issues[newIndex]) {
            issues[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            issues[newIndex].style.outline = '2px solid var(--vscode-focusBorder)';

            // Remove outline from other issues
            issues.forEach((issue, index) => {
                if (index !== newIndex) {
                    issue.style.outline = 'none';
                }
            });
        }

        event.preventDefault();
    }
}

// Add CSS animations for fade effects
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
`;
document.head.appendChild(style);

// Go to Code functionality
function goToCode(fileName, lineNumber = 0) {
    vscode.postMessage({
        command: 'goToCode',
        fileName: fileName,
        lineNumber: lineNumber
    });
}

// Restore previous state if available
const previousState = vscode.getState();
if (previousState && previousState.currentFilter && previousState.currentFilter !== 'all') {
    setTimeout(() => {
        filterIssues(previousState.currentFilter);
    }, 500);
}