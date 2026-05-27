// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HexViewer } from '../src/ui/hexViewer.js';
import { AssemblyView } from '../src/ui/assemblyView.js';
import { CFGVisualizer } from '../src/ui/cfgVisualizer.js';
import type { Instruction } from '../src/disassembler/types.js';
import type { BasicBlock } from '../src/disassembler/cfg.js';

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
      return {
        clearRect: () => {},
        save: () => {},
        scale: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        closePath: () => {},
        restore: () => {},
        rect: () => {},
        fillText: () => {},
        measureText: () => ({ width: 10 }),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 1,
      } as any;
    }
    return null;
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

describe('HexViewer Unit Tests', () => {
  let container: HTMLElement;
  let data: Uint8Array;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    data = new Uint8Array([
      0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x3e, 0x00, 0x01, 0x00, 0x00, 0x00,
      0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should initialize and render layout with default options', () => {
    const viewer = new HexViewer(container, data);
    expect(container.classList.contains('hex-viewer-root')).toBe(true);
    expect(container.querySelector('.offset-col')).not.toBeNull();
    expect(container.querySelector('.hex-col')).not.toBeNull();
    expect(container.querySelector('.ascii-col')).not.toBeNull();

    // Check first offset element (should be 00000000)
    const firstOffset = container.querySelector('.offset-col')?.firstChild;
    expect(firstOffset?.textContent).toBe('00000000');

    // Check first byte element
    const firstByte = container.querySelector('.hex-byte');
    expect(firstByte?.textContent).toBe('7F');
  });

  it('should trigger hover and select actions and update styles', () => {
    const hoverSpy = vi.fn();
    const selectSpy = vi.fn();
    const viewer = new HexViewer(container, data, {
      onOffsetHover: hoverSpy,
      onOffsetSelect: selectSpy
    });

    const firstByte = container.querySelector('.hex-byte') as HTMLSpanElement;
    expect(firstByte).not.toBeNull();

    // Simulate mouseover/hover
    firstByte.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(hoverSpy).toHaveBeenCalledWith(0);
    expect(firstByte.classList.contains('hovered')).toBe(true);

    // Simulate click/select
    firstByte.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selectSpy).toHaveBeenCalledWith(0);
    expect(firstByte.classList.contains('selected')).toBe(true);

    // Simulate mouseleave
    const hexCol = container.querySelector('.hex-col') as HTMLDivElement;
    hexCol.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(hoverSpy).toHaveBeenCalledWith(null);
    expect(firstByte.classList.contains('hovered')).toBe(false);
  });

  it('should update data with setData', () => {
    const viewer = new HexViewer(container, data);
    const firstByte = container.querySelector('.hex-byte');
    expect(firstByte?.textContent).toBe('7F');

    const newData = new Uint8Array([0x90, 0xcc]);
    viewer.setData(newData);

    const updatedFirstByte = container.querySelector('.hex-byte');
    expect(updatedFirstByte?.textContent).toBe('90');
  });
});

