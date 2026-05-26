# DISSECT — Universal Reverse Engineering Tool: Handoff Document

> **Last Updated:** 2026-05-27 06:43 AEST
> **Project Root:** `C:\Users\NaThA\hacks\antigravity_things\agy\test`
> **Long-Term Goal:** 1,000,000+ lines of code — a fully-featured universal RE tool

---

## IMPORTANT: DO NOT SEARCH THE PROJECT — START IMMEDIATELY

All context you need is in this document. Do not waste time exploring the codebase. Read this, then start building.

---

## Project Architecture

```
test/
├── src/
│   ├── index.html              # Vite entry HTML
│   ├── main.ts                 # ApplicationCoordinator — the main app controller
│   ├── styles.css              # Premium dark-mode glassmorphic CSS design system
│   ├── parser/
│   │   ├── elf.ts              # ELF binary parser (32/64-bit, LE/BE)
│   │   ├── pe.ts               # PE/PE32+ parser (imports, exports, sections)
│   │   ├── wasm.ts             # WebAssembly module parser
│   │   ├── macho.ts            # Mach-O parser (fat/universal, 32/64-bit)
│   │   └── dex.ts              # DEX (Android Dalvik) parser (classes, methods, try/catch)
│   ├── disassembler/
│   │   ├── types.ts            # Core types: Instruction, Section, Symbol, Operand, etc.
│   │   ├── router.ts           # DisassemblerRouter — auto-detects format, routes to x86/ARM/WASM/Dalvik disassemblers
│   │   ├── cfg.ts              # Control Flow Graph builder
│   │   └── decompiler.ts       # Pseudo-C decompiler (dominator trees, loop detection)
│   ├── analyzer/
│   │   ├── entropy.ts          # Shannon entropy calculator (sliding window, high-entropy block detection)
│   │   ├── strings.ts          # String extraction engine (ASCII/Unicode, categorized: URLs, paths, APIs)
│   │   ├── search.ts           # Pattern search engine (text, hex wildcard)
│   │   ├── signatures.ts       # SignatureScanner — rule-based compiler/packer/crypto detection
│   │   └── reportGenerator.ts  # Report generator (JSON/Markdown export with metadata, sections, symbols, entropy, signatures, strings)
│   ├── emulator/
│   │   └── cpu.ts              # x86_64 CPU state machine (RAX-R15, RIP, RFLAGS, sub-register aliases, flag helpers)
│   └── ui/
│       ├── hexViewer.ts        # Interactive hex viewer with offset selection
│       ├── assemblyView.ts     # Assembly listing with jump arrows & navigation history
│       ├── cfgVisualizer.ts    # Interactive SVG CFG graph (zoom/pan)
│       ├── dependencyGraph.ts  # Import/export/local function dependency graph
│       ├── dependencyGraphView.ts
│       ├── memoryMap.ts        # Full-binary memory map overlay
│       ├── memoryMapView.ts
│       ├── stringsView.ts      # Premium strings viewer with categorization
│       ├── searchPanel.ts      # Premium search panel (text/hex/instruction modes)
│       ├── searchView.ts
│       └── signaturePanel.ts   # Premium signature scan results viewer
├── tests/
│   ├── elf.test.ts
│   ├── pe.test.ts
│   ├── wasm.test.ts
│   ├── macho.test.ts
│   ├── dex.test.ts
│   ├── entropy.test.ts
│   ├── strings.test.ts
│   ├── search.test.ts
│   ├── signatures.test.ts
│   ├── router.test.ts
│   ├── report.test.ts         # Report generator tests
│   └── emulator.test.ts       # CPU emulator tests
├── fixtures/
│   └── index.ts               # Mock binary test data (ELF, PE, WASM)
├── package.json                # pnpm, Vite 8, Vitest 4, TypeScript 6
├── tsconfig.json               # ES2022, NodeNext, strict mode
├── vite.config.ts
├── DEVLOG.md
├── README.md
└── .github/                    # GitHub Actions CI
```

---

## What Has Been Completed

