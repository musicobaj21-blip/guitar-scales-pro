import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { RootNote } from "../types";
import { EXPLORER_CATEGORIES, ScaleDefinition } from "../data/scales";
import {
  dictionaryAudio,
  GUITAR_INSTRUMENTS,
  GuitarInstrumentId,
} from "../utils/dictionaryAudio";
import { useLanguage } from "../contexts/LanguageContext";
import {
  Search,
  Music,
  BookOpen,
  Play,
  Square,
  Volume2,
  GitCommit,
  Layers,
  Hand,
  Radio,
  ChevronDown,
  Timer,
  Dumbbell,
  Repeat,
} from "lucide-react";

type DotLabelMode = "note" | "degree" | "finger";
type SubdivisionId = 1 | 2 | 3 | 4; // 1=Negra, 2=Corchea, 3=Tresillo, 4=Semicorchea
type TrainerModeId = "scale_playalong" | "spider_exercise";
type RepeatCountOption = 1 | 2 | 4 | 0; // 0 = Infinito

interface SpiderPatternOption {
  id: string;
  label: string;
  fingers: [number, number, number, number];
}

const SPIDER_PATTERNS: SpiderPatternOption[] = [
  {
    id: "1-2-3-4",
    label: "1 – 2 – 3 – 4 (Cromático)",
    fingers: [1, 2, 3, 4],
  },
  {
    id: "1-4-2-3",
    label: "1 – 4 – 2 – 3 (Independencia)",
    fingers: [1, 4, 2, 3],
  },
  {
    id: "1-3-2-4",
    label: "1 – 3 – 2 – 4 (Alternado)",
    fingers: [1, 3, 2, 4],
  },
  {
    id: "1-2-4-3",
    label: "1 – 2 – 4 – 3 (Control 3-4)",
    fingers: [1, 2, 4, 3],
  },
  {
    id: "4-3-2-1",
    label: "4 – 3 – 2 – 1 (Inverso)",
    fingers: [4, 3, 2, 1],
  },
  {
    id: "4-1-3-2",
    label: "4 – 1 – 3 – 2 (Salto)",
    fingers: [4, 1, 3, 2],
  },
];

const REPEAT_OPTIONS: { value: RepeatCountOption; label: string }[] = [
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 4, label: "4x" },
  { value: 0, label: "∞" },
];

const ROOT_SEMITONES: Record<RootNote, number> = {
  C: 0,
  Db: 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
};

const ROOT_SOLFEGE_ES: Record<RootNote, string> = {
  C: "Do",
  Db: "Reb",
  D: "Re",
  Eb: "Mib",
  E: "Mi",
  F: "Fa",
  "F#": "Fa#",
  G: "Sol",
  Ab: "Lab",
  A: "La",
  Bb: "Sib",
  B: "Si",
};

const HORIZONTAL_STRINGS = [
  { stringNumber: 1, openMidi: 64, labelEs: "Mi", labelEn: "E", thickness: 1.2 },
  { stringNumber: 2, openMidi: 59, labelEs: "Si", labelEn: "B", thickness: 1.5 },
  { stringNumber: 3, openMidi: 55, labelEs: "Sol", labelEn: "G", thickness: 1.9 },
  { stringNumber: 4, openMidi: 50, labelEs: "Re", labelEn: "D", thickness: 2.3 },
  { stringNumber: 5, openMidi: 45, labelEs: "La", labelEn: "A", thickness: 2.8 },
  { stringNumber: 6, openMidi: 40, labelEs: "Mi", labelEn: "E", thickness: 3.3 },
];

const NOTE_NAMES_SHARP_ES = [
  "Do",
  "Do#",
  "Re",
  "Re#",
  "Mi",
  "Fa",
  "Fa#",
  "Sol",
  "Sol#",
  "La",
  "La#",
  "Si",
];

const NOTE_NAMES_FLAT_ES = [
  "Do",
  "Reb",
  "Re",
  "Mib",
  "Mi",
  "Fa",
  "Solb",
  "Sol",
  "Lab",
  "La",
  "Sib",
  "Si",
];

const NOTE_NAMES_SHARP_EN = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const NOTE_NAMES_FLAT_EN = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

const INTERVAL_DEGREE_MAP: Record<number, string> = {
  0: "F",
  1: "2m",
  2: "2M",
  3: "3m",
  4: "3M",
  5: "4J",
  6: "5d",
  7: "5J",
  8: "6m",
  9: "6M",
  10: "7m",
  11: "7M",
};

function resolveIntervalLabel(
  semitone: number,
  scaleName: string,
  scaleIntervals: number[]
): string {
  const norm = ((semitone % 12) + 12) % 12;

  if (norm === 0) return "F";

  if (norm === 3 && scaleName.includes("Lidia #2")) {
    return "2a";
  }

  if (norm === 6) {
    if (
      scaleName.includes("Lidia") ||
      scaleName.includes("#4") ||
      scaleName.includes("Tonal (Tono") ||
      scaleName.includes("Dominante Disminuida")
    ) {
      return "4a";
    }
    return "5d";
  }

  if (norm === 8) {
    if (
      scaleName.includes("Aumentada") ||
      scaleName.includes("#5") ||
      scaleName.includes("(+)") ||
      scaleName.includes("Tonal") ||
      (scaleName.includes("Bebop Mayor") && scaleIntervals.includes(9))
    ) {
      return "5a";
    }
    return "6m";
  }

  if (norm === 9) {
    if (
      scaleName.includes("°7") ||
      scaleName.includes("dim7") ||
      scaleName.includes("bb7")
    ) {
      return "7d";
    }
    return "6M";
  }

  return INTERVAL_DEGREE_MAP[norm] || String(norm);
}

const CATEGORY_SHORT_LABELS: Record<string, { es: string; en: string }> = {
  "Modos de la Escala Mayor": { es: "MODOS MAYOR", en: "MAJOR MODES" },
  "Modos de la Menor Melódica": { es: "MENOR MELÓDICA", en: "MELODIC MINOR" },
  "Modos de la Menor Armónica": { es: "MENOR ARMÓNICA", en: "HARMONIC MINOR" },
  "Pentatónicas y Blues": { es: "PENTATÓNICAS", en: "PENTATONICS" },
  "Otras Escalas": { es: "OTRAS ESCALAS", en: "OTHER SCALES" },
  Arpegios: { es: "ARPEGIOS", en: "ARPEGGIOS" },
};

const ROMAN_FRET: Record<number, string> = {
  0: "0",
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "XI",
  12: "XII",
  13: "XIII",
  14: "XIV",
  15: "XV",
  16: "XVI",
  17: "XVII",
  18: "XVIII",
};

interface HorizontalNoteDot {
  key: string;
  stringNumber: number;
  fret: number;
  midi: number;
  freq: number;
  isRoot: boolean;
  noteLabelEs: string;
  noteLabelEn: string;
  degreeLabel: string;
  customFinger?: string;
}

interface ScalePositionResolved {
  id: number;
  titleEs: string;
  titleEn: string;
  subtitleEs: string;
  subtitleEn: string;
  minFret: number;
  maxFret: number;
  romanReference: string;
  activeDotKeys: Set<string>;
  orderedOneOctaveDots: HorizontalNoteDot[];
  orderedRootAnchoredRoundTrip: HorizontalNoteDot[];
  fingerByDotKey: Map<string, string>;
}

interface ExactBoxInC {
  refFretInC: number;
  startRootString: 6 | 5 | 4;
  stringsInC: {
    6: [number, string][];
    5: [number, string][];
    4: [number, string][];
    3: [number, string][];
    2: [number, string][];
    1: [number, string][];
  };
}

