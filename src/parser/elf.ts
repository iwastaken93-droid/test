export interface ElfHeader {
  class: '32-bit' | '64-bit' | 'Unknown';
  endianness: 'Little Endian' | 'Big Endian' | 'Unknown';
  osAbi: string;
  type: string;
  machine: string;
  entryPoint: bigint | number;
  phOff: bigint | number;
  shOff: bigint | number;
  flags: number;
  ehSize: number;
  phentSize: number;
  phNum: number;
  shentSize: number;
  shNum: number;
  shStrNdX: number;
}

export interface ElfSectionHeader {
  nameOffset: number;
  name: string; // resolved if shstrtab is present/parsed
  type: number;
  typeName: string;
  flags: bigint | number;
  addr: bigint | number;
  offset: bigint | number;
  size: bigint | number;
  link: number;
  info: number;
  addralign: bigint | number;
  entsize: bigint | number;
}

export interface ElfProgramHeader {
  type: number;
  typeName: string;
  flags: number;
  offset: bigint | number;
  vaddr: bigint | number;
  paddr: bigint | number;
  filesz: bigint | number;
  memsz: bigint | number;
  align: bigint | number;
}

export interface ParsedElf {
  header: ElfHeader;
  programHeaders: ElfProgramHeader[];
  sectionHeaders: ElfSectionHeader[];
}

// ELF Constants and Mappings
const ELF_CLASS: Record<number, '32-bit' | '64-bit' | 'Unknown'> = {
  1: '32-bit',
  2: '64-bit',
};

const ELF_DATA: Record<number, 'Little Endian' | 'Big Endian' | 'Unknown'> = {
  1: 'Little Endian',
  2: 'Big Endian',
};

const ELF_OSABI: Record<number, string> = {
  0x00: 'System V',
  0x01: 'HP-UX',
  0x02: 'NetBSD',
  0x03: 'Linux',
  0x06: 'Solaris',
  0x07: 'AIX',
  0x08: 'IRIX',
  0x09: 'FreeBSD',
  0x0c: 'OpenBSD',
  0x0d: 'OpenVMS',
  0x0e: 'NSK',
  0x0f: 'AROS',
  0x10: 'FenixOS',
  0x11: 'Nuxi CloudABI',
  0x12: 'Stratus Technologies OpenVOS',
};

const ELF_TYPE: Record<number, string> = {
  0: 'NONE (No file type)',
  1: 'REL (Relocatable file)',
  2: 'EXEC (Executable file)',
  3: 'DYN (Shared object file)',
  4: 'CORE (Core file)',
};

const ELF_MACHINE: Record<number, string> = {
  0: 'No machine',
  2: 'SPARC',
  3: 'x86',
  8: 'MIPS',
  19: 'Intel i860',
  20: 'PowerPC',
  22: 'S390',
  40: 'ARM',
  42: 'SuperH',
  50: 'IA-64',
  62: 'AMD64 (x86-64)',
  183: 'AArch64 (ARM 64-bit)',
  243: 'RISC-V',
};

const SHT_TYPE: Record<number, string> = {
  0: 'SHT_NULL',
  1: 'SHT_PROGBITS',
  2: 'SHT_SYMTAB',
  3: 'SHT_STRTAB',
  4: 'SHT_RELA',
  5: 'SHT_HASH',
  6: 'SHT_DYNAMIC',
  7: 'SHT_NOTE',
  8: 'SHT_NOBITS',
  9: 'SHT_REL',
  10: 'SHT_SHLIB',
  11: 'SHT_DYNSYM',
  14: 'SHT_INIT_ARRAY',
  15: 'SHT_FINI_ARRAY',
  16: 'SHT_PREINIT_ARRAY',
  17: 'SHT_GROUP',
  18: 'SHT_SYMTAB_SHNDX',
};

const PT_TYPE: Record<number, string> = {
  0: 'PT_NULL',
  1: 'PT_LOAD',
  2: 'PT_DYNAMIC',
  3: 'PT_INTERP',
  4: 'PT_NOTE',
  5: 'PT_SHLIB',
  6: 'PT_PHDR',
  7: 'PT_TLS',
  0x60000000: 'PT_LOOS',
  0x6fffffff: 'PT_HIOS',
  0x70000000: 'PT_LOPROC',
  0x7fffffff: 'PT_HIPROC',
  0x6474e550: 'PT_GNU_EH_FRAME',
  0x6474e551: 'PT_GNU_STACK',
  0x6474e552: 'PT_GNU_RELRO',
};

