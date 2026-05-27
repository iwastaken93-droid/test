# 🔬 DISSECT — Universal Reverse Engineering Tool: Comprehensive Handoff

> **Last Updated:** 2026-05-27 16:03 AEST (Session 6 close-out)
> **Project Root:** `C:\Users\NaThA\hacks\antigravity_things\agy\test`
> **Long-Term Goal:** 1,000,000+ lines of code — a fully-featured universal RE workbench
> **Current Size:** ~780 KB of TypeScript source across 65+ files

---

## 🚨🚨🚨 NEXT SESSION: START BUILDING IMMEDIATELY 🚨🚨🚨

# ⚡ LAUNCH 10 SUBAGENTS RIGHT NOW ⚡

1. **Read this document first** — it has everything you need
2. **Launch 10+ subagents immediately** to work in parallel
3. **Fix the 5 failing tests** first (quick wins — see details below)
4. **Then build the incomplete features** listed in the Roadmap below
5. **`git add` all untracked files** — there are 33 files needing staging
6. **Always run `pnpm test` after changes** and update DEVLOG.md
7. **DO NOT WAIT. DO NOT PLAN. START CODING.**

---

## 📐 Project Architecture

```
test/
├── .agents/
│   └── skills/
│       ├── Handoff/SKILL.md                   # Handoff skill instructions
│       └── start/SKILL.md                     # Start skill instructions
├── .github/
│   └── workflows/
│       └── ci.yml                             # GitHub Actions CI (checkout → pnpm → typecheck → vitest)
├── src/                                        # ~780 KB total source
│   ├── index.html                (428 B)      # Vite entry HTML (loads main.ts as module)
│   ├── main.ts                   (69.4 KB)    # ApplicationCoordinator — master app controller (~2000 lines)
│   ├── styles.css                (9.8 KB)     # Premium dark-mode glassmorphic CSS design system
│   ├── parser/                                # Binary format parsers
│   │   ├── .gitkeep
│   │   ├── elf.ts                (10.4 KB)    # ELF parser — 32/64-bit, LE/BE, section/program headers
│   │   ├── pe.ts                 (17.9 KB)    # PE/PE32+ parser — DOS, COFF, imports/exports, sections
│   │   ├── wasm.ts               (19.3 KB)    # WebAssembly parser — LEB128, type/import/function/export/code
│   │   ├── macho.ts              (17.0 KB)    # Mach-O parser — fat/universal, 32/64-bit, segments, symbols
│   │   └── dex.ts                (15.5 KB)    # DEX parser — MUTF-8, classes, methods, try/catch, LEB128
│   ├── disassembler/                          # Disassembly & decompilation engine
│   │   ├── .gitkeep
│   │   ├── types.ts              (4.4 KB)     # Core types — Instruction, Section, Symbol, Operand
│   │   ├── router.ts             (59.4 KB)    # DisassemblerRouter — auto-detect, x86/ARM/WASM/Dalvik + Capstone
│   │   ├── cfg.ts                (8.5 KB)     # CFG builder — basic block splitting, leader detection, edges
│   │   ├── decompiler.ts         (32.5 KB)    # Pseudo-C decompiler — dominator trees, loop detection, type prop
│   │   └── capstoneWasm.ts       (4.0 KB)     # Capstone WASM integration — x86/ARM disassembly [NEW]
│   ├── analyzer/                              # Analysis engines
│   │   ├── entropy.ts            (4.1 KB)     # Shannon entropy — sliding window, high-entropy blocks
│   │   ├── strings.ts            (8.2 KB)     # String extractor — ASCII/Unicode, URL/filepath/API categorization
│   │   ├── search.ts             (8.7 KB)     # Pattern search — text, hex wildcard, instruction matching
│   │   ├── signatures.ts         (8.0 KB)     # Signature scanner — compiler/packer/crypto detection rules
│   │   ├── reportGenerator.ts    (5.6 KB)     # Report generator — JSON/Markdown export
│   │   ├── xrefs.ts              (10.1 KB)    # Cross-references — CALL/JUMP/DATA xref tracking
│   │   ├── yara.ts               (12.2 KB)    # YARA engine — rule parsing, hex/text matching, conditions
│   │   ├── ai.ts                 (21.2 KB)    # AI explanation engine — pattern-based code analysis
│   │   ├── patcher.ts            (6.4 KB)     # Binary patcher — patch tracking, undo/redo, export
│   │   ├── fcg.ts                (4.7 KB)     # Function Call Graph builder — maps call relationships
│   │   ├── scripting.ts          (7.4 KB)     # Scripting engine — JS-based scripting console context
│   │   ├── demangler.ts          (12.8 KB)    # Symbol demangler — C++/Rust/Swift name demangling [NEW]
│   │   ├── diff.ts               (8.3 KB)     # Binary diff engine — side-by-side binary comparison [NEW]
│   │   ├── hashes.ts             (7.6 KB)     # Hash calculator — MD5/SHA-1/SHA-256/CRC32 [NEW]
│   │   └── vulnScanner.ts        (9.8 KB)     # Vulnerability scanner — unsafe API detection [NEW]
│   ├── emulator/                              # x86_64 emulator
│   │   ├── cpu.ts                (5.9 KB)     # CPU state machine — RAX-R15, RIP, RFLAGS, sub-register aliases
│   │   ├── memory.ts             (6.8 KB)     # Virtual memory — page-based, permission checks, section loading
│   │   ├── emulator.ts           (17.8 KB)    # Instruction executor — MOV/ADD/SUB/PUSH/POP/CALL/RET/JMP/Jcc/CMP/XOR/LEA
│   │   └── syscall.ts            (8.0 KB)     # Syscall emulation — Linux syscalls + Windows API stubs [NEW]
│   ├── network/                               # Networking / collaboration
│   │   └── collab.ts             (10.1 KB)    # Collaborative sync — mock WebRTC/WebSocket, comments/highlights/renames
│   └── ui/                                    # Premium UI components (28 files)
│       ├── .gitkeep
│       ├── hexViewer.ts          (11.1 KB)    # Interactive hex viewer — offset/byte/ASCII columns
│       ├── assemblyView.ts       (37.4 KB)    # Assembly listing — jump arrows, comments, nav history
│       ├── cfgVisualizer.ts      (25.8 KB)    # SVG CFG graph — zoom/pan, colored branch arrows
│       ├── dependencyGraph.ts    (30.5 KB)    # Import/export dep graph — force-directed canvas renderer
│       ├── dependencyGraphView.ts (11.1 KB)   # Dep graph wrapper — container integration
│       ├── memoryMap.ts          (23.0 KB)    # Memory map overlay — entropy heatmaps, section coloring
│       ├── memoryMapView.ts      (8.1 KB)     # Memory map wrapper
│       ├── stringsView.ts        (18.1 KB)    # Strings viewer — search, tag filters, sort columns
│       ├── searchPanel.ts        (30.3 KB)    # Search panel — text/hex/instruction modes
│       ├── searchView.ts         (10.0 KB)    # Search wrapper
│       ├── signaturePanel.ts     (19.9 KB)    # Signature scan panel — grouped results by category
│       ├── reportPanel.ts        (33.1 KB)    # Report panel — JSON/MD download, clipboard, preview
│       ├── emulatorPanel.ts      (17.5 KB)    # Emulator panel — step controls, registers, stack, memory inspector
│       ├── xrefsPanel.ts         (20.3 KB)    # Cross-refs panel — incoming/outgoing xrefs, quick stats
│       ├── importsExportsPanel.ts (17.7 KB)   # Import/export table — sub-tabs, search, navigation
│       ├── aiPanel.ts            (16.9 KB)    # AI explanation panel — code analysis UI
│       ├── collabPanel.ts        (26.5 KB)    # Collaboration panel — peer list, comments, highlights
│       ├── patcherPanel.ts       (17.3 KB)    # Binary patcher panel — hex editing, patch history
│       ├── yaraPanel.ts          (21.7 KB)    # YARA rules panel — rule editor, scan results
│       ├── entropyGraph.ts       (25.1 KB)    # Entropy visualization — canvas graph
│       ├── fcgVisualizer.ts      (20.8 KB)    # FCG visualizer — function call graph canvas
│       ├── scriptingConsole.ts   (11.7 KB)    # Scripting console — JS REPL UI
│       ├── demanglerPanel.ts     (20.3 KB)    # Symbol demangler panel [NEW]
│       ├── diffPanel.ts          (25.0 KB)    # Binary diff panel — side-by-side comparison [NEW]
│       ├── metadataPanel.ts      (15.8 KB)    # Metadata panel — file info, hashes, timestamps [NEW]
│       ├── typeSystemPanel.ts    (34.3 KB)    # Type system panel — struct viewer, C parser [NEW]
│       └── vulnPanel.ts          (12.5 KB)    # Vulnerability scanner panel [NEW]
├── tests/                                     # Test suites (Vitest) — 31 files
│   ├── elf.test.ts               (4.2 KB)     # ELF parser tests (5 tests)
│   ├── pe.test.ts                (12.7 KB)    # PE parser tests (6 tests)
│   ├── wasm.test.ts              (6.9 KB)     # WASM parser tests (4 tests)
│   ├── macho.test.ts             (9.7 KB)     # Mach-O parser tests (9 tests)
│   ├── dex.test.ts               (12.9 KB)    # DEX parser tests (8 tests)
│   ├── decompiler.test.ts        (6.5 KB)     # Decompiler tests (6 tests)
│   ├── router.test.ts            (6.8 KB)     # Disassembler router tests (17 tests)
│   ├── entropy.test.ts           (4.9 KB)     # Entropy analyzer tests (9 tests)
│   ├── strings.test.ts           (6.1 KB)     # String extraction tests (8 tests)
│   ├── search.test.ts            (7.6 KB)     # Pattern search tests (15 tests)
│   ├── signatures.test.ts        (9.8 KB)     # Signature scanner tests (19 tests)
│   ├── report.test.ts            (9.3 KB)     # Report generator tests (15 tests)
│   ├── reportPanel.test.ts       (3.4 KB)     # Report panel UI tests (5 tests)
│   ├── emulator.test.ts          (15.6 KB)    # Emulator tests (27 tests)
│   ├── xrefs.test.ts             (7.8 KB)     # Cross-references tests (7 tests)
│   ├── yara.test.ts              (6.1 KB)     # YARA engine tests (9 tests)
│   ├── collab.test.ts            (5.3 KB)     # Collaboration engine tests (8 tests)
│   ├── ai.test.ts                (2.8 KB)     # AI explanation tests (5 tests) ✅ FIXED
│   ├── fcg.test.ts               (11.6 KB)    # FCG builder + visualizer tests (14 tests) [NEW]
│   ├── scripting.test.ts         (11.6 KB)    # Scripting engine + console tests (22 tests) [NEW]
│   ├── entropyGraph.test.ts      (7.2 KB)     # Entropy graph UI tests (7 tests) [NEW]
│   ├── patcher.test.ts           (11.8 KB)    # Patcher engine + panel tests (18 tests) [NEW]
│   ├── capstoneWasm.test.ts      (5.5 KB)     # Capstone WASM tests (9 — ⚠️ 2 FAILING) [NEW]
│   ├── syscall.test.ts           (5.9 KB)     # Syscall emulation tests (5 — ⚠️ 2 FAILING) [NEW]
│   ├── uiPanels.test.ts          (10.4 KB)    # UI panel integration tests (10 — ⚠️ 1 FAILING) [NEW]
│   ├── demangler.test.ts         (3.5 KB)     # Demangler tests (8 tests) [NEW]
│   ├── diff.test.ts              (1.6 KB)     # Diff engine tests (2 tests) [NEW]
│   ├── metadata.test.ts          (4.3 KB)     # Metadata panel tests (6 tests) [NEW]
│   ├── typeSystem.test.ts        (3.3 KB)     # Type system panel tests (4 tests) [NEW]
│   ├── vulnScanner.test.ts       (3.6 KB)     # Vulnerability scanner tests (4 tests) [NEW]
│   └── yaraPanel.test.ts         (3.5 KB)     # YARA panel UI tests (6 tests) [NEW]
├── fixtures/
│   └── index.ts                  (7.3 KB)     # Mock binary test data (ELF, PE, WASM)
├── docs/                                      # Documentation (8 files)
│   ├── README.md                 (2.9 KB)     # Table of contents, introduction, design principles
│   ├── architecture.md           (5.4 KB)     # System pipeline, Mermaid diagrams
│   ├── parsers.md                (6.1 KB)     # Binary format parser details (ELF/PE/Mach-O/DEX/WASM)
│   ├── disassembler_router.md    (5.8 KB)     # Routing logic, block splitting, CFG, decompiler
│   ├── emulator.md               (6.8 KB)     # Register structures, virtual memory, instruction loop
│   ├── analyzers.md              (4.4 KB)     # Entropy, signatures, strings, xrefs, report config
│   ├── developer_setup.md        (2.5 KB)     # Setup scripts, linting, formatting
│   └── roadmap_proposals.md      (6.9 KB)     # Strategic research proposals & advanced features
├── dist/                                      # Production build output
│   ├── index.html                (0.48 KB)
│   └── assets/
│       ├── index-*.css           (6.67 KB / gzip: 2.17 KB)
│       └── index-*.js            (487.17 KB / gzip: 112.69 KB)
├── package.json                               # Project config (pnpm, type:module)
├── tsconfig.json                              # ES2022, NodeNext, strict, DOM libs
├── vite.config.ts                             # Vite + Vitest config (root: src, port 5173)
├── eslint.config.js                           # ESLint flat config with typescript-eslint
├── .prettierrc                                # Prettier: semi, singleQuote, tabWidth:2, trailingComma:es5
├── .gitignore                                 # Standard ignores
├── pnpm-workspace.yaml                        # pnpm workspace config
├── pnpm-lock.yaml               (152 KB)     # Lock file
├── index.js                     (59 B)       # Placeholder entry (console.log)
├── AGENTS.md                    (1.6 KB)     # Agent rules (pnpm, subagents, devlog)
├── DEVLOG.md                    (50.5 KB)    # Development log (736 lines)
├── README.md                    (4.2 KB)     # Project README with architecture diagram
└── Handoff.md                                 # THIS FILE
```