### Session 1 (2026-05-25)
- Core bootstrapping: Vite + TypeScript + pnpm project setup
- ELF parser: Full 32/64-bit support, section/program headers, string table resolution
- PE parser: DOS header, COFF, Optional Header (PE32/PE32+), imports/exports, sections
- WASM parser: Module sections, exports, imports, code bodies
- Disassembler Router: Auto-detect ELF/PE/WASM, route to x86_64/ARM/WASM disassemblers
- x86_64 disassembler: REX prefix handling, MOV/PUSH/POP/JMP/CALL/CMP/ADD/SUB/XOR/LEA
- ARM (AArch64) disassembler: Branch, load/store, ADD/SUB, MOV, conditional branches
- CFG Builder: Basic block splitting at branch/jump targets
- Decompiler: Dominator tree computation, loop detection, pseudo-C output
- All UI views: HexViewer, AssemblyView, CFGVisualizer, DependencyGraph, MemoryMap
- Premium CSS: Dark glassmorphic design system with CSS variables, gradients, animations
- 17 tests passing, GitHub Actions CI

### Session 2 (2026-05-26 morning)
- Entropy analyzer: Shannon entropy, sliding window, high-entropy block identification
- String extractor: ASCII/Unicode extraction, URL/filepath/API categorization
- Pattern search engine: Text search, hex wildcard search (`55 ?? 48`)
- Mach-O parser: Fat/universal binary support, segments, sections, symbol tables
- DEX parser: Header, strings (MUTF-8/ULEB128), types, protos, methods, classes, try/catch
- StringsView UI: Premium categorized strings panel
- SearchPanel UI: Multi-mode search (text/hex/instruction) with result cards
- 65+ tests passing

### Session 3 (2026-05-26 evening)
- Mach-O & DEX router integration: `detectArchitecture` now detects Mach-O (all magic variants) and DEX (`dex\n`) headers, routing DEX to `disassembleDalvik`
- main.ts coordinator integration: `processBinary` now dispatches to `parseMacho` and `parseDex`, resolving sections/symbols/dependencies for the UI
- SignaturePanel UI (`src/ui/signaturePanel.ts`): Created premium signature scan viewer grouped by compiler/packer/crypto categories with navigation buttons
- Signatures tab integrated into main.ts: Import, tab button, panel, `initSignaturePanel()` method, invoked in `processBinary()`
- CSS design audit: Upgraded design tokens, shadows, glassmorphic effects, button hover states
- Router tests (`tests/router.test.ts`): DEX detection, thin Mach-O (32/64-bit LE/BE), fat Mach-O (LE/BE)
- **97 tests passing** across 11 test files

### Session 4 (2026-05-27 — PARTIAL)
- **Report Generator** (`src/analyzer/reportGenerator.ts`): Supports JSON and Markdown export with file metadata, sections, symbols, entropy, high-entropy blocks, signature matches, and top 100 strings
- **Report tests** (`tests/report.test.ts`): Added, bringing total to 100 tests passing
- **CPU State Machine** (`src/emulator/cpu.ts`): Full x86_64 register file (RAX-R15, RIP, RFLAGS, RSP), sub-register aliases (eax/ax/al/ah, r8d/r8w/r8b), proper zero-extension for 32-bit writes, flag manipulation helpers
- **Emulator tests** (`tests/emulator.test.ts`): 9 CPU unit tests added
- **121 tests passing** across 13 test files
- **NOT completed**: Report Panel UI, emulator memory module, emulator executor, emulator panel UI — all subagents hit rate limits

---

## Current Test Status

```
Test Files  13 passed (13)
     Tests  121 passed (121)
```

All tests compile and pass via `pnpm test`.

---

## Tech Stack

| Component       | Version    |
|----------------|------------|
| TypeScript      | 6.0.3      |
| Vite            | 8.0.14     |
| Vitest          | 4.1.7      |
| pnpm            | latest     |
| Node.js         | latest LTS |
| ESLint          | 10.4.0     |
| Prettier        | 3.8.3      |

**Key config**: ES2022 target, NodeNext modules, strict mode, `.js` extensions in imports (ESM).

---

## Roadmap (What Remains)

### Priority 1 — Immediate (do these NOW)
1. **Report Panel UI** (`src/ui/reportPanel.ts`)
   - Premium UI panel with JSON download, Markdown preview, copy-to-clipboard buttons
   - Add "Reports" tab to `main.ts` layout
   - Wire up `initReportPanel()` in `processBinary()`

2. **Emulator — Memory Module** (`src/emulator/memory.ts`)
   - Virtual memory map with read/write (8/16/32/64-bit)
   - Memory-mapped sections loading from parsed binary

