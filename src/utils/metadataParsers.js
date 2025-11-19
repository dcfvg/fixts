/* Node.js-only module - delegates to metadataParsers-core.js and fileMetadataParser.js */
/**
 * @module metadataParsers
 * @browserSafe false
 * @requires fileMetadataParser
 * @description Node.js wrapper for metadata parsing (delegates to core + file system)
 */

import { parseDateString, parseEXIFDateTime } from './dateUtils.js';

/**
 * Parse EXIF segment to extract timestamp from JPEG DataView
 * Priority: DateTimeOriginal (0x9003) > DateTimeDigitized (0x9004) > DateTime (0x0132)
 * @param {DataView} dataView - DataView of image file
 * @returns {Date|null} - Extracted timestamp or null
 */
export function parseEXIFSegment(dataView) {
  try {
    // Check for JPEG marker
    if (dataView.getUint16(0, false) !== 0xffd8) {
      return null; // Not a JPEG
    }

    // Find EXIF segment
    let offset = 2;
    while (offset < dataView.byteLength) {
      if (dataView.getUint8(offset) !== 0xff) break;

      const marker = dataView.getUint8(offset + 1);
      if (marker === 0xe1) {
        // APP1 marker (EXIF)
        const exifData = parseEXIFSegmentInternal(dataView, offset + 4);
        if (exifData) {
          return exifData;
        }
      }

      offset += 2 + dataView.getUint16(offset + 2, false);
    }
  } catch {
    // Silent fail
  }

  return null;
}

/**
 * Internal EXIF parser
 * @param {DataView} dataView - DataView of JPEG data
 * @param {number} offset - Offset to start parsing
 * @returns {object|null} Extracted datetime or null
 */
function parseEXIFSegmentInternal(dataView, offset) {
  try {
    // Check EXIF header
    if (dataView.getUint32(offset, false) !== 0x45786966) {
      // "Exif"
      return null;
    }

    offset += 6; // Skip "Exif\0\0"

    // Check byte order
    const byteOrder = dataView.getUint16(offset, false);
    const littleEndian = byteOrder === 0x4949; // "II"

    // Skip to IFD offset
    const ifdOffset = dataView.getUint32(offset + 4, littleEndian);
    const ifdStart = offset + ifdOffset;

    // Collect all datetime values with their priority
    const datetimes = {
      dateTimeOriginal: null, // 0x9003 - Priority 1 (capture time)
      dateTimeDigitized: null, // 0x9004 - Priority 2
      dateTime: null, // 0x0132 - Priority 3 (file modification)
    };

    // Read IFD0 entries
    const numEntries = dataView.getUint16(ifdStart, littleEndian);

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdStart + 2 + i * 12;
      const tag = dataView.getUint16(entryOffset, littleEndian);

      // Check for SubIFD (Exif IFD tag 0x8769) - most important, check first
      if (tag === 0x8769) {
        const subIfdOffset = dataView.getUint32(entryOffset + 8, littleEndian);
        const subDates = parseIFDForDates(dataView, offset + subIfdOffset, littleEndian, offset);
        // Merge SubIFD results with priority (SubIFD takes precedence)
        if (subDates.dateTimeOriginal) datetimes.dateTimeOriginal = subDates.dateTimeOriginal;
        if (subDates.dateTimeDigitized) datetimes.dateTimeDigitized = subDates.dateTimeDigitized;
        if (subDates.dateTime && !datetimes.dateTime) datetimes.dateTime = subDates.dateTime;
      }

      // Tags in IFD0: 0x9003 = DateTimeOriginal, 0x0132 = DateTime, 0x9004 = DateTimeDigitized
      if (tag === 0x9003 && !datetimes.dateTimeOriginal) {
        const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian);
        const dateTimeStr = readASCIIString(dataView, offset + valueOffset, 19);
        datetimes.dateTimeOriginal = parseEXIFDateTime(dateTimeStr);
      } else if (tag === 0x9004 && !datetimes.dateTimeDigitized) {
        const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian);
        const dateTimeStr = readASCIIString(dataView, offset + valueOffset, 19);
        datetimes.dateTimeDigitized = parseEXIFDateTime(dateTimeStr);
      } else if (tag === 0x0132 && !datetimes.dateTime) {
        const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian);
        const dateTimeStr = readASCIIString(dataView, offset + valueOffset, 19);
        datetimes.dateTime = parseEXIFDateTime(dateTimeStr);
      }
    }

    // Return in priority order: DateTimeOriginal > DateTimeDigitized > DateTime
    if (datetimes.dateTimeOriginal) {
      return datetimes.dateTimeOriginal;
    }
    if (datetimes.dateTimeDigitized) {
      return datetimes.dateTimeDigitized;
    }
    if (datetimes.dateTime) {
      return datetimes.dateTime;
    }
  } catch {
    // Silent fail
  }

  return null;
}

