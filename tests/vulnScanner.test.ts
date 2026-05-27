import { describe, test, expect } from 'vitest';
import { VulnScanner } from '../src/analyzer/vulnScanner.js';
import { Instruction, Section, Symbol } from '../src/disassembler/types.js';

describe('VulnScanner Core Tests', () => {
  const scanner = new VulnScanner();

  test('detects unsafe C API calls in symbols list', () => {
    const symbols: Symbol[] = [
      { name: 'strcpy', address: 0x1020, binding: 'global', type: 'function' },
      { name: 'sprintf', address: 0x1040, binding: 'global', type: 'function' },
      { name: 'memset', address: 0x1060, binding: 'global', type: 'function' } // safe
    ];

    const matches = scanner.scan(new Uint8Array(0), [], symbols, [], { unsafeApi: true });
    expect(matches.length).toBe(2);
    expect(matches[0].category).toBe('unsafe_api');
    expect(matches[0].evidence).toBe('strcpy');
    expect(matches[1].evidence).toBe('sprintf');
  });

  test('detects unsafe API calls inside instructions', () => {
    const instructions: Instruction[] = [
      {
        address: 0x1000,
        bytes: new Uint8Array([0xe8, 0x00, 0x00, 0x00, 0x00]),
        mnemonic: 'call',
        opStr: 'strcpy',
        operands: [],
        size: 5
      },
      {
        address: 0x1005,
        bytes: new Uint8Array([0xe8, 0x00, 0x00, 0x00, 0x00]),
        mnemonic: 'call',
        opStr: 'printf', // not directly listed as high-severity unsafe API
        operands: [],
        size: 5
      }
    ];

    const matches = scanner.scan(new Uint8Array(0), [], [], instructions, { unsafeApi: true });
    expect(matches.length).toBe(1);
    expect(matches[0].category).toBe('unsafe_api');
    expect(matches[0].evidence).toBe('strcpy');
  });

  test('detects buffer overflow indicators (rep movs & large stack allocations)', () => {
    const instructions: Instruction[] = [
      {
        address: 0x2000,
        bytes: new Uint8Array([0xf3, 0xa4]),
        mnemonic: 'rep movsb',
        opStr: '',
        operands: [],
        size: 2
      },
      {
        address: 0x2002,
        bytes: new Uint8Array([0x48, 0x81, 0xec, 0x00, 0x10, 0x00, 0x00]),
        mnemonic: 'sub',
        opStr: 'rsp, 0x1000',
        operands: [
          { type: 'reg', reg: 'rsp' },
          { type: 'imm', imm: 4096 }
        ],
        size: 7
      }
    ];

    const matches = scanner.scan(new Uint8Array(0), [], [], instructions, { bufferOverflow: true });
    expect(matches.length).toBe(2);
    expect(matches[0].category).toBe('buffer_overflow');
    expect(matches[1].category).toBe('buffer_overflow');
    expect(matches[1].evidence).toContain('rsp, 0x1000');
  });

  test('detects integer overflow vulnerability patterns (idiv & unchecked loop/index arithmetic)', () => {
    const instructions: Instruction[] = [
      {
        address: 0x3000,
        bytes: new Uint8Array([0xf7, 0xf9]),
        mnemonic: 'idiv',
        opStr: 'ecx',
        operands: [{ type: 'reg', reg: 'ecx' }],
        size: 2
      },
      {
        address: 0x3002,
        bytes: new Uint8Array([0x48, 0x01, 0xde]),
        mnemonic: 'add',
        opStr: 'rsi, rbx',
        operands: [
          { type: 'reg', reg: 'rsi' },
          { type: 'reg', reg: 'rbx' }
        ],
        size: 3
      }
    ];

    const matches = scanner.scan(new Uint8Array(0), [], [], instructions, { integerOverflow: true });
    expect(matches.length).toBe(2);
    expect(matches[0].category).toBe('integer_overflow');
    expect(matches[0].evidence).toBe('idiv ecx');
    expect(matches[1].category).toBe('integer_overflow');
    expect(matches[1].evidence).toBe('add rsi, rbx');
  });
});