const EXACT_SHAPES_IN_C: Record<string, ExactBoxInC[]> = {
  "Pentatónica Mayor": [
    {
      refFretInC: 3,
      startRootString: 5,
      stringsInC: {
        6: [[3, "2"], [5, "4"]],
        5: [[3, "2"], [5, "4"]],
        4: [[2, "1"], [5, "4"]],
        3: [[2, "1"], [5, "4"]],
        2: [[3, "2"], [5, "4"]],
        1: [[3, "2"], [5, "4"]],
      },
    },
    {
      refFretInC: 8,
      startRootString: 6,
      stringsInC: {
        6: [[5, "1"], [8, "4"]],
        5: [[5, "1"], [7, "3"]],
        4: [[5, "1"], [7, "3"]],
        3: [[5, "1"], [7, "3"]],
        2: [[5, "1"], [8, "4"]],
        1: [[5, "1"], [8, "4"]],
      },
    },
    {
      refFretInC: 8,
      startRootString: 6,
      stringsInC: {
        6: [[8, "2"], [10, "4"]],
        5: [[7, "1"], [10, "4"]],
        4: [[7, "1"], [10, "4"]],
        3: [[7, "1"], [9, "3"]],
        2: [[8, "2"], [10, "4"]],
        1: [[8, "2"], [10, "4"]],
      },
    },
    {
      refFretInC: 10,
      startRootString: 4,
      stringsInC: {
        6: [[10, "2"], [12, "4"]],
        5: [[10, "2"], [12, "4"]],
        4: [[10, "2"], [12, "4"]],
        3: [[9, "1"], [12, "4"]],
        2: [[10, "1"], [13, "4"]],
        1: [[10, "2"], [12, "4"]],
      },
    },
  ],

  "Pentatónica Menor": [
    {
      refFretInC: 3,
      startRootString: 5,
      stringsInC: {
        6: [[3, "1"], [6, "4"]],
        5: [[3, "1"], [6, "4"]],
        4: [[3, "1"], [5, "3"]],
        3: [[3, "1"], [5, "3"]],
        2: [[4, "2"], [6, "4"]],
        1: [[3, "1"], [6, "4"]],
      },
    },
    {
      refFretInC: 8,
      startRootString: 6,
      stringsInC: {
        6: [[6, "2"], [8, "4"]],
        5: [[6, "2"], [8, "4"]],
        4: [[5, "1"], [8, "4"]],
        3: [[5, "1"], [8, "4"]],
        2: [[6, "2"], [8, "4"]],
        1: [[6, "2"], [8, "4"]],
      },
    },
    {
      refFretInC: 8,
      startRootString: 6,
      stringsInC: {
        6: [[8, "1"], [11, "4"]],
        5: [[8, "1"], [10, "3"]],
        4: [[8, "1"], [10, "3"]],
        3: [[8, "1"], [10, "3"]],
        2: [[8, "1"], [11, "4"]],
        1: [[8, "1"], [11, "4"]],
      },
    },
    {
      refFretInC: 10,
      startRootString: 4,
      stringsInC: {
        6: [[11, "2"], [13, "4"]],
        5: [[10, "1"], [13, "4"]],
        4: [[10, "1"], [13, "4"]],
        3: [[10, "1"], [12, "3"]],
        2: [[11, "2"], [13, "4"]],
        1: [[11, "2"], [13, "4"]],
      },
    },
  ],

  "Pentatónica de Blues (con b5)": [
    {
      refFretInC: 3,
      startRootString: 5,
      stringsInC: {
        6: [[2, "1"], [3, "2"], [6, "4"]],
        5: [[3, "1"], [6, "4"]],
        4: [[3, "1"], [4, "2"], [5, "3"]],
        3: [[3, "1"], [5, "3"]],
        2: [[4, "2"], [6, "4"]],
        1: [[2, "1"], [3, "2"], [6, "4"]],
      },
    },
    {
      refFretInC: 8,
      startRootString: 6,
      stringsInC: {
        6: [[6, "2"], [8, "4"]],
        5: [[6, "2"], [8, "4"]],
        4: [[4, "1"], [5, "2"], [8, "4"]],
        3: [[5, "1"], [8, "4"]],
        2: [[6, "2"], [7, "3"], [8, "4"]],
        1: [[6, "2"], [8, "4"]],
      },
    },
    {
      refFretInC: 8,
      startRootString: 6,
      stringsInC: {
        6: [[8, "1"], [11, "4"]],
        5: [[8, "1"], [9, "2"], [10, "3"]],
        4: [[8, "1"], [10, "3"]],
        3: [[8, "1"], [10, "3"], [11, "4"]],
        2: [[8, "1"], [11, "4"]],
        1: [[8, "1"], [11, "4"]],
      },
    },
    {
      refFretInC: 10,
      startRootString: 4,
      stringsInC: {
        6: [[11, "1"], [13, "3"], [14, "4"]],
        5: [[9, "1"], [10, "2"], [13, "4"]],
        4: [[10, "1"], [13, "4"]],
        3: [[10, "1"], [11, "2"], [12, "3"]],
        2: [[11, "2"], [13, "4"]],
        1: [[11, "1"], [13, "3"], [14, "4"]],
      },
    },
  ],

  "Escala de Blues (b3 / 3M / b5)": [
    {
      refFretInC: 3,
      startRootString: 5,
      stringsInC: {
        6: [[2, "1"], [3, "2"], [6, "4"]],
        5: [[3, "1"], [6, "4"]],
        4: [[2, "1"], [3, "2"], [4, "3"], [5, "4"]],
        3: [[3, "1"], [5, "3"]],
        2: [[4, "1"], [5, "2"], [6, "3"]],
        1: [[2, "1"], [3, "2"], [6, "4"]],
      },
    },
    {
      refFretInC: 8,
      startRootString: 6,
      stringsInC: {
        6: [[6, "2"], [8, "4"]],
        5: [[6, "1"], [7, "2"], [8, "3"]],
        4: [[4, "1"], [5, "2"], [8, "4"]],
        3: [[5, "1"], [8, "3"], [9, "4"]],
        2: [[5, "1"], [6, "2"], [7, "3"], [8, "4"]],
        1: [[6, "2"], [8, "4"]],
      },
    },
    {
      refFretInC: 8,
      startRootString: 6,
      stringsInC: {
        6: [[8, "1"], [11, "4"]],
        5: [[7, "1"], [8, "2"], [9, "3"], [10, "4"]],
        4: [[8, "1"], [10, "3"]],
        3: [[8, "1"], [9, "2"], [10, "3"], [11, "4"]],
        2: [[8, "1"], [11, "4"]],
        1: [[8, "1"], [11, "4"]],
      },
    },
    {
      refFretInC: 10,
      startRootString: 4,
      stringsInC: {
        6: [[11, "1"], [12, "2"], [13, "3"], [14, "4"]],
        5: [[9, "1"], [10, "2"], [13, "4"]],
        4: [[10, "1"], [13, "4"]],
        3: [[9, "1"], [10, "2"], [11, "3"], [12, "4"]],
        2: [[11, "2"], [13, "4"]],
        1: [[11, "1"], [12, "2"], [13, "3"], [14, "4"]],
      },
    },
  ],
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function shouldUseSharps(
  root: RootNote,
  scaleIntervals: number[],
  scaleName: string
): boolean {
  if (
    (scaleName.includes("#5") ||
      scaleName.includes("Aumentada") ||
      scaleName.includes("Tonal")) &&
    !["Db", "Eb", "F", "Ab", "Bb"].includes(root)
  ) {
    return true;
  }
  if (["Db", "Eb", "F", "Ab", "Bb"].includes(root)) return false;
  if (["D", "E", "F#", "G", "A", "B"].includes(root)) return true;
  const hasFlatDegrees =
    scaleIntervals.includes(1) ||
    scaleIntervals.includes(3) ||
    scaleIntervals.includes(6) ||
    scaleIntervals.includes(8) ||
    scaleIntervals.includes(10);
  return !hasFlatDegrees;
}

function getFormulaFromIntervals(intervals: number[], scaleName: string): string {
  return intervals
    .map((semi) => resolveIntervalLabel(semi, scaleName, intervals))
    .join(" – ");
}

/**
 * Asigna los dedos de la mano izquierda en una cuerda.
 * Si la cuerda tiene 2 notas separadas por 2 trastes (ej. Fa en traste 3 y Sol en traste 5 de la 4ª cuerda)
 * y la siguiente cuerda (3ª cuerda) requiere abrir el Dedo 1 un traste hacia atrás (traste 2 = La),
 * asigna automáticamente Dedo 1 (Fa) y Dedo 4 (Sol) en la 4ª cuerda para facilitar el cambio de cuerda.
 */
function assignUniqueFingersOnString(
  notesOnStr: HorizontalNoteDot[],
  baseFret: number,
  nextStringShiftsBackOneFret: boolean = false
): Map<string, string> {
  const result = new Map<string, string>();
  if (notesOnStr.length === 0) return result;

  const sorted = [...notesOnStr].sort((a, b) => a.fret - b.fret);

  if (sorted.length >= 4) {
    sorted.forEach((d, idx) => {
      if (d.fret === 0) {
        result.set(d.key, "0");
      } else {
        result.set(d.key, String(Math.min(4, idx + 1)));
      }
    });
    return result;
  }

  if (sorted.length === 3) {
    const [n0, n1, n2] = sorted;
    const f0 = n0.fret === 0 ? "0" : "1";
    const span1 = n1.fret - n0.fret;
    const span2 = n2.fret - n1.fret;

    let f1 = "2";
    let f2 = "4";

    if (span1 >= 2 && span2 >= 2) {
      f1 = "2";
      f2 = "4";
    } else if (span1 >= 2 && span2 === 1) {
      // Ej. 3ª cuerda: La (traste 2) = Dedo 1, Si (traste 4) = Dedo 3, Do (traste 5) = Dedo 4
      f1 = "3";
      f2 = "4";
    } else if (span1 === 1 && span2 >= 2) {
      // Ej. 3ª cuerda: La (traste 2) = Dedo 1, Sib (traste 3) = Dedo 2, Do (traste 5) = Dedo 4
      f1 = "2";
      f2 = "4";
    } else {
      f1 = "2";
      f2 = "3";
    }

    result.set(n0.key, f0);
    result.set(n1.key, f1);
    result.set(n2.key, f2);
    return result;
  }

  if (sorted.length === 2) {
    const [n0, n1] = sorted;
    if (n0.fret === 0) {
      result.set(n0.key, "0");
      result.set(n1.key, n1.fret <= baseFret + 1 ? "2" : "3");
      return result;
    }
    const off0 = n0.fret - baseFret;
    const span = n1.fret - n0.fret;
    const f0 = off0 <= 0 ? "1" : "2";
    let f1 = "4";
    if (f0 === "1") {
      if (span === 1) {
        f1 = "2";
      } else if (span === 2) {
        // Si la 3ª cuerda retrocede al traste baseFret - 1 (ej. La en traste 2),
        // en la 4ª cuerda Fa (traste 3) va con Dedo 1 y Sol (traste 5) va con Dedo 4
        f1 = nextStringShiftsBackOneFret ? "4" : "3";
      } else {
        f1 = "4";
      }
    } else {
      f1 = span === 1 ? "3" : "4";
    }
    result.set(n0.key, f0);
    result.set(n1.key, f1);
    return result;
  }

  for (const d of sorted) {
    if (d.fret === 0) {
      result.set(d.key, "0");
    } else {
      const off = d.fret - baseFret;
      result.set(
        d.key,
        off <= 0 ? "1" : off === 1 ? "2" : off === 2 ? "3" : "4"
      );
    }
  }
  return result;
}

function buildOneOctavePlaybackFromPositionDots(
  posDots: HorizontalNoteDot[],
  preferredStartRootString: number
): HorizontalNoteDot[] {
  const rootsInBox = posDots
    .filter((d) => d.isRoot && d.fret >= 1)
    .sort((a, b) => {
      const aPref = a.stringNumber === preferredStartRootString ? 0 : 1;
      const bPref = b.stringNumber === preferredStartRootString ? 0 : 1;
      return aPref - bPref || a.midi - b.midi || b.stringNumber - a.stringNumber;
    });

  const startRoot =
    rootsInBox.find((r) =>
      posDots.some((d) => d.isRoot && d.midi === r.midi + 12)
    ) || rootsInBox[0];

  const orderedOneOctaveDots: HorizontalNoteDot[] = [];
  if (startRoot) {
    const targetTopMidi = startRoot.midi + 12;
    const inOctave = posDots
      .filter(
        (d) =>
          d.midi >= startRoot.midi &&
          d.midi <= targetTopMidi &&
          d.stringNumber <= startRoot.stringNumber
      )
      .sort((a, b) => {
        if (a.midi !== b.midi) return a.midi - b.midi;
        if (a.fret === 0 && b.fret > 0) return 1;
        if (b.fret === 0 && a.fret > 0) return -1;
        return b.stringNumber - a.stringNumber;
      });

    const seen = new Set<number>();
    for (const d of inOctave) {
      if (!seen.has(d.midi)) {
        seen.add(d.midi);
        orderedOneOctaveDots.push(d);
      }
    }
  }
  return orderedOneOctaveDots;
}

function buildRootAnchoredRoundTrip(
  posDots: HorizontalNoteDot[],
  preferredStartRootString: number
): HorizontalNoteDot[] {
  const sortedBox = [...posDots].sort((a, b) => {
    if (a.stringNumber !== b.stringNumber) {
      return b.stringNumber - a.stringNumber;
    }
    return a.fret - b.fret;
  });

  if (sortedBox.length === 0) return [];

  let rootIdx = sortedBox.findIndex(
    (d) => d.isRoot && d.stringNumber === preferredStartRootString
  );
  if (rootIdx === -1) {
    rootIdx = sortedBox.findIndex((d) => d.isRoot);
  }
  if (rootIdx === -1) {
    rootIdx = 0;
  }

  const result: HorizontalNoteDot[] = [];

  for (let i = rootIdx; i < sortedBox.length; i++) {
    result.push(sortedBox[i]);
  }

  for (let i = sortedBox.length - 2; i >= 0; i--) {
    result.push(sortedBox[i]);
  }

  if (rootIdx > 0) {
    for (let i = 1; i <= rootIdx; i++) {
      result.push(sortedBox[i]);
    }
  }

  return result;
}

/**
 * Construye cada posición evitando estiramientos de 5 trastes en la 4ª cuerda (ej. traste 7 en Posición 1)
 * cuando la nota está disponible en la 3ª cuerda en `baseFret - 1` (ej. La en 3ª cuerda traste 2 con Dedo 1).
 */
function buildCleanStudioPosition(
  posId: number,
  baseFret: number,
  refFret: number,
  preferredStartRootString: 6 | 5 | 4,
  allDots: HorizontalNoteDot[],
  scaleIntervals: number[],
  rootPc: number,
  maxFretLimit: number
): ScalePositionResolved {
  const isArpeggioOrTriad = scaleIntervals.length <= 4;
  const isPentatonicFive = scaleIntervals.length === 5;
  const isEightNoteScale = scaleIntervals.length >= 8;

  const maxNotesPerString = isArpeggioOrTriad
    ? 2
    : isPentatonicFive
    ? 2
    : isEightNoteScale
    ? 4
    : 3;

  const stringNotesMap = new Map<number, HorizontalNoteDot[]>();

  for (let s = 6; s >= 1; s--) {
    // En la 3ª cuerda (Sol), permitir desde el inicio que tome baseFret - 1 (ej. traste 2 en Posición 1 de Do)
    // porque entre la 3ª y 2ª cuerda hay una 3ª mayor y es la postura natural de guitarra sin abrir la mano en la 4ª cuerda.
    const minFretForStr =
      !isArpeggioOrTriad && !isPentatonicFive && s === 3
        ? Math.max(1, baseFret - 1)
        : baseFret;

    const inBox = allDots
      .filter(
        (d) =>
          d.stringNumber === s &&
          d.fret >= minFretForStr &&
          d.fret <= baseFret + 3
      )
      .sort((a, b) => a.fret - b.fret)
      .slice(0, maxNotesPerString);

    stringNotesMap.set(s, inBox);
  }

  const targetOuterCount = isArpeggioOrTriad ? 2 : isPentatonicFive ? 2 : 3;
  const s6Init = stringNotesMap.get(6) || [];
  if (!isArpeggioOrTriad && s6Init.length < targetOuterCount) {
    const withStretch = allDots
      .filter(
        (d) =>
          d.stringNumber === 6 &&
          d.fret >= Math.max(0, baseFret - 1) &&
          d.fret <= Math.min(maxFretLimit, baseFret + 4)
      )
      .sort((a, b) => a.fret - b.fret)
      .slice(0, targetOuterCount);

    if (withStretch.length > s6Init.length) {
      stringNotesMap.set(6, withStretch);
    }
  }

  if (!isArpeggioOrTriad) {
    const s6Frets = (stringNotesMap.get(6) || []).map((d) => d.fret);
    stringNotesMap.set(
      1,
      allDots
        .filter((d) => d.stringNumber === 1 && s6Frets.includes(d.fret))
        .sort((a, b) => a.fret - b.fret)
    );
  }

  for (let s = 6; s >= 2; s--) {
    const lower = stringNotesMap.get(s) || [];
    const upper = stringNotesMap.get(s - 1) || [];
    if (lower.length === 0 || upper.length === 0) continue;

    const lastLower = lower[lower.length - 1];
    const firstUpper = upper[0];

    if (lastLower.midi === firstUpper.midi) {
      // Si hay nota duplicada entre la 4ª y la 3ª cuerda, preferir dejarla en la 3ª cuerda con Dedo 1
      // antes que estirar el meñique en la 4ª cuerda
      if (s === 4 && lastLower.fret >= baseFret + 3) {
        lower.pop();
        stringNotesMap.set(s, lower);
      } else if (s === 3 && lower.length >= 3) {
        lower.pop();
        stringNotesMap.set(s, lower);
      } else if (upper.length >= 3) {
        upper.shift();
        stringNotesMap.set(s - 1, upper);
      } else if (lower.length > 2) {
        lower.pop();
        stringNotesMap.set(s, lower);
      }
    }
  }

  const currentMidis = new Set<number>();
  for (let s = 6; s >= 1; s--) {
    (stringNotesMap.get(s) || []).forEach((d) => currentMidis.add(d.midi));
  }

  const allSelectedList = Array.from(currentMidis);
  const minInternalMidi =
    allSelectedList.length > 0 ? Math.min(...allSelectedList) : 40 + baseFret;
  const maxInternalMidi =
    allSelectedList.length > 0 ? Math.max(...allSelectedList) : 64 + baseFret + 3;

  const intervalSet = new Set(
    scaleIntervals.map((i) => ((i % 12) + 12) % 12)
  );

  for (let m = minInternalMidi + 1; m < maxInternalMidi; m++) {
    const rel = ((m % 12 - rootPc) % 12 + 12) % 12;
    if (!intervalSet.has(rel)) continue;
    if (currentMidis.has(m)) continue;

    const candidates = allDots.filter(
      (d) =>
        d.midi === m &&
        d.stringNumber >= 2 &&
        d.stringNumber <= 5 &&
        d.fret >= Math.max(0, baseFret - 1) &&
        d.fret <= Math.min(maxFretLimit, baseFret + 4) &&
        (stringNotesMap.get(d.stringNumber) || []).length < maxNotesPerString
    );

    if (candidates.length > 0) {
      // Priorizar siempre la cuerda donde el traste sea baseFret - 1 con Dedo 1 (ej. 3ª cuerda traste 2 = La)
      // en vez de estirar hasta baseFret + 4 (traste 7) en la cuerda anterior (4ª cuerda)
      const best = [...candidates].sort((a, b) => {
        const aIsStretchPlus4 = a.fret >= baseFret + 4 ? 1 : 0;
        const bIsStretchPlus4 = b.fret >= baseFret + 4 ? 1 : 0;
        if (aIsStretchPlus4 !== bIsStretchPlus4) {
          return aIsStretchPlus4 - bIsStretchPlus4;
        }
        return b.stringNumber - a.stringNumber;
      })[0];

      const list = stringNotesMap.get(best.stringNumber) || [];
      list.push(best);
      list.sort((a, b) => a.fret - b.fret);
      stringNotesMap.set(best.stringNumber, list);
      currentMidis.add(m);
    }
  }

  for (let s = 6; s >= 1; s--) {
    const current = stringNotesMap.get(s) || [];
    if (current.length === 0) {
      const nearest = allDots
        .filter(
          (d) =>
            d.stringNumber === s &&
            d.fret >= Math.max(0, baseFret - 2) &&
            d.fret <= Math.min(maxFretLimit, baseFret + 5)
        )
        .sort(
          (a, b) =>
            Math.abs(a.fret - (baseFret + 1.5)) -
            Math.abs(b.fret - (baseFret + 1.5))
        );
      if (nearest.length > 0) {
        stringNotesMap.set(s, [nearest[0]]);
      }
    }
  }

  if (!isArpeggioOrTriad) {
    const s6Locked = (stringNotesMap.get(6) || []).slice(0, maxNotesPerString);
    stringNotesMap.set(6, s6Locked);
    const lockedFrets = s6Locked.map((d) => d.fret);
    stringNotesMap.set(
      1,
      allDots
        .filter((d) => d.stringNumber === 1 && lockedFrets.includes(d.fret))
        .sort((a, b) => a.fret - b.fret)
    );
  }

  const activeDotKeys = new Set<string>();
  const fingerByDotKey = new Map<string, string>();
  const posDots: HorizontalNoteDot[] = [];

  for (let s = 6; s >= 1; s--) {
    const notesOnStr = stringNotesMap.get(s) || [];
    const nextStrNotes = s > 1 ? stringNotesMap.get(s - 1) || [] : [];
    const nextStringShiftsBackOneFret =
      nextStrNotes.length > 0 &&
      notesOnStr.length > 0 &&
      nextStrNotes[0].fret < notesOnStr[0].fret;

    const strFingerMap = assignUniqueFingersOnString(
      notesOnStr,
      baseFret,
      nextStringShiftsBackOneFret
    );

    for (const d of notesOnStr) {
      activeDotKeys.add(d.key);
      posDots.push(d);
      fingerByDotKey.set(d.key, strFingerMap.get(d.key) || "1");
    }
  }

  const frets = posDots.map((d) => d.fret);
  const minFret = frets.length > 0 ? Math.min(...frets) : baseFret;
  const maxFret = frets.length > 0 ? Math.max(...frets) : baseFret + 3;

  const orderedOneOctaveDots = buildOneOctavePlaybackFromPositionDots(
    posDots,
    preferredStartRootString
  );
  const orderedRootAnchoredRoundTrip = buildRootAnchoredRoundTrip(
    posDots,
    preferredStartRootString
  );

  const safeRef = Math.max(1, Math.min(maxFretLimit, refFret));
  const roman = ROMAN_FRET[safeRef] || String(safeRef);

  return {
    id: posId,
    titleEs: `POSICIÓN ${posId} (${roman})`,
    titleEn: `POSITION ${posId} (${roman})`,
    subtitleEs: `Posición ${posId} (${roman}) · Trastes ${minFret} al ${maxFret} (Parte y termina en Tónica ${preferredStartRootString}ª cuerda)`,
    subtitleEn: `Position ${posId} (${roman}) · Frets ${minFret} to ${maxFret} (Starts & ends on ${preferredStartRootString}th string Root)`,
    minFret,
    maxFret,
    romanReference: roman,
    activeDotKeys,
    orderedOneOctaveDots,
    orderedRootAnchoredRoundTrip,
    fingerByDotKey,
  };
}

function buildChromaticFretboardLookup(
  maxFret: number
): Map<string, HorizontalNoteDot> {
  const map = new Map<string, HorizontalNoteDot>();
  for (const str of HORIZONTAL_STRINGS) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const midi = str.openMidi + fret;
      const pc = midi % 12;
      const key = `${str.stringNumber}-${fret}`;
      map.set(key, {
        key,
        stringNumber: str.stringNumber,
        fret,
        midi,
        freq: midiToFreq(midi),
        isRoot: false,
        noteLabelEs: NOTE_NAMES_SHARP_ES[pc],
        noteLabelEn: NOTE_NAMES_SHARP_EN[pc],
        degreeLabel: "",
      });
    }
  }
  return map;
}

