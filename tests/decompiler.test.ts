import { describe, it, expect } from 'vitest';
import { Decompiler, BasicBlock } from '../src/disassembler/decompiler';

describe('Decompiler Core Analysis', () => {
  // Helper to construct basic blocks easily
  function createBlock(id: string, successors: string[]): BasicBlock {
    return {
      id,
      instructions: [],
      successors,
    };
  }

  it('should compute dominator tree correctly on a simple DAG with branches and merges', () => {
    // A simple CFG:
    //      A
    //     / \
    //    B   C
    //     \ /
    //      D
    //      |
    //      E
    const blocks = [
      createBlock('A', ['B', 'C']),
      createBlock('B', ['D']),
      createBlock('C', ['D']),
      createBlock('D', ['E']),
      createBlock('E', []),
    ];

    const blockMap = new Map<string, BasicBlock>();
    for (const b of blocks) {
      blockMap.set(b.id, b);
    }

    const decompiler = new Decompiler();
    // Accessing private method computeDominators
    const dominators: Map<string, Set<string>> = (
      decompiler as any
    ).computeDominators(blockMap, 'A');

    expect(dominators).toBeDefined();

    // Check dominator set sizes and contents
    // A is entry, so only A dominates it
    expect(dominators.get('A')).toEqual(new Set(['A']));

    // B's only path from entry is A -> B, dominated by A and B
    expect(dominators.get('B')).toEqual(new Set(['A', 'B']));

    // C's only path from entry is A -> C, dominated by A and C
    expect(dominators.get('C')).toEqual(new Set(['A', 'C']));

    // D has paths A -> B -> D and A -> C -> D. Common nodes in both paths are A and D.
    expect(dominators.get('D')).toEqual(new Set(['A', 'D']));

    // E's only path goes through D, dominated by A, D, and E
    expect(dominators.get('E')).toEqual(new Set(['A', 'D', 'E']));
  });

  it('should identify natural loops and loop bodies correctly', () => {
    // A CFG with a loop:
    //      Entry
    //        |
    //      Header <--- Latch
    //       /  \        |
    //    Body  Exit     |
    //      \____________|
    const blocks = [
      createBlock('Entry', ['Header']),
      createBlock('Header', ['Body', 'Exit']),
      createBlock('Body', ['Latch']),
      createBlock('Latch', ['Header']),
      createBlock('Exit', []),
    ];

    const blockMap = new Map<string, BasicBlock>();
    for (const b of blocks) {
      blockMap.set(b.id, b);
    }

    const decompiler = new Decompiler();
    const dominators: Map<string, Set<string>> = (
      decompiler as any
    ).computeDominators(blockMap, 'Entry');
    const loops = (decompiler as any).identifyLoops(
      blockMap,
      'Entry',
      dominators
    );

    expect(loops).toBeDefined();
    // Header should be identified as a loop header
    expect(loops.has('Header')).toBe(true);

    const loopInfo = loops.get('Header');
    expect(loopInfo).toBeDefined();
    expect(loopInfo.header).toBe('Header');
    expect(loopInfo.latch).toBe('Latch');

    // Loop body should contain Header, Body, Latch
    expect(loopInfo.body).toEqual(new Set(['Header', 'Body', 'Latch']));

    // Exit and Entry should not be part of the loop body
    expect(loopInfo.body.has('Entry')).toBe(false);
    expect(loopInfo.body.has('Exit')).toBe(false);
  });
});
