export const EDU_SUBJECTS: string[] = [
  "TOÁN",
  "TOÁN HỌC",
  "VẬT LÍ",
  "SINH HỌC",
  "NGỮ VĂN",
  "ĐỊA LÍ",
  "TIẾNG ANH",
  "GDCD",
  "THỂ DỤC",
  "HÓA HỌC",
  "GDQP",
  "HỌC NGHỀ",
  "NGHỀ PT",
  "LỊCH SỬ VÀ ĐỊA LÍ",
  "KHOA HỌC TỰ NHIÊN",
  "TIN HỌC",
  "GIÁO DỤC THỂ CHẤT",
  "KTCN",
  "NGHỆ THUẬT",
  "HOẠT ĐỘNG TRẢI NGHIỆM, HƯỚNG NGHIỆP",
  "NỘI DUNG GIÁO DỤC CỦA ĐỊA PHƯƠNG",
  "TIẾNG VIỆT",
  "TN-XH",
  "ĐẠO ĐỨC",
  "THỦ CÔNG",
  "KHOA HỌC",
  "KĨ THUẬT",
  "KĨ NĂNG SỐNG",
  "HOẠT ĐỘNG TRẢI NGHIỆM",
  "TIN HỌC VÀ CÔNG NGHỆ (CÔNG NGHỆ)",
  "TIN HỌC VÀ CÔNG NGHỆ (TIN HỌC)",
  "NGOẠI NGỮ 1",
  "TC nhận xét 1",
  "TC nhận xét 2",
  "TC nhận xét 3",
  "TIẾT ĐỌC THƯ VIỆN",
  "TC NHẬN XÉT 2",
  "HĐ TẬP THỂ",
  "CÔNG NGHỆ",
  "ÂM NHẠC",
  "MĨ THUẬT",
  "TỰ CHỌN 2",
  "TỰ CHỌN 3",
  "TỰ CHỌN 2",
  "ÂM NHẠC",
  "MĨ THUẬT",
  "TC NHẬN XÉT 3",
  "TỰ CHỌN 1",
  "TỰ CHỌN 5",
];

export function normalizeVietnamese(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function autoMapToEdu(raw: string): string {
  const nraw = normalizeVietnamese(String(raw || ""));
  if (!nraw) return "";
  // exact (normalized) match
  const exact = EDU_SUBJECTS.find((e) => normalizeVietnamese(e) === nraw);
  if (exact) return exact;
  // partial contains
  const partial = EDU_SUBJECTS.find((e) => nraw.includes(normalizeVietnamese(e)) || normalizeVietnamese(e).includes(nraw));
  return partial || "";
}