---

## 🧪 Current Test Status (as of 2026-05-27 16:03 AEST)

```
Test Files   3 failed | 28 passed (31)
     Tests   5 failed | 292 passed (297)
  Duration  11.19s
```

### Failing Tests (5)

#### 1. `tests/capstoneWasm.test.ts` — 2 failures
- **`should disassemble x86_64 instructions correctly when loaded`**
  - Expected `'eax, 0xdeadbeef'` but got `'eax, 0x-21524111'`
  - **Root cause:** Signed vs unsigned hex formatting in `capstoneWasm.ts` operand string
- **`should disassemble arm instructions correctly when loaded`**
  - Expected `'nop'` but got `'mov'`
  - **Root cause:** ARM NOP instruction byte mapping incorrect in mock disassembler

#### 2. `tests/syscall.test.ts` — 2 failures
- **`should emulate Linux sys_exit and halt the emulator`**
  - `res.halted` expected `true`, got `false`
  - **Root cause:** Syscall handler doesn't properly set halted state on exit
- **`should hook and emulate Windows VirtualAlloc via direct calls`**
  - `allocatedAddr` expected `> 0`, got `0`
  - **Root cause:** VirtualAlloc hook not correctly writing return value to RAX

#### 3. `tests/uiPanels.test.ts` — 1 failure
- **`should render SVG canvas and block nodes`**
  - Expected textContent to contain `'block_0x1000'` but got `'0x10001 insts0x1000nop'`
  - **Root cause:** CFG block card rendering not including the block label prefix

