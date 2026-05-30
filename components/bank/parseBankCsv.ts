export type BankRecord = {
  date: string;
  year: number;
  month: number;
  description: string;
  amount: number;
  type: "withdrawal" | "deposit";
  balance: number;
  bank: string;
};

export type ParseBankResult = {
  records: BankRecord[];
  bankName: string;
  error?: string;
};

export function bankRecordKey(r: BankRecord): string {
  return `${r.date}__${r.description}__${r.amount}__${r.type}__${r.bank}`;
}

// 三井住友銀行のみ UTF-8、他は Shift-JIS
export function needsUtf8(filename: string): boolean {
  return filename.normalize("NFC").includes("三井住友");
}

function csv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur.trim());
  return out;
}

function toAmt(s: string): number {
  const c = s.replace(/[¥¥\\ ,　]/g, "");
  if (!c || c === "-" || c === "ー" || c === "－") return 0;
  const n = parseInt(c.replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toDateStr(y: number, m: number, d: number) { return `${y}-${pad2(m)}-${pad2(d)}`; }

function parseSlash(s: string) {
  const m = s.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return { year: +m[1], month: +m[2], date: toDateStr(+m[1], +m[2], +m[3]) };
}

function parseJP(s: string) {
  const m = s.trim().match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return { year: +m[1], month: +m[2], date: toDateStr(+m[1], +m[2], +m[3]) };
}

function isNumericCol(s: string): boolean {
  const c = s.replace(/[\s,¥\\]/g, "");
  return c.length > 0 && /^\d+$/.test(c);
}

// 城南信用金庫: type(0)=2, date(1)=YYYY年MM月DD日, desc(2), 出金(3), 入金(4), 残高(5)
function parseJonan(lines: string[], bank: string): BankRecord[] {
  const out: BankRecord[] = [];
  for (const line of lines) {
    const c = csv(line);
    if (c[0] !== "2") continue;
    const d = parseJP(c[1] ?? "");
    if (!d) continue;
    const w = toAmt(c[3] ?? ""), dep = toAmt(c[4] ?? ""), bal = toAmt(c[5] ?? "");
    const desc = (c[2] ?? "").replace(/\s+/g, " ").trim();
    if (w > 0) out.push({ ...d, description: desc, amount: w, type: "withdrawal", balance: bal, bank });
    else if (dep > 0) out.push({ ...d, description: desc, amount: dep, type: "deposit", balance: bal, bank });
  }
  return out;
}

// 昭和信用金庫: ヘッダー行スキップ後、日付(0), 摘要(1), お支払(2), お預り(3), 残高(4)
function parseShowa(lines: string[], bank: string): BankRecord[] {
  const out: BankRecord[] = [];
  let active = false;
  for (const line of lines) {
    if (!active) {
      if (line.includes("日付") && (line.includes("摘要") || line.includes("Ev"))) active = true;
      continue;
    }
    const c = csv(line);
    if (c.length < 4) continue;
    const d = parseSlash(c[0] ?? "");
    if (!d) continue;
    const bal = toAmt(c[c.length - 1] ?? "");
    const base = (c[1] ?? "").replace(/\s+/g, " ").trim();
    const col2num = isNumericCol(c[2] ?? "");
    const col3num = isNumericCol(c[3] ?? "");
    if (col2num && !col3num) {
      // 出金: col[2]=金額, col[3]=摘要詳細テキスト
      const detail = (c[3] ?? "").replace(/\s+/g, " ").trim();
      const desc = detail ? `${base} ${detail}`.trim() : base;
      out.push({ ...d, description: desc, amount: toAmt(c[2]), type: "withdrawal", balance: bal, bank });
    } else if (!col2num && col3num) {
      // 入金: col[2]=摘要詳細テキスト, col[3]=金額
      const detail = (c[2] ?? "").replace(/\s+/g, " ").trim();
      const desc = detail ? `${base} ${detail}`.trim() : base;
      out.push({ ...d, description: desc, amount: toAmt(c[3]), type: "deposit", balance: bal, bank });
    }
  }
  return out;
}

// 住信SBIネット銀行: ヘッダー行スキップ後、日付(0), 内容(1), 出金(2), 入金(3), 残高(4)
function parseSBI(lines: string[], bank: string): BankRecord[] {
  const out: BankRecord[] = [];
  let active = false;
  for (const line of lines) {
    if (!active) {
      if (line.includes("日付") || line.includes("ut")) active = true;
      continue;
    }
    const c = csv(line);
    if (c.length < 4) continue;
    const d = parseSlash(c[0] ?? "");
    if (!d) continue;
    const w = toAmt(c[2] ?? ""), dep = toAmt(c[3] ?? ""), bal = toAmt(c[4] ?? "");
    const desc = (c[1] ?? "").replace(/\s+/g, " ").trim();
    if (w > 0) out.push({ ...d, description: desc, amount: w, type: "withdrawal", balance: bal, bank });
    else if (dep > 0) out.push({ ...d, description: desc, amount: dep, type: "deposit", balance: bal, bank });
  }
  return out;
}

// 三井住友銀行 新形式 (Shift-JIS):
// データ区分2: 取引行
// 日付: YYMMDD（令和年号、08=令和8年=2026年）
// 入払区分: 1=入金(deposit), 2=払出(withdrawal)
// 金額: col[6] 12桁ゼロ埋め
// 摘要: col[14](仕向人名) or col[17](摘要内容)
function parseSMBC(lines: string[], bank: string): BankRecord[] {
  const out: BankRecord[] = [];
  for (const line of lines) {
    const c = csv(line);
    if (c[0] !== "2") continue;
    const dateStr = (c[2] ?? "").trim();
    if (!/^\d{6}$/.test(dateStr)) continue;
    const ry = parseInt(dateStr.substring(0, 2)); // 令和年
    const mm = parseInt(dateStr.substring(2, 4));
    const dd = parseInt(dateStr.substring(4, 6));
    if (!ry || !mm || !dd || mm > 12 || dd > 31) continue;
    const year = 2018 + ry; // 令和→西暦（令和1年=2019年）
    const date = toDateStr(year, mm, dd);
    const nyuhai = (c[4] ?? "").trim(); // 1=入金, 2=払出
    const amount = parseInt((c[6] ?? "").trim(), 10) || 0;
    if (amount === 0) continue;
    // 摘要: 仕向人名(col14) があればそちらを優先、なければ摘要内容(col17)
    const desc = ((c[14] ?? "").trim() || (c[17] ?? "").trim()).replace(/\s+/g, " ");
    if (nyuhai === "1") {
      out.push({ date, year, month: mm, description: desc, amount, type: "deposit", balance: 0, bank });
    } else if (nyuhai === "2") {
      out.push({ date, year, month: mm, description: desc, amount, type: "withdrawal", balance: 0, bank });
    }
  }
  return out;
}

function detectBankType(filename: string, lines: string[]): "jonan" | "showa" | "sbi" | "smbc" | null {
  const fn = filename.normalize("NFC");

  // ファイル名優先
  if (fn.includes("城南")) return "jonan";
  if (fn.includes("昭和")) return "showa";
  if (fn.includes("住信") || fn.toLowerCase().includes("sbi")) return "sbi";
  if (fn.includes("三井住友") || fn.toLowerCase().includes("smbc")) return "smbc";

  // 内容ベースの判定（Shift-JIS デコード後）
  const sample = lines.slice(0, 30);

  // 三井住友 新形式: type2行=「2,8桁連番,6桁令和日付,6桁,1or2,2桁,12桁金額」
  // または type1行=「1,2桁コード,1桁,6桁令和日付」
  if (sample.some(l => /^2,\d{8},\d{6},\d{6},[12],\d{2},\d{12}/.test(l))) return "smbc";
  if (sample.some(l => /^1,\d{2},\d,\d{6},\d{6}/.test(l))) return "smbc";

  // 城南: "1,YYYYMMDD" または "2,\"YYYY" で始まる行
  if (sample.some(l => /^1,\d{8}/.test(l) || /^2,"?\d{4}/.test(l))) return "jonan";

  // 住信SBI: 日付フィールドがクォートされている "YYYY/MM/DD"
  if (sample.some(l => /^"(\d{4}\/\d{2}\/\d{2})"/.test(l))) return "sbi";

  // 昭和: 日付がクォートなしで行頭 YYYY/MM/DD, または 店番コードヘッダー
  if (sample.some(l => /^\d{4}\/\d{2}\/\d{2}[\s,]/.test(l) || l.includes("店番コード"))) return "showa";

  return null;
}

export function parseBankCsv(filename: string, content: string): ParseBankResult {
  const lines = content.split(/\r?\n/);
  const bankType = detectBankType(filename, lines);

  if (!bankType) {
    return { records: [], bankName: "不明", error: "銀行の種類を特定できませんでした（城南信用金庫・昭和信用金庫・住信SBIネット銀行・三井住友銀行）" };
  }

  const nameMap = { jonan: "城南信用金庫", showa: "昭和信用金庫", sbi: "住信SBIネット銀行", smbc: "三井住友銀行" };
  const bankName = nameMap[bankType];

  let records: BankRecord[] = [];
  if (bankType === "jonan") records = parseJonan(lines, bankName);
  else if (bankType === "showa") records = parseShowa(lines, bankName);
  else if (bankType === "sbi") records = parseSBI(lines, bankName);
  else records = parseSMBC(lines, bankName);

  if (records.length === 0) return { records: [], bankName, error: `明細が取得できませんでした（${bankName}）` };
  return { records, bankName };
}
