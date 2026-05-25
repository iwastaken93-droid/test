/**
 * Universal Reverse Engineering Tool (URET)
 * Application Coordinator / Main Entry Point
 */

import { parseElf } from './parser/elf.js';
import { PEParser } from './parser/pe.js';
import { parseWasm } from './parser/wasm.js';
import { DisassemblerRouter, Architecture } from './disassembler/router.js';
import { buildCFG, BasicBlock as CoreBasicBlock } from './disassembler/cfg.js';
import {
  Decompiler,
  BasicBlock as DecompilerBlock,
} from './disassembler/decompiler.js';
import { HexViewer } from './ui/hexViewer.js';
import { AssemblyView } from './ui/assemblyView.js';
import { CFGVisualizer } from './ui/cfgVisualizer.js';
import { Instruction, Section, Symbol } from './disassembler/types.js';

// App state management
interface AppState {
  fileName: string;
  fileSize: number;
  binaryData: Uint8Array;
  architecture: Architecture;
  entryPoint: number;
  sections: Section[];
  symbols: Symbol[];
  instructions: Instruction[];
  cfgBlocks: CoreBasicBlock[];
  activeTab: 'hex' | 'assembly' | 'cfg' | 'decompiler';
  selectedSymbol: Symbol | null;
  searchQuery: string;
}

class ApplicationCoordinator {
  private state!: AppState;

  // UI Components
  private hexViewer: HexViewer | null = null;
  private assemblyView: AssemblyView | null = null;
  private cfgVisualizer: CFGVisualizer | null = null;

  // DOM elements cache
  private appContainer!: HTMLDivElement;
  private fileInput!: HTMLInputElement;
  private uploadBtn!: HTMLButtonElement;
  private fileDropzone!: HTMLDivElement;
  private searchInput!: HTMLInputElement;
  private sidebarList!: HTMLDivElement;
  private tabButtons: Map<string, HTMLButtonElement> = new Map();
  private tabPanels: Map<string, HTMLElement> = new Map();

  // Header status elements
  private statusFileName!: HTMLSpanElement;
  private statusFileType!: HTMLSpanElement;
  private statusEntryVal!: HTMLSpanElement;
  private statusSectionsVal!: HTMLSpanElement;

  constructor() {
    this.injectStyles();
    this.createLayout();
    this.cacheElements();
    this.setupEventListeners();
    this.loadSampleBinary();
  }

