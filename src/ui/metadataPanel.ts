import { computeMD5, computeSHA1, computeSHA256 } from '../analyzer/hashes.js';

export interface MetadataPanelData {
  fileName: string;
  fileSize: number;
  binaryData: Uint8Array;
  architecture: string;
  entryPoint: number;
  sectionsCount: number;
  symbolsCount: number;
  lastModified?: number;
}

export class MetadataPanel {
  private container: HTMLElement;
  private data: MetadataPanelData | null = null;

  // DOM elements
  private rootEl!: HTMLDivElement;

  // Calculated hashes cache
  private md5Hash: string = '';
  private sha1Hash: string = '';
  private sha256Hash: string = '';
  private isCalculatingHashes: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.injectStyles();
    this.initLayout();
  }

  /**
   * Updates the panel with new binary/file data.
   */
  public updateData(data: MetadataPanelData) {
    this.data = data;
    this.md5Hash = '';
    this.sha1Hash = '';
    this.sha256Hash = '';
    
    // Async hash calculation to prevent blocking UI main thread
    this.calculateHashes(data.binaryData);
    this.render();
  }

  private injectStyles() {
    if (document.getElementById('metadata-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'metadata-panel-styles';
    style.textContent = `
      .meta-panel-root {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 1.5rem;
        padding: 1.5rem;
        box-sizing: border-box;
        font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
        color: var(--text-primary);
        background: rgba(15, 17, 21, 0.2);
        overflow-y: auto;
      }

      .meta-header {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .meta-header h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        background: var(--gradient-accent);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .meta-header p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-muted);
      }

      /* Grid stats layout */
      .meta-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .meta-stat-card {
        background: var(--bg-glass);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 1.25rem;
        backdrop-filter: blur(12px);
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
      }

      .meta-stat-card:hover {
        transform: translateY(-2px);
        border-color: var(--border-hover);
        background: var(--bg-glass-hover);
      }

      .meta-stat-card .stat-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--text-muted);
        font-weight: 700;
        letter-spacing: 0.05em;
      }

      .meta-stat-card .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        font-family: var(--font-mono);
        color: var(--text-primary);
      }

      /* Sections container styling */
      .meta-sections-wrapper {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
      }

      @media (max-width: 900px) {
        .meta-sections-wrapper {
          grid-template-columns: 1fr;
        }
      }

      .meta-card {
        background: var(--bg-glass);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 1.5rem;
        backdrop-filter: blur(12px);
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .meta-card-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.75rem;
      }

      /* Key-Value Details table */
      .meta-details-table {
        width: 100%;
        border-collapse: collapse;
      }

      .meta-details-table tr {
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      }

      .meta-details-table tr:last-child {
        border-bottom: none;
      }

      .meta-details-table td {
        padding: 0.75rem 0;
        font-size: 0.9rem;
        vertical-align: top;
      }

      .meta-details-table td.detail-label {
        width: 35%;
        color: var(--text-muted);
        font-weight: 500;
      }

      .meta-details-table td.detail-value {
        color: var(--text-secondary);
        font-family: var(--font-mono);
        word-break: break-all;
      }

      /* Hashes items styling */
      .meta-hash-item {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-bottom: 1rem;
      }

      .meta-hash-item:last-child {
        margin-bottom: 0;
      }

      .meta-hash-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .meta-hash-label {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--text-muted);
      }

      .meta-hash-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .meta-hash-value {
        flex: 1;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 0.6rem 0.8rem;
        font-family: var(--font-mono);
        font-size: 0.825rem;
        color: var(--text-secondary);
        word-break: break-all;
        min-height: 2.1rem;
        box-sizing: border-box;
      }

      .meta-hash-value.loading {
        color: var(--text-disabled);
        font-style: italic;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .copy-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-fast);
        min-width: 2.2rem;
        height: 2.1rem;
      }

      .copy-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        border-color: var(--border-hover);
        color: var(--text-primary);
      }

      .copy-btn:active:not(:disabled) {
        transform: scale(0.95);
      }

      .copy-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .copy-btn.copied {
        background: var(--success-glow);
        border-color: var(--success);
        color: var(--success);
      }

      /* Spinner animation */
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .spinner {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255,255,255,0.1);
        border-top-color: var(--text-muted);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
    `;
    document.head.appendChild(style);
  }

  private initLayout() {
    this.container.innerHTML = '';
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'meta-panel-root';
    this.container.appendChild(this.rootEl);
    this.render();
  }

  private calculateHashes(binaryData: Uint8Array) {
    if (binaryData.length === 0) {
      this.md5Hash = 'N/A';
      this.sha1Hash = 'N/A';
      this.sha256Hash = 'N/A';
      return;
    }

    this.isCalculatingHashes = true;
    this.render();

    // Use setTimeout to allow UI to render first
    setTimeout(() => {
      try {
        this.md5Hash = computeMD5(binaryData);
        this.sha1Hash = computeSHA1(binaryData);
        this.sha256Hash = computeSHA256(binaryData);
      } catch (err) {
        console.error('Error calculating hashes:', err);
        this.md5Hash = 'Error';
        this.sha1Hash = 'Error';
        this.sha256Hash = 'Error';
      } finally {
        this.isCalculatingHashes = false;
        this.render();
      }
    }, 50);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return `${bytes.toLocaleString()} bytes (${val} ${sizes[i]})`;
  }

  private formatDate(timestamp?: number): string {
    const d = timestamp ? new Date(timestamp) : new Date();
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private copyToClipboard(text: string, button: HTMLButtonElement) {
    if (!text || text === 'N/A' || this.isCalculatingHashes) return;
    
    navigator.clipboard.writeText(text).then(() => {
      button.classList.add('copied');
      const originalHTML = button.innerHTML;
      button.innerHTML = '✓';
      
      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = originalHTML;
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  private render() {
    if (!this.data) {
      this.rootEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
          <span style="font-size: 3rem;">📁</span>
          <p>No binary file loaded. Drag and drop or browse to load a binary.</p>
        </div>
      `;
      return;
    }

    const { fileName, fileSize, architecture, entryPoint, sectionsCount, symbolsCount, lastModified } = this.data;

    const formattedSize = this.formatBytes(fileSize);
    const formattedEntryPoint = `0x${entryPoint.toString(16).toUpperCase()}`;
    const formattedModifiedDate = this.formatDate(lastModified);

    this.rootEl.innerHTML = `
      <div class="meta-header">
        <h2>File Metadata Analysis</h2>
        <p>Comprehensive metadata, structural properties, and cryptographic hashes</p>
      </div>

      <!-- Quick Stats cards -->
      <div class="meta-stats-grid">
        <div class="meta-stat-card">
          <span class="stat-label">File Size</span>
          <span class="stat-value" title="${formattedSize}">${fileSize.toLocaleString()} B</span>
        </div>
        <div class="meta-stat-card">
          <span class="stat-label">Format / Arch</span>
          <span class="stat-value" style="color: var(--accent-end);">${architecture.toUpperCase()}</span>
        </div>
        <div class="meta-stat-card">
          <span class="stat-label">Entry Point</span>
          <span class="stat-value" style="color: var(--success);">${formattedEntryPoint}</span>
        </div>
        <div class="meta-stat-card">
          <span class="stat-label">Sections / Symbols</span>
          <span class="stat-value">${sectionsCount} / ${symbolsCount}</span>
        </div>
      </div>

      <div class="meta-sections-wrapper">
        <!-- Structural details card -->
        <div class="meta-card">
          <h3 class="meta-card-title">⚙️ Structural Details</h3>
          <table class="meta-details-table">
            <tr>
              <td class="detail-label">File Name</td>
              <td class="detail-value" style="color: var(--text-primary); font-weight: 500;">${fileName}</td>
            </tr>
            <tr>
              <td class="detail-label">Full Path / URI</td>
              <td class="detail-value" style="font-size: 0.8rem;">file:///${fileName}</td>
            </tr>
            <tr>
              <td class="detail-label">File Size</td>
              <td class="detail-value">${formattedSize}</td>
            </tr>
            <tr>
              <td class="detail-label">Architecture</td>
              <td class="detail-value">${architecture}</td>
            </tr>
            <tr>
              <td class="detail-label">Entry Point</td>
              <td class="detail-value">${formattedEntryPoint}</td>
            </tr>
            <tr>
              <td class="detail-label">Total Sections</td>
              <td class="detail-value">${sectionsCount}</td>
            </tr>
            <tr>
              <td class="detail-label">Total Symbols</td>
              <td class="detail-value">${symbolsCount}</td>
            </tr>
            <tr>
              <td class="detail-label">Last Modified</td>
              <td class="detail-value">${formattedModifiedDate}</td>
            </tr>
          </table>
        </div>

        <!-- Cryptographic Hashes card -->
        <div class="meta-card">
          <h3 class="meta-card-title">🔒 Cryptographic Hashes</h3>
          <div style="display: flex; flex-direction: column; gap: 1rem; justify-content: center; height: 100%;">
            
            <div class="meta-hash-item">
              <div class="meta-hash-header">
                <span class="meta-hash-label">MD5</span>
              </div>
              <div class="meta-hash-row">
                <div class="meta-hash-value ${this.isCalculatingHashes ? 'loading' : ''}">
                  ${this.isCalculatingHashes ? '<span class="spinner"></span> Calculating...' : this.md5Hash || 'N/A'}
                </div>
                <button class="copy-btn" data-hash="md5" ${this.isCalculatingHashes || !this.md5Hash ? 'disabled' : ''} title="Copy MD5 hash">
                  📋
                </button>
              </div>
            </div>

            <div class="meta-hash-item">
              <div class="meta-hash-header">
                <span class="meta-hash-label">SHA-1</span>
              </div>
              <div class="meta-hash-row">
                <div class="meta-hash-value ${this.isCalculatingHashes ? 'loading' : ''}">
                  ${this.isCalculatingHashes ? '<span class="spinner"></span> Calculating...' : this.sha1Hash || 'N/A'}
                </div>
                <button class="copy-btn" data-hash="sha1" ${this.isCalculatingHashes || !this.sha1Hash ? 'disabled' : ''} title="Copy SHA-1 hash">
                  📋
                </button>
              </div>
            </div>

            <div class="meta-hash-item">
              <div class="meta-hash-header">
                <span class="meta-hash-label">SHA-256</span>
              </div>
              <div class="meta-hash-row">
                <div class="meta-hash-value ${this.isCalculatingHashes ? 'loading' : ''}">
                  ${this.isCalculatingHashes ? '<span class="spinner"></span> Calculating...' : this.sha256Hash || 'N/A'}
                </div>
                <button class="copy-btn" data-hash="sha256" ${this.isCalculatingHashes || !this.sha256Hash ? 'disabled' : ''} title="Copy SHA-256 hash">
                  📋
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    // Hook up copy buttons
    this.rootEl.querySelectorAll('.copy-btn').forEach(btn => {
      const b = btn as HTMLButtonElement;
      const type = b.dataset.hash;
      let text = '';
      if (type === 'md5') text = this.md5Hash;
      else if (type === 'sha1') text = this.sha1Hash;
      else if (type === 'sha256') text = this.sha256Hash;

      b.addEventListener('click', () => this.copyToClipboard(text, b));
    });
  }
}