/**
 * Parse a single IFD (Image File Directory) and extract datetime tags
 * @param {DataView} dataView - DataView of EXIF data
 * @param {number} ifdStart - Start offset of IFD
 * @param {boolean} littleEndian - Byte order flag
 * @param {number} baseOffset - Base offset for calculating pointers
 * @returns {object} - Object with dateTimeOriginal, dateTimeDigitized, dateTime properties
 */
function parseIFDForDates(dataView, ifdStart, littleEndian, baseOffset) {
  const result = {
    dateTimeOriginal: null,
    dateTimeDigitized: null,
    dateTime: null,
  };

  try {
    const numEntries = dataView.getUint16(ifdStart, littleEndian);

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdStart + 2 + i * 12;
      const tag = dataView.getUint16(entryOffset, littleEndian);

      if (tag === 0x9003) {
        const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian);
        const dateTimeStr = readASCIIString(dataView, baseOffset + valueOffset, 19);
        result.dateTimeOriginal = parseEXIFDateTime(dateTimeStr);
      } else if (tag === 0x9004) {
        const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian);
        const dateTimeStr = readASCIIString(dataView, baseOffset + valueOffset, 19);
        result.dateTimeDigitized = parseEXIFDateTime(dateTimeStr);
      } else if (tag === 0x0132) {
        const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian);
        const dateTimeStr = readASCIIString(dataView, baseOffset + valueOffset, 19);
        result.dateTime = parseEXIFDateTime(dateTimeStr);
      }
    }
  } catch {
    // Silent fail
  }

  return result;
}

/**
 * Read ASCII string from DataView
 * @param {DataView} dataView - DataView to read from
 * @param {number} offset - Offset to start reading
 * @param {number} length - Number of bytes to read
 * @returns {string} Extracted ASCII string
 */
function readASCIIString(dataView, offset, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    const charCode = dataView.getUint8(offset + i);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str;
}

/**
 * Parse MP3 ID3v2 tags for timestamp
 * Looks for TDRC (recording time), TDOR (original release), or TDAT/TYER (ID3v2.3)
 * @param {DataView} dataView - DataView of MP3 file
 * @returns {Date|null} - Extracted timestamp or null
 */
export function parseID3v2Timestamp(dataView) {
  try {
    // Check for ID3v2 header
    if (dataView.byteLength < 10) return null;

    const id3Header = String.fromCharCode(
      dataView.getUint8(0),
      dataView.getUint8(1),
      dataView.getUint8(2)
    );

    if (id3Header !== 'ID3') return null;

    const version = dataView.getUint8(3);
    const flags = dataView.getUint8(5);

    // Parse syncsafe integer for tag size
    const size =
      ((dataView.getUint8(6) & 0x7f) << 21) |
      ((dataView.getUint8(7) & 0x7f) << 14) |
      ((dataView.getUint8(8) & 0x7f) << 7) |
      (dataView.getUint8(9) & 0x7f);

    let offset = 10;

    // Skip extended header if present
    if (flags & 0x40) {
      const extHeaderSize =
        ((dataView.getUint8(offset) & 0x7f) << 21) |
        ((dataView.getUint8(offset + 1) & 0x7f) << 14) |
        ((dataView.getUint8(offset + 2) & 0x7f) << 7) |
        (dataView.getUint8(offset + 3) & 0x7f);
      offset += extHeaderSize;
    }

    const endOffset = 10 + size;

    // Look for timestamp frames: TDRC (v2.4), TDOR (v2.4), or TYER+TDAT (v2.3)
    while (offset < endOffset - 10) {
      const frameId = String.fromCharCode(
        dataView.getUint8(offset),
        dataView.getUint8(offset + 1),
        dataView.getUint8(offset + 2),
        dataView.getUint8(offset + 3)
      );

      if (frameId === '\0\0\0\0') break;

      let frameSize;
      if (version === 4) {
        // ID3v2.4 uses syncsafe integers
        frameSize =
          ((dataView.getUint8(offset + 4) & 0x7f) << 21) |
          ((dataView.getUint8(offset + 5) & 0x7f) << 14) |
          ((dataView.getUint8(offset + 6) & 0x7f) << 7) |
          (dataView.getUint8(offset + 7) & 0x7f);
      } else {
        // ID3v2.3 uses regular integers
        frameSize =
          (dataView.getUint8(offset + 4) << 24) |
          (dataView.getUint8(offset + 5) << 16) |
          (dataView.getUint8(offset + 6) << 8) |
          dataView.getUint8(offset + 7);
      }

      // TDRC = Recording time (ID3v2.4), TDOR = Original release time
      if (frameId === 'TDRC' || frameId === 'TDOR' || frameId === 'TYER') {
        const encoding = dataView.getUint8(offset + 10);
        let textOffset = offset + 11;

        // Skip BOM for UTF-16
        if (encoding === 1 || encoding === 2) {
          textOffset += 2;
        }

        let dateStr = '';
        for (let i = textOffset; i < offset + 10 + frameSize && i < dataView.byteLength; i++) {
          const byte = dataView.getUint8(i);
          if (byte === 0) break;
          dateStr += String.fromCharCode(byte);
        }

        // Parse ISO 8601 date: YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD or YYYY
        const parsed = parseDateString(dateStr);
        if (parsed) return parsed;
      }

      offset += 10 + frameSize;
    }
  } catch {
    // Silent fail
  }

  return null;
}

