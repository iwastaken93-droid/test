import { Section, Symbol } from '../disassembler/types.js';
import { ScanResult } from './signatures.js';
import { ExtractedString } from './strings.js';
import { EntropyBlock } from './entropy.js';

export interface ReportData {
  fileName: string;
  fileSize: number;
  architecture: string;
  entryPoint: number;
  sections: Section[];
  symbols: Symbol[];
  signatures: ScanResult[];
  entropy: {
    overall: number;
    highEntropyBlocks: EntropyBlock[];
  };
  strings: ExtractedString[];
}

export class ReportGenerator {
  public static generateJSON(data: ReportData): string {
    return JSON.stringify(data, null, 2);
  }

  public static generateMarkdown(data: ReportData): string {
    const formatSize = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    let md = `# Binary Analysis Report: ${data.fileName}\n\n`;
    
    // Metadata Table
    md += `## 📋 File Metadata\n\n`;
    md += `| Parameter | Value |\n`;
    md += `|---|---|\n`;
    md += `| **File Name** | ${data.fileName} |\n`;
    md += `| **Size** | ${formatSize(data.fileSize)} (${data.fileSize} bytes) |\n`;
    md += `| **Architecture** | ${data.architecture.toUpperCase()} |\n`;
    md += `| **Entry Point** | 0x${data.entryPoint.toString(16).toUpperCase()} |\n`;
    md += `| **Overall Entropy** | ${data.entropy.overall.toFixed(4)} |\n\n`;

    // Sections Table
    md += `## 📦 Sections\n\n`;
    if (data.sections && data.sections.length > 0) {
      md += `| Name | Virtual Address | Virtual Size | File Offset | File Size | Entropy | Flags |\n`;
      md += `|---|---|---|---|---|---|---|\n`;
      for (const sec of data.sections) {
        const flagsStr = [
          sec.flags.read ? 'R' : '-',
          sec.flags.write ? 'W' : '-',
          sec.flags.execute ? 'X' : '-'
        ].join('');
        const entropyVal = sec.entropy !== undefined ? sec.entropy.toFixed(4) : 'N/A';
        md += `| \`${sec.name}\` | 0x${sec.virtualAddress.toString(16).toUpperCase()} | ${formatSize(sec.virtualSize)} | 0x${sec.fileOffset.toString(16).toUpperCase()} | ${formatSize(sec.fileSize)} | ${entropyVal} | \`${flagsStr}\` |\n`;
      }
    } else {
      md += `No sections found.\n`;
    }
    md += `\n`;

    // Symbols List
    md += `## 🏷️ Symbols\n\n`;
    const funcSyms = data.symbols.filter(s => s.type === 'function');
    const otherSyms = data.symbols.filter(s => s.type !== 'function');
    md += `Total Symbols: ${data.symbols.length} (Functions: ${funcSyms.length}, Other: ${otherSyms.length})\n\n`;
    if (data.symbols.length > 0) {
      md += `| Name | Address | Type | Binding | Size |\n`;
      md += `|---|---|---|---|---|\n`;
      const displayedSymbols = data.symbols.slice(0, 50);
      for (const sym of displayedSymbols) {
        const sizeStr = sym.size !== undefined ? sym.size.toString() : 'N/A';
        md += `| \`${sym.name}\` | 0x${sym.address.toString(16).toUpperCase()} | \`${sym.type}\` | \`${sym.binding}\` | ${sizeStr} |\n`;
      }
      if (data.symbols.length > 50) {
        md += `| ... | ... | ... | ... | ... |\n`;
        md += `\n*Showing top 50 symbols. Check JSON report for full list.*\n`;
      }
    } else {
      md += `No symbols found.\n`;
    }
    md += `\n`;

    // Signature Matches
    md += `## 🛡️ Signature Scan Results\n\n`;
    if (data.signatures && data.signatures.length > 0) {
      md += `| Rule Name | Category | Matches (Offsets) |\n`;
      md += `|---|---|---|\n`;
      for (const sig of data.signatures) {
        const matchesStr = sig.matches.map(m => `0x${m.offset.toString(16).toUpperCase()} (${m.patternType})`).join(', ');
        md += `| **${sig.ruleName}** | \`${sig.category}\` | ${matchesStr} |\n`;
      }
    } else {
      md += `No signatures matched.\n`;
    }
    md += `\n`;

    // Entropy Blocks
    md += `## 📈 High Entropy Blocks\n\n`;
    if (data.entropy.highEntropyBlocks && data.entropy.highEntropyBlocks.length > 0) {
      md += `| Start Offset | End Offset | Length | Entropy |\n`;
      md += `|---|---|---|---|\n`;
      for (const block of data.entropy.highEntropyBlocks) {
        md += `| 0x${block.start.toString(16).toUpperCase()} | 0x${block.end.toString(16).toUpperCase()} | ${block.length} B | ${block.entropy.toFixed(4)} |\n`;
      }
    } else {
      md += `No high entropy blocks detected (entropy >= 7.2).\n`;
    }
    md += `\n`;

    // Extracted Strings
    md += `## 💬 Extracted Strings (Top 100)\n\n`;
    if (data.strings && data.strings.length > 0) {
      md += `| Offset | Address | Encoding | Tags | String Value |\n`;
      md += `|---|---|---|---|---|\n`;
      const displayedStrings = data.strings.slice(0, 100);
      for (const str of displayedStrings) {
        const tagsStr = str.tags.length > 0 ? str.tags.map(t => `\`${t}\``).join(', ') : '-';
        const escapedValue = str.value.replace(/\|/g, '\\|').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        md += `| 0x${str.offset.toString(16).toUpperCase()} | 0x${str.virtualAddress.toString(16).toUpperCase()} | \`${str.encoding}\` | ${tagsStr} | \`${escapedValue}\` |\n`;
      }
      if (data.strings.length > 100) {
        md += `| ... | ... | ... | ... | ... |\n`;
        md += `\n*Showing top 100 strings. Check JSON report for full list.*\n`;
      }
    } else {
      md += `No strings extracted.\n`;
    }
    md += `\n`;

    return md;
  }
}