### Full Test Breakdown by File

| Test File | Tests | Status |
|-----------|-------|--------|
| elf.test.ts | 5 | ✅ Pass |
| pe.test.ts | 6 | ✅ Pass |
| wasm.test.ts | 4 | ✅ Pass |
| macho.test.ts | 9 | ✅ Pass |
| dex.test.ts | 8 | ✅ Pass |
| decompiler.test.ts | 6 | ✅ Pass |
| router.test.ts | 17 | ✅ Pass |
| entropy.test.ts | 9 | ✅ Pass |
| strings.test.ts | 8 | ✅ Pass |
| search.test.ts | 15 | ✅ Pass |
| signatures.test.ts | 19 | ✅ Pass |
| report.test.ts | 15 | ✅ Pass |
| reportPanel.test.ts | 5 | ✅ Pass |
| emulator.test.ts | 27 | ✅ Pass |
| xrefs.test.ts | 7 | ✅ Pass |
| yara.test.ts | 9 | ✅ Pass |
| collab.test.ts | 8 | ✅ Pass |
| ai.test.ts | 5 | ✅ Pass |
| fcg.test.ts | 14 | ✅ Pass |
| scripting.test.ts | 22 | ✅ Pass |
| entropyGraph.test.ts | 7 | ✅ Pass |
| patcher.test.ts | 18 | ✅ Pass |
| diff.test.ts | 2 | ✅ Pass |
| demangler.test.ts | 8 | ✅ Pass |
| vulnScanner.test.ts | 4 | ✅ Pass |
| typeSystem.test.ts | 4 | ✅ Pass |
| metadata.test.ts | 6 | ✅ Pass |
| yaraPanel.test.ts | 6 | ✅ Pass |
| capstoneWasm.test.ts | 7/9 | ⚠️ 2 Failing |
| syscall.test.ts | 3/5 | ⚠️ 2 Failing |
| uiPanels.test.ts | 9/10 | ⚠️ 1 Failing |
| **Total** | **292/297** | |