describe('AssemblyView Unit Tests', () => {
  let container: HTMLElement;
  let instructions: Instruction[];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    instructions = [
      {
        address: 0x1000,
        bytes: new Uint8Array([0x55]),
        mnemonic: 'push',
        opStr: 'rbp',
        operands: [{ type: 'reg', reg: 'rbp', access: 'r' }],
        size: 1
      },
      {
        address: 0x1001,
        bytes: new Uint8Array([0x48, 0x89, 0xe5]),
        mnemonic: 'mov',
        opStr: 'rbp, rsp',
        operands: [
          { type: 'reg', reg: 'rbp', access: 'w' },
          { type: 'reg', reg: 'rsp', access: 'r' }
        ],
        size: 3
      }
    ];
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should render headers, controls, and instruction rows', () => {
    const view = new AssemblyView(container, instructions);
    expect(container.querySelector('.assembly-viewer-root')).not.toBeNull();
    expect(container.querySelector('.assembly-header')).not.toBeNull();
    expect(container.querySelector('.instructions-list')).not.toBeNull();

    const rows = container.querySelectorAll('.instruction-row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.row-mnemonic')?.textContent).toBe('push');
    expect(rows[0].querySelector('.row-operands')?.textContent).toBe('rbp');
  });

  it('should navigate to address and trigger select events', () => {
    const selectSpy = vi.fn();
    const view = new AssemblyView(container, instructions, {
      onInstructionSelect: selectSpy
    });

    view.navigateToAddress(0x1001);
    expect(selectSpy).toHaveBeenCalledWith(instructions[1]);

    const activeRow = container.querySelector('.instruction-row.active');
    expect(activeRow?.querySelector('.row-address')?.textContent).toContain('1001');
  });

  it('should handle comment adding and retrieval', () => {
    const commentSpy = vi.fn();
    const view = new AssemblyView(container, instructions, {
      onCommentChange: commentSpy
    });

    view.setComment(0x1000, 'Function prologue');
    expect(commentSpy).toHaveBeenCalledWith(0x1000, 'Function prologue');
    expect(view.getComment(0x1000)).toBe('Function prologue');

    const commentEl = container.querySelector('.row-comment[data-address="4096"]');
    expect(commentEl?.textContent).toBe('Function prologue');
    expect(commentEl?.classList.contains('has-comment')).toBe(true);
  });

  it('should support back and forward navigation history', () => {
    const view = new AssemblyView(container, instructions);
    view.navigateToAddress(0x1000);
    view.navigateToAddress(0x1001);

    view.goBack();
    const activeRowBack = container.querySelector('.instruction-row.active');
    expect(activeRowBack?.querySelector('.row-address')?.textContent).toContain('1000');

    view.goForward();
    const activeRowForward = container.querySelector('.instruction-row.active');
    expect(activeRowForward?.querySelector('.row-address')?.textContent).toContain('1001');
  });
});

describe('CFGVisualizer Unit Tests', () => {
  let container: HTMLElement;
  let blocks: BasicBlock[];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    blocks = [
      {
        id: 'block_0x1000',
        startAddress: 0x1000,
        endAddress: 0x1004,
        instructions: [
          {
            address: 0x1000,
            bytes: new Uint8Array([0x90]),
            mnemonic: 'nop',
            opStr: '',
            operands: [],
            size: 1
          }
        ],
        successors: ['block_0x1005']
      },
      {
        id: 'block_0x1005',
        startAddress: 0x1005,
        endAddress: 0x1006,
        instructions: [
          {
            address: 0x1005,
            bytes: new Uint8Array([0xc3]),
            mnemonic: 'ret',
            opStr: '',
            operands: [],
            size: 1
          }
        ],
        successors: []
      }
    ];
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should render SVG canvas and block nodes', () => {
    const visualizer = new CFGVisualizer(container, blocks);
    expect(container.classList.contains('cfg-visualizer-root')).toBe(true);
    expect(container.querySelector('.cfg-svg-canvas')).not.toBeNull();

    const blockCards = container.querySelectorAll('.cfg-block-card');
    expect(blockCards.length).toBe(2);
    expect(blockCards[0].textContent).toContain('block_0x1000');
  });

  it('should handle block selection and trigger onBlockSelect callback', () => {
    const selectSpy = vi.fn();
    const visualizer = new CFGVisualizer(container, blocks, {
      onBlockSelect: selectSpy
    });

    const blockCards = container.querySelectorAll('.cfg-block-card');
    const firstBlockCard = blockCards[0];

    // Click block to select
    firstBlockCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selectSpy).toHaveBeenCalledWith('block_0x1000');
    expect(firstBlockCard.classList.contains('selected')).toBe(true);

    // Click empty SVG canvas to clear selection
    const svgCanvas = container.querySelector('.cfg-svg-canvas') as SVGSVGElement;
    svgCanvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selectSpy).toHaveBeenCalledWith(null);
    expect(firstBlockCard.classList.contains('selected')).toBe(false);
  });

  it('should change layout modes when layout switch is triggered', () => {
    const visualizer = new CFGVisualizer(container, blocks, { layout: 'layered' });
    const layoutBtn = container.querySelector('.cfg-btn') as HTMLButtonElement;
    expect(layoutBtn).not.toBeNull();
    
    // Toggle layout from layered to stack
    layoutBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(layoutBtn.textContent).toContain('Stack');
  });
});