  private injectStyles() {
    if (document.getElementById('coordinator-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'coordinator-custom-styles';
    style.textContent = `
      .search-input {
        width: 100%;
        padding: 0.75rem 1rem;
        background: rgba(15, 17, 21, 0.6);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-family: var(--font-sans);
        font-size: 0.9rem;
        transition: all var(--transition-fast);
      }
      .search-input:focus {
        outline: none;
        border-color: var(--accent-start);
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
      }
      .sidebar-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        overflow-y: auto;
        flex: 1;
        padding-right: 4px;
      }
      .sidebar-item {
        display: flex;
        flex-direction: column;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .sidebar-item:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: var(--border-hover);
        transform: translateX(2px);
      }
      .sidebar-item.active {
        background: rgba(99, 102, 241, 0.1);
        border-color: var(--accent-start);
      }
      .sidebar-item-name {
        font-weight: 600;
        font-size: 0.85rem;
        color: var(--text-primary);
        word-break: break-all;
      }
      .sidebar-item-meta {
        font-size: 0.7rem;
        color: var(--text-muted);
        font-family: var(--font-mono);
        margin-top: 0.25rem;
      }
      .metadata-container {
        display: flex;
        gap: 1.5rem;
        align-items: center;
      }
      .metadata-item {
        display: flex;
        flex-direction: column;
      }
      .metadata-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        color: var(--text-disabled);
        font-weight: 700;
        letter-spacing: 0.05em;
      }
      .metadata-value {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-secondary);
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .file-upload-zone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        border: 2px dashed var(--border-color);
        border-radius: var(--radius-md);
        background: rgba(22, 26, 33, 0.2);
        cursor: pointer;
        transition: all var(--transition-normal);
      }
      .file-upload-zone:hover, .file-upload-zone.dragover {
        border-color: var(--accent-start);
        background: rgba(99, 102, 241, 0.05);
      }
      .tab-content {
        width: 100%;
        height: calc(100vh - var(--header-height) - 4rem);
        position: relative;
      }
      .tab-selector-container {
        display: flex;
        gap: 0.5rem;
        background: var(--bg-tertiary);
        padding: 0.25rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
      }
      .tab-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        font-weight: 600;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .tab-btn:hover {
        color: var(--text-primary);
      }
      .tab-btn.active {
        background: var(--bg-secondary);
        color: var(--text-primary);
        box-shadow: var(--shadow-sm);
      }
      .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 700;
        font-size: 1.2rem;
        color: var(--text-primary);
        background: var(--gradient-accent);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  private createLayout() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
      <div class="app-container">
        <!-- Sidebar -->
        <aside class="sidebar">
          <div class="sidebar-brand">
            🌌 Universal RE Tool
          </div>
          
          <!-- Dropzone -->
          <div class="file-upload-zone" id="file-dropzone">
            <input type="file" id="file-input" style="display: none;" />
            <button class="btn btn-primary" id="upload-btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Upload Binary</button>
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.5rem; text-align: center;">Drag & drop or click</span>
          </div>

          <!-- Search Bar -->
          <input type="text" class="search-input" id="sidebar-search" placeholder="Search functions/symbols..." />

          <!-- Symbols / Sections List -->
          <div class="sidebar-list" id="sidebar-list"></div>
        </aside>

        <!-- Header -->
        <header class="header">
          <div class="metadata-container">
            <div class="metadata-item">
              <span class="metadata-label">File</span>
              <span class="metadata-value" id="status-filename">No file loaded</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Format</span>
              <span class="metadata-value" id="status-filetype">-</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Entry Point</span>
              <span class="metadata-value" id="status-entryval">-</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Sections</span>
              <span class="metadata-value" id="status-sectionsval">-</span>
            </div>
          </div>

          <!-- Navigation Tab Selector -->
          <div class="tab-selector-container">
            <button class="tab-btn active" data-tab="hex">Hex Viewer</button>
            <button class="tab-btn" data-tab="assembly">Assembly</button>
            <button class="tab-btn" data-tab="cfg">CFG Graph</button>
            <button class="tab-btn" data-tab="decompiler">Decompiler</button>
          </div>
        </header>

        <!-- Main Workspace Contents -->
        <main class="main-content">
          <!-- Hex Viewer Tab Panel -->
          <div class="tab-content" id="panel-hex" style="display: block;">
            <div id="hex-viewer-container" style="height: 100%;"></div>
          </div>

          <!-- Assembly Viewer Tab Panel -->
          <div class="tab-content" id="panel-assembly" style="display: none;">
            <div id="assembly-viewer-container" style="height: 100%;"></div>
          </div>

          <!-- CFG Viewer Tab Panel -->
          <div class="tab-content" id="panel-cfg" style="display: none;">
            <div id="cfg-viewer-container" style="height: 100%; width: 100%;"></div>
          </div>

          <!-- Decompiler Tab Panel -->
          <div class="tab-content" id="panel-decompiler" style="display: none;">
            <pre id="decompiler-viewer-container" class="glass-panel" style="font-family: var(--font-mono); font-size: 0.85rem; overflow: auto; height: 100%; white-space: pre-wrap; padding: 1.5rem; margin: 0; color: var(--text-secondary); line-height: 1.5;"></pre>
          </div>
        </main>
      </div>
    `;
  }

  private cacheElements() {
    this.appContainer = document.querySelector(
      '.app-container'
    ) as HTMLDivElement;
    this.fileInput = document.getElementById('file-input') as HTMLInputElement;
    this.uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement;
    this.fileDropzone = document.getElementById(
      'file-dropzone'
    ) as HTMLDivElement;
    this.searchInput = document.getElementById(
      'sidebar-search'
    ) as HTMLInputElement;
    this.sidebarList = document.getElementById(
      'sidebar-list'
    ) as HTMLDivElement;

    // Tab buttons and panel elements cache
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const b = btn as HTMLButtonElement;
      const tabName = b.dataset.tab;
      if (tabName) {
        this.tabButtons.set(tabName, b);
        this.tabPanels.set(
          tabName,
          document.getElementById(`panel-${tabName}`)!
        );
      }
    });

    this.statusFileName = document.getElementById(
      'status-filename'
    ) as HTMLSpanElement;
    this.statusFileType = document.getElementById(
      'status-filetype'
    ) as HTMLSpanElement;
    this.statusEntryVal = document.getElementById(
      'status-entryval'
    ) as HTMLSpanElement;
    this.statusSectionsVal = document.getElementById(
      'status-sectionsval'
    ) as HTMLSpanElement;
  }