### Build Status
```
✅ vite build — 487.17 KB bundle (112.69 KB gzip) — 50 modules, 282ms
```

---

## 📊 Session 6 — What Was Completed (2026-05-27)

### ✅ Successfully Completed

| Category | Module | File | Status |
|----------|--------|------|--------|
| **Git** | Staged untracked files | scripting.ts, entropyGraph.ts, fcgVisualizer.ts, scriptingConsole.ts, ai.test.ts | ✅ Staged |
| **Tests** | FCG + FCG Visualizer tests | tests/fcg.test.ts (14 tests) | ✅ All pass |
| **Tests** | Scripting + Console tests | tests/scripting.test.ts (22 tests) | ✅ All pass |
| **Tests** | Entropy Graph tests | tests/entropyGraph.test.ts (7 tests) | ✅ All pass |
| **Fix** | AI tests fixed | tests/ai.test.ts (5 tests) | ✅ All pass (was 2 failing) |
| **Tests** | Patcher + Panel tests | tests/patcher.test.ts (18 tests) | ✅ All pass |
| **Integration** | Main.ts wiring | Collab, Yara, FCG panels wired into coordinator | ✅ Complete |
| **Feature** | Type System Viewer | src/ui/typeSystemPanel.ts + tests/typeSystem.test.ts (4 tests) | ✅ Complete |
| **Feature** | Symbol Demangler | src/analyzer/demangler.ts + src/ui/demanglerPanel.ts + tests/demangler.test.ts (8 tests) | ✅ Complete |
| **Feature** | Binary Diff Engine | src/analyzer/diff.ts + src/ui/diffPanel.ts + tests/diff.test.ts (2 tests) | ✅ Complete |
| **Feature** | Metadata Panel | src/ui/metadataPanel.ts + tests/metadata.test.ts (6 tests) | ✅ Complete |
| **Feature** | Vulnerability Scanner | src/analyzer/vulnScanner.ts + src/ui/vulnPanel.ts + tests/vulnScanner.test.ts (4 tests) | ✅ Complete |
| **Feature** | Hash Calculator | src/analyzer/hashes.ts | ✅ Complete |
| **Feature** | Capstone WASM Engine | src/disassembler/capstoneWasm.ts + tests/capstoneWasm.test.ts (7/9 pass) | ⚠️ 2 tests failing |
| **Feature** | Syscall Emulation | src/emulator/syscall.ts + tests/syscall.test.ts (3/5 pass) | ⚠️ 2 tests failing |
| **Tests** | UI Panel Integration | tests/uiPanels.test.ts (9/10 pass) | ⚠️ 1 test failing |
| **Tests** | YARA Panel tests | tests/yaraPanel.test.ts (6 tests) | ✅ All pass |

