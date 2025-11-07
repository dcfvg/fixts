#!/bin/bash
# Setup comprehensive test fixtures for CLI integration tests
# Based on patterns from test/fixtures/patterns/create-test-files.sh

set -e

FIXTURE_DIR="$(cd "$(dirname "$0")/fixtures" && pwd)"
cd "$FIXTURE_DIR"

echo "🧹 Cleaning existing fixtures..."
rm -rf ./* 2>/dev/null || true

echo "📁 Creating comprehensive test fixtures..."

# ============================================
# GROUP 1: ISO Formats (Most standard)
# ============================================
echo "  ✓ ISO formats"
touch "2024-11-02-photo.jpg"
touch "2024_11_02-underscored-date.jpg"
touch "2024.11.02-dots-date.jpg"
touch "20241102-compact-date.txt"
touch "2024-11-02-14-30-25-iso-dashes.txt"
touch "2024_11_02_14_30_25-underscored.txt"
touch "20241102143025-fully-compact.txt"
touch "2024-11-02T14:30:25-iso-t-colons.txt"
touch "20241102_1430-compact-hhmm.txt"
touch "2024-11-02-14.30.25-video.mp4"
touch "2024-11-02-14.30.25.123-precise.log"

# ============================================
# GROUP 2: Prefix Formats (Camera, Phone)
# ============================================
echo "  ✓ Camera/phone formats"
touch "IMG_20241102_143025.jpg"
touch "VID_20241102_143025.mp4"
touch "REC_20241102_143025.m4a"
touch "PXL_20241102_143025.jpg"
touch "DSC_20241102_143025.jpg"
touch "IMG_20241102_143025_HDR.jpg"

# ============================================
# GROUP 3: European Formats (DD-MM-YYYY)
# ============================================
echo "  ✓ European formats"
touch "02-11-2024-european.txt"
touch "02.11.2024-dots.txt"
touch "02-11-2024-14.30.25-european-time.txt"
touch "15-03-2023-clearly-european.txt"  # Day > 12

# ============================================
# GROUP 4: Ambiguous Dates
# ============================================
echo "  ✓ Ambiguous dates"
touch "01-12-2024-ambiguous1.txt"  # Jan 12 or Dec 1
touch "05-06-2024-ambiguous2.txt"  # May 6 or Jun 5
touch "03-04-2024-ambiguous3.txt"  # Mar 4 or Apr 3

# ============================================
# GROUP 5: Partial Dates
# ============================================
echo "  ✓ Partial dates"
touch "2024-11-year-month.txt"
touch "202411-yyyymm.txt"
touch "2024-annual-report.pdf"

# ============================================
# GROUP 6: Special Characters (must preserve)
# ============================================
echo "  ✓ Special characters"
touch "2020-01-01-12-00-00-file[0].txt"
touch "2020-01-01-12-00-00-file(v2).txt"
touch "2020-01-01-12-00-00-file+extra.txt"
touch "2020-01-01-12-00-00-file@work.txt"

# ============================================
# GROUP 7: Phone numbers (must NOT be removed)
# ============================================
echo "  ✓ Files with phone numbers"
touch "2019-03-06-07-45-01-5550000000-[1].m4a"
touch "2018-12-19-11-59-53-+15550000000.mp3"
touch "2019-01-23-22-53-04-Contact-+15550000000-[0].m4a"

# ============================================
# GROUP 8: Keyword Formats
# ============================================
echo "  ✓ Keyword formats"
touch "Screenshot_2024-11-02-14-30-25.png"
touch "Capture_2024-11-02-14-30-25.png"
touch "Recording_2024-11-02-14-30-25.m4a"

# ============================================
# GROUP 9: "at" Separator (Messaging)
# ============================================
echo "  ✓ Messaging formats"
touch "2024-11-02 at 14.30.25.jpg"
touch "2024-11-02 à 14.30.25.jpg"

# ============================================
# GROUP 10: Prefix/Suffix Variations
# ============================================
echo "  ✓ Prefix/suffix variations"
touch "backup_20241102-archive.tar"
touch "log_20241102-system.log"
touch "DRAFT_20241102-wip.docx"
touch "FINAL_20241102_1430-finalized.pdf"
touch "data_20241102-dataset.csv"

# ============================================
# GROUP 11: Time Shift Test Cases
# ============================================
echo "  ✓ Time shift scenarios"
touch "2024-01-01-22-30-00-late-night.txt"      # +2h → crosses midnight
touch "2024-01-01-02-30-00-early-morning.txt"   # -3h → crosses midnight backwards
touch "2024-06-15-12-00-00-noon.txt"            # No midnight crossing

# ============================================
# GROUP 12: Already Formatted
# ============================================
echo "  ✓ Pre-formatted files"
touch "2024-01-15 14.30.00 - already-formatted.txt"
touch "2023-05-03 09.46.35 - formatted.MP3"

# ============================================
# GROUP 13: Files WITHOUT Timestamps (for metadata)
# ============================================
echo "  ✓ No-timestamp files (for metadata)"
touch "photo1.jpg"
touch "photo2.jpg"
touch "document.pdf"

# Set specific modification times for metadata testing
touch -t 202301151430 "photo1.jpg"
touch -t 202112251845 "photo2.jpg"
touch -t 202006151200 "document.pdf"

# ============================================
# GROUP 14: Edge Cases
# ============================================
echo "  ✓ Edge cases"
touch "2024-02-29-leap-year.txt"
touch "2024-12-31-23-59-59-year-end.txt"
touch "2024-01-01-00-00-00-first-second.txt"

# ============================================
# GROUP 15: Named Months
# ============================================
echo "  ✓ Named months"
touch "2024-Nov-02-named-month.txt"
touch "02-Nov-2024-dd-mmm-yyyy.txt"

# ============================================
# GROUP 16: 2-digit Years
# ============================================
echo "  ✓ 2-digit years"
touch "241102-yymmdd.txt"
touch "24-11-02-yy-mm-dd.txt"

# ============================================
# GROUP 17: UTC/Timezone
# ============================================
echo "  ✓ UTC/timezone formats"
touch "2024-11-02T14:30:25Z-utc-z.log"
touch "20241102T143025Z-compact-utc.log"

# ============================================
# GROUP 18: French Time Format (HHhMMmSSs)
# ============================================
echo "  ✓ French time formats"
touch "video-2023-08-15-14h05m37s448.mp4"
touch "capture-2022-10-25-19h16m20s466.png"
touch "screen-2021-06-06-14h40m31s813.jpg"

# ============================================
# GROUP 19: Messaging Apps (WhatsApp)
# ============================================
echo "  ✓ WhatsApp formats"
touch "whatsapp-image-2024-10-25-at-17.04.12.jpg"

# ============================================
# GROUP 20: Double Timestamps (Instagram Montages)
# ============================================
echo "  ✓ Instagram montage formats"
touch "montage-2020-01-04_19.09.17_1234567890123456789_5550000000.jpg"

# ============================================
# GROUP 21: Export with Technical Suffix
# ============================================
echo "  ✓ Export formats with suffix"
touch "export-2024-01-15_14.30.25_suffix-data.csv"

echo ""
echo "✅ Created $(ls -1 | wc -l | awk '{print $1}') test fixtures in:"
echo "   $FIXTURE_DIR"
echo ""
echo "� Pattern Distribution:"
echo "   - ISO formats: ~11 files"
echo "   - Camera/phone prefixes: ~6 files"
echo "   - European formats: ~4 files"
echo "   - Ambiguous dates: ~3 files"
echo "   - Partial dates: ~3 files"
echo "   - Special characters: ~4 files"
echo "   - Phone numbers: ~3 files (CRITICAL TEST)"
echo "   - Keywords: ~3 files"
echo "   - Messaging formats: ~2 files"
echo "   - Prefix/suffix: ~5 files"
echo "   - Time shift: ~3 files (CRITICAL TEST)"
echo "   - Pre-formatted: ~2 files"
echo "   - No timestamp: ~3 files (for metadata)"
echo "   - Edge cases: ~3 files"
echo "   - Named months: ~2 files"
echo "   - 2-digit years: ~2 files"
echo "   - UTC/timezone: ~2 files"
echo "   - French time formats: ~3 files (HHhMMmSSs)"
echo "   - WhatsApp formats: ~1 file"
echo "   - Instagram montages: ~1 file (double timestamps)"
echo "   - Export with suffix: ~1 file"
echo ""
echo "📋 Test Coverage:"
echo "   ✓ Time shift feature (+/- crossing midnight)"
echo "   ✓ Phone number preservation (10-12 digit patterns)"
echo "   ✓ Metadata extraction (files without timestamps)"
echo "   ✓ Special character preservation ([0], (v2), +, @)"
echo "   ✓ Ambiguous date resolution (DD-MM vs MM-DD)"
echo "   ✓ Edge cases (leap year, year-end, first-second)"
echo "   ✓ Various format styles (ISO, European, Camera, etc.)"
echo "   ✓ French time format cleaning (HHhMMmSSsmmm)"
echo "   ✓ WhatsApp 'at' format detection"
echo "   ✓ Instagram double timestamp handling"
echo "   ✓ Export formats with technical suffixes"

