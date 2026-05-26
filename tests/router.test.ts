import { describe, it, expect } from 'vitest';
import { DisassemblerRouter } from '../src/disassembler/router';

describe('DisassemblerRouter Unit Tests', () => {
  describe('DEX/Dalvik Routing', () => {
    it('should detect DEX/Dalvik format by magic bytes', () => {
      const data = new Uint8Array([0x64, 0x65, 0x78, 0x0a, 0x00, 0x00, 0x00, 0x00]);
      const arch = DisassemblerRouter.detectArchitecture(data);
      expect(arch).toBe('dex');
    });

    it('should route and disassemble DEX bytecode correctly', () => {
      const router = new DisassemblerRouter();
      // DEX magic followed by:
      // - 0x00 (nop)
      // - 0x0e (return-void)
      const data = new Uint8Array([
        0x64, 0x65, 0x78, 0x0a, // dex\n magic
        0x00,                   // nop
        0x0e,                   // return-void
      ]);
      const instructions = router.disassemble(data);

      expect(instructions.length).toBe(6);
      expect(instructions[0].mnemonic).toBe('db');
      expect(instructions[4].mnemonic).toBe('nop');
      expect(instructions[5].mnemonic).toBe('return-void');
    });
  });

  describe('Mach-O Routing', () => {
    // Helper to build thin Mach-O header
    function makeThinMacho(magic: number, isLE: boolean, cputype: number): Uint8Array {
      const header = new Uint8Array(28);
      const view = new DataView(header.buffer);
      view.setUint32(0, magic, isLE);
      view.setUint32(4, cputype, isLE);
      return header;
    }

    it('should route 64-bit LE Mach-O (x86_64)', () => {
      // magic: 0xfeedfacf (LE), cputype: CPU_TYPE_X86_64 (0x01000007)
      const data = makeThinMacho(0xfeedfacf, true, 0x01000007);
      const arch = DisassemblerRouter.detectArchitecture(data);
      expect(arch).toBe('x86_64');
    });

    it('should route 64-bit LE Mach-O (arm)', () => {
      // magic: 0xfeedfacf (LE), cputype: CPU_TYPE_ARM64 (0x0100000c)
      const data = makeThinMacho(0xfeedfacf, true, 0x0100000c);
      const arch = DisassemblerRouter.detectArchitecture(data);
      expect(arch).toBe('arm');
    });

    it('should route 32-bit BE Mach-O (x86_64 / i386)', () => {
      // magic: 0xfeedface (BE), cputype: CPU_TYPE_I386 (7)
      const data = makeThinMacho(0xfeedface, false, 7);
      const arch = DisassemblerRouter.detectArchitecture(data);
      expect(arch).toBe('x86_64');
    });

    it('should route 32-bit BE Mach-O (arm)', () => {
      // magic: 0xfeedface (BE), cputype: CPU_TYPE_ARM (12)
      const data = makeThinMacho(0xfeedface, false, 12);
      const arch = DisassemblerRouter.detectArchitecture(data);
      expect(arch).toBe('arm');
    });

    it('should route Fat BE Mach-O (x86_64)', () => {
      const data = new Uint8Array(28);
      const view = new DataView(data.buffer);
      // fat magic: 0xcafebabe (BE)
      view.setUint32(0, 0xcafebabe, false);
      // nfat: 1
      view.setUint32(4, 1, false);
      // cputype: CPU_TYPE_X86_64 (0x01000007)
      view.setUint32(8, 0x01000007, false);

      const arch = DisassemblerRouter.detectArchitecture(data);
      expect(arch).toBe('x86_64');
    });

    it('should route Fat LE Mach-O (arm)', () => {
      const data = new Uint8Array(28);
      const view = new DataView(data.buffer);
      // fat magic: 0xbebafeca (LE in bytes, so we write BE of 0xbebafeca to get bytes be ba fe ca)
      view.setUint32(0, 0xbebafeca, false);
      // nfat: 1
      view.setUint32(4, 1, true);
      // cputype: CPU_TYPE_ARM64 (0x0100000c)
      view.setUint32(8, 0x0100000c, true);

      const arch = DisassemblerRouter.detectArchitecture(data);
      expect(arch).toBe('arm');
    });
  });
});
