export interface Instruction {
  address: number;
  op: string; // e.g., 'MOV', 'ADD', 'SUB', 'CMP', 'JMP', 'JZ', 'JNZ', 'JE', 'JNE', 'RET', 'CALL'
  args: string[];
}

export interface BasicBlock {
  id: string; // unique identifier
  instructions: Instruction[];
  successors: string[]; // target block IDs
}

export interface DecompiledFunction {
  name: string;
  args: string[];
  pseudocode: string;
}

// AST Nodes for Structured Control Flow
type ASTNode =
  | { type: 'Block'; statements: ASTNode[] }
  | { type: 'Statement'; code: string }
  | { type: 'If'; condition: string; thenBranch: ASTNode; elseBranch?: ASTNode }
  | { type: 'While'; condition: string; body: ASTNode }
  | { type: 'Return'; value?: string };

export class Decompiler {
  /**
   * Decompiles a function represented by a set of basic blocks into structured pseudocode.
   * @param name The name of the function.
   * @param args The arguments of the function.
   * @param blocks List of all basic blocks belonging to the function.
   * @param entryBlockId The entry block ID of the function.
   */
  public decompile(
    name: string,
    args: string[],
    blocks: BasicBlock[],
    entryBlockId: string
  ): DecompiledFunction {
    const blockMap = new Map<string, BasicBlock>();
    for (const b of blocks) {
      blockMap.set(b.id, b);
    }

    const dominators = this.computeDominators(blockMap, entryBlockId);
    const loops = this.identifyLoops(blockMap, entryBlockId, dominators);
    const ast = this.structureBlocks(blockMap, entryBlockId, dominators, loops, new Set());
    const pseudocode = this.renderAST(ast, 0);

    // Format the function signature
    const signature = `function ${name}(${args.join(', ')}) {\n${pseudocode}\n}`;

    return {
      name,
      args,
      pseudocode: signature,
    };
  }