export function parseElf(arrayBuffer: ArrayBuffer): ParsedElf {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);

  // Validate ELF Magic: 0x7F, 'E', 'L', 'F'
  if (
    bytes[0] !== 0x7f ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0x4c ||
    bytes[3] !== 0x46
  ) {
    throw new Error('Invalid ELF Magic header');
  }

  const classVal = bytes[4];
  const elfClass = ELF_CLASS[classVal] || 'Unknown';
  if (elfClass === 'Unknown') {
    throw new Error(`Unsupported or unknown ELF class: ${classVal}`);
  }

  const dataVal = bytes[5];
  const endianness = ELF_DATA[dataVal] || 'Unknown';
  if (endianness === 'Unknown') {
    throw new Error(`Unsupported or unknown endianness: ${dataVal}`);
  }

  const littleEndian = endianness === 'Little Endian';
  const osAbiVal = bytes[7];
  const osAbi = ELF_OSABI[osAbiVal] || `Unknown (${osAbiVal})`;

  // Parsing Type and Machine
  const typeVal = view.getUint16(16, littleEndian);
  const type = ELF_TYPE[typeVal] || `Unknown (${typeVal})`;

  const machineVal = view.getUint16(18, littleEndian);
  const machine = ELF_MACHINE[machineVal] || `Unknown (${machineVal})`;

  let entryPoint: bigint | number;
  let phOff: bigint | number;
  let shOff: bigint | number;
  let flags: number;
  let ehSize: number;
  let phentSize: number;
  let phNum: number;
  let shentSize: number;
  let shNum: number;
  let shStrNdX: number;

  const is64 = elfClass === '64-bit';

  if (is64) {
    entryPoint = view.getBigUint64(24, littleEndian);
    phOff = view.getBigUint64(32, littleEndian);
    shOff = view.getBigUint64(40, littleEndian);
    flags = view.getUint32(48, littleEndian);
    ehSize = view.getUint16(52, littleEndian);
    phentSize = view.getUint16(54, littleEndian);
    phNum = view.getUint16(56, littleEndian);
    shentSize = view.getUint16(58, littleEndian);
    shNum = view.getUint16(60, littleEndian);
    shStrNdX = view.getUint16(62, littleEndian);
  } else {
    entryPoint = view.getUint32(24, littleEndian);
    phOff = view.getUint32(28, littleEndian);
    shOff = view.getUint32(32, littleEndian);
    flags = view.getUint32(36, littleEndian);
    ehSize = view.getUint16(40, littleEndian);
    phentSize = view.getUint16(42, littleEndian);
    phNum = view.getUint16(44, littleEndian);
    shentSize = view.getUint16(46, littleEndian);
    shNum = view.getUint16(48, littleEndian);
    shStrNdX = view.getUint16(50, littleEndian);
  }

  const header: ElfHeader = {
    class: elfClass,
    endianness,
    osAbi,
    type,
    machine,
    entryPoint,
    phOff,
    shOff,
    flags,
    ehSize,
    phentSize,
    phNum,
    shentSize,
    shNum,
    shStrNdX,
  };

  // Program Headers
  const programHeaders: ElfProgramHeader[] = [];
  const phOffsetNum = Number(phOff);
  for (let i = 0; i < phNum; i++) {
    const offset = phOffsetNum + i * phentSize;
    if (offset + phentSize > arrayBuffer.byteLength) break;

    let pType: number;
    let pFlags = 0;
    let pOffset: bigint | number;
    let pVaddr: bigint | number;
    let pPaddr: bigint | number;
    let pFilesz: bigint | number;
    let pMemsz: bigint | number;
    let pAlign: bigint | number;

    if (is64) {
      pType = view.getUint32(offset, littleEndian);
      pFlags = view.getUint32(offset + 4, littleEndian);
      pOffset = view.getBigUint64(offset + 8, littleEndian);
      pVaddr = view.getBigUint64(offset + 16, littleEndian);
      pPaddr = view.getBigUint64(offset + 24, littleEndian);
      pFilesz = view.getBigUint64(offset + 32, littleEndian);
      pMemsz = view.getBigUint64(offset + 40, littleEndian);
      pAlign = view.getBigUint64(offset + 48, littleEndian);
    } else {
      pType = view.getUint32(offset, littleEndian);
      pOffset = view.getUint32(offset + 4, littleEndian);
      pVaddr = view.getUint32(offset + 8, littleEndian);
      pPaddr = view.getUint32(offset + 12, littleEndian);
      pFilesz = view.getUint32(offset + 16, littleEndian);
      pMemsz = view.getUint32(offset + 20, littleEndian);
      pFlags = view.getUint32(offset + 24, littleEndian);
      pAlign = view.getUint32(offset + 28, littleEndian);
    }

    programHeaders.push({
      type: pType,
      typeName: PT_TYPE[pType] || `PT_UNKNOWN (${pType})`,
      flags: pFlags,
      offset: pOffset,
      vaddr: pVaddr,
      paddr: pPaddr,
      filesz: pFilesz,
      memsz: pMemsz,
      align: pAlign,
    });
  }

  // Section Headers
  const sectionHeaders: ElfSectionHeader[] = [];
  const shOffsetNum = Number(shOff);
  for (let i = 0; i < shNum; i++) {
    const offset = shOffsetNum + i * shentSize;
    if (offset + shentSize > arrayBuffer.byteLength) break;

    let shName: number;
    let shType: number;
    let shFlags: bigint | number;
    let shAddr: bigint | number;
    let shSecOffset: bigint | number;
    let shSize: bigint | number;
    let shLink: number;
    let shInfo: number;
    let shAddralign: bigint | number;
    let shEntsize: bigint | number;

    if (is64) {
      shName = view.getUint32(offset, littleEndian);
      shType = view.getUint32(offset + 4, littleEndian);
      shFlags = view.getBigUint64(offset + 8, littleEndian);
      shAddr = view.getBigUint64(offset + 16, littleEndian);
      shSecOffset = view.getBigUint64(offset + 24, littleEndian);
      shSize = view.getBigUint64(offset + 32, littleEndian);
      shLink = view.getUint32(offset + 40, littleEndian);
      shInfo = view.getUint32(offset + 44, littleEndian);
      shAddralign = view.getBigUint64(offset + 48, littleEndian);
      shEntsize = view.getBigUint64(offset + 56, littleEndian);
    } else {
      shName = view.getUint32(offset, littleEndian);
      shType = view.getUint32(offset + 4, littleEndian);
      shFlags = view.getUint32(offset + 8, littleEndian);
      shAddr = view.getUint32(offset + 12, littleEndian);
      shSecOffset = view.getUint32(offset + 16, littleEndian);
      shSize = view.getUint32(offset + 20, littleEndian);
      shLink = view.getUint32(offset + 24, littleEndian);
      shInfo = view.getUint32(offset + 28, littleEndian);
      shAddralign = view.getUint32(offset + 32, littleEndian);
      shEntsize = view.getUint32(offset + 36, littleEndian);
    }

    sectionHeaders.push({
      nameOffset: shName,
      name: '', // resolved below
      type: shType,
      typeName: SHT_TYPE[shType] || `SHT_UNKNOWN (${shType})`,
      flags: shFlags,
      addr: shAddr,
      offset: shSecOffset,
      size: shSize,
      link: shLink,
      info: shInfo,
      addralign: shAddralign,
      entsize: shEntsize,
    });
  }

  // Resolve section names using the String Table (shstrtab) if available
  if (shStrNdX > 0 && shStrNdX < sectionHeaders.length) {
    const shstrtabHeader = sectionHeaders[shStrNdX];
    const shstrtabOffset = Number(shstrtabHeader.offset);
    const shstrtabSize = Number(shstrtabHeader.size);

    if (shstrtabOffset + shstrtabSize <= arrayBuffer.byteLength) {
      for (const section of sectionHeaders) {
        const start = shstrtabOffset + section.nameOffset;
        if (start < shstrtabOffset + shstrtabSize) {
          // Extract null-terminated string
          let name = '';
          for (let j = start; j < shstrtabOffset + shstrtabSize; j++) {
            if (bytes[j] === 0) break;
            name += String.fromCharCode(bytes[j]);
          }
          section.name = name;
        }
      }
    }
  }

  return {
    header,
    programHeaders,
    sectionHeaders,
  };
}
