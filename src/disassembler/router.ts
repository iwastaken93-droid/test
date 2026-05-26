import { Instruction, Operand, OperandType, Section } from './types.js';
import {
  parseWasm,
  WasmModule,
  Instruction as WasmInstruction,
} from '../parser/wasm.js';

/**
 * Supported architectures.
 */
export type Architecture = 'x86_64' | 'arm' | 'wasm' | 'dex';

/**
 * Metadata configuration for disassembly.
 */
export interface DisassemblyMetadata {
  arch?: Architecture;
  baseAddress?: number;
  entryPoint?: number;
}

/**
 * Disassembler Router Engine.
 * Detects the binary architecture and disassembles code sections into structured Instruction objects.
 */
export class DisassemblerRouter {
  /**
   * Automatically detects the architecture of the given binary.
   */
  public static detectArchitecture(
    data: Uint8Array,
    metadata?: DisassemblyMetadata
  ): Architecture {
    if (metadata?.arch) {
      return metadata.arch;
    }

    // Detect DEX by magic bytes: dex\n
    if (
      data.length >= 4 &&
      data[0] === 0x64 &&
      data[1] === 0x65 &&
      data[2] === 0x78 &&
      data[3] === 0x0a
    ) {
      return 'dex';
    }

    // Detect WASM by magic bytes: \0asm
    if (
      data.length >= 4 &&
      data[0] === 0x00 &&
      data[1] === 0x61 &&
      data[2] === 0x73 &&
      data[3] === 0x6d
    ) {
      return 'wasm';
    }

    // Detect Mach-O Architecture
    if (data.length >= 4) {
      const magicLE = (data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)) >>> 0;
      const magicBE = ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;

      if (magicBE === 0xcafebabe || magicBE === 0xbebafeca) {
        // Fat/Universal binary
        const isFatBE = magicBE === 0xcafebabe;
        if (data.length >= 8) {
          const nfat = (isFatBE
            ? (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]
            : data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24)) >>> 0;
          
          let offset = 8;
          for (let i = 0; i < nfat; i++) {
            if (offset + 20 <= data.length) {
              const cputype = (isFatBE
                ? (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
                : data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
              
              if (cputype === 0x01000007 || cputype === 7) return 'x86_64';
              if (cputype === 0x0100000c || cputype === 12) return 'arm';
              offset += 20;
            }
          }
        }
      } else if (
        magicLE === 0xfeedfacf ||
        magicBE === 0xfeedfacf ||
        magicLE === 0xfeedface ||
        magicBE === 0xfeedface
      ) {
        const isLE = magicLE === 0xfeedface || magicLE === 0xfeedfacf;
        if (data.length >= 8) {
          const cputype = (isLE
            ? data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24)
            : (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0;
          
          if (cputype === 0x01000007 || cputype === 7) return 'x86_64';
          if (cputype === 0x0100000c || cputype === 12) return 'arm';
        }
      }
    }

    // Detect ELF Architecture
    if (
      data.length >= 64 &&
      data[0] === 0x7f &&
      data[1] === 0x45 &&
      data[2] === 0x4c &&
      data[3] === 0x46
    ) {
      const is64 = data[4] === 2;
      // e_machine is at offset 18 (2 bytes)
      const eMachine = data[18] | (data[19] << 8);
      if (eMachine === 62) return 'x86_64'; // EM_X86_64
      if (eMachine === 40 || eMachine === 183) return 'arm'; // EM_ARM or EM_AARCH64
    }

    // Detect PE Architecture
    if (data.length >= 64 && data[0] === 0x5a && data[1] === 0x4d) {
      // MZ
      const peOffset =
        data[0x3c] |
        (data[0x3d] << 8) |
        (data[0x3e] << 16) |
        (data[0x3f] << 24);
      if (peOffset + 24 <= data.length) {
        if (data[peOffset] === 0x50 && data[peOffset + 1] === 0x45) {
          // PE\0\0
          const machine = data[peOffset + 4] | (data[peOffset + 5] << 8);
          if (machine === 0x8664) return 'x86_64'; // IMAGE_FILE_MACHINE_AMD64
          if (machine === 0xaa64 || machine === 0x01c4) return 'arm'; // IMAGE_FILE_MACHINE_ARM64 / ARMNT
        }
      }
    }

    // Detect Mach-O Architecture
    const isMacho = (
      (data[0] === 0xcf && data[1] === 0xfa && data[2] === 0xed && data[3] === 0xfe) ||
      (data[0] === 0xfe && data[1] === 0xed && data[2] === 0xfa && data[3] === 0xcf) ||
      (data[0] === 0xce && data[1] === 0xfa && data[2] === 0xed && data[3] === 0xfe) ||
      (data[0] === 0xfe && data[1] === 0xed && data[2] === 0xfa && data[3] === 0xce)
    );
    if (isMacho) {
      const isLittleEndian = data[0] === 0xcf || data[0] === 0xce;
      let cputype = 0;
      if (isLittleEndian) {
        cputype = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
      } else {
        cputype = data[7] | (data[6] << 8) | (data[5] << 16) | (data[4] << 24);
      }
      const CPU_ARCH_ABI64 = 0x01000000;
      const CPU_TYPE_ARM = 12;
      const CPU_TYPE_ARM64 = CPU_TYPE_ARM | CPU_ARCH_ABI64;
      if (cputype === CPU_TYPE_ARM || cputype === CPU_TYPE_ARM64) {
        return 'arm';
      }
      return 'x86_64';
    }

    // Detect Mach-O Fat/Universal Architecture
    const isFat = (
      (data[0] === 0xca && data[1] === 0xfe && data[2] === 0xba && data[3] === 0xbe) ||
      (data[0] === 0xbe && data[1] === 0xba && data[2] === 0xfe && data[3] === 0xca)
    );
    if (isFat) {
      const isLittleEndian = data[0] === 0xbe;
      let cputype = 0;
      if (isLittleEndian) {
        cputype = data[8] | (data[9] << 8) | (data[10] << 16) | (data[11] << 24);
      } else {
        cputype = data[11] | (data[10] << 8) | (data[9] << 16) | (data[8] << 24);
      }
      const CPU_ARCH_ABI64 = 0x01000000;
      const CPU_TYPE_ARM = 12;
      const CPU_TYPE_ARM64 = CPU_TYPE_ARM | CPU_ARCH_ABI64;
      if (cputype === CPU_TYPE_ARM || cputype === CPU_TYPE_ARM64) {
        return 'arm';
      }
      return 'x86_64';
    }

    // Fallback default
    return 'x86_64';
  }

  /**
   * Disassembles a section of binary data.
   */
  public disassemble(
    data: Uint8Array,
    metadata?: DisassemblyMetadata
  ): Instruction[] {
    const arch = DisassemblerRouter.detectArchitecture(data, metadata);
    const baseAddress = metadata?.baseAddress ?? 0;

    switch (arch) {
      case 'wasm':
        return this.disassembleWasm(data);
      case 'arm':
        return this.disassembleArm(data, baseAddress);
      case 'dex':
        return this.disassembleDalvik(data, baseAddress);
      case 'x86_64':
      default:
        return this.disassembleX86(data, baseAddress);
    }
  }

  /**
   * WebAssembly Disassembly.
   */
  private disassembleWasm(data: Uint8Array): Instruction[] {
    try {
      const wasmModule = parseWasm(data);
      const instructions: Instruction[] = [];

      for (let i = 0; i < wasmModule.code.length; i++) {
        const body = wasmModule.code[i];
        let currentOffset = 0;

        for (let j = 0; j < body.instructions.length; j++) {
          const wasmInst = body.instructions[j];
          const nextInst = body.instructions[j + 1];
          const instSize = nextInst ? nextInst.offset - wasmInst.offset : 1;

          // Extract instruction bytes if available
          const instBytes = body.rawBytes.subarray(
            wasmInst.offset,
            Math.min(wasmInst.offset + instSize, body.rawBytes.length)
          );

          // Convert WASM operands
          const operands: Operand[] = [];
          let opStr = '';

          if (wasmInst.args !== undefined) {
            if (
              typeof wasmInst.args === 'number' ||
              typeof wasmInst.args === 'bigint'
            ) {
              operands.push({
                type: 'imm',
                imm: Number(wasmInst.args),
              });
              opStr = wasmInst.args.toString();
            } else if (Array.isArray(wasmInst.args)) {
              opStr = wasmInst.args.join(', ');
              wasmInst.args.forEach((arg: any) => {
                if (typeof arg === 'number') {
                  operands.push({ type: 'imm', imm: arg });
                }
              });
            } else if (
              typeof wasmInst.args === 'object' &&
              wasmInst.args !== null
            ) {
              opStr = JSON.stringify(wasmInst.args);
            } else {
              opStr = String(wasmInst.args);
            }
          }

          instructions.push({
            address: wasmInst.offset,
            bytes:
              instBytes.length > 0
                ? instBytes
                : new Uint8Array([wasmInst.opcode]),
            mnemonic: wasmInst.mnemonic,
            opStr,
            operands,
            size: instSize,
          });
        }
      }

      return instructions;
    } catch (e) {
      console.error(
        'Failed to parse WASM binary, falling back to mock WASM stream:',
        e
      );
      return this.generateFallbackWasm(data);
    }
  }

  /**
   * Fallback mock WASM generator for partial WASM binaries.
   */
  private generateFallbackWasm(data: Uint8Array): Instruction[] {
    const instructions: Instruction[] = [];
    let pos = 0;
    while (pos < data.length) {
      const opcode = data[pos];
      let mnemonic = 'unsupported';
      let size = 1;
      let opStr = '';
      let operands: Operand[] = [];

      // WASM Opcode Map Extension
      if (opcode === 0x00) {
        mnemonic = 'unreachable';
      } else if (opcode === 0x01) {
        mnemonic = 'nop';
      } else if (opcode === 0x02) {
        mnemonic = 'block';
        size = 2;
        opStr = `type: ${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x03) {
        mnemonic = 'loop';
        size = 2;
        opStr = `type: ${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x04) {
        mnemonic = 'if';
        size = 2;
        opStr = `type: ${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x05) {
        mnemonic = 'else';
      } else if (opcode === 0x0b) {
        mnemonic = 'end';
      } else if (opcode === 0x0c) {
        mnemonic = 'br';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x0d) {
        mnemonic = 'br_if';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x0f) {
        mnemonic = 'return';
      } else if (opcode === 0x10) {
        mnemonic = 'call';
        size = 2;
        opStr = `func_${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x11) {
        mnemonic = 'call_indirect';
        size = 3;
        opStr = `type_${data[pos + 1] || 0}, table_${data[pos + 2] || 0}`;
        operands = [
          { type: 'imm', imm: data[pos + 1] || 0 },
          { type: 'imm', imm: data[pos + 2] || 0 },
        ];
      } else if (opcode === 0x1a) {
        mnemonic = 'drop';
      } else if (opcode === 0x1b) {
        mnemonic = 'select';
      } else if (opcode === 0x20) {
        mnemonic = 'local.get';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x21) {
        mnemonic = 'local.set';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x22) {
        mnemonic = 'local.tee';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x23) {
        mnemonic = 'global.get';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x24) {
        mnemonic = 'global.set';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode >= 0x28 && opcode <= 0x3e) {
        // Loads and Stores
        const mnemonics: Record<number, string> = {
          0x28: 'i32.load',
          0x29: 'i64.load',
          0x2a: 'f32.load',
          0x2b: 'f64.load',
          0x2c: 'i32.load8_s',
          0x2d: 'i32.load8_u',
          0x2e: 'i32.load16_s',
          0x2f: 'i32.load16_u',
          0x30: 'i64.load8_s',
          0x31: 'i64.load8_u',
          0x32: 'i64.load16_s',
          0x33: 'i64.load16_u',
          0x34: 'i64.load32_s',
          0x35: 'i64.load32_u',
          0x36: 'i32.store',
          0x37: 'i64.store',
          0x38: 'f32.store',
          0x39: 'f64.store',
          0x3a: 'i32.store8',
          0x3b: 'i32.store16',
          0x3c: 'i64.store8',
          0x3d: 'i64.store16',
          0x3e: 'i64.store32',
        };
        mnemonic = mnemonics[opcode] || 'load_store';
        size = 3;
        const align = data[pos + 1] || 0;
        const offset = data[pos + 2] || 0;
        opStr = `align=${align} offset=${offset}`;
        operands = [
          { type: 'imm', imm: align },
          { type: 'imm', imm: offset },
        ];
      } else if (opcode === 0x41) {
        mnemonic = 'i32.const';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x42) {
        mnemonic = 'i64.const';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
        operands = [{ type: 'imm', imm: data[pos + 1] || 0 }];
      } else if (opcode === 0x43) {
        mnemonic = 'f32.const';
        size = 5;
        opStr = 'float';
      } else if (opcode === 0x44) {
        mnemonic = 'f64.const';
        size = 9;
        opStr = 'double';
      } else if (opcode >= 0x45 && opcode <= 0x66) {
        // Comparisons
        const cmpOps: Record<number, string> = {
          0x45: 'i32.eqz',
          0x46: 'i32.eq',
          0x47: 'i32.ne',
          0x48: 'i32.lt_s',
          0x49: 'i32.lt_u',
          0x4a: 'i32.gt_s',
          0x4b: 'i32.gt_u',
          0x4c: 'i32.le_s',
          0x4d: 'i32.le_u',
          0x4e: 'i32.ge_s',
          0x4f: 'i32.ge_u',
          0x50: 'i64.eqz',
          0x51: 'i64.eq',
          0x52: 'i64.ne',
          0x53: 'i64.lt_s',
          0x54: 'i64.lt_u',
          0x55: 'i64.gt_s',
          0x56: 'i64.gt_u',
          0x57: 'i64.le_s',
          0x58: 'i64.le_u',
          0x59: 'i64.ge_s',
          0x5a: 'i64.ge_u',
          0x5b: 'f32.eq',
          0x5c: 'f32.ne',
          0x5d: 'f32.lt',
          0x5e: 'f32.gt',
          0x5f: 'f32.le',
          0x60: 'f32.ge',
          0x61: 'f64.eq',
          0x62: 'f64.ne',
          0x63: 'f64.lt',
          0x64: 'f64.gt',
          0x65: 'f64.le',
          0x66: 'f64.ge',
        };
        mnemonic = cmpOps[opcode] || 'cmp';
      } else if (opcode >= 0x67 && opcode <= 0x78) {
        // i32 numeric
        const i32Ops: Record<number, string> = {
          0x67: 'i32.clz',
          0x68: 'i32.ctz',
          0x69: 'i32.popcnt',
          0x6a: 'i32.add',
          0x6b: 'i32.sub',
          0x6c: 'i32.mul',
          0x6d: 'i32.div_s',
          0x6e: 'i32.div_u',
          0x6f: 'i32.rem_s',
          0x70: 'i32.rem_u',
          0x71: 'i32.and',
          0x72: 'i32.or',
          0x73: 'i32.xor',
          0x74: 'i32.shl',
          0x75: 'i32.shr_s',
          0x76: 'i32.shr_u',
          0x77: 'i32.rotl',
          0x78: 'i32.rotr',
        };
        mnemonic = i32Ops[opcode] || 'i32.numeric';
      } else if (opcode === 0x7c) {
        mnemonic = 'f32.add';
      }

      if (pos + size > data.length) size = data.length - pos;

      const bytes = data.slice(pos, pos + size);
      instructions.push({
        address: pos,
        bytes,
        mnemonic,
        opStr,
        operands,
        size,
      });

      pos += size;
    }
    return instructions;
  }

  /**
   * Lightweight mock x86_64 disassembler.
   * Recognizes standard instructions and provides realistic fallback decoding.
   */
  private disassembleX86(data: Uint8Array, baseAddress: number): Instruction[] {
    const instructions: Instruction[] = [];
    const regs = [
      'rax',
      'rcx',
      'rdx',
      'rbx',
      'rsp',
      'rbp',
      'rsi',
      'rdi',
      'r8',
      'r9',
      'r10',
      'r11',
      'r12',
      'r13',
      'r14',
      'r15',
    ];

    let i = 0;
    while (i < data.length) {
      const addr = baseAddress + i;
      const b = data[i];
      let mnemonic = 'db';
      let opStr = `0x${b.toString(16).padStart(2, '0')}`;
      let size = 1;
      let operands: Operand[] = [];

      // Check for REX prefix (0x40 - 0x4f)
      const hasRex = b >= 0x40 && b <= 0x4f;
      const isRexW = hasRex && (b & 0x08) !== 0;
      const rexR = hasRex ? (b & 0x04) >> 2 : 0;
      const rexX = hasRex ? (b & 0x02) >> 1 : 0;
      const rexB = hasRex ? b & 0x01 : 0;

      const opIdx = hasRex ? i + 1 : i;

      if (opIdx < data.length) {
        let opcode = data[opIdx];
        let opSize = hasRex ? 2 : 1;

        // Multi-byte escape
        let isTwoByte = false;
        if (opcode === 0x0f && opIdx + 1 < data.length) {
          isTwoByte = true;
          opcode = data[opIdx + 1];
          opSize += 1;
        }

        const nextByteIdx = opIdx + (isTwoByte ? 2 : 1);

        if (!isTwoByte) {
          // NOP
          if (opcode === 0x90) {
            mnemonic = 'nop';
            opStr = '';
            size = opSize;
          }
          // RET
          else if (opcode === 0xc3) {
            mnemonic = 'ret';
            opStr = '';
            size = opSize;
          }
          // PUSH / POP register (0x50 - 0x5f)
          else if (opcode >= 0x50 && opcode <= 0x57) {
            const regId = opcode - 0x50 + (rexB << 3);
            mnemonic = 'push';
            const regName = regs[regId] || 'rax';
            opStr = regName;
            operands = [{ type: 'reg', reg: regName }];
            size = opSize;
          } else if (opcode >= 0x58 && opcode <= 0x5f) {
            const regId = opcode - 0x58 + (rexB << 3);
            mnemonic = 'pop';
            const regName = regs[regId] || 'rax';
            opStr = regName;
            operands = [{ type: 'reg', reg: regName }];
            size = opSize;
          }
          // PUSH immediate (0x68 / 0x6a)
          else if (opcode === 0x6a && nextByteIdx < data.length) {
            mnemonic = 'push';
            const imm = this.signExtend8(data[nextByteIdx]);
            opStr = `0x${imm.toString(16)}`;
            operands = [{ type: 'imm', imm }];
            size = opSize + 1;
          } else if (opcode === 0x68 && nextByteIdx + 3 < data.length) {
            mnemonic = 'push';
            const imm = this.readInt32LE(data, nextByteIdx);
            opStr = `0x${imm.toString(16)}`;
            operands = [{ type: 'imm', imm }];
            size = opSize + 4;
          }
          // JMP (0xeb for short, 0xe9 for near)
          else if (opcode === 0xeb && nextByteIdx < data.length) {
            mnemonic = 'jmp';
            const offset = this.signExtend8(data[nextByteIdx]);
            const dest = addr + opSize + 1 + offset;
            opStr = `0x${dest.toString(16)}`;
            operands = [{ type: 'imm', imm: dest }];
            size = opSize + 1;
          } else if (opcode === 0xe9 && nextByteIdx + 3 < data.length) {
            mnemonic = 'jmp';
            const offset = this.readInt32LE(data, nextByteIdx);
            const dest = addr + opSize + 4 + offset;
            opStr = `0x${dest.toString(16)}`;
            operands = [{ type: 'imm', imm: dest }];
            size = opSize + 4;
          }
          // Conditional Jumps (short 0x70 - 0x7f)
          else if (opcode >= 0x70 && opcode <= 0x7f && nextByteIdx < data.length) {
            const conds = [
              'jo', 'jno', 'jb', 'jae', 'je', 'jne', 'jbe', 'ja',
              'js', 'jns', 'jp', 'jnp', 'jl', 'jge', 'jle', 'jg'
            ];
            mnemonic = conds[opcode - 0x70];
            const offset = this.signExtend8(data[nextByteIdx]);
            const dest = addr + opSize + 1 + offset;
            opStr = `0x${dest.toString(16)}`;
            operands = [{ type: 'imm', imm: dest }];
            size = opSize + 1;
          }
          // CALL (0xe8)
          else if (opcode === 0xe8 && nextByteIdx + 3 < data.length) {
            mnemonic = 'call';
            const offset = this.readInt32LE(data, nextByteIdx);
            const dest = addr + opSize + 4 + offset;
            opStr = `0x${dest.toString(16)}`;
            operands = [{ type: 'imm', imm: dest }];
            size = opSize + 4;
          }
          // MOV immediate to reg/mem (0xc7 or 0xb8-0xbf or 0xc6)
          else if (opcode === 0xc7 && nextByteIdx + 1 < data.length) {
            const modrm = data[nextByteIdx];
            const mod = (modrm & 0xc0) >> 6;
            const rm = (modrm & 0x07) + (rexB << 3);
            mnemonic = 'mov';
            
            let dispSize = 0;
            if (mod === 1) dispSize = 1;
            else if (mod === 2) dispSize = 4;
            else if (mod === 0 && (rm & 7) === 5) dispSize = 4; // RIP-relative or disp32

            if (nextByteIdx + 1 + dispSize + 4 <= data.length) {
              const disp = dispSize === 1 ? this.signExtend8(data[nextByteIdx + 1]) : dispSize === 4 ? this.readInt32LE(data, nextByteIdx + 1) : 0;
              const imm = this.readInt32LE(data, nextByteIdx + 1 + dispSize);
              if (mod === 3) {
                const regName = regs[rm];
                opStr = `${regName}, 0x${imm.toString(16)}`;
                operands = [
                  { type: 'reg', reg: regName },
                  { type: 'imm', imm },
                ];
              } else {
                const baseRegName = regs[rm];
                const memStr = disp ? `${baseRegName} + 0x${disp.toString(16)}` : baseRegName;
                opStr = `qword ptr [${memStr}], 0x${imm.toString(16)}`;
                operands = [
                  { type: 'mem', mem: { base: baseRegName, disp } },
                  { type: 'imm', imm },
                ];
              }
              size = opSize + 1 + dispSize + 4;
            }
          } else if (opcode >= 0xb8 && opcode <= 0xbf) {
            const regId = opcode - 0xb8 + (rexB << 3);
            const regName = regs[regId];
            mnemonic = 'mov';
            if (isRexW && nextByteIdx + 7 < data.length) {
              const low = this.readInt32LE(data, nextByteIdx);
              const high = this.readInt32LE(data, nextByteIdx + 4);
              const val = BigInt(low) | (BigInt(high) << 32n);
              opStr = `${regName}, 0x${val.toString(16)}`;
              operands = [
                { type: 'reg', reg: regName },
                { type: 'imm', imm: val },
              ];
              size = opSize + 8;
            } else if (nextByteIdx + 3 < data.length) {
              const imm = this.readInt32LE(data, nextByteIdx);
              opStr = `${regName}, 0x${imm.toString(16)}`;
              operands = [
                { type: 'reg', reg: regName },
                { type: 'imm', imm },
              ];
              size = opSize + 4;
            }
          }
          // MOV reg, reg or reg, mem (0x89 or 0x8b)
          else if ((opcode === 0x89 || opcode === 0x8b) && nextByteIdx < data.length) {
            const modrm = data[nextByteIdx];
            const mod = (modrm & 0xc0) >> 6;
            const reg = ((modrm & 0x38) >> 3) + (rexR << 3);
            const rm = (modrm & 0x07) + (rexB << 3);
            mnemonic = 'mov';
            
            let dispSize = 0;
            if (mod === 1) dispSize = 1;
            else if (mod === 2) dispSize = 4;
            else if (mod === 0 && (rm & 7) === 5) dispSize = 4;

            if (nextByteIdx + 1 + dispSize <= data.length) {
              const disp = dispSize === 1 ? this.signExtend8(data[nextByteIdx + 1]) : dispSize === 4 ? this.readInt32LE(data, nextByteIdx + 1) : 0;
              const dstReg = regs[reg];
              const srcRM = regs[rm];

              if (mod === 3) {
                const dst = regs[opcode === 0x89 ? rm : reg];
                const src = regs[opcode === 0x89 ? reg : rm];
                opStr = `${dst}, ${src}`;
                operands = [
                  { type: 'reg', reg: dst },
                  { type: 'reg', reg: src },
                ];
              } else {
                const memStr = disp ? `${srcRM} + 0x${disp.toString(16)}` : srcRM;
                const dst = opcode === 0x89 ? `qword ptr [${memStr}]` : dstReg;
                const src = opcode === 0x89 ? dstReg : `qword ptr [${memStr}]`;
                opStr = `${dst}, ${src}`;
                operands = [
                  opcode === 0x89
                    ? { type: 'mem', mem: { base: srcRM, disp } }
                    : { type: 'reg', reg: dst as string },
                  opcode === 0x89
                    ? { type: 'reg', reg: src as string }
                    : { type: 'mem', mem: { base: srcRM, disp } },
                ];
              }
              size = opSize + 1 + dispSize;
            }
          }
          // ADD / SUB / CMP / XOR / AND / OR immediate (0x83 / 0x81)
          else if ((opcode === 0x83 || opcode === 0x81) && nextByteIdx < data.length) {
            const modrm = data[nextByteIdx];
            const mod = (modrm & 0xc0) >> 6;
            const opType = (modrm & 0x38) >> 3;
            const rm = (modrm & 0x07) + (rexB << 3);

            const opMap: Record<number, string> = {
              0: 'add',
              1: 'or',
              4: 'and',
              5: 'sub',
              6: 'xor',
              7: 'cmp',
            };
            mnemonic = opMap[opType] || 'db';

            if (mnemonic !== 'db') {
              const is8BitImm = opcode === 0x83;
              const immSize = is8BitImm ? 1 : 4;

              if (nextByteIdx + 1 + immSize <= data.length) {
                const imm = is8BitImm
                  ? this.signExtend8(data[nextByteIdx + 1])
                  : this.readInt32LE(data, nextByteIdx + 1);
                const regName = regs[rm];
                opStr = `${regName}, 0x${imm.toString(16)}`;
                operands = [
                  { type: 'reg', reg: regName },
                  { type: 'imm', imm },
                ];
                size = opSize + 1 + immSize;
              }
            }
          }
          // LEA (0x8d)
          else if (opcode === 0x8d && nextByteIdx < data.length) {
            const modrm = data[nextByteIdx];
            const mod = (modrm & 0xc0) >> 6;
            const reg = ((modrm & 0x38) >> 3) + (rexR << 3);
            const rm = (modrm & 0x07) + (rexB << 3);
            mnemonic = 'lea';

            let dispSize = 0;
            if (mod === 1) dispSize = 1;
            else if (mod === 2) dispSize = 4;
            else if (mod === 0 && (rm & 7) === 5) dispSize = 4;

            if (nextByteIdx + 1 + dispSize <= data.length) {
              const disp = dispSize === 1 ? this.signExtend8(data[nextByteIdx + 1]) : dispSize === 4 ? this.readInt32LE(data, nextByteIdx + 1) : 0;
              const dstReg = regs[reg];
              const srcRM = regs[rm];
              const memStr = disp ? `${srcRM} + 0x${disp.toString(16)}` : srcRM;
              opStr = `${dstReg}, [${memStr}]`;
              operands = [
                { type: 'reg', reg: dstReg },
                { type: 'mem', mem: { base: srcRM, disp } }
              ];
              size = opSize + 1 + dispSize;
            }
          }
          // XOR reg, reg (0x31 / 0x33)
          else if ((opcode === 0x31 || opcode === 0x33) && nextByteIdx < data.length) {
            const modrm = data[nextByteIdx];
            const reg = ((modrm & 0x38) >> 3) + (rexR << 3);
            const rm = (modrm & 0x07) + (rexB << 3);
            mnemonic = 'xor';
            const dst = regs[opcode === 0x31 ? rm : reg];
            const src = regs[opcode === 0x31 ? reg : rm];
            opStr = `${dst}, ${src}`;
            operands = [
              { type: 'reg', reg: dst },
              { type: 'reg', reg: src }
            ];
            size = opSize + 1;
          }
        } else {
          // Two-byte opcode escape (0x0f opcode ...)
          // Conditional Jumps near (0x0f 0x80 - 0x0f 0x8f)
          if (opcode >= 0x80 && opcode <= 0x8f && nextByteIdx + 3 < data.length) {
            const conds = [
              'jo', 'jno', 'jb', 'jae', 'je', 'jne', 'jbe', 'ja',
              'js', 'jns', 'jp', 'jnp', 'jl', 'jge', 'jle', 'jg'
            ];
            mnemonic = conds[opcode - 0x80];
            const offset = this.readInt32LE(data, nextByteIdx);
            const dest = addr + opSize + 4 + offset;
            opStr = `0x${dest.toString(16)}`;
            operands = [{ type: 'imm', imm: dest }];
            size = opSize + 4;
          }
          // IMUL (0x0f 0xaf)
          else if (opcode === 0xaf && nextByteIdx < data.length) {
            const modrm = data[nextByteIdx];
            const reg = ((modrm & 0x38) >> 3) + (rexR << 3);
            const rm = (modrm & 0x07) + (rexB << 3);
            mnemonic = 'imul';
            const dst = regs[reg];
            const src = regs[rm];
            opStr = `${dst}, ${src}`;
            operands = [
              { type: 'reg', reg: dst },
              { type: 'reg', reg: src }
            ];
            size = opSize + 1;
          }
          // MOVZX / MOVSX (0x0f 0xb6 / 0x0f 0xb7 / 0x0f 0xbe / 0x0f 0xbf)
          else if ((opcode === 0xb6 || opcode === 0xb7 || opcode === 0xbe || opcode === 0xbf) && nextByteIdx < data.length) {
            const modrm = data[nextByteIdx];
            const reg = ((modrm & 0x38) >> 3) + (rexR << 3);
            const rm = (modrm & 0x07) + (rexB << 3);
            mnemonic = opcode === 0xb6 || opcode === 0xb7 ? 'movzx' : 'movsx';
            const dst = regs[reg];
            const src = regs[rm];
            opStr = `${dst}, ${src}`;
            operands = [
              { type: 'reg', reg: dst },
              { type: 'reg', reg: src }
            ];
            size = opSize + 1;
          }
        }
      }

      // If instruction couldn't be decoded, format as raw DB
      if (mnemonic === 'db') {
        size = 1;
        opStr = `0x${b.toString(16).padStart(2, '0')}`;
      }

      const bytes = data.slice(i, i + size);
      instructions.push({
        address: addr,
        bytes,
        mnemonic,
        opStr,
        operands,
        size,
      });

      i += size;
    }

    return instructions;
  }

  /**
   * Lightweight mock ARM (AArch64) disassembler.
   * Decodes 32-bit instruction words.
   */
  private disassembleArm(data: Uint8Array, baseAddress: number): Instruction[] {
    const instructions: Instruction[] = [];
    const regs = Array.from({ length: 31 }, (_, idx) => `x${idx}`).concat([
      'xzr',
      'sp',
    ]);

    let i = 0;
    while (i + 3 < data.length) {
      const addr = baseAddress + i;
      const val =
        data[i] |
        (data[i + 1] << 8) |
        (data[i + 2] << 16) |
        (data[i + 3] << 24);
      let mnemonic = 'db';
      let opStr = `0x${val.toString(16).padStart(8, '0')}`;
      let operands: Operand[] = [];
      const size = 4;

      // NOP (0xd503201f)
      if (val === 0xd503201f) {
        mnemonic = 'nop';
        opStr = '';
      }
      // RET (typically 0xd65f03c0 for x30)
      else if ((val & 0xfffffc1f) === 0xd65f0000) {
        mnemonic = 'ret';
        const regId = (val >> 5) & 0x1f;
        const regName = regId === 30 ? '' : regs[regId];
        opStr = regName;
        operands = regName ? [{ type: 'reg', reg: regName }] : [];
      }
      // Branch / unconditional jump: b <offset> (0x14000000)
      else if ((val & 0xfc000000) === 0x14000000) {
        mnemonic = 'b';
        const offset = this.signExtend26(val & 0x03ffffff) * 4;
        const dest = addr + offset;
        opStr = `0x${dest.toString(16)}`;
        operands = [{ type: 'imm', imm: dest }];
      }
      // Branch with link / call: bl <offset> (0x94000000)
      else if ((val & 0xfc000000) === 0x94000000) {
        mnemonic = 'bl';
        const offset = this.signExtend26(val & 0x03ffffff) * 4;
        const dest = addr + offset;
        opStr = `0x${dest.toString(16)}`;
        operands = [{ type: 'imm', imm: dest }];
      }
      // Branch to register / indirect call
      else if ((val & 0xfffffc1f) === 0xd61f0000) {
        mnemonic = 'br';
        const regId = (val >> 5) & 0x1f;
        opStr = regs[regId];
        operands = [{ type: 'reg', reg: regs[regId] }];
      } else if ((val & 0xfffffc1f) === 0xd63f0000) {
        mnemonic = 'blr';
        const regId = (val >> 5) & 0x1f;
        opStr = regs[regId];
        operands = [{ type: 'reg', reg: regs[regId] }];
      }
      // Conditional Branch: b.cond (0x54000000)
      else if ((val & 0xff000010) === 0x54000000) {
        const cond = val & 0xf;
        const condNames = [
          'eq', 'ne', 'cs', 'cc', 'mi', 'pl', 'vs', 'vc',
          'hi', 'ls', 'ge', 'lt', 'gt', 'le', 'al', 'nv'
        ];
        mnemonic = `b.${condNames[cond] || 'cond'}`;
        const offset = this.signExtend19((val >> 5) & 0x7ffff) * 4;
        const dest = addr + offset;
        opStr = `0x${dest.toString(16)}`;
        operands = [{ type: 'imm', imm: dest }];
      }
      // CBZ (0x34000000) / CBNZ (0x35000000)
      else if ((val & 0xfe000000) === 0x34000000 || (val & 0xfe000000) === 0x35000000) {
        mnemonic = (val & 0x01000000) ? 'cbnz' : 'cbz';
        const rd = val & 0x1f;
        const offset = this.signExtend19((val >> 5) & 0x7ffff) * 4;
        const dest = addr + offset;
        const rdName = regs[rd] || 'x0';
        opStr = `${rdName}, 0x${dest.toString(16)}`;
        operands = [
          { type: 'reg', reg: rdName },
          { type: 'imm', imm: dest },
        ];
      }
      // ADD / SUB (immediate)
      else if (
        (val & 0xff000000) === 0x91000000 ||
        (val & 0xff000000) === 0xd1000000
      ) {
        mnemonic = val & 0x40000000 ? 'sub' : 'add';
        const rd = val & 0x1f;
        const rn = (val >> 5) & 0x1f;
        const imm = (val >> 10) & 0xfff;
        const rdName = regs[rd] || 'x0';
        const rnName = rn === 31 ? 'sp' : regs[rn];
        opStr = `${rdName}, ${rnName}, #0x${imm.toString(16)}`;
        operands = [
          { type: 'reg', reg: rdName },
          { type: 'reg', reg: rnName },
          { type: 'imm', imm },
        ];
      }
      // ADD / SUB (shifted register)
      else if (
        (val & 0xff200000) === 0x8b000000 ||
        (val & 0xff200000) === 0xcb000000
      ) {
        mnemonic = val & 0x40000000 ? 'sub' : 'add';
        const rd = val & 0x1f;
        const rn = (val >> 5) & 0x1f;
        const rm = (val >> 16) & 0x1f;
        const rdName = regs[rd] || 'x0';
        const rnName = regs[rn] || 'x0';
        const rmName = regs[rm] || 'x0';
        opStr = `${rdName}, ${rnName}, ${rmName}`;
        operands = [
          { type: 'reg', reg: rdName },
          { type: 'reg', reg: rnName },
          { type: 'reg', reg: rmName },
        ];
      }
      // CMP (subs immediate or register - mapped to cmp)
      else if ((val & 0xff000000) === 0xf1000000) {
        // subs immediate
        mnemonic = 'cmp';
        const rn = (val >> 5) & 0x1f;
        const imm = (val >> 10) & 0xfff;
        const rnName = rn === 31 ? 'sp' : regs[rn];
        opStr = `${rnName}, #0x${imm.toString(16)}`;
        operands = [
          { type: 'reg', reg: rnName },
          { type: 'imm', imm },
        ];
      }
      // MOVZ / MOVK / MOVN (Move immediate)
      else if ((val & 0xff800000) === 0xd2800000) {
        mnemonic = 'mov';
        const rd = val & 0x1f;
        const imm = (val >> 5) & 0xffff;
        const rdName = regs[rd] || 'x0';
        opStr = `${rdName}, #0x${imm.toString(16)}`;
        operands = [
          { type: 'reg', reg: rdName },
          { type: 'imm', imm },
        ];
      }
      // ORR / AND / EOR (register/move)
      else if ((val & 0xffc00000) === 0xaa000000 || (val & 0xffc00000) === 0x0a000000 || (val & 0xffc00000) === 0xca000000) {
        const op = (val >> 29) & 3;
        const rd = val & 0x1f;
        const rn = (val >> 5) & 0x1f;
        const rm = (val >> 16) & 0x1f;
        const rdName = regs[rd];
        const rnName = regs[rn];
        const rmName = regs[rm];

        if (op === 1 && rnName === 'xzr') {
          mnemonic = 'mov';
          opStr = `${rdName}, ${rmName}`;
          operands = [
            { type: 'reg', reg: rdName },
            { type: 'reg', reg: rmName },
          ];
        } else {
          mnemonic = op === 0 ? 'and' : op === 1 ? 'orr' : 'eor';
          opStr = `${rdName}, ${rnName}, ${rmName}`;
          operands = [
            { type: 'reg', reg: rdName },
            { type: 'reg', reg: rnName },
            { type: 'reg', reg: rmName },
          ];
        }
      }
      // LDR / STR (immediate offset / register offset)
      else if ((val & 0xffc00000) === 0xf9400000 || (val & 0xffc00000) === 0xf9000000) {
        mnemonic = (val & 0x00400000) ? 'ldr' : 'str';
        const rt = val & 0x1f;
        const rn = (val >> 5) & 0x1f;
        const imm = ((val >> 10) & 0xfff) * 8; // scaled by 8 for 64-bit load/store
        const rtName = regs[rt];
        const rnName = rn === 31 ? 'sp' : regs[rn];
        opStr = `${rtName}, [${rnName}, #0x${imm.toString(16)}]`;
        operands = [
          { type: 'reg', reg: rtName },
          { type: 'mem', mem: { base: rnName, disp: imm } }
        ];
      }
      // LDP / STP (register pair)
      else if ((val & 0xffc00000) === 0x29400000 || (val & 0xffc00000) === 0x29000000) {
        mnemonic = (val & 0x00400000) ? 'ldp' : 'stp';
        const rt1 = val & 0x1f;
        const rn = (val >> 5) & 0x1f;
        const rt2 = (val >> 10) & 0x1f;
        const imm = this.signExtend7((val >> 15) & 0x7f) * 8;
        const rt1Name = regs[rt1];
        const rt2Name = regs[rt2];
        const rnName = rn === 31 ? 'sp' : regs[rn];
        opStr = `${rt1Name}, ${rt2Name}, [${rnName}, #0x${imm.toString(16)}]`;
        operands = [
          { type: 'reg', reg: rt1Name },
          { type: 'reg', reg: rt2Name },
          { type: 'mem', mem: { base: rnName, disp: imm } }
        ];
      }
      // Stack simulation patterns: str reg, [sp, #-16]! / ldr reg, [sp], #16
      else if ((val & 0xffc003e0) === 0xf81f0ffe) {
        mnemonic = 'push';
        const rt = val & 0x1f;
        opStr = regs[rt];
        operands = [{ type: 'reg', reg: regs[rt] }];
      } else if ((val & 0xffc003e0) === 0xf84007fe) {
        mnemonic = 'pop';
        const rt = val & 0x1f;
        opStr = regs[rt];
        operands = [{ type: 'reg', reg: regs[rt] }];
      }

      const bytes = data.slice(i, i + size);
      instructions.push({
        address: addr,
        bytes,
        mnemonic,
        opStr,
        operands,
        size,
      });

      i += size;
    }

    // Capture any remaining bytes at the end
    while (i < data.length) {
      instructions.push({
        address: baseAddress + i,
        bytes: data.slice(i, i + 1),
        mnemonic: 'db',
        opStr: `0x${data[i].toString(16).padStart(2, '0')}`,
        operands: [],
        size: 1,
      });
      i++;
    }

    return instructions;
  }

  /**
   * Lightweight mock Dalvik bytecode disassembler.
   * Decodes DEX bytecode.
   */
  private disassembleDalvik(data: Uint8Array, baseAddress: number): Instruction[] {
    const instructions: Instruction[] = [];
    let i = 0;
    while (i < data.length) {
      const addr = baseAddress + i;
      const opcode = data[i];
      let mnemonic = 'nop';
      let opStr = '';
      let operands: Operand[] = [];
      let size = 1;

      if (opcode === 0x00) {
        mnemonic = 'nop';
        size = 1;
      } else if (opcode === 0x01) {
        mnemonic = 'move';
        const vA = data[i + 1] & 0xf;
        const vB = (data[i + 1] >> 4) & 0xf;
        opStr = `v${vA}, v${vB}`;
        operands = [{ type: 'reg', reg: `v${vA}` }, { type: 'reg', reg: `v${vB}` }];
        size = 2;
      } else if (opcode === 0x12) {
        mnemonic = 'const/4';
        const vA = data[i + 1] & 0xf;
        const B = (data[i + 1] >> 4) & 0xf;
        const val = B > 7 ? B - 16 : B;
        opStr = `v${vA}, #0x${val.toString(16)}`;
        operands = [{ type: 'reg', reg: `v${vA}` }, { type: 'imm', imm: val }];
        size = 2;
      } else if (opcode === 0x26) {
        mnemonic = 'fill-array-data';
        const vA = data[i + 1];
        const offset = data[i + 2] | (data[i + 3] << 8) | (data[i + 4] << 16) | (data[i + 5] << 24);
        opStr = `v${vA}, +0x${offset.toString(16)}`;
        operands = [{ type: 'reg', reg: `v${vA}` }, { type: 'imm', imm: offset }];
        size = 6;
      } else if (opcode === 0x28) {
        mnemonic = 'goto';
        const offset = this.signExtend8(data[i + 1]);
        opStr = `+0x${offset.toString(16)}`;
        operands = [{ type: 'imm', imm: addr + offset * 2 }];
        size = 2;
      } else if (opcode === 0x32) {
        mnemonic = 'if-eq';
        const vA = data[i + 1] & 0xf;
        const vB = (data[i + 1] >> 4) & 0xf;
        const offset = data[i + 2] | (data[i + 3] << 8);
        const signedOffset = offset > 0x7fff ? offset - 0x10000 : offset;
        opStr = `v${vA}, v${vB}, +0x${signedOffset.toString(16)}`;
        operands = [
          { type: 'reg', reg: `v${vA}` },
          { type: 'reg', reg: `v${vB}` },
          { type: 'imm', imm: addr + signedOffset * 2 }
        ];
        size = 4;
      } else if (opcode === 0x71 || opcode === 0x6e) {
        mnemonic = opcode === 0x71 ? 'invoke-static' : 'invoke-virtual';
        const count = (data[i + 1] >> 4) & 0xf;
        const methIdx = data[i + 2] | (data[i + 3] << 8);
        opStr = `{v0..v${Math.max(0, count - 1)}}, meth@0x${methIdx.toString(16)}`;
        operands = [{ type: 'imm', imm: methIdx }];
        size = 6;
      } else if (opcode === 0x0e) {
        mnemonic = 'return-void';
        size = 1;
      } else if (opcode === 0x13) {
        mnemonic = 'const/16';
        const vA = data[i + 1];
        const val = data[i + 2] | (data[i + 3] << 8);
        const signedVal = val > 0x7fff ? val - 0x10000 : val;
        opStr = `v${vA}, #0x${signedVal.toString(16)}`;
        operands = [{ type: 'reg', reg: `v${vA}` }, { type: 'imm', imm: signedVal }];
        size = 4;
      } else {
        mnemonic = `db`;
        opStr = `0x${opcode.toString(16).padStart(2, '0')}`;
        operands = [];
        size = 1;
      }

      if (i + size > data.length) {
        size = data.length - i;
        mnemonic = 'db';
        opStr = Array.from(data.subarray(i, i + size)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ');
      }

      instructions.push({
        address: addr,
        bytes: data.slice(i, i + size),
        mnemonic,
        opStr,
        operands,
        size,
      });

      i += size;
    }

    return instructions;
  }

  // Helpers
  private signExtend8(val: number): number {
    return (val << 24) >> 24;
  }

  private signExtend7(val: number): number {
    return val & 0x40 ? val | ~0x7f : val;
  }

  private signExtend19(val: number): number {
    return val & 0x40000 ? val | ~0x7ffff : val;
  }

  private signExtend26(val: number): number {
    return val & 0x2000000 ? val | ~0x3ffffff : val;
  }

  private readInt32LE(data: Uint8Array, offset: number): number {
    return (
      data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)
    );
  }
}