  /**
   * Computes the dominator relation for each block.
   * A node d dominates n (written d dom n) if every path from the entry node to n must go through d.
   */
  private computeDominators(
    blockMap: Map<string, BasicBlock>,
    entryBlockId: string
  ): Map<string, Set<string>> {
    const dominators = new Map<string, Set<string>>();
    const allBlockIds = Array.from(blockMap.keys());

    // Initialize dominators
    for (const id of allBlockIds) {
      if (id === entryBlockId) {
        dominators.set(id, new Set([entryBlockId]));
      } else {
        dominators.set(id, new Set(allBlockIds));
      }
    }

    // Iterative algorithm for dominators
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of allBlockIds) {
        if (id === entryBlockId) continue;

        // Find predecessors
        const predecessors = allBlockIds.filter((pId) =>
          blockMap.get(pId)!.successors.includes(id)
        );

        if (predecessors.length === 0) continue;

        // Intersection of dominators of all predecessors
        const firstPredDom = dominators.get(predecessors[0])!;
        const intersection = new Set<string>();
        for (const domId of firstPredDom) {
          let isDom = true;
          for (let i = 1; i < predecessors.length; i++) {
            if (!dominators.get(predecessors[i])!.has(domId)) {
              isDom = false;
              break;
            }
          }
          if (isDom) {
            intersection.add(domId);
          }
        }

        // Add self to dominator set
        intersection.add(id);

        const currentDom = dominators.get(id)!;
        if (currentDom.size !== intersection.size || ![...currentDom].every((x) => intersection.has(x))) {
          dominators.set(id, intersection);
          changed = true;
        }
      }
    }

    return dominators;
  }

  /**
   * Identifies loop structures (headers and back-edges).
   * A back-edge is an edge A -> B where B dominates A. B is the loop header.
   */
  private identifyLoops(
    blockMap: Map<string, BasicBlock>,
    entryBlockId: string,
    dominators: Map<string, Set<string>>
  ): Map<string, { header: string; latch: string; body: Set<string> }> {
    const loops = new Map<string, { header: string; latch: string; body: Set<string> }>();

    for (const [nodeId, block] of blockMap) {
      for (const succId of block.successors) {
        // Back-edge check: if succId dominates nodeId
        if (dominators.get(nodeId)?.has(succId)) {
          // Loop header is succId, latch (back-edge source) is nodeId
          const body = this.findLoopBody(blockMap, succId, nodeId);
          loops.set(succId, { header: succId, latch: nodeId, body });
        }
      }
    }

    return loops;
  }

  /**
   * Helper to find the set of nodes belonging to a loop body.
   */
  private findLoopBody(
    blockMap: Map<string, BasicBlock>,
    header: string,
    latch: string
  ): Set<string> {
    const body = new Set<string>([header, latch]);
    const stack: string[] = [latch];

    while (stack.length > 0) {
      const node = stack.pop()!;
      // Find predecessors of node
      const predecessors = Array.from(blockMap.keys()).filter((pId) =>
        blockMap.get(pId)!.successors.includes(node)
      );

      for (const pred of predecessors) {
        if (!body.has(pred)) {
          body.add(pred);
          stack.push(pred);
        }
      }
    }

    return body;
  }

  /**
   * Structures a control flow graph into a high-level AST.
   */
  private structureBlocks(
    blockMap: Map<string, BasicBlock>,
    currentId: string,
    dominators: Map<string, Set<string>>,
    loops: Map<string, { header: string; latch: string; body: Set<string> }>,
    visited: Set<string>
  ): ASTNode {
    if (visited.has(currentId)) {
      return { type: 'Block', statements: [] };
    }
    visited.add(currentId);

    const block = blockMap.get(currentId);
    if (!block) {
      return { type: 'Block', statements: [] };
    }

    const statements: ASTNode[] = [];

    // 1. Process instructions inside this basic block
    const blockStatements: ASTNode[] = [];
    let conditionCode = 'true';

    for (const inst of block.instructions) {
      if (['JZ', 'JNZ', 'JE', 'JNE'].includes(inst.op)) {
        // This is a conditional branch instruction.
        // We'll extract its logic for structuring.
        conditionCode = `${inst.op}(${inst.args.join(', ')})`;
      } else if (inst.op === 'RET') {
        blockStatements.push({ type: 'Return', value: inst.args.join(' ') });
      } else {
        // Standard instruction translation to pseudocode statement
        blockStatements.push({
          type: 'Statement',
          code: `${inst.op.toLowerCase()}(${inst.args.join(', ')})`,
        });
      }
    }
    statements.push(...blockStatements);

    // 2. Check if this is the start of a loop (loop header)
    if (loops.has(currentId)) {
      const loop = loops.get(currentId)!;
      // We clone visited to avoid loop body visiting affecting the rest of the flow
      const loopBodyVisited = new Set(visited);
      
      // Compute loop body AST
      // The loop body terminates or continues back to header.
      // We structure the loop body nodes by excluding nodes outside the loop body.
      const innerBlocks = Array.from(loop.body).filter(id => id !== currentId);
      
      let loopBodyAST: ASTNode;
      if (innerBlocks.length > 0) {
        // Start structuring from loop header's successor which is in the body
        const startBodyId = block.successors.find(s => loop.body.has(s) && s !== currentId);
        loopBodyAST = startBodyId 
          ? this.structureBlocks(blockMap, startBodyId, dominators, loops, loopBodyVisited)
          : { type: 'Block', statements: [] };
      } else {
        loopBodyAST = { type: 'Block', statements: [] };
      }

      // Nodes that are successors of loop latch or header but outside the loop body
      const outsideSuccessors = block.successors.filter(s => !loop.body.has(s));
      const nextId = outsideSuccessors[0];

      const loopNode: ASTNode = {
        type: 'While',
        condition: conditionCode || 'true',
        body: loopBodyAST,
      };
      statements.push(loopNode);

      if (nextId) {
        statements.push(this.structureBlocks(blockMap, nextId, dominators, loops, visited));
      }

      return { type: 'Block', statements };
    }

    // 3. Check for multi-way branch (e.g. IF-ELSE)
    if (block.successors.length === 2) {
      const [thenId, elseId] = block.successors;

      // Find where they merge (post-dominator/common descendant)
      // A simple heuristic is finding a block dominated by both or the first block visited next.
      // For now, let's recursively structure both branches.
      const thenVisited = new Set(visited);
      const elseVisited = new Set(visited);

      const thenBranch = this.structureBlocks(blockMap, thenId, dominators, loops, thenVisited);
      const elseBranch = this.structureBlocks(blockMap, elseId, dominators, loops, elseVisited);

      statements.push({
        type: 'If',
        condition: conditionCode,
        thenBranch,
        elseBranch,
      });

      return { type: 'Block', statements };
    }

    // 4. Sequential flow
    if (block.successors.length === 1) {
      const nextId = block.successors[0];
      statements.push(this.structureBlocks(blockMap, nextId, dominators, loops, visited));
    }

    return { type: 'Block', statements };
  }

  /**
   * Renders the control-flow AST into beautifully formatted pseudocode.
   */
  private renderAST(node: ASTNode, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    switch (node.type) {
      case 'Block':
        return node.statements
          .map((s) => this.renderAST(s, indentLevel))
          .filter((s) => s.trim().length > 0)
          .join('\n');

      case 'Statement':
        return `${indent}${node.code};`;

      case 'Return':
        return `${indent}return${node.value ? ` ${node.value}` : ''};`;

      case 'If': {
        const cond = node.condition;
        let result = `${indent}if (${cond}) {\n${this.renderAST(node.thenBranch, indentLevel + 1)}\n${indent}}`;
        if (node.elseBranch && node.elseBranch.type === 'Block' && node.elseBranch.statements.length > 0) {
          result += ` else {\n${this.renderAST(node.elseBranch, indentLevel + 1)}\n${indent}}`;
        }
        return result;
      }

      case 'While': {
        return `${indent}while (${node.condition}) {\n${this.renderAST(node.body, indentLevel + 1)}\n${indent}}`;
      }
    }
  }
}