/**
 * Parse M4A/AAC metadata atoms for timestamp
 * @param {DataView} dataView - DataView of M4A file
 * @returns {Date|null} - Extracted timestamp or null
 */
export function parseM4ATimestamp(dataView) {
  try {
    // Look for moov > udta > meta > ilst atoms
    // M4A files use atom structure: [size:4][type:4][data...]

    const moovOffset = findAtom(dataView, 'moov', 0);
    if (moovOffset === -1) return null;

    const udtaOffset = findAtom(dataView, 'udta', moovOffset);
    if (udtaOffset === -1) return null;

    const metaOffset = findAtom(dataView, 'meta', udtaOffset);
    if (metaOffset === -1) return null;

    // Skip meta version/flags (4 bytes after 'meta')
    const ilstOffset = findAtom(dataView, 'ilst', metaOffset + 4);
    if (ilstOffset === -1) return null;

    // Look for ©day atom (creation date)
    const dayAtomOffset = findAtom(dataView, '©day', ilstOffset);
    if (dayAtomOffset !== -1) {
      // Read the data atom inside ©day
      const dataOffset = findAtom(dataView, 'data', dayAtomOffset);
      if (dataOffset !== -1) {
        const dataSize = dataView.getUint32(dataOffset - 4, false);
        const textStart = dataOffset + 8; // Skip type and locale

        let dateStr = '';
        for (let i = textStart; i < dataOffset - 4 + dataSize && i < dataView.byteLength; i++) {
          const byte = dataView.getUint8(i);
          if (byte === 0) break;
          dateStr += String.fromCharCode(byte);
        }

        const parsed = parseDateString(dateStr);
        if (parsed) return parsed;
      }
    }
  } catch {
    // Silent fail
  }

  return null;
}

/**
 * Find an atom in M4A file structure
 * @param {DataView} dataView - DataView of file
 * @param {string} atomType - 4-character atom type
 * @param {number} startOffset - Where to start searching
 * @returns {number} - Offset to atom data (after size+type) or -1
 */
function findAtom(dataView, atomType, startOffset) {
  try {
    const parentSize = dataView.byteLength;
    let offset = startOffset;

    while (offset < parentSize - 8) {
      const atomSize = dataView.getUint32(offset, false);
      const type = String.fromCharCode(
        dataView.getUint8(offset + 4),
        dataView.getUint8(offset + 5),
        dataView.getUint8(offset + 6),
        dataView.getUint8(offset + 7)
      );

      if (type === atomType) {
        return offset + 8; // Return offset to data (after size+type)
      }

      if (atomSize === 0 || atomSize > parentSize - offset) break;
      offset += atomSize;
    }
  } catch {
    // Silent fail
  }

  return -1;
}

/**
 * Parse OGG Vorbis comments for timestamp
 * @param {DataView} dataView - DataView of OGG file
 * @returns {Date|null} - Extracted timestamp or null
 */
