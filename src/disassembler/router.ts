import { Instruction, Operand, OperandType, Section } from './types.js';
import {
  parseWasm,
  WasmModule,
  Instruction as WasmInstruction,
} from '../parser/wasm.js';

/**
 * Supported architectures.
 */
export type Architecture = 'x86_64' | 'arm' | 'wasm';

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

      if (opcode === 0x00) {
        mnemonic = 'unreachable';
      } else if (opcode === 0x01) {
        mnemonic = 'nop';
      } else if (opcode === 0x02) {
        mnemonic = 'block';
        size = 2;
        opStr = `type: ${data[pos + 1] || 0}`;
      } else if (opcode === 0x03) {
        mnemonic = 'loop';
        size = 2;
        opStr = `type: ${data[pos + 1] || 0}`;
      } else if (opcode === 0x04) {
        mnemonic = 'if';
        size = 2;
        opStr = `type: ${data[pos + 1] || 0}`;
      } else if (opcode === 0x0c) {
        mnemonic = 'br';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
      } else if (opcode === 0x0d) {
        mnemonic = 'br_if';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
      } else if (opcode === 0x0f) {
        mnemonic = 'return';
      } else if (opcode === 0x10) {
        mnemonic = 'call';
        size = 2;
        opStr = `func_${data[pos + 1] || 0}`;
      } else if (opcode === 0x1a) {
        mnemonic = 'drop';
      } else if (opcode === 0x1b) {
        mnemonic = 'select';
      } else if (opcode === 0x20) {
        mnemonic = 'local.get';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
      } else if (opcode === 0x21) {
        mnemonic = 'local.set';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
      } else if (opcode === 0x22) {
        mnemonic = 'local.tee';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
      } else if (opcode === 0x23) {
        mnemonic = 'global.get';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
      } else if (opcode === 0x24) {
        mnemonic = 'global.set';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
      } else if (opcode === 0x41) {
        mnemonic = 'i32.const';
        size = 2;
        opStr = `${data[pos + 1] || 0}`;
      } else if (opcode === 0x6a) {
        mnemonic = 'i32.add';
      } else if (opcode === 0x6b) {
        mnemonic = 'i32.sub';
      } else if (opcode === 0x6c) {
        mnemonic = 'i32.mul';
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
        operands: opStr ? [{ type: 'imm', imm: data[pos + 1] || 0 }] : [],
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
        const opcode = data[opIdx];

        // NOP
        if (opcode === 0x90) {
          mnemonic = 'nop';
          opStr = '';
          size = hasRex ? 2 : 1;
        }
        // RET
        else if (opcode === 0xc3) {
          mnemonic = 'ret';
          opStr = '';
          size = hasRex ? 2 : 1;
        }
        // PUSH (0x50 - 0x57) / POP (0x58 - 0x5f)
        else if (opcode >= 0x50 && opcode <= 0x57) {
          const regId = opcode - 0x50 + (rexB << 3);
          mnemonic = 'push';
          const regName = regs[regId] || 'rax';
          opStr = regName;
          operands = [{ type: 'reg', reg: regName }];
          size = hasRex ? 2 : 1;
        } else if (opcode >= 0x58 && opcode <= 0x5f) {
          const regId = opcode - 0x58 + (rexB << 3);
          mnemonic = 'pop';
          const regName = regs[regId] || 'rax';
          opStr = regName;
          operands = [{ type: 'reg', reg: regName }];
          size = hasRex ? 2 : 1;
        }
        // JMP (0xeb for short, 0xe9 for near)
        else if (opcode === 0xeb && opIdx + 1 < data.length) {
          mnemonic = 'jmp';
          const offset = this.signExtend8(data[opIdx + 1]);
          const dest = addr + (hasRex ? 3 : 2) + offset;
          opStr = `0x${dest.toString(16)}`;
          operands = [{ type: 'imm', imm: dest }];
          size = (hasRex ? 2 : 1) + 1;
        } else if (opcode === 0xe9 && opIdx + 4 < data.length) {
          mnemonic = 'jmp';
          const offset = this.readInt32LE(data, opIdx + 1);
          const dest = addr + (hasRex ? 6 : 5) + offset;
          opStr = `0x${dest.toString(16)}`;
          operands = [{ type: 'imm', imm: dest }];
          size = (hasRex ? 2 : 1) + 4;
        }
        // JE (0x74 for short, 0x0f 0x84 for near)
        else if (opcode === 0x74 && opIdx + 1 < data.length) {
          mnemonic = 'je';
          const offset = this.signExtend8(data[opIdx + 1]);
          const dest = addr + (hasRex ? 3 : 2) + offset;
          opStr = `0x${dest.toString(16)}`;
          operands = [{ type: 'imm', imm: dest }];
          size = (hasRex ? 2 : 1) + 1;
        } else if (
          opcode === 0x0f &&
          opIdx + 5 < data.length &&
          data[opIdx + 1] === 0x84
        ) {
          mnemonic = 'je';
          const offset = this.readInt32LE(data, opIdx + 2);
          const dest = addr + (hasRex ? 7 : 6) + offset;
          opStr = `0x${dest.toString(16)}`;
          operands = [{ type: 'imm', imm: dest }];
          size = (hasRex ? 2 : 1) + 5;
        }
        // CALL (0xe8)
        else if (opcode === 0xe8 && opIdx + 4 < data.length) {
          mnemonic = 'call';
          const offset = this.readInt32LE(data, opIdx + 1);
          const dest = addr + (hasRex ? 6 : 5) + offset;
          opStr = `0x${dest.toString(16)}`;
          operands = [{ type: 'imm', imm: dest }];
          size = (hasRex ? 2 : 1) + 4;
        }
        // MOV immediate (0xc7 or 0xb8-0xbf)
        else if (opcode === 0xc7 && opIdx + 5 < data.length) {
          // mov [reg], imm32 or mov reg, imm32
          const modrm = data[opIdx + 1];
          const mod = (modrm & 0xc0) >> 6;
          const reg = (modrm & 0x38) >> 3;
          const rm = (modrm & 0x07) + (rexB << 3);
          const imm = this.readInt32LE(data, opIdx + 2);
          mnemonic = 'mov';

          if (mod === 3) {
            const regName = regs[rm];
            opStr = `${regName}, 0x${imm.toString(16)}`;
            operands = [
              { type: 'reg', reg: regName },
              { type: 'imm', imm },
            ];
          } else {
            opStr = `qword ptr [${regs[rm]}], 0x${imm.toString(16)}`;
            operands = [
              { type: 'mem', mem: { base: regs[rm] } },
              { type: 'imm', imm },
            ];
          }
          size = (hasRex ? 2 : 1) + 5;
        } else if (opcode >= 0xb8 && opcode <= 0xbf) {
          // mov reg, imm
          const regId = opcode - 0xb8 + (rexB << 3);
          const regName = regs[regId];
          mnemonic = 'mov';
          if (isRexW && opIdx + 8 < data.length) {
            const low = this.readInt32LE(data, opIdx + 1);
            const high = this.readInt32LE(data, opIdx + 5);
            const val = BigInt(low) | (BigInt(high) << 32n);
            opStr = `${regName}, 0x${val.toString(16)}`;
            operands = [
              { type: 'reg', reg: regName },
              { type: 'imm', imm: val },
            ];
            size = (hasRex ? 2 : 1) + 8;
          } else if (opIdx + 4 < data.length) {
            const imm = this.readInt32LE(data, opIdx + 1);
            opStr = `${regName}, 0x${imm.toString(16)}`;
            operands = [
              { type: 'reg', reg: regName },
              { type: 'imm', imm },
            ];
            size = (hasRex ? 2 : 1) + 4;
          }
        }
        // MOV reg, reg (0x89 or 0x8b)
        else if (
          (opcode === 0x89 || opcode === 0x8b) &&
          opIdx + 1 < data.length
        ) {
          const modrm = data[opIdx + 1];
          const mod = (modrm & 0xc0) >> 6;
          const reg = ((modrm & 0x38) >> 3) + (rexR << 3);
          const rm = (modrm & 0x07) + (rexB << 3);
          mnemonic = 'mov';
          size = (hasRex ? 2 : 1) + 1;

          if (mod === 3) {
            const dst = regs[opcode === 0x89 ? rm : reg];
            const src = regs[opcode === 0x89 ? reg : rm];
            opStr = `${dst}, ${src}`;
            operands = [
              { type: 'reg', reg: dst },
              { type: 'reg', reg: src },
            ];
          } else {
            // Memory addressing mock representation
            const dst = opcode === 0x89 ? `qword ptr [${regs[rm]}]` : regs[reg];
            const src = opcode === 0x89 ? regs[reg] : `qword ptr [${regs[rm]}]`;
            opStr = `${dst}, ${src}`;
            operands = [
              opcode === 0x89
                ? { type: 'mem', mem: { base: regs[rm] } }
                : { type: 'reg', reg: dst as string },
              opcode === 0x89
                ? { type: 'reg', reg: src as string }
                : { type: 'mem', mem: { base: regs[rm] } },
            ];
          }
        }
        // ADD / SUB / CMP immediate (0x83 / 0x81)
        else if (
          (opcode === 0x83 || opcode === 0x81) &&
          opIdx + 1 < data.length
        ) {
          const modrm = data[opIdx + 1];
          const mod = (modrm & 0xc0) >> 6;
          const opType = (modrm & 0x38) >> 3;
          const rm = (modrm & 0x07) + (rexB << 3);

          if (opType === 0) mnemonic = 'add';
          else if (opType === 5) mnemonic = 'sub';
          else if (opType === 7) mnemonic = 'cmp';

          if (mnemonic !== 'db') {
            const is8BitImm = opcode === 0x83;
            const immSize = is8BitImm ? 1 : 4;

            if (opIdx + 1 + immSize < data.length) {
              const imm = is8BitImm
                ? this.signExtend8(data[opIdx + 2])
                : this.readInt32LE(data, opIdx + 2);
              const regName = regs[rm];
              opStr = `${regName}, 0x${imm.toString(16)}`;
              operands = [
                { type: 'reg', reg: regName },
                { type: 'imm', imm },
              ];
              size = (hasRex ? 2 : 1) + 1 + immSize;
            }
          }
        }
      }

      // If instruction couldn't be decoded or went out of bounds, format as raw DB or simple mock instruction sequence
      if (mnemonic === 'db') {
        // Look ahead to see if we can aggregate or keep as db
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
          'eq',
          'ne',
          'cs',
          'cc',
          'mi',
          'pl',
          'vs',
          'vc',
          'hi',
          'ls',
          'ge',
          'lt',
          'gt',
          'le',
          'al',
          'nv',
        ];
        mnemonic = `b.${condNames[cond] || 'cond'}`;
        const offset = this.signExtend19((val >> 5) & 0x7ffff) * 4;
        const dest = addr + offset;
        opStr = `0x${dest.toString(16)}`;
        operands = [{ type: 'imm', imm: dest }];
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
      // ORR (register/move)
      else if ((val & 0xffe00000) === 0xaa000000) {
        const rd = val & 0x1f;
        const rn = (val >> 5) & 0x1f;
        const rm = (val >> 16) & 0x1f;
        const rdName = regs[rd];
        const rnName = regs[rn];
        const rmName = regs[rm];

        if (rnName === 'xzr') {
          mnemonic = 'mov';
          opStr = `${rdName}, ${rmName}`;
          operands = [
            { type: 'reg', reg: rdName },
            { type: 'reg', reg: rmName },
          ];
        } else {
          mnemonic = 'orr';
          opStr = `${rdName}, ${rnName}, ${rmName}`;
          operands = [
            { type: 'reg', reg: rdName },
            { type: 'reg', reg: rnName },
            { type: 'reg', reg: rmName },
          ];
        }
      }
      // Stack simulation patterns: str reg, [sp, #-16]! / ldr reg, [sp], #16
      // In AArch64 SP = 31 (but regs[31] is 'xzr', sp is explicitly regs[32] / hand-crafted)
      else if ((val & 0xffc003e0) === 0xf81f0ffe) {
        // str with pre-index sp
        mnemonic = 'push';
        const rt = val & 0x1f;
        opStr = regs[rt];
        operands = [{ type: 'reg', reg: regs[rt] }];
      } else if ((val & 0xffc003e0) === 0xf84007fe) {
        // ldr with post-index sp
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

  // Helpers
  private signExtend8(val: number): number {
    return (val << 24) >> 24;
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
