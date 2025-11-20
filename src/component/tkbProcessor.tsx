import React, { useState } from "react";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { EduAutocomplete } from "./eduComplete";
import { EDU_SUBJECTS, autoMapToEdu } from "./subjects";
import {
  norm,
  isMetaRow,
  findGridHeaderRow,
  isGridFormat,
  isClassHeaderFormat,
  isDayColumnFormat,
  isRowWiseFormat,
  normalizeBuoi,
  extractClassNames,
  buildGridColumnInfos,
  detectDayIndex,
} from "./tkbHelpers";

interface SubjectMapItem {
  raw: string;
  edu: string;
  custom?: boolean;
}
type Mode = "single" | "separate";

export default function TKBProcessor() {
  const [processingMode, setProcessingMode] = useState<Mode>("separate");

  //  SINGLE FILE (Cả ngày) 
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [sheetData, setSheetData] = useState<any[][]>([]);

  //  SEPARATE FILES (Sáng/Chiều) 
  const [morningFile, setMorningFile] = useState<File | null>(null);
  const [afternoonFile, setAfternoonFile] = useState<File | null>(null);
  const [morningFileName, setMorningFileName] = useState("");
  const [afternoonFileName, setAfternoonFileName] = useState("");
  const [morningSheetNames, setMorningSheetNames] = useState<string[]>([]);
  const [afternoonSheetNames, setAfternoonSheetNames] = useState<string[]>([]);
  const [selectedMorningSheet, setSelectedMorningSheet] = useState("");
  const [selectedAfternoonSheet, setSelectedAfternoonSheet] = useState("");
  const [morningSheetData, setMorningSheetData] = useState<any[][]>([]);
  const [afternoonSheetData, setAfternoonSheetData] = useState<any[][]>([]);

  //  SUBJECT MAPPING 
  const [subjects, setSubjects] = useState<SubjectMapItem[]>([]);
  const [newRaw, setNewRaw] = useState("");
  const [newEdu, setNewEdu] = useState("");

  const headerDays = [
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
    "Chủ nhật",
  ];


  // localStorage functions for subject mappings
  const saveSubjectMappings = (mappings: SubjectMapItem[]) => {
    try {
      const dataToSave = mappings.filter(s => s.raw.trim() && s.edu.trim());
      localStorage.setItem('tkb_subject_mappings', JSON.stringify(dataToSave));
    } catch (err) {
      console.warn('Failed to save subject mappings to localStorage:', err);
    }
  };

  const loadSubjectMappings = (): SubjectMapItem[] => {
    try {
      const saved = localStorage.getItem('tkb_subject_mappings');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Loaded subject mappings from localStorage:', parsed.length, 'items');
        return parsed;
      }
    } catch (err) {
      console.warn('Failed to load subject mappings from localStorage:', err);
    }
    return [];
  };

  const normalizeSubject = (raw: string) => {
    if (!raw) return "";

    const key = norm(raw);
    if (!key) return "";

    const candidates = subjects
      .map((s) => ({
        key: norm(s.raw),
        edu: (s.edu || "").trim(),
      }))
      .filter((x) => x.key);

    // 1) Ưu tiên khớp CHÍNH XÁC (sau chuẩn hoá)
    const exact = candidates.find((x) => x.key === key && x.edu);
    if (exact) return exact.edu;
    const contains = candidates
      .filter(
        (x) =>
          x.edu &&
          (key.includes(x.key) || x.key.includes(key)) &&
          x.key.length >= 3 
      )
      .sort((a, b) => b.key.length - a.key.length)[0];
    if (contains) return contains.edu;

    const auto = autoMapToEdu(raw);
    return auto || raw;
  };

  const extractSubjects = (data: any[][]) => {
    try {
      const unique = new Set<string>();
      if (isGridFormat(data)) {
        const headerRowIdx = findGridHeaderRow(data);
        for (let r = headerRowIdx + 1; r < data.length; r++) {
          const row = data[r] || [];
          const periodNum = Number(row[1] ?? "");
          if (!(periodNum > 0)) continue;
          for (let c = 2; c < (row?.length || 0); c++) {
            const cell = String(row[c] ?? "").trim();
            if (cell) unique.add(cell);
          }
        }
      } else if (isDayColumnFormat(data) || isClassHeaderFormat(data)) {
        let classHeaderRow = -1;
        for (let r = 0; r < Math.min(5, data.length); r++) {
          const row = data[r] || [];
          let count = 0;
          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] ?? "").trim();
            if (/^\d+[A-Z]\d+$/.test(cell)) count++;
          }
          if (count >= 3) { classHeaderRow = r; break; }
        }
        if (classHeaderRow !== -1) {
          for (let r = classHeaderRow + 1; r < data.length; r++) {
            const row = data[r] || [];
            const first = String(row[0] ?? "").trim().toLowerCase();
            if (first.includes("thứ") || first.includes("chủ nhật")) continue;
            for (let c = 0; c < row.length; c++) {
              const cell = String(row[c] ?? "").trim();
              if (cell && !/^[0-9]+$/.test(cell)) unique.add(cell);
            }
          }
        }
      } else if (isRowWiseFormat(data)) {
        for (let r = 1; r < data.length; r++) {
          const row = data[r] || [];
          for (let c = 3; c <= 9; c++) {
            const cell = String(row[c] ?? "").trim();
            if (cell) unique.add(cell);
          }
        }
      } else {
        for (let r = 1; r < data.length; r++) {
          const row = data[r] || [];
          for (let c = 3; c <= 9; c++) {
            const cell = String(row[c] ?? "").trim();
            if (cell) unique.add(cell);
          }
        }
      }

      const extracted: SubjectMapItem[] = Array.from(unique)
        .sort((a, b) => a.localeCompare(b, "vi"))
        .map((raw) => ({ raw, edu: autoMapToEdu(raw) }));
      
      // Load saved mappings from localStorage
      const savedMappings = loadSubjectMappings();
      
      setSubjects((prev) => {
        const merged = [...prev];
        
        for (const saved of savedMappings) {
          if (!merged.some((m) => m.raw.toLowerCase() === saved.raw.toLowerCase())) {
            merged.push(saved);
          }
        }
        
        for (const x of extracted) {
          if (!merged.some((m) => m.raw.toLowerCase() === x.raw.toLowerCase())) {
            merged.push(x);
          }
        }
        
        return merged;
      });
    } catch (err) {
      console.warn("Extract subjects failed", err);
    }
  };

  //  FILE READERS 
  const loadSheetFromFile = (
    f: File,
    sheetName: string,
    setter: (data: any[][]) => void,
    alsoExtractSubjects: boolean
  ) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string | ArrayBuffer;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const data = jsonData as any[][];
      setter(data);
      if (alsoExtractSubjects) extractSubjects(data);
      console.log("Loaded:", sheetName, data.slice(0, 10));
    };
    reader.readAsBinaryString(f);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string | ArrayBuffer;
      const wb = XLSX.read(bstr, { type: "binary" });
      setSheetNames(wb.SheetNames);
      const first = wb.SheetNames[0] || "";
      setSelectedSheet(first);
      loadSheetFromFile(f, first, setSheetData, true);
    };
    reader.readAsBinaryString(f);
  };

  const handleMorningUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMorningFile(f);
    setMorningFileName(f.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string | ArrayBuffer;
      const wb = XLSX.read(bstr, { type: "binary" });
      setMorningSheetNames(wb.SheetNames);
      const first = wb.SheetNames[0] || "";
      setSelectedMorningSheet(first);
      loadSheetFromFile(f, first, setMorningSheetData, true);
    };
    reader.readAsBinaryString(f);
  };

  const handleAfternoonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAfternoonFile(f);
    setAfternoonFileName(f.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string | ArrayBuffer;
      const wb = XLSX.read(bstr, { type: "binary" });
      setAfternoonSheetNames(wb.SheetNames);
      const first = wb.SheetNames[0] || "";
      setSelectedAfternoonSheet(first);
      loadSheetFromFile(f, first, setAfternoonSheetData, true);
    };
    reader.readAsBinaryString(f);
  };

  //  PROCESSORS 
  const handleProcess = () => {
    const anyUnmapped =
      subjects.some(s => !String(s.edu || "").trim());

    if (anyUnmapped) {
      const proceed = confirm(
        "Một số môn chưa có 'Tên môn học Edu'. Vẫn xuất file chứ?"
      );
      if (!proceed) return;
    }

    // Auto-save subject mappings to localStorage before processing
    saveSubjectMappings(subjects);

    if (processingMode === "single") {
      if (!sheetData.length) {
        alert("Vui lòng upload file & chọn sheet!");
        return;
      }
      processSingleFile(sheetData);
    } else {
      if (!morningSheetData.length && !afternoonSheetData.length) {
        alert("Vui lòng upload ít nhất 1 file (Sáng hoặc Chiều), tốt nhất là cả 2!");
        return;
      }
      processSeparateFiles();
    }
  };

  const processSingleFile = (data: any[][]) => {
    const result: any[][] = [];
    result.push(["Lớp học", "Buổi", "Tiết thứ", ...headerDays]);

    if (isGridFormat(data)) {
      const headerRowIdx = findGridHeaderRow(data);
      const gridColumns = buildGridColumnInfos(data, headerRowIdx);
      const classToData: Record<
        string,
        Record<string, Record<number, Record<number, string>>>
      > = {};

      const ensurePeriodBucket = (
        className: string,
        sessionKey: string,
        periodNum: number
      ) => {
        if (!classToData[className]) classToData[className] = {};
        if (!classToData[className][sessionKey])
          classToData[className][sessionKey] = {};
        if (!classToData[className][sessionKey][periodNum])
          classToData[className][sessionKey][periodNum] = {};
      };

      let currentDayIdx = -1;
      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r] || [];
        const dayLabel = String(row[0] ?? "").trim();
        if (dayLabel) {
          const idx = detectDayIndex(dayLabel, headerDays);
          if (idx >= 0) currentDayIdx = idx;
        }
        const periodNum = Number(row[1] ?? "");
        if (!(periodNum > 0)) continue;

        gridColumns.forEach(({ className, colIndex, sessionCode }) => {
          const sessionKey = sessionCode || "";
          ensurePeriodBucket(className, sessionKey, periodNum);
          const raw = String(row[colIndex] ?? "").trim();
          classToData[className][sessionKey][periodNum][currentDayIdx] =
            normalizeSubject(raw);
        });
      }

      const sessionSort = (code: string) => {
        const normalized = (code || "").toUpperCase();
        if (normalized === "S") return 0;
        if (normalized === "C") return 1;
        return 2;
      };

      Object.keys(classToData)
        .sort()
        .forEach((cls) => {
          const sessions = Object.keys(classToData[cls] || {}).sort(
            (a, b) => sessionSort(a) - sessionSort(b)
          );
          sessions.forEach((sessionKey) => {
            const periods = Object.keys(classToData[cls]?.[sessionKey] || {})
              .map((n) => Number(n))
              .sort((a, b) => a - b);
            const maxPeriod = periods.length ? periods[periods.length - 1] : 0;
            for (let p = 1; p <= maxPeriod; p++) {
              const dayValues = headerDays.map(
                (_, di) => classToData[cls]?.[sessionKey]?.[p]?.[di] ?? ""
              );
              result.push([cls, sessionKey, p, ...dayValues]);
            }
          });
        });
    } else {
      // Row-wise / biến thể
      const classSessionData: Record<string, Record<string, any[]>> = {};

      for (let i = 1; i < data.length; i++) {
        const row = data[i] || [];
        if (!row || row.length < 3) continue;
        const lop = String(row[0] ?? "").trim();
        const buoi = normalizeBuoi(String(row[1] ?? ""));
        const tiet = row[2];
        const days = (row.slice(3, 10) as string[]).map((subj) => normalizeSubject(String(subj ?? "")));

        if (!classSessionData[lop]) classSessionData[lop] = {};
        if (!classSessionData[lop][buoi]) classSessionData[lop][buoi] = [];
        classSessionData[lop][buoi].push([lop, buoi, tiet, ...days]);
      }

      const sortedClasses = Object.keys(classSessionData).sort();
      sortedClasses.forEach((className) => {
        const sessions = Object.keys(classSessionData[className]).sort();
        sessions.forEach((sessionCode) => {
          const rows = classSessionData[className][sessionCode];
          rows.sort((a, b) => Number(a[2]) - Number(b[2]));
          rows.forEach((r) => result.push(r));
        });
      });
    }

    exportExcel(result);
  };

  const processSeparateFiles = () => {
    const result: any[][] = [];
    result.push(["Lớp học", "Buổi", "Tiết thứ", ...headerDays]);

    const morningClasses = morningSheetData.length ? extractClassNames(morningSheetData) : [];
    const afternoonClasses = afternoonSheetData.length ? extractClassNames(afternoonSheetData) : [];
    const allClasses = [...new Set([...morningClasses, ...afternoonClasses])].sort();

    allClasses.forEach((className) => {
      if (morningClasses.includes(className)) processClassData(morningSheetData, className, "S", result);
      if (afternoonClasses.includes(className)) processClassData(afternoonSheetData, className, "C", result);
    });

    const sRows = result.filter((r) => r?.[1] === "S").length;
    const cRows = result.filter((r) => r?.[1] === "C").length;
    console.log("Rows S:", sRows, "Rows C:", cRows);

    exportExcel(result);
  };

  const processClassData = (
    data: any[][],
    className: string,
    sessionCode: "S" | "C",
    result: any[][]
  ) => {
    if (!data?.length) return;

    if (isGridFormat(data)) {
      const headerRowIdx = findGridHeaderRow(data);
      const gridColumns = buildGridColumnInfos(data, headerRowIdx).filter(
        (info) => info.className === className
      );
      if (!gridColumns.length) return;

      const sessionMatches = gridColumns.filter(
        (info) => (info.sessionCode || "") === sessionCode
      );
      const targetColumns = sessionMatches.length ? sessionMatches : gridColumns;
      const appliedSession =
        sessionCode || targetColumns[0]?.sessionCode || "";

      const classData: Record<number, Record<number, string>> = {};
      let currentDayIdx = -1;

      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r] || [];
        const dayLabel = String(row[0] ?? "").trim();
        if (dayLabel) {
          const idx = detectDayIndex(dayLabel, headerDays);
          if (idx >= 0) currentDayIdx = idx;
        }
        const periodNum = Number(row[1] ?? "");
        if (!(periodNum > 0)) continue;

        targetColumns.forEach(({ colIndex }) => {
          const raw = String(row[colIndex] ?? "").trim();
          if (!classData[periodNum]) classData[periodNum] = {};
          classData[periodNum][currentDayIdx] = normalizeSubject(raw);
        });
      }

      const periods = Object.keys(classData).map(Number).sort((a, b) => a - b);
      const maxP = periods.length ? Math.max(...periods) : 0;
      for (let p = 1; p <= maxP; p++) {
        const days = headerDays.map((_, di) => classData[p]?.[di] ?? "");
        result.push([className, appliedSession, p, ...days]);
      }
      return;
    }

    if (isDayColumnFormat(data)) {
      let classCol = -1;
      let classHeaderRow = -1;

      for (let r = 0; r < Math.min(5, data.length); r++) {
        const row = data[r] || [];
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] ?? "").trim() === className) {
            classCol = c;
            classHeaderRow = r;
            break;
          }
        }
        if (classCol !== -1) break;
      }
      if (classCol === -1) return;

      const classData: Record<number, string> = {};
      for (let r = classHeaderRow + 1; r < data.length; r++) {
        const row = data[r] || [];
        const first = String(row[0] ?? "").trim();
        if (!isMetaRow(first)) continue;
        const dayIdx = detectDayIndex(first, headerDays);
        if (dayIdx < 0) continue;
        const raw = String(row[classCol] ?? "").trim();
        if (raw && !isMetaRow(raw) && !raw.toLowerCase().includes("ngày")) {
          classData[dayIdx] = normalizeSubject(raw);
        }
      }

      for (let di = 0; di < headerDays.length; di++) {
        const subj = classData[di] || "";
        if (subj)
          result.push([
            className,
            sessionCode,
            1,
            ...headerDays.map((_, idx) => (idx === di ? subj : "")),
          ]);
      }
      return;
    }

    if (isClassHeaderFormat(data)) {
      let classCol = -1;
      let classHeaderRow = -1;

      for (let r = 0; r < Math.min(5, data.length); r++) {
        const row = data[r] || [];
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] ?? "").trim() === className) {
            classCol = c;
            classHeaderRow = r;
            break;
          }
        }
        if (classCol !== -1) break;
      }
      if (classCol === -1) return;

      const classData: Record<number, Record<number, string>> = {};
      let currentDayIdx = -1;

      for (let r = classHeaderRow + 1; r < data.length; r++) {
        const row = data[r] || [];
        const first = String(row[0] ?? "").trim();
        if (isMetaRow(first)) {
          const di = detectDayIndex(first, headerDays);
          if (di >= 0) currentDayIdx = di;
          continue;
        }
        const period = Number(row[1] ?? "");
        if (!(period > 0 && period <= 20)) continue;
        const raw = String(row[classCol] ?? "").trim();
        if (raw && !isMetaRow(raw)) {
          if (!classData[period]) classData[period] = {};
          classData[period][currentDayIdx] = normalizeSubject(raw);
        }
      }

      const periods = Object.keys(classData).map(Number).sort((a, b) => a - b);
      const maxP = periods.length ? Math.max(...periods) : 0;
      for (let p = 1; p <= maxP; p++) {
        const days = headerDays.map((_, di) => classData[p]?.[di] ?? "");
        result.push([className, sessionCode, p, ...days]);
      }
      return;
    }

    // Row-wise & fallback
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      if (!row || row.length < 3) continue;
      const lop = String(row[0] ?? "").trim();
      if (isMetaRow(lop)) continue;
      if (lop !== className) continue;
      const tiet = row[2];
      const days = (row.slice(3, 10) as string[]).map((x) =>
        normalizeSubject(String(x ?? ""))
      );
      result.push([className, sessionCode, tiet, ...days]);
    }
  };

  const exportExcel = (rows: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);

    const ref = ws["!ref"] || "A1";
    const range = XLSX.utils.decode_range(ref);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" } as any;
        (ws[addr] as any).s = {
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { name: "Arial" },
        } as any;
      }
    }

    // Style header
    const headerLen = range.e.c - range.s.c + 1;
    for (let c = 0; c < headerLen; c++) {
      const cell = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[cell]) {
        (ws[cell] as any).s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4F81BD" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          },
        } as any;
      }
    }

    // Column widths & row heights
    ws["!cols"] = Array.from({ length: headerLen }).map((_, idx) => ({
      wch: idx <= 2 ? 12 : 22,
    }));
    const rowCount = range.e.r - range.s.r + 1;
    ws["!rows"] = Array.from({ length: rowCount }).map(() => ({ hpt: 24 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TKB_VNEDU");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "TKB_vnedu.xlsx");
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Công cụ chuẩn hóa TKB VNEDU</h1>
        <p className="text-gray-500">Upload → Chuẩn hóa → Xuất dữ liệu</p>
      </header>

      <section className="p-4 border rounded space-y-3">
        <h2 className="font-semibold">1. Chọn chế độ xử lý</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="processingMode"
              value="single"
              checked={processingMode === "single"}
              onChange={(e) => setProcessingMode(e.target.value as Mode)}
            />
            <span>Chuẩn hóa cả ngày (1 file có cả buổi sáng và chiều)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="processingMode"
              value="separate"
              checked={processingMode === "separate"}
              onChange={(e) => setProcessingMode(e.target.value as Mode)}
            />
            <span>Chuẩn hóa từng buổi (2 file riêng biệt)</span>
          </label>
        </div>
      </section>

      {processingMode === "single" ? (
        <section className="p-4 border rounded space-y-3">
          <h2 className="font-semibold">2. Chọn file Excel (cả ngày)</h2>
          <input type="file" accept=".xls,.xlsx" onChange={handleUpload} />
          {fileName && <p className="text-green-600">✅ {fileName} đã tải lên</p>}

          {sheetNames.length > 0 && (
            <div className="mt-3">
              <label className="mr-2">Chọn sheet:</label>
              <select
                value={selectedSheet}
                onChange={(e) => {
                  setSelectedSheet(e.target.value);
                  if (file) loadSheetFromFile(file, e.target.value, setSheetData, true);
                }}
                className="border px-2 py-1"
              >
                {sheetNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* {previewSingle.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="font-medium mb-1">Xem nhanh 8 dòng đầu:</div>
              <pre className="bg-gray-50 p-2 border rounded max-h-60 overflow-auto text-xs">
                {JSON.stringify(previewSingle, null, 2)}
              </pre>
            </div>
          )} */}
        </section>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <section className="p-4 border rounded space-y-3">
            <h2 className="font-semibold">2. Chọn file TKB buổi sáng</h2>
            <input type="file" accept=".xls,.xlsx" onChange={handleMorningUpload} />
            {morningFileName && <p className="text-green-600">✅ {morningFileName} đã tải lên</p>}
            {morningSheetNames.length > 0 && (
              <div className="mt-3">
                <label className="mr-2">Chọn sheet:</label>
                <select
                  value={selectedMorningSheet}
                  onChange={(e) => {
                    setSelectedMorningSheet(e.target.value);
                    if (morningFile) loadSheetFromFile(morningFile, e.target.value, setMorningSheetData, true);
                  }}
                  className="border px-2 py-1"
                >
                  {morningSheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* {previewMorning.length > 0 && (
              <div className="mt-3 text-sm">
                <div className="font-medium mb-1">Xem nhanh 8 dòng đầu (Sáng):</div>
                <pre className="bg-gray-50 p-2 border rounded max-h-60 overflow-auto text-xs">
                  {JSON.stringify(previewMorning, null, 2)}
                </pre>
              </div>
            )} */}
          </section>

          <section className="p-4 border rounded space-y-3">
            <h2 className="font-semibold">3. Chọn file TKB buổi chiều</h2>
            <input type="file" accept=".xls,.xlsx" onChange={handleAfternoonUpload} />
            {afternoonFileName && <p className="text-green-600">✅ {afternoonFileName} đã tải lên</p>}
            {afternoonSheetNames.length > 0 && (
              <div className="mt-3">
                <label className="mr-2">Chọn sheet:</label>
                <select
                  value={selectedAfternoonSheet}
                  onChange={(e) => {
                    setSelectedAfternoonSheet(e.target.value);
                    if (afternoonFile) loadSheetFromFile(afternoonFile, e.target.value, setAfternoonSheetData, true);
                  }}
                  className="border px-2 py-1"
                >
                  {afternoonSheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* {previewAfternoon.length > 0 && (
              <div className="mt-3 text-sm">
                <div className="font-medium mb-1">Xem nhanh 8 dòng đầu (Chiều):</div>
                <pre className="bg-gray-50 p-2 border rounded max-h-60 overflow-auto text-xs">
                  {JSON.stringify(previewAfternoon, null, 2)}
                </pre>
              </div>
            )} */}
          </section>
        </div>
      )}

      <section className="p-4 border rounded space-y-3">
        <h2 className="font-semibold">{processingMode === "single" ? "3" : "4"}. Danh mục môn học</h2>
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              {subjects.length > 0 && <tr>
                <th className="border px-2 py-1 text-left">Tên môn học Raw</th>
                <th className="border px-2 py-1 text-left">Tên môn học Edu</th>
                <th className="border px-2 py-1">Xóa</th>
              </tr>}
            </thead>
            <tbody>
              {subjects.map((s, i) => (
                <tr key={`${i}-${s.raw}`}>
                  {/* Tên môn học Raw: gõ trực tiếp */}
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      value={s.raw}
                      onChange={(e) => {
                        const next = [...subjects];
                        next[i] = { ...next[i], raw: e.target.value };
                        setSubjects(next);
                      }}
                      className="w-full border rounded px-2 py-1"
                      placeholder="Tên môn học Raw"
                    />
                  </td>

                  {/* Tên môn học Edu: gõ tự do + có gợi ý */}
                  <td className="border px-2 py-1 relative overflow-visible">
                    <EduAutocomplete
                      value={s.edu}
                      onChange={(v) => {
                        const next = [...subjects];
                        next[i] = { ...next[i], edu: v };
                        setSubjects(next);
                      }}
                      options={EDU_SUBJECTS}
                    />
                  </td>

                  {/* Xóa dòng */}
                  <td className="border px-2 py-1 text-center">
                    <button
                      className="text-red-600 hover:underline"
                      onClick={() => setSubjects((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Datalist gợi ý cho cột EDU (đặt ngay sau bảng hoặc ngay trước </section> đều được) */}
            <datalist id="edu-suggestions">
              {EDU_SUBJECTS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>

          </table>
        </div>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={newRaw}
            onChange={(e) => setNewRaw(e.target.value)}
            placeholder="Tên môn học Raw"
            className="border px-2 py-1 flex-1 rounded"
          />
          <input
            type="text"
            value={newEdu}
            onChange={(e) => setNewEdu(e.target.value)}
            placeholder="Tên môn học Edu"
            className="border px-2 py-1 flex-1 rounded"
          />
          <button
            onClick={() => {
              if (!newRaw.trim() || !newEdu.trim()) return;
              setSubjects((prev) => [...prev, { raw: newRaw.trim(), edu: newEdu.trim() }]);
              setNewRaw("");
              setNewEdu("");
            }}
            className="bg-blue-600 text-white px-4 rounded"
          >
            + Thêm
          </button>
        </div>
      </section>

      <section className="p-4 border rounded space-y-3">
        <h2 className="font-semibold">{processingMode === "single" ? "4" : "5"}. Xử lý thời khóa biểu</h2>
        <button onClick={handleProcess} className="bg-purple-600 text-white px-4 py-2 rounded">
          Chuẩn hóa TKB
        </button>
      </section>

      <section className="p-4 border rounded space-y-3">
        <h2 className="font-semibold">{processingMode === "single" ? "5" : "6"}. Xuất dữ liệu</h2>
        <p>
          Sau khi bấm <b>Chuẩn hóa TKB</b>, file <b>TKB_vnedu.xlsx</b> sẽ tự động tải về.
        </p>
      </section>
    </div>
  );
}
