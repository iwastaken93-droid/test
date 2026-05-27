import { describe, it, expect } from 'vitest';
import { diffBytes, diffInstructions } from '../src/analyzer/diff.js';
import { Instruction } from '../src/disassembler/types.js';

describe('Binary Diffing Engine Tests', () => {
  it('should compute byte diffs correctly', () => {
    const a = new Uint8Array([0x10, 0x20, 0x30, 0x40]);
    const b = new Uint8Array([0x10, 0x25, 0x30, 0x50, 0x60]);

    const result = diffBytes(a, b);

    expect(result.length).toBeGreaterThan(0);
    // First byte is 0x10, equal
    expect(result[0]).toEqual({
      type: 'equal',
      offset1: 0,
      offset2: 0,
      byte1: 0x10,
      byte2: 0x10,
    });
  });

  it('should compute instruction diffs correctly', () => {
    const instA: Instruction[] = [
      { address: 0x1000, bytes: new Uint8Array([0x90]), mnemonic: 'nop', opStr: '', size: 1, operands: [] },
      { address: 0x1001, bytes: new Uint8Array([0x50]), mnemonic: 'push', opStr: 'rax', size: 1, operands: [] },
    ];
    const instB: Instruction[] = [
      { address: 0x1000, bytes: new Uint8Array([0x90]), mnemonic: 'nop', opStr: '', size: 1, operands: [] },
      { address: 0x1001, bytes: new Uint8Array([0x51]), mnemonic: 'push', opStr: 'rcx', size: 1, operands: [] },
      { address: 0x1002, bytes: new Uint8Array([0x58]), mnemonic: 'pop', opStr: 'rax', size: 1, operands: [] },
    ];

    const result = diffInstructions(instA, instB);
    expect(result.length).toBe(3);

    expect(result[0].type).toBe('equal');
    expect(result[1].type).toBe('replace'); // push rax replaced with push rcx
    expect(result[2].type).toBe('insert');  // pop rax inserted
  });
});