export function parseOGGTimestamp(dataView) {
  try {
    // OGG format: pages with segments containing Vorbis comment packets
    // Look for "OggS" page markers and Vorbis comment header

    let offset = 0;
    while (offset < dataView.byteLength - 4) {
      // Find OggS page
      if (
        String.fromCharCode(
          dataView.getUint8(offset),
          dataView.getUint8(offset + 1),
          dataView.getUint8(offset + 2),
          dataView.getUint8(offset + 3)
        ) === 'OggS'
      ) {
        // Skip to segments
        const segmentCount = dataView.getUint8(offset + 26);
        let pageDataOffset = offset + 27 + segmentCount;

        // Check for Vorbis comment packet (starts with 0x03 + "vorbis")
        if (pageDataOffset + 7 < dataView.byteLength) {
          const packetType = dataView.getUint8(pageDataOffset);
          const vorbisStr = String.fromCharCode(
            dataView.getUint8(pageDataOffset + 1),
            dataView.getUint8(pageDataOffset + 2),
            dataView.getUint8(pageDataOffset + 3),
            dataView.getUint8(pageDataOffset + 4),
            dataView.getUint8(pageDataOffset + 5),
            dataView.getUint8(pageDataOffset + 6)
          );

          if (packetType === 0x03 && vorbisStr === 'vorbis') {
            // Found Vorbis comment header
            // Skip vendor string
            pageDataOffset += 7;
            const vendorLength = dataView.getUint32(pageDataOffset, true);
            pageDataOffset += 4 + vendorLength;

            // Read comment count
            const commentCount = dataView.getUint32(pageDataOffset, true);
            pageDataOffset += 4;

            // Parse comments
            for (let i = 0; i < commentCount && pageDataOffset < dataView.byteLength - 4; i++) {
              const commentLength = dataView.getUint32(pageDataOffset, true);
              pageDataOffset += 4;

              let comment = '';
              for (let j = 0; j < commentLength && pageDataOffset + j < dataView.byteLength; j++) {
                comment += String.fromCharCode(dataView.getUint8(pageDataOffset + j));
              }

              // Look for DATE= or CREATION_TIME= tags
              if (comment.toUpperCase().startsWith('DATE=')) {
                const dateStr = comment.substring(5);
                const parsed = parseDateString(dateStr);
                if (parsed) return parsed;
              }
              if (comment.toUpperCase().startsWith('CREATION_TIME=')) {
                const dateStr = comment.substring(14);
                const parsed = parseDateString(dateStr);
                if (parsed) return parsed;
              }

              pageDataOffset += commentLength;
            }

            return null; // Found comment header but no date
          }
        }
      }

      offset++;
    }
  } catch {
    // Silent fail
  }

  return null;
}

/**
 * Parse WAV file metadata for timestamp
 * Looks for RIFF INFO chunks (ICRD, IDIT) or Broadcast Wave Format bext chunk
 * @param {DataView} dataView - DataView of WAV file
 * @returns {Date|null} - Extracted timestamp or null
 */