### ⚠️ Subagents that hit rate limits or had partial completion

| Subagent Task | Result |
|---------------|--------|
| FCG tests | ✅ Completed fully — 14 tests |
| Scripting tests | ✅ Completed fully — 22 tests |
| AI test fix | ✅ Completed fully — 5/5 pass |
| Patcher tests | ✅ Completed fully — 18 tests |
| Entropy Graph tests | ✅ Completed fully — 7 tests |
| Main.ts integration wiring | ✅ Completed — collab, yara, FCG |
| Type System Viewer | ✅ Completed — panel + tests |
| Symbol Demangler | ✅ Completed — engine + panel + tests |
| Metadata Panel | ✅ Completed — panel + tests |
| Capstone WASM | ⚠️ Partial — 2 test failures (hex formatting + ARM NOP) |
| Syscall Emulation | ⚠️ Partial — 2 test failures (exit halt + VirtualAlloc) |
| UI Panel Integration tests | ⚠️ Partial — 1 test failure (CFG block labels) |

---

## 📦 Untracked/Uncommitted Files (need `git add`)

### Untracked (`??`) — 33 files
```
docs/roadmap_proposals.md
src/analyzer/demangler.ts
src/analyzer/diff.ts
src/analyzer/hashes.ts
src/analyzer/vulnScanner.ts
src/disassembler/capstoneWasm.ts
src/emulator/syscall.ts
src/ui/demanglerPanel.ts
src/ui/diffPanel.ts
src/ui/metadataPanel.ts
src/ui/typeSystemPanel.ts
src/ui/vulnPanel.ts
tests/capstoneWasm.test.ts
tests/demangler.test.ts
tests/diff.test.ts
tests/entropyGraph.test.ts
tests/fcg.test.ts
tests/metadata.test.ts
tests/patcher.test.ts
tests/scripting.test.ts
tests/syscall.test.ts
tests/typeSystem.test.ts
tests/uiPanels.test.ts
tests/vulnScanner.test.ts
tests/yaraPanel.test.ts
```

