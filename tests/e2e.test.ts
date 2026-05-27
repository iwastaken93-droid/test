// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApplicationCoordinator } from '../src/main.js';

// Define globally required mocks for JSDOM
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      const mockContext = {
        measureText: () => ({ width: 10 }),
      };
      return new Proxy(mockContext, {
        get(target, prop) {
          if (prop in target) {
            return (target as any)[prop];
          }
          if (typeof prop === 'string') {
            if (['strokeStyle', 'fillStyle', 'font', 'textAlign', 'textBaseline', 'shadowColor'].includes(prop)) {
              return '';
            }
            if (['lineWidth', 'globalAlpha', 'shadowBlur'].includes(prop)) {
              return 1;
            }
            return () => {};
          }
          return undefined;
        },
        set(target, prop, value) {
          return true;
        }
      }) as any;
    }
    return null;
  };
}

if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  (navigator as any).clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };
}

// Simple requestAnimationFrame mock since we are running in JSDOM/Vitest environment
const originalRAF = global.requestAnimationFrame;
beforeEach(() => {
  global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 0) as any;
  };
});
afterEach(() => {
  global.requestAnimationFrame = originalRAF;
});

describe('E2E DOM Integration Tests', () => {
  let appEl: HTMLElement;

  beforeEach(() => {
    // Create the container element that main.ts expects
    appEl = document.createElement('div');
    appEl.id = 'app';
    document.body.appendChild(appEl);
  });

  afterEach(() => {
    document.body.removeChild(appEl);
    vi.clearAllMocks();
  });

  it('should initialize the application coordinator and render structural UI layout', () => {
    // Instantiate coordinator
    const coordinator = new ApplicationCoordinator();

    // Verify layout structure
    const container = document.querySelector('.app-container');
    expect(container).not.toBeNull();

    const sidebar = document.querySelector('.sidebar');
    expect(sidebar).not.toBeNull();

    const header = document.querySelector('.header');
    expect(header).not.toBeNull();

    const mainContent = document.querySelector('.main-content');
    expect(mainContent).not.toBeNull();
  });

  it('should display the default sample binary details in the header status', () => {
    const coordinator = new ApplicationCoordinator();

    // The loadSampleBinary should have been called during constructor
    const statusFileName = document.getElementById('status-filename');
    expect(statusFileName).not.toBeNull();
    expect(statusFileName?.textContent).toBe('sample_elf.bin');

    const statusFileType = document.getElementById('status-filetype');
    expect(statusFileType).not.toBeNull();
    expect(statusFileType?.textContent).toBe('X86_64 / Format');
  });

  it('should switch panels when tab buttons are clicked', () => {
    const coordinator = new ApplicationCoordinator();

    // Get all panels
    const panelHex = document.getElementById('panel-hex');
    const panelAssembly = document.getElementById('panel-assembly');

    // Default active tab should show panel-hex and hide panel-assembly
    expect(panelHex?.style.display).toBe('block');
    expect(panelAssembly?.style.display).toBe('none');

    // Find the assembly tab button
    const tabButtons = document.querySelectorAll('.tab-btn');
    const assemblyBtn = Array.from(tabButtons).find(btn => (btn as HTMLButtonElement).dataset.tab === 'assembly') as HTMLButtonElement | undefined;
    expect(assemblyBtn).toBeDefined();

    // Simulate click
    assemblyBtn?.click();

    // After click, panel-assembly should be block and panel-hex should be none
    expect(panelHex?.style.display).toBe('none');
    expect(panelAssembly?.style.display).toBe('block');
  });

  it('should filter symbols list in the sidebar when search is typed', () => {
    const coordinator = new ApplicationCoordinator();

    const searchInput = document.getElementById('sidebar-search') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    // Simulate typing a search query that matches nothing
    searchInput.value = 'non_existent_symbol_xyz';
    searchInput.dispatchEvent(new Event('input'));

    // Check that the sidebar lists no items
    const sidebarList = document.getElementById('sidebar-list');
    expect(sidebarList?.querySelectorAll('.sidebar-item').length).toBe(0);
  });
});