function RhythmFigureSvg({ id }: { id: SubdivisionId }) {
  if (id === 1) {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <ellipse cx="10" cy="17" rx="4.2" ry="3" transform="rotate(-20 10 17)" />
        <rect x="12.8" y="4" width="1.8" height="13" />
      </svg>
    );
  }
  if (id === 2) {
    return (
      <svg viewBox="0 0 28 24" className="w-5 h-4 fill-current">
        <ellipse cx="7" cy="17.5" rx="3.6" ry="2.6" transform="rotate(-20 7 17.5)" />
        <ellipse cx="19" cy="16" rx="3.6" ry="2.6" transform="rotate(-20 19 16)" />
        <rect x="9.4" y="5" width="1.6" height="12.5" />
        <rect x="21.4" y="3.5" width="1.6" height="12.5" />
        <polygon points="9.4,4.5 23,3 23,6 9.4,7.5" />
      </svg>
    );
  }
  if (id === 3) {
    return (
      <svg viewBox="0 0 34 24" className="w-6 h-4 fill-current">
        <text
          x="17"
          y="5.5"
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="900"
          fontFamily="monospace"
        >
          3
        </text>
        <ellipse cx="6" cy="18" rx="3" ry="2.2" transform="rotate(-20 6 18)" />
        <ellipse cx="16" cy="18" rx="3" ry="2.2" transform="rotate(-20 16 18)" />
        <ellipse cx="26" cy="18" rx="3" ry="2.2" transform="rotate(-20 26 18)" />
        <rect x="8" y="7.5" width="1.4" height="10.5" />
        <rect x="18" y="7.5" width="1.4" height="10.5" />
        <rect x="28" y="7.5" width="1.4" height="10.5" />
        <rect x="8" y="7" width="21.4" height="2.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 38 24" className="w-6 h-4 fill-current">
      <ellipse cx="5.5" cy="18" rx="2.7" ry="2" transform="rotate(-20 5.5 18)" />
      <ellipse cx="13.5" cy="18" rx="2.7" ry="2" transform="rotate(-20 13.5 18)" />
      <ellipse cx="21.5" cy="18" rx="2.7" ry="2" transform="rotate(-20 21.5 18)" />
      <ellipse cx="29.5" cy="18" rx="2.7" ry="2" transform="rotate(-20 29.5 18)" />
      <rect x="7.3" y="5" width="1.3" height="13" />
      <rect x="15.3" y="5" width="1.3" height="13" />
      <rect x="23.3" y="5" width="1.3" height="13" />
      <rect x="31.3" y="5" width="1.3" height="13" />
      <rect x="7.3" y="4.5" width="25.3" height="2" />
      <rect x="7.3" y="8" width="25.3" height="2" />
    </svg>
  );
}

