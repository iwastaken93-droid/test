# Devlog

## [2026-05-25 22:57:00+10:00] Formatted Test Files with Prettier
- Ran Prettier to format and check all files under the [tests/](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tests/) directory to ensure consistent styling:
  - [decompiler.test.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tests/decompiler.test.ts)
  - [elf.test.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tests/elf.test.ts)
  - [pe.test.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tests/pe.test.ts)
  - [wasm.test.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tests/wasm.test.ts)
- Verified formatting compliance and successfully ran all 17 tests via Vitest.

## [2026-05-25 22:56:00+10:00] Fixed TypeScript Compilation Errors and ES Module Relative Imports
- Added `.js` extension to relative imports in [cfg.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/disassembler/cfg.ts) and [assemblyView.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/ui/assemblyView.ts) to conform to `node16`/`nodenext` resolution rules.
- Annotated implicit `any` parameter and variable types in [assemblyView.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/ui/assemblyView.ts).
- Refactored `hexPattern` scope inside the `updateHoverJumpLine` method in [assemblyView.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/ui/assemblyView.ts) to resolve undefined variable errors.
- Verified compilation cleanliness using `tsc --noEmit`.

## [2026-05-25 22:55:00+10:00] Cleaned Up Jest Configs and Removed Unused Dependencies
- Deleted `jest.config.js` (previously at [jest.config.js](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/jest.config.js)).
- Removed `jest`, `ts-jest`, and `@types/jest` from devDependencies in [package.json](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/package.json).
- Ensured `"test": "vitest run"` script is configured in [package.json](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/package.json).
- Ran `pnpm install` to update workspace lockfile and dependencies.

## [2026-05-25 22:47:00+10:00] Initial Project Setup
- Created base [package.json](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/package.json) configured with basic scripts.
- Created [index.js](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/index.js) as the main entry point.
- Ran `pnpm install` to initialize the project workspace.

## [2026-05-25 22:48:30+10:00] Interactive Control Flow Graph Visualizer
- Created [cfgVisualizer.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/ui/cfgVisualizer.ts) to render interactive control flow graphs.
- Implemented smooth zoom and pan controls.
- Implemented sequential and layered layouts (BFS-based rank layering).
- Added interactive node selection with highlighted incoming/outgoing edge routing.

## [2026-05-25 22:49:15+10:00] Decompiler Core Unit Tests
- Created [decompiler.test.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tests/decompiler.test.ts) to verify dominator tree computation and loop identification.
- Installed `vitest` dependency and updated [package.json](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/package.json) to configure `pnpm test`.
- Successfully verified that all tests passed.
## [2026-05-25 22:49:00+10:00] Disassembler Router Engine
- Created [router.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/disassembler/router.ts) implementing a multi-architecture routing engine (x86_64, ARM, WASM).
- Implemented auto-detection of executable format/architecture using magic signatures (WASM, ELF, PE headers).
- Developed a robust lightweight mock disassembler parsing common opcodes (`push`, `pop`, `mov`, `add`, `sub`, `cmp`, `je`, `jmp`, `call`, `ret`, `nop`) for x86_64 and ARM.
- Integrated WASM disassembly by calling the native [wasm.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/parser/wasm.ts) parser.
## [2026-05-25 22:49:00+10:00] Binary Parsers, Assembly Canvas UI, and Project Configurations
- Added PE and WASM binary parsers in [pe.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/parser/pe.ts) and [wasm.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/parser/wasm.ts).
- Configured TypeScript and Vite compilation via [tsconfig.json](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tsconfig.json) and [vite.config.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/vite.config.ts), along with Jest configurations.
- Implemented canvas-based assembly rendering in [assemblyView.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/ui/assemblyView.ts).
- Completed initial Git commit for version control.

## [2026-05-25 22:50:00+10:00] Jest Configuration & TypeScript Testing Setup
- Created [jest.config.js](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/jest.config.js) configured with ts-jest preset and ESM support.
- Installed ts-jest, @types/jest, and jest dependencies as devDependencies via pnpm.

## [2026-05-25 22:51:00+10:00] Installed Node Types and Updated Vite Configuration
- Installed `@types/node` using pnpm as a devDependency.
- Updated [vite.config.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/vite.config.ts) to correctly import and use `path` via `import * as path from 'path';`.

## [2026-05-25 22:52:00+10:00] WASM Parser Unit Tests
- Created [wasm.test.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tests/wasm.test.ts) to verify WASM magic number validation, custom sections, imports, exports, types, and instructions.
- Ran tests successfully via vitest.

## [2026-05-25 22:53:00+10:00] PE Parser Unit Tests
- Created [pe.test.ts](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/tests/pe.test.ts) to write unit tests for the PE binary parser.
- Verified that it validates MZ signature, parses COFF header, Optional Header fields (both 32-bit and 64-bit), sections, and handles invalid headers appropriately.
- Verified that all unit tests passed successfully.

## [2026-05-25 22:54:00+10:00] Prettier Code Formatting Setup
- Created Prettier configuration file [.prettierrc](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/.prettierrc) with standard formatting rules.
- Installed `prettier` as a devDependency using `pnpm`.
- Formatted all source files under [src/](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/src/) and verified formatting compliance.


## [2026-05-25 22:54:00+10:00] Configure GitHub Actions CI Workflow
- Added typecheck script `"typecheck": "tsc --noEmit"` to [package.json](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/package.json).
- Created GitHub Actions workflow configuration in [.github/workflows/ci.yml](file:///C:/Users/NaThA/hacks/antigravity_things/agy/test/.github/workflows/ci.yml) to run typecheck and Vitest tests on pushes and pull requests to main.
  


## [2026-05-25 22:51:30+10:00] TypeScript Compiler Verification
- Ran TypeScript compilation check (`pnpm exec tsc --noEmit`) to verify the workspace is free of compiler errors.
- Confirmed that the compilation succeeds without errors.
