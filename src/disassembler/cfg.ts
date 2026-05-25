import { Instruction } from './types';

/**
 * Represents a single Basic Block in the Control Flow Graph.
 */
export interface BasicBlock {
  /** Unique identifier for the basic block (typically "block_0xAddress") */
  id: string;

  /** Virtual address of the first instruction in the block */
  startAddress: number;

  /** Virtual address of the end of the block (address of the last instruction + its size) */
  endAddress: number;

  /** Ordered list of instructions contained in this block */
  instructions: Instruction[];

  /** List of successor basic block IDs (edges in the control flow graph) */
  successors: string[];
}

/**
 * Helper to classify instruction mnemonics.
 */
export class InstructionClassifier {
  private static readonly RET_MNEMONICS = new Set([
    'ret', 'retn', 'retf', 'iret', 'sysret', 'ret_n', 'bx lr'
  ]);

  private static readonly CALL_MNEMONICS = new Set([
    'call', 'syscall', 'sysenter', 'bl', 'blx', 'jal', 'jalr'
  ]);

  private static readonly UNCOND_JUMP_MNEMONICS = new Set([
    'jmp', 'jmp.w', 'b', 'br', 'bx', 'jr', 'j'
  ]);

  private static readonly COND_JUMP_MNEMONICS = new Set([
    // x86 / x64
    'je', 'jne', 'jz', 'jnz', 'jg', 'jge', 'jl', 'jle', 'ja', 'jae', 'jb', 'jbe',
    'js', 'jns', 'jo', 'jno', 'jp', 'jnp', 'jc', 'jnc', 'loop', 'loopz', 'loope',
    'loopnz', 'loopne', 'jcxz', 'jecxz', 'rcxz',
    // ARM
    'beq', 'bne', 'bcs', 'bhs', 'bcc', 'blo', 'bmi', 'bpl', 'bvs', 'bvc', 'bhi',
    'bls', 'bge', 'blt', 'bgt', 'ble', 'cbz', 'cbnz', 'tbz', 'tbnz',
    // RISC-V / MIPS / General
    'beqz', 'bnez', 'bgez', 'blez', 'bltz', 'bgtz'
  ]);

  /**
   * Checks if an instruction mnemonic represents a return.
   */
  public static isReturn(mnemonic: string): boolean {
    const lower = mnemonic.toLowerCase().trim();
    return this.RET_MNEMONICS.has(lower);
  }

  /**
   * Checks if an instruction mnemonic represents a call.
   */
  public static isCall(mnemonic: string): boolean {
    const lower = mnemonic.toLowerCase().trim();
    return this.CALL_MNEMONICS.has(lower);
  }

  /**
   * Checks if an instruction mnemonic represents an unconditional jump.
   */
  public static isUnconditionalJump(mnemonic: string): boolean {
    const lower = mnemonic.toLowerCase().trim();
    return this.UNCOND_JUMP_MNEMONICS.has(lower);
  }

  /**
   * Checks if an instruction mnemonic represents a conditional jump.
   */
  public static isConditionalJump(mnemonic: string): boolean {
    const lower = mnemonic.toLowerCase().trim();
    // Prefix matches for branch instructions like b.eq, b.ne, etc.
    if (lower.startsWith('b.') || lower.startsWith('bne.') || lower.startsWith('beq.')) {
      return true;
    }
    return this.COND_JUMP_MNEMONICS.has(lower);
  }

  /**
   * Checks if an instruction is a control transfer instruction.
   */
  public static isControlTransfer(instruction: Instruction): boolean {
    const m = instruction.mnemonic;
    return this.isReturn(m) || this.isCall(m) || this.isUnconditionalJump(m) || this.isConditionalJump(m);
  }
}

/**
 * Attempts to extract the target address from a control transfer instruction.
 * Usually searches for immediate operands (imm).
 */
export function getBranchTarget(instruction: Instruction): number | null {
  if (!instruction.operands) return null;

  for (const op of instruction.operands) {
    if (op.type === 'imm' && op.imm !== undefined) {
      if (typeof op.imm === 'bigint') {
        return Number(op.imm);
      }
      return op.imm;
    }
  }

  return null;
}

/**
 * Formats a block ID based on its starting address.
 */
export function getBlockId(address: number): string {
  return `block_0x${address.toString(16).toLowerCase()}`;
}