export default function ScaleDictionary() {
  const { language } = useLanguage();
  const isEs = language === "es";

  const [selectedRoot, setSelectedRoot] = useState<RootNote>("C");
  const [activeCategory, setActiveCategory] = useState<string>(
    EXPLORER_CATEGORIES[0].category
  );
  const [selectedScaleName, setSelectedScaleName] = useState<string>(
    EXPLORER_CATEGORIES[0].scales[0].name
  );
  const [dotLabelMode, setDotLabelMode] = useState<DotLabelMode>("note");
  const [selectedPositionId, setSelectedPositionId] = useState<number>(1);
  const [selectedInstrument, setSelectedInstrument] =
    useState<GuitarInstrumentId>("clean_electric");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [trainerMode, setTrainerMode] =
    useState<TrainerModeId>("scale_playalong");
  const [bpm, setBpm] = useState<number>(80);
  const [subdivision, setSubdivision] = useState<SubdivisionId>(1);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(true);
  const [repeatCount, setRepeatCount] = useState<RepeatCountOption>(1);
  const [spiderPatternId, setSpiderPatternId] = useState<string>("1-4-2-3");
  const [spiderStartFret, setSpiderStartFret] = useState<number>(1);

  const [activePlayingDotKey, setActivePlayingDotKey] = useState<string | null>(
    null
  );
  const [countInFirstDotKey, setCountInFirstDotKey] = useState<string | null>(
    null
  );
  const [activeSpiderStepInfo, setActiveSpiderStepInfo] = useState<{
    key: string;
    finger: string;
    noteEs: string;
    noteEn: string;
    fret: number;
    stringNumber: number;
    baseFretWindow: number;
  } | null>(null);
  const [currentBeatPulse, setCurrentBeatPulse] = useState<number>(0);
  const [isPlayingSequence, setIsPlayingSequence] = useState<boolean>(false);

  const timersRef = useRef<number[]>([]);

  const roots: RootNote[] = [
    "C",
    "Db",
    "D",
    "Eb",
    "E",
    "F",
    "F#",
    "G",
    "Ab",
    "A",
    "Bb",
    "B",
  ];

  const MAX_FRET = 17;
  const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17];

  const chromaticLookup = useMemo(
    () => buildChromaticFretboardLookup(MAX_FRET),
    []
  );

  useEffect(() => {
    dictionaryAudio.preloadGuitarSamples();
  }, []);

  const clearPlaybackTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setIsPlayingSequence(false);
    setActivePlayingDotKey(null);
    setCountInFirstDotKey(null);
    setActiveSpiderStepInfo(null);
    setCurrentBeatPulse(0);
  }, []);

  useEffect(() => {
    return () => clearPlaybackTimers();
  }, [clearPlaybackTimers]);

  useEffect(() => {
    clearPlaybackTimers();
  }, [
    selectedRoot,
    selectedScaleName,
    selectedPositionId,
    trainerMode,
    spiderPatternId,
    spiderStartFret,
    clearPlaybackTimers,
  ]);

  const isFullMapActive =
    selectedPositionId === 0 && trainerMode === "scale_playalong";

  useEffect(() => {
    if (isFullMapActive && dotLabelMode !== "note") {
      setDotLabelMode("note");
    }
  }, [isFullMapActive, dotLabelMode]);

  const selectedScaleDef = useMemo<ScaleDefinition>(() => {
    for (const cat of EXPLORER_CATEGORIES) {
      const found = cat.scales.find((s) => s.name === selectedScaleName);
      if (found) return found;
    }
    return EXPLORER_CATEGORIES[0].scales[0];
  }, [selectedScaleName]);

  const allFretboardDots = useMemo<HorizontalNoteDot[]>(() => {
    const rootPc = ROOT_SEMITONES[selectedRoot] ?? 0;
    const intervalSet = new Set(
      selectedScaleDef.intervals.map((i) => ((i % 12) + 12) % 12)
    );
    const useSharps = shouldUseSharps(
      selectedRoot,
      selectedScaleDef.intervals,
      selectedScaleDef.name
    );
    const namesEs = useSharps ? NOTE_NAMES_SHARP_ES : NOTE_NAMES_FLAT_ES;
    const namesEn = useSharps ? NOTE_NAMES_SHARP_EN : NOTE_NAMES_FLAT_EN;

    const dots: HorizontalNoteDot[] = [];

    for (const str of HORIZONTAL_STRINGS) {
      for (let fret = 0; fret <= MAX_FRET; fret++) {
        const midi = str.openMidi + fret;
        const pc = midi % 12;
        const relSemitones = ((pc - rootPc) % 12 + 12) % 12;

        if (!intervalSet.has(relSemitones)) continue;

        const degreeLabel = resolveIntervalLabel(
          relSemitones,
          selectedScaleDef.name,
          selectedScaleDef.intervals
        );

        dots.push({
          key: `${str.stringNumber}-${fret}`,
          stringNumber: str.stringNumber,
          fret,
          midi,
          freq: midiToFreq(midi),
          isRoot: relSemitones === 0,
          noteLabelEs: namesEs[pc],
          noteLabelEn: namesEn[pc],
          degreeLabel,
        });
      }
    }

    return dots;
  }, [selectedRoot, selectedScaleDef]);

  const studioPositions = useMemo<ScalePositionResolved[]>(() => {
    const rootPc = ROOT_SEMITONES[selectedRoot] ?? 0;

    let r6 = ((rootPc - 4) % 12 + 12) % 12;
    if (r6 === 0) r6 = 12;

    let r5 = ((rootPc - 9) % 12 + 12) % 12;
    if (r5 === 0) r5 = 12;

    const exactBoxesInC = EXACT_SHAPES_IN_C[selectedScaleDef.name];

    if (exactBoxesInC) {
      const resolvedExact = exactBoxesInC.map((tpl, idx) => {
        const posId = idx + 1;

        const allTemplateFretsInC: number[] = [];
        ([6, 5, 4, 3, 2, 1] as const).forEach((sNum) => {
          tpl.stringsInC[sNum].forEach(([f]) => allTemplateFretsInC.push(f));
        });
        const minInC = Math.min(...allTemplateFretsInC);
        const maxInC = Math.max(...allTemplateFretsInC);

        let shift = posId === 1 ? r5 - 3 : r6 - 8;
        if (minInC + shift < 0) {
          shift += 12;
        }
        if (maxInC + shift > MAX_FRET && minInC + shift - 12 >= 1) {
          shift -= 12;
        }

        const activeDotKeys = new Set<string>();
        const fingerByDotKey = new Map<string, string>();

        ([6, 5, 4, 3, 2, 1] as const).forEach((sNum) => {
          tpl.stringsInC[sNum].forEach(([fretInC, finger]) => {
            const targetFret = fretInC + shift;
            if (targetFret >= 0 && targetFret <= MAX_FRET) {
              const key = `${sNum}-${targetFret}`;
              activeDotKeys.add(key);
              fingerByDotKey.set(key, targetFret === 0 ? "0" : finger);
            }
          });
        });

        const posDots = allFretboardDots.filter((d) =>
          activeDotKeys.has(d.key)
        );
        const frets = posDots.map((d) => d.fret);
        const minFret = frets.length > 0 ? Math.min(...frets) : 1;
        const maxFret = frets.length > 0 ? Math.max(...frets) : 5;

        const refFret = Math.max(1, Math.min(MAX_FRET, tpl.refFretInC + shift));
        const roman = ROMAN_FRET[refFret] || String(refFret);

        const orderedOneOctaveDots = buildOneOctavePlaybackFromPositionDots(
          posDots,
          tpl.startRootString
        );
        const orderedRootAnchoredRoundTrip = buildRootAnchoredRoundTrip(
          posDots,
          tpl.startRootString
        );

        return {
          id: posId,
          titleEs: `POSICIÓN ${posId} (${roman})`,
          titleEn: `POSITION ${posId} (${roman})`,
          subtitleEs: `Posición ${posId} (${roman}) · Trastes ${minFret} al ${maxFret} (Parte y termina en Tónica ${tpl.startRootString}ª cuerda)`,
          subtitleEn: `Position ${posId} (${roman}) · Frets ${minFret} to ${maxFret} (Starts & ends on ${tpl.startRootString}th string Root)`,
          minFret,
          maxFret,
          romanReference: roman,
          activeDotKeys,
          orderedOneOctaveDots,
          orderedRootAnchoredRoundTrip,
          fingerByDotKey,
        };
      });

      const allFrettedKeys = new Set(
        allFretboardDots.filter((d) => d.fret >= 1).map((d) => d.key)
      );
      const fullMapPosition: ScalePositionResolved = {
        id: 0,
        titleEs: `MAPA COMPLETO (1–${MAX_FRET})`,
        titleEn: `FULL FRETBOARD (1–${MAX_FRET})`,
        subtitleEs: `Vista panorámica de todas las notas en el diapasón (Trastes 1 al ${MAX_FRET})`,
        subtitleEn: `Panoramic view of all notes across the fretboard (Frets 1 to ${MAX_FRET})`,
        minFret: 1,
        maxFret: MAX_FRET,
        romanReference: `I–${ROMAN_FRET[MAX_FRET]}`,
        activeDotKeys: allFrettedKeys,
        orderedOneOctaveDots:
          resolvedExact[0]?.orderedOneOctaveDots || [],
        orderedRootAnchoredRoundTrip:
          resolvedExact[0]?.orderedRootAnchoredRoundTrip || [],
        fingerByDotKey:
          resolvedExact[0]?.fingerByDotKey || new Map<string, string>(),
      };

      return [fullMapPosition, ...resolvedExact];
    }

    const hasMinorThird =
      selectedScaleDef.intervals.includes(3) &&
      !selectedScaleDef.intervals.includes(4);

    const normalizeBaseFret = (rawFret: number) => {
      let b = rawFret;
      if (b < 1) b += 12;
      if (b > 12) b -= 12;
      return Math.max(1, b);
    };

    const base1 = hasMinorThird ? Math.max(1, r5) : Math.max(1, r5 - 1);
    const ref1 = r5;

    const base2 = normalizeBaseFret(r6 - 3);
    const ref2 = normalizeBaseFret(base2 + 3);

    const base3 = hasMinorThird
      ? normalizeBaseFret(r6)
      : normalizeBaseFret(r6 - 1);
    const ref3 = r6;

    const base4 = hasMinorThird
      ? normalizeBaseFret(r6 + 2)
      : normalizeBaseFret(r6 + 1);
    const ref4 = normalizeBaseFret(r6 + 2);

    const pos1 = buildCleanStudioPosition(
      1,
      base1,
      ref1,
      5,
      allFretboardDots,
      selectedScaleDef.intervals,
      rootPc,
      MAX_FRET
    );

    const pos2 = buildCleanStudioPosition(
      2,
      base2,
      ref2,
      6,
      allFretboardDots,
      selectedScaleDef.intervals,
      rootPc,
      MAX_FRET
    );

    const pos3 = buildCleanStudioPosition(
      3,
      base3,
      ref3,
      6,
      allFretboardDots,
      selectedScaleDef.intervals,
      rootPc,
      MAX_FRET
    );

    const pos4 = buildCleanStudioPosition(
      4,
      base4,
      ref4,
      4,
      allFretboardDots,
      selectedScaleDef.intervals,
      rootPc,
      MAX_FRET
    );

    const allFrettedKeys = new Set(
      allFretboardDots.filter((d) => d.fret >= 1).map((d) => d.key)
    );
    const fullMapPosition: ScalePositionResolved = {
      id: 0,
      titleEs: `MAPA COMPLETO (1–${MAX_FRET})`,
      titleEn: `FULL FRETBOARD (1–${MAX_FRET})`,
      subtitleEs: `Vista panorámica de todas las notas en el diapasón (Trastes 1 al ${MAX_FRET})`,
      subtitleEn: `Panoramic view of all notes across the fretboard (Frets 1 to ${MAX_FRET})`,
      minFret: 1,
      maxFret: MAX_FRET,
      romanReference: `I–${ROMAN_FRET[MAX_FRET]}`,
      activeDotKeys: allFrettedKeys,
      orderedOneOctaveDots: pos1.orderedOneOctaveDots,
      orderedRootAnchoredRoundTrip: pos1.orderedRootAnchoredRoundTrip,
      fingerByDotKey: pos1.fingerByDotKey,
    };

    return [fullMapPosition, pos1, pos2, pos3, pos4];
  }, [selectedRoot, allFretboardDots, selectedScaleDef]);

  const activePositionBox = useMemo(
    () =>
      studioPositions.find((p) => p.id === selectedPositionId) ||
      studioPositions[1] ||
      studioPositions[0],
    [studioPositions, selectedPositionId]
  );

  const selectedSpiderPattern = useMemo(
    () =>
      SPIDER_PATTERNS.find((p) => p.id === spiderPatternId) ||
      SPIDER_PATTERNS[1],
    [spiderPatternId]
  );

  const currentSpiderWindowBaseFret = activeSpiderStepInfo
    ? activeSpiderStepInfo.baseFretWindow
    : spiderStartFret;

  const spiderDotsOnFretboard = useMemo(() => {
    const map = new Map<string, { dot: HorizontalNoteDot; finger: string }>();
    for (let s = 6; s >= 1; s--) {
      for (let fOffset = 0; fOffset < 4; fOffset++) {
        const fret = currentSpiderWindowBaseFret + fOffset;
        const finger = String(fOffset + 1);
        const key = `${s}-${fret}`;
        const dot = chromaticLookup.get(key);
        if (dot) {
          map.set(key, { dot, finger });
        }
      }
    }
    return map;
  }, [currentSpiderWindowBaseFret, chromaticLookup]);

  const showOpenStringColumn = useMemo(() => {
    if (trainerMode === "spider_exercise") return false;
    if (activePositionBox.id === 0) return false;
    return allFretboardDots.some(
      (d) => d.fret === 0 && activePositionBox.activeDotKeys.has(d.key)
    );
  }, [activePositionBox, allFretboardDots, trainerMode]);

  const visibleFrets = useMemo(() => {
    const list: number[] = [];
    const start = showOpenStringColumn ? 0 : 1;
    for (let f = start; f <= MAX_FRET; f++) {
      list.push(f);
    }
    return list;
  }, [showOpenStringColumn]);

  const handlePlaySingleDot = (
    dot: HorizontalNoteDot,
    instToUse: GuitarInstrumentId = selectedInstrument
  ) => {
    clearPlaybackTimers();
    setActivePlayingDotKey(dot.key);
    dictionaryAudio.playGuitarMidi(dot.midi, instToUse, 1.35, 0, 0.65);
    const tId = window.setTimeout(() => {
      setActivePlayingDotKey(null);
    }, 450);
    timersRef.current.push(tId);
  };

  const startRhythmicPractice = useCallback(
    (customPos?: ScalePositionResolved, customMode?: TrainerModeId) => {
      clearPlaybackTimers();

      const modeToRun = customMode || trainerMode;
      const posToRun = customPos || activePositionBox;

      const beatDurationMs = (60 / bpm) * 1000;
      const noteStepMs = beatDurationMs / subdivision;
      const noteAudioDurationSec = Math.max(
        0.22,
        Math.min(1.25, (noteStepMs / 1000) * 1.45)
      );

      interface ScheduledPracticeStep {
        key: string;
        midi: number;
        finger: string;
        noteEs: string;
        noteEn: string;
        fret: number;
        stringNumber: number;
        baseFretWindow: number;
      }

      const fullRoundTripSteps: ScheduledPracticeStep[] = [];

      if (modeToRun === "scale_playalong") {
        const roundTripDots =
          posToRun.orderedRootAnchoredRoundTrip.length > 0
            ? posToRun.orderedRootAnchoredRoundTrip
            : posToRun.orderedOneOctaveDots;

        if (roundTripDots.length === 0) return;

        roundTripDots.forEach((d) => {
          fullRoundTripSteps.push({
            key: d.key,
            midi: d.midi,
            finger: posToRun.fingerByDotKey.get(d.key) || "1",
            noteEs: d.noteLabelEs,
            noteEn: d.noteLabelEn,
            fret: d.fret,
            stringNumber: d.stringNumber,
            baseFretWindow: posToRun.minFret,
          });
        });
      } else {
        const fingersOrder = selectedSpiderPattern.fingers;
        const totalFretShifts = 4;

        for (let shiftIdx = 0; shiftIdx < totalFretShifts; shiftIdx++) {
          const currentBase = Math.min(MAX_FRET - 3, spiderStartFret + shiftIdx);
          const stringOrder =
            shiftIdx % 2 === 0 ? [6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6];

          for (const sNum of stringOrder) {
            for (const fingerNum of fingersOrder) {
              const targetFret = currentBase + (fingerNum - 1);
              const key = `${sNum}-${targetFret}`;
              const dot = chromaticLookup.get(key);
              if (dot) {
                fullRoundTripSteps.push({
                  key,
                  midi: dot.midi,
                  finger: String(fingerNum),
                  noteEs: dot.noteLabelEs,
                  noteEn: dot.noteLabelEn,
                  fret: targetFret,
                  stringNumber: sNum,
                  baseFretWindow: currentBase,
                });
              }
            }
          }
        }
      }

      if (fullRoundTripSteps.length === 0) return;

      const startsAndEndsOnSameNote =
        modeToRun === "scale_playalong" &&
        fullRoundTripSteps.length > 2 &&
        fullRoundTripSteps[0].key ===
          fullRoundTripSteps[fullRoundTripSteps.length - 1].key;

      const SeamlessLoopSteps = startsAndEndsOnSameNote
        ? fullRoundTripSteps.slice(0, -1)
        : fullRoundTripSteps;

      setIsPlayingSequence(true);

      const countInTotalBeats = 4;
      const countInTotalDurationMs = countInTotalBeats * beatDurationMs;
      const firstNoteKey = fullRoundTripSteps[0].key;
      setCountInFirstDotKey(firstNoteKey);

      for (let beatIdx = 0; beatIdx < countInTotalBeats; beatIdx++) {
        const delayMs = beatIdx * beatDurationMs;
        const beatInBar = (beatIdx % 4) + 1;

        const countTimerId = window.setTimeout(() => {
          setCurrentBeatPulse(beatInBar);
          dictionaryAudio.playMetronomeClick(beatInBar === 1, 0);
        }, delayMs);

        timersRef.current.push(countTimerId);
      }

      let completedPasses = 0;
      let cumulativeNoteSteps = 0;

      const schedulePass = (initialOffsetMs: number) => {
        const isLastPass =
          repeatCount !== 0 && completedPasses + 1 >= repeatCount;

        const stepsForThisPass = isLastPass
          ? fullRoundTripSteps
          : SeamlessLoopSteps;

        stepsForThisPass.forEach((step, idx) => {
          const delayMs = initialOffsetMs + idx * noteStepMs;
          const globalStepIndex = cumulativeNoteSteps + idx;
          const isOnBeat = globalStepIndex % subdivision === 0;
          const beatIndex = Math.floor(globalStepIndex / subdivision);
          const beatInBar = (beatIndex % 4) + 1;

          const tId = window.setTimeout(() => {
            if (completedPasses === 0 && idx === 0) {
              setCountInFirstDotKey(null);
            }

            if (isOnBeat) {
              setCurrentBeatPulse(beatInBar);
              if (metronomeEnabled) {
                dictionaryAudio.playMetronomeClick(beatInBar === 1, 0);
              }
            }

            setActivePlayingDotKey(step.key);
            setActiveSpiderStepInfo(step);
            dictionaryAudio.playGuitarMidi(
              step.midi,
              selectedInstrument,
              noteAudioDurationSec,
              0,
              isOnBeat ? 0.68 : 0.54
            );
          }, delayMs);

          timersRef.current.push(tId);
        });

        const totalPassDurationMs = stepsForThisPass.length * noteStepMs;
        cumulativeNoteSteps += stepsForThisPass.length;

        const endOrLoopId = window.setTimeout(() => {
          completedPasses += 1;
          if (repeatCount === 0 || completedPasses < repeatCount) {
            timersRef.current = [];
            schedulePass(0);
          } else {
            clearPlaybackTimers();
          }
        }, initialOffsetMs + totalPassDurationMs);

        timersRef.current.push(endOrLoopId);
      };

      schedulePass(countInTotalDurationMs);
    },
    [
      clearPlaybackTimers,
      trainerMode,
      activePositionBox,
      bpm,
      subdivision,
      selectedSpiderPattern,
      spiderStartFret,
      chromaticLookup,
      metronomeEnabled,
      selectedInstrument,
      repeatCount,
    ]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select"
      ) {
        return;
      }

      e.preventDefault();
      if (isPlayingSequence) {
        clearPlaybackTimers();
      } else {
        startRhythmicPractice();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlayingSequence, clearPlaybackTimers, startRhythmicPractice]);

  const activeFormulaString = useMemo(
    () =>
      getFormulaFromIntervals(
        selectedScaleDef.intervals,
        selectedScaleDef.name
      ),
    [selectedScaleDef]
  );

  const spiderExampleNotesOn6thString = useMemo(() => {
    const base = currentSpiderWindowBaseFret;
    return selectedSpiderPattern.fingers
      .map((fNum) => {
        const fret = base + (fNum - 1);
        const dot = chromaticLookup.get(`6-${fret}`);
        if (!dot) return "";
        return isEs ? dot.noteLabelEs : dot.noteLabelEn;
      })
      .join(" – ");
  }, [
    currentSpiderWindowBaseFret,
    selectedSpiderPattern,
    chromaticLookup,
    isEs,
  ]);

  const gridColsStyle = showOpenStringColumn
    ? `46px 44px repeat(${MAX_FRET}, minmax(0, 1fr))`
    : `46px repeat(${MAX_FRET}, minmax(0, 1fr))`;

  return (
    <div
      id="scale-dictionary-container"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full select-none items-start"
    >
      {/* COLUMNA IZQUIERDA */}
      <div className="lg:col-span-4 flex flex-col gap-4 min-w-0">
        <div className="bg-[#111217] p-4 rounded-2xl border border-[#1e202b] shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Music size={14} className="text-[#f25100]" />
              {isEs ? "TÓNICA (FUNDAMENTAL)" : "TONIC (ROOT NOTE)"}
            </span>
            <span className="text-xs font-mono font-bold text-[#f25100]">
              {ROOT_SOLFEGE_ES[selectedRoot]} ({selectedRoot})
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {roots.map((root) => {
              const isSelected = selectedRoot === root;
              return (
                <button
                  key={`root-${root}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelectedRoot(root);
                    if (trainerMode === "spider_exercise") {
                      setTrainerMode("scale_playalong");
                    }
                  }}
                  className={`h-10 rounded-xl border font-mono text-sm font-extrabold transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#f25100] text-white border-[#ff7433] shadow-[0_0_14px_rgba(242,81,0,0.4)]"
                      : "bg-[#161720] text-zinc-200 border-[#232533] hover:border-[#f25100]/50 hover:text-white"
                  }`}
                >
                  {root}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111217] p-4 rounded-2xl border border-[#1e202b] shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              {isEs ? "ESCALA / ARPEGIO A EXPLORAR" : "SCALE / ARPEGGIO"}
            </span>
            <span className="text-[10px] font-mono text-[#f25100] font-bold">
              {isEs ? "4 Posiciones Completas" : "4 Complete Positions"}
            </span>
          </div>

          <div className="relative w-full">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              placeholder={
                isEs
                  ? "Buscar escala, modo o arpegio..."
                  : "Search scale, mode or arpeggio..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161720] border border-[#252736] rounded-xl py-2 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#f25100] transition-colors"
            />
          </div>

          {!searchQuery && (
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#1c1e28]">
              {EXPLORER_CATEGORIES.map((group) => {
                const isCatActive = activeCategory === group.category;
                const shortLbl = CATEGORY_SHORT_LABELS[group.category];
                return (
                  <button
                    key={group.category}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setActiveCategory(group.category)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                      isCatActive
                        ? "bg-[#f25100] text-white"
                        : "bg-[#161720] text-zinc-400 hover:text-white border border-[#242634]"
                    }`}
                  >
                    {shortLbl
                      ? isEs
                        ? shortLbl.es
                        : shortLbl.en
                      : group.category}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2 max-h-[390px] overflow-y-auto pr-1">
            {EXPLORER_CATEGORIES.map((group) => {
              if (!searchQuery && group.category !== activeCategory) return null;

              const filteredScales = group.scales.filter((sc) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  sc.name.toLowerCase().includes(q) ||
                  sc.relatedChords.some((c) => c.toLowerCase().includes(q))
                );
              });

              if (filteredScales.length === 0) return null;

              return (
                <div key={group.category} className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 px-1">
                    {group.category}
                  </span>
                  {filteredScales.map((sc) => {
                    const isSelected = selectedScaleName === sc.name;
                    const formulaStr = getFormulaFromIntervals(
                      sc.intervals,
                      sc.name
                    );
                    return (
                      <button
                        key={sc.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedScaleName(sc.name);
                          if (trainerMode === "spider_exercise") {
                            setTrainerMode("scale_playalong");
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-[#f25100] text-white border-[#ff7433] shadow-[0_0_12px_rgba(242,81,0,0.3)]"
                            : "bg-[#161720] text-zinc-200 border-[#232533] hover:border-[#f25100]/50 hover:bg-[#1b1d28]"
                        }`}
                      >
                        <span className="text-sm font-bold truncate">
                          {sc.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono shrink-0 ${
                            isSelected
                              ? "text-orange-100 font-bold"
                              : "text-zinc-500"
                          }`}
                        >
                          {formulaStr}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA */}
      <div className="lg:col-span-8 flex flex-col gap-3.5 min-w-0">
        <div className="bg-[#111217] p-4 sm:p-5 rounded-2xl border border-[#1e202b] shadow-2xl flex flex-col gap-3.5 overflow-hidden">
          {/* 1. CABECERA SUPERIOR */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-nowrap">
                {trainerMode === "spider_exercise" ? (
                  <>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-baseline gap-2 min-w-0">
                      <span className="text-[#f25100] shrink-0 font-mono">
                        {selectedSpiderPattern.id}
                      </span>
                      <span className="truncate">
                        {isEs ? "Ejercicio de Digitación" : "Spider Drill"}
                      </span>
                    </h2>
                    <span className="px-2 py-0.5 rounded-lg bg-[#161720] border border-[#252736] text-[10px] font-mono font-extrabold text-[#f25100] shrink-0">
                      {isEs
                        ? `Trastes ${currentSpiderWindowBaseFret}–${
                            currentSpiderWindowBaseFret + 3
                          }`
                        : `Frets ${currentSpiderWindowBaseFret}–${
                            currentSpiderWindowBaseFret + 3
                          }`}
                    </span>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-baseline gap-2 min-w-0">
                      <span className="text-[#f25100] shrink-0">
                        {selectedRoot}
                      </span>
                      <span className="truncate">{selectedScaleDef.name}</span>
                    </h2>
                    <span className="px-2 py-0.5 rounded-lg bg-[#161720] border border-[#252736] text-[10px] font-mono font-extrabold text-[#f25100] shrink-0">
                      Pos. {activePositionBox.romanReference}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                {trainerMode === "spider_exercise"
                  ? isEs
                    ? `6ª cuerda (Traste ${currentSpiderWindowBaseFret}): ${spiderExampleNotesOn6thString} · Sube 6ª→1ª y avanza +1 traste bajando 1ª→6ª`
                    : `6th string (Fret ${currentSpiderWindowBaseFret}): ${spiderExampleNotesOn6thString}`
                  : isEs
                  ? activePositionBox.subtitleEs
                  : activePositionBox.subtitleEn}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center bg-[#161720] p-1 rounded-xl border border-[#252736] h-9">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setTrainerMode("scale_playalong")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                    trainerMode === "scale_playalong"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {isEs ? "ESCALAS" : "SCALES"}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTrainerMode("spider_exercise");
                    setDotLabelMode("finger");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                    trainerMode === "spider_exercise"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Dumbbell size={11} />
                  <span>{isEs ? "DIGITACIÓN" : "DRILLS"}</span>
                </button>
              </div>

              <div className="relative h-9 shrink-0">
                <Radio
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#f25100] pointer-events-none"
                />
                <select
                  value={selectedInstrument}
                  onChange={(e) => {
                    const newInst = e.target.value as GuitarInstrumentId;
                    e.currentTarget.blur();
                    setSelectedInstrument(newInst);
                    dictionaryAudio.setInstrument(newInst);
                    const firstRootDot =
                      activePositionBox.orderedOneOctaveDots[0] ||
                      allFretboardDots.find((d) => d.isRoot);
                    if (firstRootDot) {
                      handlePlaySingleDot(firstRootDot, newInst);
                    }
                  }}
                  className="h-9 pl-7 pr-6 rounded-xl bg-[#161720] hover:bg-[#1c1e29] border border-[#282b3d] hover:border-[#f25100]/60 text-[11px] font-extrabold uppercase tracking-wider text-zinc-100 appearance-none cursor-pointer focus:outline-none"
                >
                  {GUITAR_INSTRUMENTS.map((inst) => (
                    <option
                      key={inst.id}
                      value={inst.id}
                      className="bg-[#111217] text-zinc-100 font-sans font-bold"
                    >
                      {isEs ? inst.labelEs : inst.labelEn}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
              </div>

              <div className="flex items-center bg-[#161720] p-1 rounded-xl border border-[#252736] shrink-0 h-9">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setDotLabelMode("note")}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                    dotLabelMode === "note"
                      ? "bg-[#f25100] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Music size={12} />
                  <span>{isEs ? "NOTAS" : "NOTES"}</span>
                </button>
                <button
                  type="button"
                  disabled={isFullMapActive || trainerMode === "spider_exercise"}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (!isFullMapActive && trainerMode !== "spider_exercise")
                      setDotLabelMode("degree");
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                    isFullMapActive || trainerMode === "spider_exercise"
                      ? "text-zinc-600 opacity-40 cursor-not-allowed"
                      : dotLabelMode === "degree"
                      ? "bg-[#f25100] text-white cursor-pointer"
                      : "text-zinc-400 hover:text-white cursor-pointer"
                  }`}
                >
                  <GitCommit size={12} />
                  <span>{isEs ? "INT." : "INT."}</span>
                </button>
                <button
                  type="button"
                  disabled={isFullMapActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (!isFullMapActive) setDotLabelMode("finger");
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                    isFullMapActive
                      ? "text-zinc-600 opacity-40 cursor-not-allowed"
                      : dotLabelMode === "finger"
                      ? "bg-[#f25100] text-white cursor-pointer"
                      : "text-zinc-400 hover:text-white cursor-pointer"
                  }`}
                >
                  <Hand size={12} />
                  <span>{isEs ? "DEDOS" : "FING."}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. FILA DE POSICIONES (O PATRÓN DE DIGITACIÓN SI ESTÁ EN MODO ARAÑA) */}
          {trainerMode === "scale_playalong" ? (
            <div className="bg-[#15161e] border border-[#232634] rounded-xl p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Layers size={13} className="text-[#f25100]" />
                  {isEs
                    ? "POSICIONES EN EL DIAPASÓN:"
                    : "FRETBOARD POSITIONS:"}
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {isEs
                    ? `Trastes activos: ${activePositionBox.minFret} al ${activePositionBox.maxFret}`
                    : `Active frets: ${activePositionBox.minFret} to ${activePositionBox.maxFret}`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {studioPositions.map((pos) => {
                  const isSelected = selectedPositionId === pos.id;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setSelectedPositionId(pos.id);
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer truncate ${
                        isSelected
                          ? "bg-[#f25100] text-white border-[#ff7433] shadow-[0_0_12px_rgba(242,81,0,0.35)]"
                          : "bg-[#101117] text-zinc-300 border-[#252736] hover:border-[#f25100]/50 hover:text-white"
                      }`}
                    >
                      {isEs ? pos.titleEs : pos.titleEn}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[#15161e] border border-[#232634] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative h-8">
                  <select
                    value={spiderPatternId}
                    onChange={(e) => {
                      e.currentTarget.blur();
                      setSpiderPatternId(e.target.value);
                    }}
                    className="h-8 pl-3 pr-7 rounded-lg bg-[#101117] border border-[#f25100]/60 text-xs font-mono font-extrabold text-white appearance-none cursor-pointer focus:outline-none"
                  >
                    {SPIDER_PATTERNS.map((pat) => (
                      <option
                        key={pat.id}
                        value={pat.id}
                        className="bg-[#111217] text-white font-mono"
                      >
                        {isEs ? `Patrón ${pat.label}` : `Pattern ${pat.label}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#f25100] pointer-events-none"
                  />
                </div>

                <div className="relative h-8">
                  <select
                    value={spiderStartFret}
                    onChange={(e) => {
                      e.currentTarget.blur();
                      setSpiderStartFret(Number(e.target.value));
                    }}
                    className="h-8 pl-2.5 pr-6 rounded-lg bg-[#101117] border border-[#252736] text-xs font-mono font-extrabold text-zinc-200 appearance-none cursor-pointer focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 7, 9].map((f) => (
                      <option
                        key={f}
                        value={f}
                        className="bg-[#111217] text-white font-mono"
                      >
                        {isEs ? `Traste Inicial ${f}` : `Start Fret ${f}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-400">
                  {isEs ? "6ª cuerda:" : "6th str:"}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#101117] border border-[#252736] font-black text-[#f25100]">
                  {spiderExampleNotesOn6thString}
                </span>
              </div>
            </div>
          )}

          {/* 3. BARRA 100% FIJA EN 1 SOLA LÍNEA */}
          <div className="bg-[#15161e] border border-[#282c3e] rounded-xl px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center bg-[#101117] p-1 rounded-xl border border-[#252736] gap-1 shrink-0">
                {([1, 2, 3, 4] as SubdivisionId[]).map((subId) => {
                  const isSubActive = subdivision === subId;
                  const tooltipMap: Record<SubdivisionId, string> = {
                    1: isEs
                      ? "Negra (1 nota por pulso)"
                      : "Quarter note (1 note/beat)",
                    2: isEs
                      ? "Corcheas (2 notas por pulso)"
                      : "Eighth notes (2 notes/beat)",
                    3: isEs
                      ? "Tresillos (3 notas por pulso)"
                      : "Triplets (3 notes/beat)",
                    4: isEs
                      ? "Semicorcheas (4 notas por pulso)"
                      : "Sixteenth notes (4 notes/beat)",
                  };
                  return (
                    <button
                      key={subId}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      title={tooltipMap[subId]}
                      onClick={() => setSubdivision(subId)}
                      className={`w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                        isSubActive
                          ? "bg-[#f25100] text-white shadow-[0_0_10px_rgba(242,81,0,0.4)]"
                          : "text-zinc-400 hover:text-white hover:bg-[#181a24]"
                      }`}
                    >
                      <RhythmFigureSvg id={subId} />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                title={
                  isEs
                    ? "Metrónomo (Incluye 1 compás de cuenta previa al iniciar)"
                    : "Metronome (Includes 1-bar count-in on start)"
                }
                className={`h-9 px-3 rounded-xl border flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
                  metronomeEnabled
                    ? "bg-[#1a1412] text-[#ff8547] border-[#f25100]/50"
                    : "bg-[#101117] text-zinc-500 border-[#252736]"
                }`}
              >
                <Timer size={14} className="text-[#f25100] shrink-0" />
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((b) => (
                    <span
                      key={b}
                      className={`w-2 h-2 rounded-full transition-transform ${
                        isPlayingSequence && currentBeatPulse === b
                          ? b === 1
                            ? "bg-[#f25100] scale-125 shadow-[0_0_8px_#f25100]"
                            : "bg-white scale-110"
                          : "bg-zinc-700"
                      }`}
                    />
                  ))}
                </div>
              </button>

              <div className="flex items-center gap-1.5 bg-[#101117] px-2.5 rounded-xl border border-[#252736] h-9 shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setBpm((prev) => Math.max(40, prev - 5))}
                  className="text-zinc-400 hover:text-white font-mono font-bold text-xs px-1 cursor-pointer"
                >
                  −
                </button>
                <input
                  type="range"
                  min={40}
                  max={180}
                  step={1}
                  value={bpm}
                  onChange={(e) => {
                    e.currentTarget.blur();
                    setBpm(Number(e.target.value));
                  }}
                  className="w-20 accent-[#f25100] cursor-pointer"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setBpm((prev) => Math.min(180, prev + 5))}
                  className="text-zinc-400 hover:text-white font-mono font-bold text-xs px-1 cursor-pointer"
                >
                  +
                </button>
                <span className="text-xs font-mono font-black text-[#f25100] w-[54px] text-right">
                  {bpm} BPM
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div
                className="flex items-center bg-[#101117] p-1 rounded-xl border border-[#252736] h-9 shrink-0"
                title={
                  isEs
                    ? "Cantidad de veces que suena la escala (Predeterminado: 1 vez)"
                    : "Number of scale repetitions (Default: 1x)"
                }
              >
                <Repeat size={12} className="text-[#f25100] mx-1.5 shrink-0" />
                {REPEAT_OPTIONS.map((opt) => {
                  const isRepActive = repeatCount === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setRepeatCount(opt.value)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono font-extrabold transition-all cursor-pointer ${
                        isRepActive
                          ? "bg-[#f25100] text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (isPlayingSequence) {
                    clearPlaybackTimers();
                  } else {
                    startRhythmicPractice();
                  }
                }}
                title={
                  isEs
                    ? "Iniciar / Detener (Atajo: Barra Espaciadora)"
                    : "Start / Stop (Shortcut: Spacebar)"
                }
                className="w-[148px] h-9 px-3 rounded-xl bg-[#f25100] hover:bg-[#ff621a] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(242,81,0,0.45)] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                {isPlayingSequence ? (
                  <>
                    <Square size={12} className="fill-current shrink-0" />
                    <span>{isEs ? "DETENER" : "STOP"}</span>
                  </>
                ) : (
                  <>
                    <Play size={12} className="fill-current shrink-0" />
                    <span>{isEs ? "TOCA CONMIGO" : "PLAY ALONG"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4. DIAPASÓN INTERACTIVO */}
          <div className="w-full bg-[#15161e] border border-[#232634] rounded-2xl p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[880px] select-none">
              <div className="relative flex flex-col justify-between py-2">
                <div
                  className="grid items-center"
                  style={{
                    gridTemplateColumns: gridColsStyle,
                  }}
                >
                  <div
                    className="flex flex-col gap-5 relative"
                    style={{
                      gridColumn: `span ${visibleFrets.length + 1} / span ${
                        visibleFrets.length + 1
                      }`,
                    }}
                  >
                    <div
                      className="absolute inset-0 grid pointer-events-none"
                      style={{
                        gridTemplateColumns: gridColsStyle,
                      }}
                    >
                      <div
                        className={
                          showOpenStringColumn
                            ? "border-r border-[#2e3244] h-full"
                            : "border-r-[4px] border-[#f25100] h-full"
                        }
                      />

                      {visibleFrets.map((fret) => {
                        const isHighlightedFret =
                          trainerMode === "spider_exercise"
                            ? fret >= currentSpiderWindowBaseFret &&
                              fret <= currentSpiderWindowBaseFret + 3
                            : activePositionBox.id !== 0 &&
                              fret >= activePositionBox.minFret &&
                              fret <= activePositionBox.maxFret;

                        return (
                          <div
                            key={`fret-line-${fret}`}
                            className={`${
                              fret === 0
                                ? "border-r-[4px] border-[#f25100]"
                                : "border-r border-[#2e3244]"
                            } h-full relative flex items-center justify-center transition-colors ${
                              isHighlightedFret ? "bg-[#f25100]/[0.07]" : ""
                            }`}
                          >
                            {[3, 5, 7, 9, 15, 17].includes(fret) && (
                              <div className="w-2.5 h-2.5 rounded-full bg-zinc-800/80" />
                            )}
                            {fret === 12 && (
                              <div className="flex flex-col justify-between h-24">
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-800/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-800/80" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {HORIZONTAL_STRINGS.map((str) => (
                      <div
                        key={`string-row-${str.stringNumber}`}
                        className="relative grid items-center h-8"
                        style={{
                          gridTemplateColumns: gridColsStyle,
                        }}
                      >
                        <div className="relative z-10 pr-2 flex items-center justify-end gap-1">
                          <span className="text-[10px] font-mono font-bold text-zinc-500">
                            {str.stringNumber}ª
                          </span>
                          <span className="text-xs font-mono font-extrabold text-zinc-300">
                            {isEs ? str.labelEs : str.labelEn}
                          </span>
                        </div>

                        <div
                          className="absolute left-[46px] right-0 bg-zinc-600/75 pointer-events-none"
                          style={{ height: `${str.thickness}px` }}
                        />

                        {visibleFrets.map((fret) => {
                          const cellKey = `${str.stringNumber}-${fret}`;

                          if (trainerMode === "spider_exercise") {
                            const spiderCell =
                              spiderDotsOnFretboard.get(cellKey);
                            if (!spiderCell) {
                              return (
                                <div
                                  key={`empty-spider-${cellKey}`}
                                  className="h-8 flex items-center justify-center relative z-10"
                                />
                              );
                            }

                            const { dot, finger } = spiderCell;
                            const isPlayingThisExactDot =
                              activePlayingDotKey === dot.key;
                            const isCountInTargetDot =
                              countInFirstDotKey === dot.key;
                            const isFirstFingerAnchor = finger === "1";

                            const labelText =
                              dotLabelMode === "note"
                                ? isEs
                                  ? dot.noteLabelEs
                                  : dot.noteLabelEn
                                : finger;

                            return (
                              <div
                                key={dot.key}
                                className="h-8 flex items-center justify-center relative z-10"
                              >
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.currentTarget.blur();
                                    handlePlaySingleDot(dot);
                                  }}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full font-mono text-[11px] font-extrabold flex items-center justify-center transition-transform duration-150 cursor-pointer ${
                                    isPlayingThisExactDot
                                      ? "bg-white text-[#090a0d] scale-125 ring-4 ring-[#f25100] shadow-[0_0_20px_#f25100] z-30"
                                      : isCountInTargetDot
                                      ? "bg-[#f25100] text-white scale-115 ring-4 ring-white animate-pulse shadow-[0_0_18px_#f25100] z-30"
                                      : isFirstFingerAnchor
                                      ? "bg-[#f25100] text-white border-2 border-[#ff8547] shadow-[0_0_12px_rgba(242,81,0,0.5)] z-20"
                                      : "bg-[#2a2d3a] text-zinc-100 border border-[#45495c] hover:border-[#f25100]"
                                  }`}
                                >
                                  {labelText}
                                </button>
                              </div>
                            );
                          }

                          const dot = allFretboardDots.find(
                            (d) =>
                              d.stringNumber === str.stringNumber &&
                              d.fret === fret
                          );

                          if (!dot) {
                            return (
                              <div
                                key={`empty-${str.stringNumber}-${fret}`}
                                className="h-8 flex items-center justify-center relative z-10"
                              />
                            );
                          }

                          const inActivePosition =
                            activePositionBox.activeDotKeys.has(dot.key);
                          const isPlayingThisExactDot =
                            activePlayingDotKey === dot.key;
                          const isCountInTargetDot =
                            countInFirstDotKey === dot.key;

                          const effectiveMode = isFullMapActive
                            ? "note"
                            : dotLabelMode;

                          const labelText =
                            effectiveMode === "note"
                              ? isEs
                                ? dot.noteLabelEs
                                : dot.noteLabelEn
                              : effectiveMode === "degree"
                              ? dot.degreeLabel
                              : activePositionBox.fingerByDotKey.get(dot.key) ||
                                (fret === 0 ? "0" : "1");

                          return (
                            <div
                              key={dot.key}
                              className="h-8 flex items-center justify-center relative z-10"
                            >
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  e.currentTarget.blur();
                                  handlePlaySingleDot(dot);
                                }}
                                title={`${
                                  isEs ? dot.noteLabelEs : dot.noteLabelEn
                                } (${dot.degreeLabel}) - ${
                                  isEs ? "Cuerda" : "String"
                                } ${dot.stringNumber}, ${
                                  fret === 0
                                    ? isEs
                                      ? "Al aire (0)"
                                      : "Open (0)"
                                    : `${isEs ? "Traste" : "Fret"} ${fret}`
                                }`}
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full font-mono text-[11px] font-extrabold flex items-center justify-center transition-transform duration-150 cursor-pointer ${
                                  isPlayingThisExactDot
                                    ? "bg-white text-[#090a0d] scale-125 ring-4 ring-[#f25100] shadow-[0_0_20px_#f25100] z-30"
                                    : isCountInTargetDot
                                    ? "bg-[#f25100] text-white scale-115 ring-4 ring-white animate-pulse shadow-[0_0_18px_#f25100] z-30"
                                    : dot.isRoot
                                    ? "bg-[#f25100] text-white border-2 border-[#ff8547] shadow-[0_0_12px_rgba(242,81,0,0.65)] z-20"
                                    : "bg-[#2a2d3a] text-zinc-100 border border-[#45495c] hover:border-[#f25100] hover:text-white"
                                } ${
                                  !inActivePosition &&
                                  !isPlayingThisExactDot &&
                                  !isCountInTargetDot
                                    ? "opacity-15 scale-90"
                                    : "opacity-100"
                                }`}
                              >
                                {labelText}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="grid pt-4 mt-2 border-t border-[#1f2230] text-center"
                  style={{
                    gridTemplateColumns: gridColsStyle,
                  }}
                >
                  <div className="text-[10px] font-mono font-bold text-zinc-500">
                    TR.
                  </div>
                  {visibleFrets.map((fret) => {
                    const isMarker = FRET_MARKERS.includes(fret);
                    const inWindow =
                      trainerMode === "spider_exercise"
                        ? fret >= currentSpiderWindowBaseFret &&
                          fret <= currentSpiderWindowBaseFret + 3
                        : activePositionBox.id !== 0 &&
                          fret >= activePositionBox.minFret &&
                          fret <= activePositionBox.maxFret;

                    return (
                      <div
                        key={`fret-num-${fret}`}
                        className={`text-xs font-mono ${
                          inWindow
                            ? "font-black text-[#f25100]"
                            : isMarker
                            ? "font-black text-zinc-300"
                            : "font-medium text-zinc-600"
                        }`}
                      >
                        {fret}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-[#1e202b] text-xs text-zinc-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 font-bold">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#f25100] inline-block shadow-[0_0_8px_#f25100]" />
                  {trainerMode === "spider_exercise"
                    ? isEs
                      ? "Dedo 1 (Ancla del bloque de 4 trastes)"
                      : "Finger 1 (4-fret block anchor)"
                    : isEs
                    ? "Fundamental (F)"
                    : "Fundamental (F)"}
                </span>
                <span className="flex items-center gap-2 font-bold">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#2a2d3a] border border-[#45495c] inline-block" />
                  {trainerMode === "spider_exercise"
                    ? isEs
                      ? "Dedos 2, 3 y 4 del patrón cromático"
                      : "Fingers 2, 3 & 4 of chromatic pattern"
                    : isEs
                    ? "Notas de la Posición Activa"
                    : "Active Position Notes"}
                </span>
              </div>

              <span className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                <Volume2 size={13} className="text-[#f25100]" />
                {isEs
                  ? "Atajo: Presiona [ESPACIO] para Iniciar / Detener (Incluye 1 compás de entrada)"
                  : "Shortcut: Press [SPACE] to Start / Stop (Includes 1-bar count-in)"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#111217] p-5 rounded-2xl border border-[#1e202b] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <BookOpen size={14} className="text-[#f25100]" />
              {isEs ? "RELACIÓN ACORDE-ESCALA" : "CHORD-SCALE RELATIONSHIP"}
            </span>
            <p className="text-xs sm:text-sm text-zinc-400">
              {isEs
                ? "Esta escala/arpegio se aplica directamente para improvisar sobre los siguientes acordes de "
                : "This scale/arpeggio applies directly when improvising over the following chords in "}
              <strong className="text-white">{selectedRoot}</strong>:
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {selectedScaleDef.relatedChords.map((ch) => (
                <span
                  key={ch}
                  className="px-3.5 py-1.5 rounded-xl bg-[#161720] border border-[#252736] text-xs sm:text-sm font-mono font-extrabold text-white"
                >
                  {selectedRoot}{" "}
                  <span className="text-[#f25100]">{ch}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-[#161720] border border-[#252736] rounded-xl px-4 py-3 shrink-0 flex flex-col items-start sm:items-end">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <GitCommit size={13} className="text-[#f25100]" />
              {isEs ? "ESTRUCTURA DE INTERVALOS" : "INTERVAL STRUCTURE"}
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-[#f25100] mt-1">
              {activeFormulaString}
            </span>
            {selectedScaleDef.characteristicNote && (
              <span className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {isEs ? "Nota característica: " : "Characteristic note: "}
                <strong className="text-white">
                  {selectedScaleDef.characteristicNote}
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}