### Modified (`M`) — 8 files
```
.agents/skills/Handoff/SKILL.md
DEVLOG.md
src/disassembler/router.ts
src/emulator/emulator.ts
src/main.ts
src/ui/yaraPanel.ts
tests/ai.test.ts
tests/router.test.ts
```

### ⚡ Quick fix command:
```bash
git add -A && git commit -m "feat: session 6 - demangler, diff, vuln scanner, type system, metadata, capstone, syscalls, 297 tests"
```

---

## 🗺️ Roadmap — Prioritized

### 🔴 Priority 0 — Immediate Fixes (do first)
1. **Fix 2 failing Capstone WASM tests** in `tests/capstoneWasm.test.ts` — unsigned hex formatting in `capstoneWasm.ts` and ARM NOP byte mapping
2. **Fix 2 failing syscall tests** in `tests/syscall.test.ts` — `sys_exit` halted state and VirtualAlloc return value
3. **Fix 1 failing UI panel test** in `tests/uiPanels.test.ts` — CFG block card label rendering in `cfgVisualizer.ts`
4. **`git add -A && git commit`** — 33 untracked + 8 modified files

### 🟠 Priority 1 — Complete Incomplete Features & Testing Gaps
5. **Add more diff tests** — only 2 tests for diff engine, expand coverage
6. **Add more vulnScanner tests** — only 4 tests, needs edge case coverage
7. **Integrate Entropy Graph** into main.ts tabs — file exists but verify wiring
8. **Integrate Scripting Console** into main.ts tabs — file exists but verify wiring
9. **Integrate Diff Panel** into main.ts tabs
10. **Integrate Vulnerability Panel** into main.ts tabs
11. **Integrate Demangler Panel** into main.ts tabs
12. **Integrate Metadata Panel** into main.ts tabs — verify wiring

### 🟡 Priority 2 — Scale & Polish
13. **E2E browser/DOM integration tests** (jsdom-based)
14. **Expand instruction tables** for x86 and ARM disassemblers
15. **Complete Capstone.js WASM integration** — move from mock to real disassembly
16. **Plugin system** — extensible architecture for custom analyzers (see `docs/roadmap_proposals.md`)
17. **YARA rule import/export** — file I/O for .yar files
18. **Complete Syscall emulation** — expand Linux syscall table and Windows API hooks
19. **IR/SSA framework** — unified intermediate representation (see roadmap_proposals.md §3)

### 🟢 Priority 3 — Advanced Features (from roadmap_proposals.md)
20. **GDB/LLDB Remote Serial Protocol client** — live debugging integration
21. **Frida DBI integration** — dynamic binary instrumentation hooks
22. **PE Resource (.rsrc) extraction** — icons, manifests, embedded payloads
23. **PDB & DWARF debug symbol recovery** — source-level debugging
24. **Objective-C metadata recovery** — Mach-O class parsing
25. **Java/.NET metadata parsing** — MSIL/CIL decompiler
26. **CRDT-based collaboration** — Yjs WebSocket real-time sync
27. **Headless backend offloading** — Node.js/Go remote processing
28. **On-device LLM execution** — WebNN/ONNX for local AI analysis
29. **Nested archive unpacking** — ZIP/APK/JAR/IPA auto-extraction
30. **Coverage visualization** — code coverage overlay on CFG

---

## ⚙️ Tech Stack & Configuration

