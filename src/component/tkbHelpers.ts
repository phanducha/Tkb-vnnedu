export const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const isMetaRow = (text: string) => {
  const t = (text || "").toLowerCase().trim();
  if (!t) return true;
  if (t.includes("ngày") || t.includes("thứ") || t.includes("chủ nhật")) return true;
  if (t === "cn" || t === "chu nhat" || t === "chunhat") return true;
  if (/^\d+$/.test(t)) {
    const num = Number(t);
    if (num >= 2 && num <= 8) return true;
  }
  return false;
};

const looksLikeGridHeader = (first: string, second: string) => {
  const a = (first || "").toLowerCase().trim();
  const b = (second || "").toLowerCase().trim();
  const firstOk = a.includes("ngày") || a.includes("thứ");
  const secondOk = b.includes("tiết");
  return firstOk && secondOk;
};

export const findGridHeaderRow = (data: any[][]): number => {
  for (let r = 0; r < Math.min(12, data.length); r++) {
    const first = String(data?.[r]?.[0] ?? "");
    const second = String(data?.[r]?.[1] ?? "");
    if (looksLikeGridHeader(first, second)) return r;
  }
  return -1;
};

export const isGridFormat = (data: any[][]) => findGridHeaderRow(data) !== -1;

export type SessionCode = "S" | "C" | "";

export interface GridColumnInfo {
  colIndex: number;
  className: string;
  sessionCode: SessionCode;
}

const detectSessionFromLabel = (label: string): SessionCode => {
  const lower = (label || "").toLowerCase().trim();
  if (!lower) return "";
  if (lower === "s" || lower.includes("sáng")) return "S";
  if (lower === "c" || lower.includes("chiều")) return "C";
  return "";
};

export const buildGridColumnInfos = (
  data: any[][],
  headerRowIdx: number
): GridColumnInfo[] => {
  if (headerRowIdx === -1) return [];
  const headerRow = data[headerRowIdx] || [];
  const subHeaderRow = data[headerRowIdx + 1] || [];
  const maxLen = Math.max(headerRow.length, subHeaderRow.length);
  const infos: GridColumnInfo[] = [];
  let currentClass = "";

  const columnHasAnyValue = (colIndex: number) => {
    for (let r = headerRowIdx + 2; r < data.length; r++) {
      const cell = String(data?.[r]?.[colIndex] ?? "").trim();
      if (cell) return true;
    }
    return false;
  };

  for (let c = 2; c < maxLen; c++) {
    const headerVal = String(headerRow[c] ?? "").trim();
    if (headerVal) currentClass = headerVal;
    if (!currentClass) continue;

    const subVal = String(subHeaderRow[c] ?? "").trim();
    const sessionCode = detectSessionFromLabel(subVal);

    if (!headerVal && !subVal && !columnHasAnyValue(c)) continue;

    infos.push({
      colIndex: c,
      className: currentClass,
      sessionCode,
    });
  }

  return infos;
};

export const detectDayIndex = (label: string, headerDays: string[]): number => {
  const normalized = (label || "").toLowerCase().trim();
  if (!normalized) return -1;

  const exact = headerDays.findIndex(
    (d) => d.toLowerCase() === normalized
  );
  if (exact >= 0) return exact;

  const numMatch = normalized.match(/(\d+)/);
  if (numMatch) {
    const num = Number(numMatch[1]);
    if (num >= 2 && num <= 7) return num - 2;
    if (num === 8) return 6;
  }

  if (normalized === "cn" || normalized === "chunhat" || normalized === "chu nhat") {
    return 6;
  }

  return -1;
};

export const isClassHeaderFormat = (data: any[][]) => {
  for (let r = 0; r < Math.min(3, data.length); r++) {
    const row = data[r] || [];
    let classCount = 0;
    for (let c = 0; c < Math.min(12, row.length); c++) {
      const cell = String(row[c] ?? "").trim();
      if (/^\d+[A-Z]\d+$/.test(cell)) classCount++;
    }
    if (classCount >= 3) return true;
  }
  return false;
};

export const isDayColumnFormat = (data: any[][]) => {
  let dayCount = 0;
  let classCount = 0;
  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r] || [];
    const first = String(row[0] ?? "").trim().toLowerCase();
    if (first.includes("thứ") || first.includes("chủ nhật")) dayCount++;
  }
  for (let r = 0; r < Math.min(3, data.length); r++) {
    const row = data[r] || [];
    for (let c = 0; c < Math.min(12, row.length); c++) {
      const cell = String(row[c] ?? "").trim();
      if (/^\d+[A-Z]\d+$/.test(cell)) classCount++;
    }
  }
  return dayCount >= 3 && classCount >= 3;
};

export const isRowWiseFormat = (data: any[][]) => {
  let classCount = 0;
  for (let r = 1; r < Math.min(12, data.length); r++) {
    const row = data[r] || [];
    const first = String(row[0] ?? "").trim();
    if (/^\d+[A-Z]\d+$/.test(first)) classCount++;
  }
  return classCount >= 2;
};

export const normalizeBuoi = (buoi: string): string => {
  const lower = (buoi || "").toLowerCase().trim();
  if (lower === "s" || lower.includes("sáng")) return "S";
  if (lower === "c" || lower.includes("chiều")) return "C";
  return buoi || "";
};

export const extractClassNames = (data: any[][]): string[] => {
  const classNames = new Set<string>();

  if (isGridFormat(data)) {
    const headerRowIdx = findGridHeaderRow(data);
    const headerRow = data[headerRowIdx] || [];
    for (let c = 2; c < headerRow.length; c++) {
      const v = String(headerRow[c] || "").trim();
      if (v) classNames.add(v);
    }
  } else if (isDayColumnFormat(data) || isClassHeaderFormat(data)) {
    for (let r = 0; r < Math.min(5, data.length); r++) {
      const row = data[r] || [];
      for (let c = 0; c < row.length; c++) {
        const v = String(row[c] ?? "").trim();
        if (/^\d+[A-Z]\d+$/.test(v)) classNames.add(v);
      }
    }
  } else if (isRowWiseFormat(data)) {
    for (let r = 1; r < data.length; r++) {
      const row = data[r] || [];
      const v = String(row[0] ?? "").trim();
      if (/^\d+[A-Z]\d+$/.test(v)) classNames.add(v);
    }
  } else {
    for (let r = 1; r < data.length; r++) {
      const row = data[r] || [];
      const v = String(row[0] ?? "").trim();
      if (v) classNames.add(v);
    }
  }

  return Array.from(classNames).sort();
};


