export interface AssWordInput {
  id?: string;
  text?: string;
  word?: string;
  start: number;
  end: number;
  cut?: boolean;
  accent?: boolean;
}

export interface AssChunkInput {
  id?: string;
  start: number;
  end: number;
  text?: string;
  words: AssWordInput[];
}

export interface AssCaptionStyle {
  fontFamily?: string;
  fontSize?: number;
  allCaps?: boolean;
  color?: string;
  primaryColor?: string;
  accentColor?: string;
  /** Warna kotak latar caption: hex (#RRGGBB/#RGB) atau CSS rgb()/rgba() (BorderStyle=3, preview-only radius TIDAK dikirim) */
  boxBg?: string;
  /** Alpha kotak dalam format ASS langsung (00 opaque s/d FF/255 transparan); kalau kosong, diturunkan dari alpha rgba() di boxBg */
  boxAlpha?: number;
}

export interface BuildAssOptions {
  chunks: AssChunkInput[];
  style?: AssCaptionStyle;
  width?: number;
  height?: number;
}

/**
 * Convert hex color (#RRGGBB or #RGB) to ASS style color (&HAABBGGRR)
 * In ASS, alpha 00 is opaque.
 */
export function hexToAssColor(hex?: string, alpha = 0): string {
  if (!hex || typeof hex !== 'string') return '&H00FFFFFF';
  let clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (clean.length !== 6 && clean.length !== 8) {
    return '&H00FFFFFF';
  }
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  const aHex = Math.max(0, Math.min(255, alpha))
    .toString(16)
    .padStart(2, '0');
  return `&H${aHex}${b}${g}${r}`.toUpperCase();
}

/**
 * Parse warna CSS (hex atau rgb()/rgba()) jadi { hex, alpha } (alpha 0-1) untuk kotak latar.
 * 'transparent'/tidak valid => null (tanpa kotak).
 */
export function parseCssColor(css?: string): { hex: string; alpha: number } | null {
  if (!css || typeof css !== 'string') return null;
  const s = css.trim();
  if (s.toLowerCase() === 'transparent' || s.toLowerCase() === 'none') return null;

  const rgba = s.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba?.[1]) {
    const parts = rgba[1].split(/[\s,/]+/).filter(Boolean);
    const rgbNums: number[] = [];
    for (let i = 0; i < 3; i++) {
      const n = parseFloat(parts[i] ?? '');
      if (Number.isNaN(n)) return null;
      rgbNums.push(n);
    }
    const a = parts.length > 3 ? parseFloat(parts[3] ?? '') : 1;
    const hex =
      '#' +
      rgbNums
        .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
        .join('');
    return { hex, alpha: Number.isNaN(a) ? 1 : a };
  }

  const clean = s.replace(/^#/, '').trim();
  // catatan: #RRGGBBAA tidak didukung oleh hexToAssColor (abaikan 2 digit akhir), ajukan alpha eksplisit
  if (clean.length === 3 || clean.length === 6) return { hex: '#' + clean, alpha: 1 };
  return null;
}

/**
 * Convert hex color (#RRGGBB or #RGB) to ASS inline override tag color (&HBBGGRR&)
 */
export function hexToAssTagColor(hex?: string): string {
  if (!hex || typeof hex !== 'string') return '&HFFFFFF&';
  let clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (clean.length !== 6) {
    return '&HFFFFFF&';
  }
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H${b}${g}${r}&`.toUpperCase();
}

/**
 * Format seconds to ASS timestamp: H:MM:SS.cc (centiseconds, 2 digits)
 */
export function formatAssTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const totalCs = Math.floor(s * 100);
  const cs = totalCs % 100;
  const totalSecs = Math.floor(totalCs / 100);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const hours = Math.floor(totalMins / 60);

  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${hours}:${pad(mins)}:${pad(secs)}.${pad(cs)}`;
}

/**
 * Build Advanced SubStation Alpha (ASS) karaoke subtitle string
 */
export function buildAss(options: BuildAssOptions): string {
  const { chunks = [], style = {} } = options;
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;

  const fontFamily = style.fontFamily?.trim() || 'Arial';
  const fontSize = style.fontSize ?? 64;
  const allCaps = style.allCaps ?? false;

  const rawPrimary = style.color || style.primaryColor || '#FFFFFF';
  const rawAccent = style.accentColor || '#FFD700';

  const primaryAssColor = hexToAssColor(rawPrimary);
  const primaryTagColor = hexToAssTagColor(rawPrimary);
  const accentTagColor = hexToAssTagColor(rawAccent);

  // Kotak latar (BorderStyle=3): spesifikasi ASS menaruh kotak di OutlineColour (verif. libass ass_render.c),
  // BackColour hanya dipakai untuk shadow. boxAlpha = alpha ASS langsung (00 opaque, FF transparan);
  // kalau tidak ada, diturunkan dari alpha rgba() di boxBg. Alpha ≥ 255 => tanpa kotak (BorderStyle tetap 1,
  // agar outline teks tetap digambar).
  let boxBorderStyle = 1;
  let boxOutlineColour = '&H00000000';
  const boxColor = parseCssColor(style.boxBg);
  if (boxColor) {
    const assAlpha = Math.max(
      0,
      Math.min(255, Math.round(style.boxAlpha ?? (1 - boxColor.alpha) * 255))
    );
    if (assAlpha < 255) {
      boxBorderStyle = 3;
      boxOutlineColour = hexToAssColor(boxColor.hex, assAlpha);
    }
  }

  // MarginV at ~15% of height (e.g. 288 for 1920) so captions sit on chest level
  const marginV = Math.round(height * 0.15);

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${fontFamily},${fontSize},${primaryAssColor},&H000000FF,${boxOutlineColour},&H00000000,-1,0,0,0,100,100,0,0,${boxBorderStyle},3,0,2,10,10,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const dialogueLines: string[] = [];

  for (const chunk of chunks) {
    if (!chunk || !chunk.words || chunk.words.length === 0) continue;

    // Filter out words with cut: true
    const activeWords = chunk.words.filter((w) => !w.cut);
    if (activeWords.length === 0) continue;

    const startStr = formatAssTimestamp(chunk.start);
    const endStr = formatAssTimestamp(chunk.end);

    const formattedWords: string[] = [];

    for (const w of activeWords) {
      let rawText = String(w.text ?? w.word ?? '').trim();
      if (!rawText) continue;

      if (allCaps) {
        rawText = rawText.toUpperCase();
      }

      // Escape ASS special characters
      const escapedText = rawText
        .replace(/{/g, '(')
        .replace(/}/g, ')')
        .replace(/\r?\n/g, '\\N');

      const cs = Math.max(1, Math.round(Math.max(0, w.end - w.start) * 100));

      if (w.accent) {
        formattedWords.push(`{\\k${cs}\\c${accentTagColor}}${escapedText}{\\c${primaryTagColor}}`);
      } else {
        formattedWords.push(`{\\k${cs}}${escapedText}`);
      }
    }

    if (formattedWords.length > 0) {
      const dialogueText = formattedWords.join(' ');
      dialogueLines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${dialogueText}`);
    }
  }

  return header.concat(dialogueLines).join('\n') + '\n';
}