/**
 * Splits a linear sequence of instructions into Basic Blocks (CFG).
 * 
 * @param instructions Sequence of instructions (ordered by virtual address).
 * @returns Array of BasicBlock objects representing the control flow graph.
 */
export function buildCFG(instructions: Instruction[]): BasicBlock[] {
  if (instructions.length === 0) {
    return [];
  }

  // 1. Sort instructions by address to ensure linear flow processing.
  const sortedInsts = [...instructions].sort((a, b) => a.address - b.address);

  // Helper map for quick instruction and address lookups.
  const addrToInstMap = new Map<number, Instruction>();
  for (const inst of sortedInsts) {
    addrToInstMap.set(inst.address, inst);
  }

  // 2. Identify leaders.
  // The first instruction is always a leader.
  const leaders = new Set<number>();
  leaders.add(sortedInsts[0].address);

  for (let i = 0; i < sortedInsts.length; i++) {
    const inst = sortedInsts[i];
    const isCtrl = InstructionClassifier.isControlTransfer(inst);

    if (isCtrl) {
      // The instruction following a control transfer is a leader.
      if (i + 1 < sortedInsts.length) {
        leaders.add(sortedInsts[i + 1].address);
      }

      // If it's a jump or branch (or call) and has a static target address, the target is a leader.
      if (!InstructionClassifier.isReturn(inst.mnemonic)) {
        const target = getBranchTarget(inst);
        if (target !== null && addrToInstMap.has(target)) {
          leaders.add(target);
        }
      }
    }
  }

  // 3. Create Basic Blocks.
  const blocks: BasicBlock[] = [];
  let currentBlockInsts: Instruction[] = [];

  for (const inst of sortedInsts) {
    // If we hit a leader and we have collected instructions, close the previous block.
    if (leaders.has(inst.address) && currentBlockInsts.length > 0) {
      blocks.push(createBlock(currentBlockInsts));
      currentBlockInsts = [];
    }
    currentBlockInsts.push(inst);
  }

  // Push the final block.
  if (currentBlockInsts.length > 0) {
    blocks.push(createBlock(currentBlockInsts));
  }

  // Helper function to build block object.
  function createBlock(insts: Instruction[]): BasicBlock {
    const first = insts[0];
    const last = insts[insts.length - 1];
    return {
      id: getBlockId(first.address),
      startAddress: first.address,
      endAddress: last.address + last.size,
      instructions: insts,
      successors: []
    };
  }

  // Helper to check if a block starting at targetAddress exists.
  const blockStartAddresses = new Set(blocks.map(b => b.startAddress));

  // 4. Determine successors (edges) for each block.
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const lastInst = block.instructions[block.instructions.length - 1];
    const m = lastInst.mnemonic;

    const isRet = InstructionClassifier.isReturn(m);
    const isUncond = InstructionClassifier.isUnconditionalJump(m);
    const isCond = InstructionClassifier.isConditionalJump(m);
    const isCall = InstructionClassifier.isCall(m);

    const target = getBranchTarget(lastInst);
    const hasValidTarget = target !== null && blockStartAddresses.has(target);

    // Fall-through block (next block in list if it's contiguous in execution/address layout).
    const nextBlock = i + 1 < blocks.length ? blocks[i + 1] : null;

    if (isRet) {
      // Returns have no successors.
      block.successors = [];
    } else if (isUncond) {
      // Unconditional jump goes only to target.
      if (hasValidTarget) {
        block.successors.push(getBlockId(target!));
      }
    } else if (isCond) {
      // Conditional jump goes to target OR falls through.
      if (hasValidTarget) {
        block.successors.push(getBlockId(target!));
      }
      if (nextBlock) {
        block.successors.push(nextBlock.id);
      }
    } else if (isCall) {
      // Call goes to target AND/OR falls through.
      // Usually, calls are treated as returning to the fall-through instruction,
      // but in some CFGs they might also link to the target function block.
      // We will link to both if target is within our block set.
      if (hasValidTarget) {
        block.successors.push(getBlockId(target!));
      }
      if (nextBlock) {
        block.successors.push(nextBlock.id);
      }
    } else {
      // Normal instruction at the end of the block falls through.
      if (nextBlock) {
        block.successors.push(nextBlock.id);
      }
    }
  }

  return blocks;
}