export function parseWAVTimestamp(dataView) {
  try {
    // Check for RIFF header
    if (dataView.byteLength < 12) return null;

    const riffHeader = String.fromCharCode(
      dataView.getUint8(0),
      dataView.getUint8(1),
      dataView.getUint8(2),
      dataView.getUint8(3)
    );

    if (riffHeader !== 'RIFF') return null;

    const waveHeader = String.fromCharCode(
      dataView.getUint8(8),
      dataView.getUint8(9),
      dataView.getUint8(10),
      dataView.getUint8(11)
    );

    if (waveHeader !== 'WAVE') return null;

    let offset = 12;
    const fileSize = dataView.getUint32(4, true);

    // Look for INFO or bext chunks
    while (offset < fileSize && offset < dataView.byteLength - 8) {
      const chunkId = String.fromCharCode(
        dataView.getUint8(offset),
        dataView.getUint8(offset + 1),
        dataView.getUint8(offset + 2),
        dataView.getUint8(offset + 3)
      );

      const chunkSize = dataView.getUint32(offset + 4, true);

      // Broadcast Wave Format bext chunk (most reliable for timestamps)
      if (chunkId === 'bext') {
        // bext originationDate at offset 330 (YYYY-MM-DD, 10 bytes)
        // bext originationTime at offset 340 (HH:MM:SS, 8 bytes)
        if (offset + 348 <= dataView.byteLength) {
          let dateStr = '';
          for (let i = 0; i < 10; i++) {
            const char = dataView.getUint8(offset + 8 + 330 + i);
            if (char === 0) break;
            dateStr += String.fromCharCode(char);
          }

          let timeStr = '';
          for (let i = 0; i < 8; i++) {
            const char = dataView.getUint8(offset + 8 + 340 + i);
            if (char === 0) break;
            timeStr += String.fromCharCode(char);
          }

          if (dateStr && timeStr) {
            const parsed = parseDateString(`${dateStr} ${timeStr}`);
            if (parsed) return parsed;
          }
        }
      }

      // INFO chunk with ICRD (creation date) or IDIT (digitization time)
      if (chunkId === 'LIST') {
        const listType = String.fromCharCode(
          dataView.getUint8(offset + 8),
          dataView.getUint8(offset + 9),
          dataView.getUint8(offset + 10),
          dataView.getUint8(offset + 11)
        );

        if (listType === 'INFO') {
          let infoOffset = offset + 12;
          const listEnd = offset + 8 + chunkSize;

          while (infoOffset < listEnd && infoOffset < dataView.byteLength - 8) {
            const infoId = String.fromCharCode(
              dataView.getUint8(infoOffset),
              dataView.getUint8(infoOffset + 1),
              dataView.getUint8(infoOffset + 2),
              dataView.getUint8(infoOffset + 3)
            );

            const infoSize = dataView.getUint32(infoOffset + 4, true);

            // ICRD = Creation date, IDIT = Digitization time
            if (infoId === 'ICRD' || infoId === 'IDIT') {
              let dateStr = '';
              for (let i = 0; i < infoSize && infoOffset + 8 + i < dataView.byteLength; i++) {
                const char = dataView.getUint8(infoOffset + 8 + i);
                if (char === 0) break;
                dateStr += String.fromCharCode(char);
              }

              const parsed = parseDateString(dateStr);
              if (parsed) return parsed;
            }

            infoOffset += 8 + infoSize + (infoSize % 2); // Chunks are word-aligned
          }
        }
      }

      offset += 8 + chunkSize + (chunkSize % 2); // Chunks are word-aligned
    }
  } catch {
    // Silent fail
  }

  return null;
}

/**
 * Parse AIFF/AIFC file metadata for timestamp
 * Looks for NAME, AUTH, and ANNO chunks which may contain date information
 * @param {DataView} dataView - DataView of AIFF/AIFC file
 * @returns {Date|null} - Extracted timestamp or null
 */
export function parseAIFFTimestamp(dataView) {
  try {
    // Check for FORM header
    if (dataView.byteLength < 12) return null;

    const formHeader = String.fromCharCode(
      dataView.getUint8(0),
      dataView.getUint8(1),
      dataView.getUint8(2),
      dataView.getUint8(3)
    );

    if (formHeader !== 'FORM') return null;

    const aiffType = String.fromCharCode(
      dataView.getUint8(8),
      dataView.getUint8(9),
      dataView.getUint8(10),
      dataView.getUint8(11)
    );

    // AIFF or AIFC
    if (aiffType !== 'AIFF' && aiffType !== 'AIFC') return null;

    let offset = 12;
    const fileSize = dataView.getUint32(4, false); // Big-endian

    // Look for annotation chunks
    while (offset < fileSize && offset < dataView.byteLength - 8) {
      const chunkId = String.fromCharCode(
        dataView.getUint8(offset),
        dataView.getUint8(offset + 1),
        dataView.getUint8(offset + 2),
        dataView.getUint8(offset + 3)
      );

      const chunkSize = dataView.getUint32(offset + 4, false); // Big-endian

      // NAME, AUTH, ANNO, or (c) chunks may contain date info
      if (chunkId === 'NAME' || chunkId === 'AUTH' || chunkId === 'ANNO' || chunkId === '(c) ') {
        let text = '';
        for (let i = 0; i < chunkSize && offset + 8 + i < dataView.byteLength; i++) {
          const char = dataView.getUint8(offset + 8 + i);
          if (char === 0) break;
          text += String.fromCharCode(char);
        }

        // Try to extract date from text
        const parsed = parseDateString(text);
        if (parsed) return parsed;

        // Look for date patterns in the text
        const dateMatch = text.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
        if (dateMatch) {
          const parsed = parseDateString(dateMatch[0]);
          if (parsed) return parsed;
        }
      }

      offset += 8 + chunkSize + (chunkSize % 2); // Chunks are word-aligned
    }
  } catch {
    // Silent fail
  }

  return null;
}
