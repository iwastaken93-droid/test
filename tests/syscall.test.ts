import { describe, it, expect } from 'vitest';
import { Emulator } from '../src/emulator/emulator.js';
import { SyscallHandler } from '../src/emulator/syscall.js';
import { Instruction } from '../src/disassembler/types.js';

describe('Syscall and Windows API Emulation Tests', () => {
  it('should emulate Linux sys_write to stdout', () => {
    const emu = new Emulator();
    const handler = new SyscallHandler();
    emu.syscallHandler = handler;

    // Load custom text into memory
    const message = "Hello from Emulator!";
    const msgAddr = 0x5000n;
    const encoder = new TextEncoder();
    const msgBytes = encoder.encode(message);
    
    emu.memory.map(msgAddr, msgBytes.length, 'data');
    emu.memory.writeBuffer(msgAddr, msgBytes);

    // Setup registers for sys_write
    emu.cpu.write('rax', 1n); // sys_write syscall number
    emu.cpu.write('rdi', 1n); // fd = stdout
    emu.cpu.write('rsi', msgAddr); // buf ptr
    emu.cpu.write('rdx', BigInt(msgBytes.length)); // count

    // Set up syscall instruction
    const inst: Instruction = {
      address: 0x1000,
      mnemonic: 'syscall',
      opStr: '',
      size: 2,
    };
    emu.loadInstructions([inst]);
    emu.cpu.write('rip', 0x1000n);

    // Step the emulator
    const res = emu.step();
    expect(res.success).toBe(true);
    expect(emu.cpu.read('rax')).toBe(BigInt(msgBytes.length));
    expect(handler.context.stdout).toBe(message);
  });

  it('should emulate Linux sys_exit and halt the emulator', () => {
    const emu = new Emulator();
    const handler = new SyscallHandler();
    emu.syscallHandler = handler;

    emu.cpu.write('rax', 60n); // sys_exit syscall number
    emu.cpu.write('rdi', 123n); // exit status

    const inst: Instruction = {
      address: 0x1000,
      mnemonic: 'syscall',
      opStr: '',
      size: 2,
    };
    emu.loadInstructions([inst]);
    emu.cpu.write('rip', 0x1000n);

    const res = emu.step();
    expect(res.success).toBe(true);
    expect(res.halted).toBe(true);
    expect(handler.context.exitCode).toBe(123);
  });

  it('should emulate Linux sys_mmap to map memory', () => {
    const emu = new Emulator();
    const handler = new SyscallHandler();
    emu.syscallHandler = handler;

    emu.cpu.write('rax', 9n); // sys_mmap syscall number
    emu.cpu.write('rdi', 0n); // addr = 0 (auto-allocated)
    emu.cpu.write('rsi', 4096n); // length = 4096
    emu.cpu.write('rdx', 3n); // prot = PROT_READ (1) | PROT_WRITE (2)

    const inst: Instruction = {
      address: 0x1000,
      mnemonic: 'syscall',
      opStr: '',
      size: 2,
    };
    emu.loadInstructions([inst]);
    emu.cpu.write('rip', 0x1000n);

    const res = emu.step();
    expect(res.success).toBe(true);
    
    const allocatedAddr = emu.cpu.read('rax');
    expect(allocatedAddr).toBeGreaterThan(0n);

    // Test writing to the newly mapped memory
    emu.memory.write32(allocatedAddr, 0xdeadbeef);
    expect(emu.memory.read32(allocatedAddr)).toBe(0xdeadbeef);
  });

  it('should hook and emulate Windows VirtualAlloc via direct calls', () => {
    const emu = new Emulator();
    const handler = new SyscallHandler();
    emu.syscallHandler = handler;

    // Retrieve hook address for VirtualAlloc
    const vaAddr = emu.syscallHandler.registerWindowsHook('VirtualAlloc', (emu) => {
      // Stub already registered in constructor, let's just trigger it.
    });
    // Actually the constructor registers VirtualAlloc. Let's find its address.
    const hookAddr = (handler as any).winHookNames.get('VirtualAlloc');
    expect(hookAddr).toBeDefined();

    // Call VirtualAlloc(0, 8192, MEM_COMMIT, PAGE_READWRITE)
    // MS x64 calling convention: rcx, rdx, r8, r9
    emu.cpu.write('rcx', 0n); // lpAddress
    emu.cpu.write('rdx', 8192n); // dwSize
    emu.cpu.write('r8', 0x1000n); // flAllocationType
    emu.cpu.write('r9', 0x04n); // flProtect = PAGE_READWRITE

    // Setup stack to simulate a call instruction
    const nextRip = 0x1005n;
    let rsp = emu.cpu.read('rsp');
    rsp -= 8n;
    emu.cpu.write('rsp', rsp);
    emu.memory.write64(rsp, nextRip);

    // Set RIP to the hook address
    emu.cpu.write('rip', hookAddr);

    // Step the emulator (it will execute the hook and simulate 'ret')
    const res = emu.step();
    expect(res.success).toBe(true);

    const allocatedAddr = emu.cpu.read('rax');
    expect(allocatedAddr).toBeGreaterThan(0n);
    expect(emu.cpu.read('rip')).toBe(nextRip); // Returned to nextRip

    // Check we can write/read the allocated memory
    emu.memory.write32(allocatedAddr, 0xcafebabe);
    expect(emu.memory.read32(allocatedAddr)).toBe(0xcafebabe);
  });

  it('should hook and emulate Windows GetProcAddress', () => {
    const emu = new Emulator();
    const handler = new SyscallHandler();
    emu.syscallHandler = handler;

    const gpaHookAddr = (handler as any).winHookNames.get('GetProcAddress');
    const vaHookAddr = (handler as any).winHookNames.get('VirtualAlloc');
    expect(gpaHookAddr).toBeDefined();
    expect(vaHookAddr).toBeDefined();

    // Load "VirtualAlloc" string to memory
    const procName = "VirtualAlloc";
    const nameAddr = 0x6000n;
    const encoder = new TextEncoder();
    const nameBytes = new Uint8Array([...encoder.encode(procName), 0]); // null-terminated
    emu.memory.map(nameAddr, nameBytes.length, 'data');
    emu.memory.writeBuffer(nameAddr, nameBytes);

    // Set up args: hModule = 0 (rcx), lpProcName = 0x6000 (rdx)
    emu.cpu.write('rcx', 0n);
    emu.cpu.write('rdx', nameAddr);

    // Setup stack for return address
    const nextRip = 0x2005n;
    let rsp = emu.cpu.read('rsp');
    rsp -= 8n;
    emu.cpu.write('rsp', rsp);
    emu.memory.write64(rsp, nextRip);

    emu.cpu.write('rip', gpaHookAddr);

    const res = emu.step();
    expect(res.success).toBe(true);
    expect(emu.cpu.read('rax')).toBe(vaHookAddr);
    expect(emu.cpu.read('rip')).toBe(nextRip);
  });
});