3. **Emulator — Instruction Executor** (`src/emulator/emulator.ts`)
   - Execute: MOV, ADD, SUB, PUSH, POP, CALL, RET, JMP, Jcc, CMP, XOR, LEA
   - Step/run/reset controls
   - Breakpoint support

4. **Emulator Panel UI** (`src/ui/emulatorPanel.ts`)
   - Step controls, register display, stack view, memory inspector
   - Add "Emulator" tab to `main.ts`

### Priority 2 — High Value
5. **Cross-references (XRefs)** (`src/analyzer/xrefs.ts`)
6. **Import/Export Table Viewer** (`src/ui/importsExportsPanel.ts`)
7. **Capstone.js WASM Integration**

### Priority 3 — Scale & Polish
8. More test fixtures
9. Collaborative workspaces
10. AI-assisted code explanation
11. Plugin system
12. YARA rule import/export

---

## What To Do Next — IMMEDIATELY

### Task 1: Build the Report Panel UI
**Files to create:**
- `src/ui/reportPanel.ts` — Premium UI panel with export buttons

**Integration points in `main.ts`:**
1. Add `import { ReportPanel } from './ui/reportPanel.js';`
2. Add `private reportPanel: ReportPanel | null = null;`
3. Add `'reports'` to the `activeTab` union type and `switchTab` parameter
4. Add tab button: `<button class="tab-btn" data-tab="reports">Reports</button>`
5. Add panel: `<div class="tab-content" id="panel-reports" style="display: none;"><div id="reports-viewer-container" style="height: 100%;"></div></div>`
6. Add `initReportPanel()` method and call it in `processBinary()`

**Report panel features:**
- Display generated report (from `reportGenerator.ts`) as formatted Markdown preview
- JSON download button (creates Blob + triggers download)
- Markdown download button
- Copy-to-clipboard button
- Section navigation sidebar within the report

### Task 2: Build the Emulator (Memory + Executor + UI)
**Files to create:**
- `src/emulator/memory.ts` — Virtual memory map with read/write
- `src/emulator/emulator.ts` — Instruction executor (MOV, ADD, SUB, PUSH, POP, CALL, RET, JMP, Jcc, CMP, XOR)
- `src/ui/emulatorPanel.ts` — Step controls, register display, stack view, memory inspector
- Update `tests/emulator.test.ts` — Add memory + executor tests

**NOTE:** `src/emulator/cpu.ts` already exists with full register file. Build on top of it.

**Integration points in `main.ts`:**
1. Add `import { EmulatorPanel } from './ui/emulatorPanel.js';`
2. Add `private emulatorPanel: EmulatorPanel | null = null;`
3. Add `'emulator'` to the `activeTab` union type and `switchTab` parameter
4. Add tab button + panel div
5. Add `initEmulatorPanel()` method and call it in `processBinary()`

### Task 3: Build Cross-References Engine
**Files to create:**
- `src/analyzer/xrefs.ts` — Track call/data references to/from each address
- `src/ui/xrefsPanel.ts` — Display xrefs as clickable annotations
- `tests/xrefs.test.ts` — Unit tests

### Task 4: Update DEVLOG.md
After each task, append a timestamped entry to `DEVLOG.md`

### Task 5: Git Commit
After completing each major feature: `git add -A && git commit -m "feat: <description>"`

---

## Design Rules

- **Dark glassmorphic theme**: Use CSS variables from `styles.css` (`--bg-primary`, `--accent-start`, `--glass-bg`, etc.)
- **No boring neon colors**: Use curated palettes — indigo/violet gradients, subtle glows
- **Micro-animations**: Hover transforms, smooth transitions, card elevation changes
- **Glass panels**: `backdrop-filter: blur()`, semi-transparent backgrounds, subtle borders
- **Font**: System sans-serif for UI, monospace for code (`var(--font-mono)`)
- **Follow existing patterns**: Look at `searchPanel.ts` and `signaturePanel.ts` for the card/panel design pattern

---

## Key Rules for Agents

1. **Always use `pnpm`** (not npm)
2. **Always use `.js` extensions** in TypeScript import paths (ESM requirement)
3. **Run `pnpm test` after every change** to verify nothing broke
4. **Update DEVLOG.md** with timestamps after completing work 
5. **DO NOT SPAWN SUBAGENTS** if you are a subagent
6. **Keep 10+ subagents active** at all times (orchestrator rule)
7. **Use `uv pip`** instead of `pip` for any Python tooling
8. **START IMMEDIATELY** — do not research or read files, just build