| Component | Version | Notes |
|-----------|---------|-------|
| TypeScript | 6.0.3 | Strict mode, ES2022 target |
| Vite | 8.0.14 | Dev server on port 5173, root: `src/` |
| Vitest | 4.1.7 | Test runner, test files in `tests/` |
| pnpm | latest | **ALWAYS use pnpm, NEVER npm** |
| Node.js | latest LTS | |
| ESLint | 10.4.0 | Flat config with typescript-eslint |
| Prettier | 3.8.3 | Semi, singleQuote, tabWidth:2 |
| jsdom | 29.1.1 | For UI component testing |

### Key Config Details
- **Module system**: ESM (`"type": "module"` in package.json)
- **Module resolution**: NodeNext (requires `.js` extensions in imports!)
- **tsconfig**: ES2022 target, NodeNext modules, strict, DOM+DOM.Iterable+ES2022 libs
- **Vite**: root `src/`, build output to `../dist/`, test includes `../tests/**/*.test.ts`
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) — checkout → pnpm install → typecheck → vitest

---

## 🎨 Design Rules

### Visual Theme
- **Dark glassmorphic** — use CSS variables from `styles.css`
- **Color palette**: Slate/charcoal backgrounds (`--bg-primary: #0a0c10`, `--bg-secondary: #12151c`)
- **Accent**: Indigo-to-violet gradient (`--accent-start: #6366f1`, `--accent-end: #8b5cf6`)
- **Success**: Emerald green (`--success: #10b981`)
- **Typography**: Plus Jakarta Sans (UI), JetBrains Mono (code)
- **Glass effect**: `backdrop-filter: blur(16px)`, semi-transparent `rgba()` backgrounds, subtle borders

### Component Patterns
- **Panels**: Look at `searchPanel.ts` and `signaturePanel.ts` for the card/grid design pattern
- **Glassmorphism**: `background: var(--bg-glass)`, `border: 1px solid var(--border-color)`, `border-radius: 12px`
- **Micro-animations**: Hover transforms (`translateY(-2px)`), smooth transitions (`0.2s ease`), box-shadow glow on focus
- **Tables**: Striped rows, hover highlights, sortable columns
- **Badges**: Gradient backgrounds, rounded pills, status indicators

### Code Style
- **Always use `.js` extensions** in TypeScript import paths (ESM/NodeNext requirement)
- **Follow existing patterns** — each UI panel exports a class with `render()` method
- **Panel integration**: Import in main.ts, add to `AppState.activeTab` union, create tab button + panel div, init in `processBinary()`

---

## 📋 Key Rules for Agents

1. **Always use `pnpm`** — never `npm` or `yarn`
2. **Always use `.js` extensions** in TypeScript import paths (e.g., `import { X } from './module.js'`)
3. **Run `pnpm test` after every change** — verify nothing breaks
4. **Run `pnpm build` periodically** — ensure the production bundle compiles
5. **Update `DEVLOG.md`** with timestamped entries after completing work
6. **Use `uv pip`** instead of `pip` for any Python tooling
7. **DO NOT SPAWN SUBAGENTS** if you ARE a subagent
8. **Keep 10+ subagents active** at all times (orchestrator rule)
9. **Git commit frequently** — `git add -A && git commit -m "feat: <description>"`
10. **Follow the glassmorphic dark theme** — use CSS variables, never plain colors

---

## 🔧 Quick Reference Commands

```bash
# Install dependencies
pnpm install

# Start dev server (localhost:5173)
pnpm dev

# Run all tests
pnpm test

# Run a single test file
pnpm vitest run tests/<file>.test.ts

# Production build
pnpm build

# Git commit everything
git add -A && git commit -m "feat: description"

# Check git status
git status --short
```

---

## 📈 Growth Metrics

| Metric | Session 1 | Session 2 | Session 3 | Session 4 | Session 5 | Session 6 |
|--------|-----------|-----------|-----------|-----------|-----------|-----------|
| Test Files | 4 | 10 | 11 | 13 | 18 | 31 |
| Total Tests | 17 | 84 | 97 | 144 | 173 | 297 |
| Passing | 17 | 84 | 97 | 144 | 171 | 292 |
| Source Files | 17 | 30 | 32 | 38 | 55+ | 65+ |
| Bundle Size | 91 KB | ~150 KB | ~180 KB | ~250 KB | 354 KB | 487 KB |

---

*The next session should IMMEDIATELY START BUILDING. Always launch 10+ subagents. Fix the 5 failing tests first, then git add everything, then continue building toward 1M LOC. Focus on integration wiring, expanding test coverage, and the IR/SSA framework. 🚀*
