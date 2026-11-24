# What a Mach-O program holds, without its signature: the SHA-256 of every section of every segment but
# __LINKEDIT, which is where codesign writes. Two builds of the same code, signed by different people, give the
# same lines; a changed instruction or constant does not. Used by the Mac app workflow (mac-app.yml).
#   python3 macho-content.py <file>
import hashlib
import struct
import sys

LC_SEGMENT_64 = 0x19
ZEROFILL = {0x1, 0xC, 0x12}  # S_ZEROFILL, S_GB_ZEROFILL, S_THREAD_LOCAL_ZEROFILL: no bytes in the file


def thin(data, base, arch):
    magic, _, _, _, ncmds, _, _, _ = struct.unpack_from('<IiiIIIII', data, base)
    if magic != 0xFEEDFACF:
        raise SystemExit(f'not a 64-bit Mach-O at {base}')
    lines, at = [], base + 32
    for _ in range(ncmds):
        cmd, size = struct.unpack_from('<II', data, at)
        if cmd == LC_SEGMENT_64:
            segment = data[at + 8:at + 24].rstrip(b'\0').decode()
            nsects = struct.unpack_from('<I', data, at + 64)[0]
            for s in range(nsects):
                h = at + 72 + s * 80
                section = data[h:h + 16].rstrip(b'\0').decode()
                _, _, length, offset = struct.unpack_from('<QQII', data, h + 32)
                kind = struct.unpack_from('<I', data, h + 64)[0] & 0xFF
                if segment == '__LINKEDIT' or kind in ZEROFILL:
                    continue
                body = data[base + offset:base + offset + length]
                lines.append(f'{arch} {segment},{section} {length} {hashlib.sha256(body).hexdigest()}')
        at += size
    return lines


def content(path):
    data = open(path, 'rb').read()
    if struct.unpack_from('>I', data, 0)[0] == 0xCAFEBABE:
        count = struct.unpack_from('>I', data, 4)[0]
        lines = []
        for i in range(count):
            cpu, _, offset, _, _ = struct.unpack_from('>iiIII', data, 8 + i * 20)
            lines += thin(data, offset, cpu)
        return lines
    return thin(data, 0, struct.unpack_from('<i', data, 4)[0])


if __name__ == '__main__':
    print('\n'.join(content(sys.argv[1])))
