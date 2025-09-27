const vscode = acquireVsCodeApi();

function retryAnalysis() {
    const button = event.target;
    const originalContent = button.innerHTML;

    button.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: white; animation: spin 1s linear infinite;"></span> Retrying...';
    button.disabled = true;

    setTimeout(() => {
        vscode.postMessage({ command: 'refreshAnalysis' });
    }, 1000);
}

function openSettings() {
    vscode.postMessage({ command: 'openSettings' });
}

// Add spin animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);