  private setupEventListeners() {
    // File upload click
    this.uploadBtn.addEventListener('click', () => this.fileInput.click());
    this.fileDropzone.addEventListener('click', (e) => {
      if (e.target !== this.uploadBtn) {
        this.fileInput.click();
      }
    });

    // File input change
    this.fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        this.handleUploadedFile(target.files[0]);
      }
    });

    // Drag-and-drop support
    this.fileDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.fileDropzone.classList.add('dragover');
    });

    this.fileDropzone.addEventListener('dragleave', () => {
      this.fileDropzone.classList.remove('dragover');
    });

    this.fileDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.fileDropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        this.handleUploadedFile(e.dataTransfer.files[0]);
      }
    });

    // Search bar functionality
    this.searchInput.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.state.searchQuery = value;
      this.renderSidebarList();
    });

    // Tab buttons hookup
    this.tabButtons.forEach((btn, tabName: string) => {
      btn.addEventListener('click', () => {
        this.switchTab(tabName as any);
      });
    });
  }

  private switchTab(tabName: 'hex' | 'assembly' | 'cfg' | 'decompiler') {
    if (this.state.activeTab === tabName) return;

    // Toggle button active classes
    this.tabButtons.forEach((btn, name: string) => {
      if (name === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Toggle panels visible style
    this.tabPanels.forEach((panel, name: string) => {
      if (name === tabName) {
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    });

    this.state.activeTab = tabName;

    // Trigger components updates or re-render if needed
    if (tabName === 'hex' && this.hexViewer) {
      // Re-trigger layout alignment inside container
    } else if (tabName === 'assembly' && this.assemblyView) {
      if (this.state.selectedSymbol) {
        this.assemblyView.navigateToAddress(this.state.selectedSymbol.address);
      }
    }
  }

  private handleUploadedFile(file: File) {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && event.target.result instanceof ArrayBuffer) {
        this.processBinary(file.name, event.target.result);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private processBinary(fileName: string, arrayBuffer: ArrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    const fileSize = arrayBuffer.byteLength;

    // Auto-detect format & architecture using Router
    const arch = DisassemblerRouter.detectArchitecture(data);

    // Initial state values
    let entryPoint = 0;
    let sections: Section[] = [];
    let symbols: Symbol[] = [];

    // Format & parser dispatches
    try {
      if (arch === 'wasm') {
        const wasm = parseWasm(arrayBuffer);
        entryPoint = wasm.version; // Use version/magic metadata
        sections = wasm.customSections.map((s: any) => ({
          name: s.name,
          virtualAddress: 0,
          virtualSize: s.size,
          fileOffset: 0,
          fileSize: s.size,
          flags: { read: true, write: false, execute: false },
        }));
        symbols = wasm.exports.map((exp: any) => ({
          name: exp.name,
          address: exp.index,
          binding: 'global',
          type: exp.kind === 0 ? 'function' : 'none',
        }));
      } else if (
        data[0] === 0x7f &&
        data[1] === 0x45 &&
        data[2] === 0x4c &&
        data[3] === 0x46
      ) {
        // ELF binary parsing
        const elf = parseElf(arrayBuffer);
        entryPoint = Number(elf.header.entryPoint);
        sections = elf.sectionHeaders.map((sh: any) => ({
          name: sh.name || sh.typeName,
          virtualAddress: Number(sh.addr),
          virtualSize: Number(sh.size),
          fileOffset: Number(sh.offset),
          fileSize: Number(sh.size),
          flags: {
            read: (Number(sh.flags) & 4) !== 0,
            write: (Number(sh.flags) & 2) !== 0,
            execute: (Number(sh.flags) & 1) !== 0,
          },
        }));
        // Try to generate symbols based on sections or entry point
        symbols = [
          {
            name: '_start',
            address: entryPoint,
            binding: 'global',
            type: 'function',
          },
        ];
      } else if (data[0] === 0x4d && data[1] === 0x5a) {
        // PE binary parsing
        const peParser = new PEParser(arrayBuffer);
        const pe = peParser.parse();
        entryPoint =
          Number(pe.optionalHeader.addressOfEntryPoint) +
          Number(pe.optionalHeader.imageBase);
        sections = pe.sections.map((s: any) => ({
          name: s.name,
          virtualAddress:
            s.virtualAddress + Number(pe.optionalHeader.imageBase),
          virtualSize: s.virtualSize,
          fileOffset: s.pointerToRawData,
          fileSize: s.sizeOfRawData,
          flags: {
            read: (s.characteristics & 0x40000000) !== 0,
            write: (s.characteristics & 0x80000000) !== 0,
            execute: (s.characteristics & 0x20000000) !== 0,
          },
        }));

        // Load symbols from exports or default to entry point
        if (pe.exports && pe.exports.exports.length > 0) {
          symbols = pe.exports.exports.map((e: any) => ({
            name: e.name || `export_ord_${e.ordinal}`,
            address: e.address + Number(pe.optionalHeader.imageBase),
            binding: 'global',
            type: 'function',
          }));
        } else {
          symbols = [
            {
              name: 'main',
              address: entryPoint,
              binding: 'global',
              type: 'function',
            },
          ];
        }
      }
    } catch (err) {
      console.warn(
        'High-level parsing failed or incomplete. Generating fallbacks...',
        err
      );
    }

    // Standard fallback fallback routines
    if (sections.length === 0) {
      sections = [
        {
          name: '.text',
          virtualAddress: 0x1000,
          virtualSize: data.length,
          fileOffset: 0,
          fileSize: data.length,
          flags: { read: true, write: false, execute: true },
        },
      ];
    }
    if (symbols.length === 0) {
      symbols = [
        {
          name: 'sub_entry',
          address: entryPoint || 0x1000,
          binding: 'global',
          type: 'function',
        },
      ];
    }

    // Call routing disassembler
    const router = new DisassemblerRouter();
    const instructions = router.disassemble(data, {
      arch,
      baseAddress:
        sections.find((s: any) => s.flags.execute)?.virtualAddress || 0x1000,
      entryPoint,
    });

    // Populate extra symbols based on branch/calls targets to make it look full
    const additionalFuncs = new Set<number>();
    instructions.forEach((inst: Instruction) => {
      if (
        inst.mnemonic.toLowerCase() === 'call' ||
        inst.mnemonic.toLowerCase().startsWith('j')
      ) {
        const target = inst.operands?.find((op: any) => op.type === 'imm')?.imm;
        if (
          typeof target === 'number' &&
          target >= sections[0].virtualAddress &&
          target < sections[0].virtualAddress + data.length
        ) {
          additionalFuncs.add(target);
        }
      }
    });

    additionalFuncs.forEach((addr: number) => {
      if (!symbols.some((s) => s.address === addr)) {
        symbols.push({
          name: `sub_0x${addr.toString(16)}`,
          address: addr,
          binding: 'local',
          type: 'function',
        });
      }
    });

    // Sort symbols by address
    symbols.sort((a, b) => a.address - b.address);

    // Build Control Flow Graph (CFG)
    const cfgBlocks = buildCFG(instructions);

    // Update global state
    this.state = {
      fileName,
      fileSize,
      binaryData: data,
      architecture: arch,
      entryPoint,
      sections,
      symbols,
      instructions,
      cfgBlocks,
      activeTab: this.state ? this.state.activeTab : 'hex',
      selectedSymbol: symbols[0] || null,
      searchQuery: '',
    };

    // Update Header Status UI
    this.statusFileName.textContent = this.state.fileName;
    this.statusFileType.textContent = `${this.state.architecture.toUpperCase()} / Format`;
    this.statusEntryVal.textContent = `0x${this.state.entryPoint.toString(16).toUpperCase()}`;
    this.statusSectionsVal.textContent = this.state.sections.length.toString();

    this.searchInput.value = '';

    // Initialize View Components
    this.initHexViewer();
    this.initAssemblyViewer();
    this.initCFGViewer();
    this.updateDecompiler();

    // Fill the sidebar list
    this.renderSidebarList();

    // Select the first function/symbol by default
    if (symbols.length > 0) {
      this.selectSymbol(symbols[0]);
    }
  }

  private initHexViewer() {
    const container = document.getElementById('hex-viewer-container')!;
    if (this.hexViewer) {
      this.hexViewer.setData(this.state.binaryData);
    } else {
      this.hexViewer = new HexViewer(container, this.state.binaryData, {
        onOffsetSelect: (offset: number | null) => {
          if (offset !== null && this.assemblyView) {
            // Find instruction corresponding to the offset
            const address =
              (this.state.sections.find((s: any) => s.flags.execute)
                ?.virtualAddress || 0x1000) + offset;
            this.assemblyView.navigateToAddress(address, false);
          }
        },
      });
    }
  }

  private initAssemblyViewer() {
    const container = document.getElementById('assembly-viewer-container')!;
    if (this.assemblyView) {
      this.assemblyView.destroy();
    }

    this.assemblyView = new AssemblyView(container, this.state.instructions, {
      onInstructionSelect: (inst: Instruction) => {
        // Sync hex viewer selection
        const executeSection = this.state.sections.find(
          (s: any) => s.flags.execute
        );
        if (executeSection) {
          const offset = inst.address - executeSection.virtualAddress;
          if (
            offset >= 0 &&
            offset < this.state.binaryData.length &&
            this.hexViewer
          ) {
            this.hexViewer.setSelectedOffset(offset);
          }
        }
      },
    });
  }

  private initCFGViewer() {
    const container = document.getElementById('cfg-viewer-container')!;
    container.innerHTML = '';

    // Create visualization with state blocks
    this.cfgVisualizer = new CFGVisualizer(container, this.state.cfgBlocks, {
      layout: 'layered',
      onBlockSelect: (blockId: string | null) => {
        if (blockId) {
          const block = this.state.cfgBlocks.find((b) => b.id === blockId);
          if (block && this.assemblyView) {
            this.assemblyView.navigateToAddress(block.startAddress);
          }
        }
      },
    });
  }

  private updateDecompiler() {
    const container = document.getElementById('decompiler-viewer-container')!;
    if (this.state.cfgBlocks.length === 0) {
      container.textContent = '// No code to decompile';
      return;
    }

    // Convert core CFG blocks structure to structure expected by the Decompiler
    const decompilerBlocks: DecompilerBlock[] = this.state.cfgBlocks.map(
      (block: CoreBasicBlock) => ({
        id: block.id,
        successors: block.successors,
        instructions: block.instructions.map((inst: Instruction) => ({
          address: inst.address,
          op: inst.mnemonic.toUpperCase(),
          args: inst.operands
            ? inst.operands
                .map((op: any) => {
                  if (op.type === 'reg') return String(op.reg);
                  if (op.type === 'imm')
                    return `0x${Number(op.imm).toString(16)}`;
                  if (op.type === 'mem' && op.mem) {
                    const parts: string[] = [];
                    if (op.mem.base) parts.push(String(op.mem.base));
                    if (op.mem.index) {
                      const scaleStr = op.mem.scale ? ` * ${op.mem.scale}` : '';
                      parts.push(`${op.mem.index}${scaleStr}`);
                    }
                    if (op.mem.disp)
                      parts.push(`0x${Number(op.mem.disp).toString(16)}`);
                    return `[${parts.join(' + ')}]`;
                  }
                  return '';
                })
                .filter(Boolean)
            : [inst.opStr],
        })),
      })
    );

    const decompiler = new Decompiler();
    const entryBlock = decompilerBlocks[0];

    try {
      const funcName = this.state.selectedSymbol
        ? this.state.selectedSymbol.name
        : 'main';
      const result = decompiler.decompile(
        funcName,
        ['a0', 'a1'],
        decompilerBlocks,
        entryBlock?.id || ''
      );
      container.textContent = result.pseudocode;
    } catch (err) {
      container.textContent = `// Decompilation failed: ${err}`;
    }
  }

  private renderSidebarList() {
    this.sidebarList.innerHTML = '';
    const query = this.state.searchQuery.toLowerCase();

    const filtered = this.state.symbols.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        `0x${s.address.toString(16)}`.includes(query)
    );

    filtered.forEach((sym: Symbol) => {
      const item = document.createElement('div');
      item.className = 'sidebar-item';
      if (
        this.state.selectedSymbol &&
        this.state.selectedSymbol.address === sym.address
      ) {
        item.classList.add('active');
      }

      item.innerHTML = `
        <span class="sidebar-item-name">${sym.name}</span>
        <span class="sidebar-item-meta">Address: 0x${sym.address.toString(16).toUpperCase()} (${sym.type})</span>
      `;

      item.addEventListener('click', () => {
        this.selectSymbol(sym);
      });

      this.sidebarList.appendChild(item);
    });
  }

  private selectSymbol(sym: Symbol) {
    this.state.selectedSymbol = sym;

    // Re-highlight active item in list
    const items = this.sidebarList.querySelectorAll('.sidebar-item');
    const filtered = this.state.symbols.filter(
      (s) =>
        s.name.toLowerCase().includes(this.state.searchQuery.toLowerCase()) ||
        `0x${s.address.toString(16)}`.includes(
          this.state.searchQuery.toLowerCase()
        )
    );

    items.forEach((item, idx: number) => {
      const s = filtered[idx];
      if (s && s.address === sym.address) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Navigate viewers to the symbol's address
    if (this.assemblyView) {
      this.assemblyView.navigateToAddress(sym.address);
    }

    const executeSection = this.state.sections.find(
      (s: any) => s.flags.execute
    );
    if (executeSection && this.hexViewer) {
      const offset = sym.address - executeSection.virtualAddress;
      if (offset >= 0 && offset < this.state.binaryData.length) {
        this.hexViewer.setSelectedOffset(offset);
      }
    }

    // Refresh decompiler for this function scope
    this.updateDecompiler();
  }

  private loadSampleBinary() {
    // Generate mock ELF AMD64 executable bytes representing standard loop/branching logic
    const mockBytes = new Uint8Array([
      0x7f,
      0x45,
      0x4c,
      0x46, // ELF Magic
      0x02, // 64-bit
      0x01, // Little Endian
      0x01, // Version 1
      0x00, // OS ABI (System V)
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // Padding
      0x02,
      0x00, // Type (EXEC)
      0x3e,
      0x00, // Machine (AMD64)
      0x01,
      0x00,
      0x00,
      0x00, // Version
      0x00,
      0x10,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // Entry Point (0x1000)
      0x40,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // PH Offset (64)
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // SH Offset
      0x00,
      0x00,
      0x00,
      0x00,
      0x40,
      0x00,
      0x38,
      0x00, // Flags + Sizes

      // Instruction block at 0x1000
      0x90, // nop
      0x55, // push rbp
      0x48,
      0x89,
      0xe5, // mov rbp, rsp
      0x48,
      0x83,
      0xec,
      0x10, // sub rsp, 16
      0xc7,
      0x45,
      0xfc,
      0x00,
      0x00,
      0x00,
      0x00, // mov dword ptr [rbp - 4], 0
      0x83,
      0x7d,
      0xfc,
      0x0a, // cmp dword ptr [rbp - 4], 10
      0x7f,
      0x0c, // jg +12 (0x102b)
      0x8b,
      0x45,
      0xfc, // mov eax, [rbp - 4]
      0x01,
      0xc0, // add eax, eax
      0x89,
      0x45,
      0xf8, // mov [rbp - 8], eax
      0xff,
      0x45,
      0xfc, // inc dword ptr [rbp - 4]
      0xeb,
      0xeb, // jmp -21 (0x1013)
      0xb8,
      0x2a,
      0x00,
      0x00,
      0x00, // mov eax, 42
      0xc9, // leave
      0xc3, // ret

      // Pad remaining to look like a realistic raw dump
      ...Array.from({ length: 64 }, (_, i) => (i * 3) % 256),
    ]);

    // Create a mock File object
    const sampleBuffer = mockBytes.buffer;
    this.processBinary('sample_elf.bin', sampleBuffer);
  }
}

// Instantiate the coordinator on window load
window.addEventListener('DOMContentLoaded', () => {
  new ApplicationCoordinator();
});
