export type CardRecord = {
  _idx?: number;
  year: number;
  month: number;
  date: string;
  description: string;
  amount: number;
  card: string;
  user: string;
  memo?: string;
};

type ParseResult =
  | { records: CardRecord[]; error?: undefined }
  | { records?: undefined; error: string };

type CardType = "amex-gold" | "saison-amex" | "life" | "smbc" | null;

export function parseCardCsv(filename: string, text: string): ParseResult {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim());

  switch (detect(filename, lines)) {
    case "amex-gold":   return parseAmexGold(lines);
    case "saison-amex": return parseSaisonAmex(lines);
    case "life":        return parseLifeCard(lines);
    case "smbc":        return parseSmbc(lines);
    default:
      return {
        error: `未対応のCSV形式です（${filename}）。対応: AMEX Gold / セゾンAMEX / LIFEカード / 三井住友`,
      };
  }
}

function detect(filename: string, lines: string[]): CardType {
  // Content-based detection (works after Shift_JIS decoding)
  if (lines[0]?.includes("データ日")) return "amex-gold";
  if (lines.some((l) => l.includes("利用店名及び摘要") || l.includes("カード会員名:") || l.includes("ご利用店名及び商品名") || l.includes("ご利用者名:")))
    return "saison-amex";
  if (lines.some((l) => l.includes("明細No."))) return "life";
  if (lines[0]?.match(/\d{4}-\d{2}\*+/)) return "smbc";

  // AMEX Gold データ行パターン: 利用日,データ日,店名,カード会員名,-カード番号,金額,,
  if (lines.some((l) => /^\d{4}\/\d{2}\/\d{2},\d{4}\/\d{2}\/\d{2},[^,]+,[^,]+,-\d{4,},/.test(l))) return "amex-gold";

  // Filename fallback
  const f = filename.normalize("NFC").toLowerCase();
  if (f.includes("amex") && (f.includes("gold") || f.includes("ゴールド"))) return "amex-gold";
  if (f.includes("セゾン") || f.includes("saison")) return "saison-amex";
  if (f.includes("life") || f.includes("ライフ")) return "life";
  if (f.includes("三井住友") || f.includes("smbc")) return "smbc";

  return null;
}

// ---- AMEX Gold ----
// 利用日(0), データ日(1), 利用店名(2), カード会員名(3), 番号#(4), 金額(5), CO通貨(6), レート(7)
function parseAmexGold(lines: string[]): ParseResult {
  const records: CardRecord[] = [];
  let headerPassed = false;

  for (const line of lines) {
    if (!line) continue;
    if (line.includes("データ日")) { headerPassed = true; continue; }
    if (!headerPassed) { headerPassed = true; } // skip first line if no header found

    const cols = splitCsv(line);
    if (cols.length < 6) continue;

    const date = cols[0].trim();
    if (!isDate(date)) continue;

    const description = cols[2].trim();
    const user = cols[3].trim() || "不明";
    const amount = parseAmount(cols[5]);
    if (isNaN(amount) || amount === 0) continue;

    const [y, m] = date.split("/");
    const foreign = cols[6]?.trim();
    const rate = cols[7]?.trim();
    const memo = foreign ? (rate ? `${foreign} (レート: ${rate})` : foreign) : undefined;

    records.push({ year: +y, month: +m, date, description, amount, card: "AMEX Gold", user, memo });
  }

  return { records };
}

// ---- セゾンAMEX ----
// ヘッダー行から列位置を動的検出。
// ご利用者名: 行でユーザー名を追跡（ヘッダーの後に来る。家族カードは別セクション）
// 実際のフォーマット: 利用日, ご利用店名及び商品名, 本人・家族区分, 支払区分名称, 締前入金区分, 利用金額, 備考
function parseSaisonAmex(lines: string[]): ParseResult {
  const records: CardRecord[] = [];
  let currentUser = "本人";
  let active = false;
  let dateCol = 0;
  let descCol = 1;
  let amountCol = 5;
  let memoCol = 6;

  for (const line of lines) {
    if (!line) continue;

    // ユーザー名行（ヘッダーの前後どちらにも出現しうる）
    if (line.includes("カード会員名:") || line.includes("ご利用者名:")) {
      const m = line.match(/(?:カード会員名|ご利用者名):([^,\n]+)/);
      if (m) {
        const name = m[1].trim().replace(/\s+\d+\s*$/, "").trim();
        if (name) currentUser = name;
      }
      continue;
    }

    // ヘッダー行 → 列位置を確定してデータ読み取り開始
    if (line.includes("利用店名及び摘要") || line.includes("ご利用店名及び商品名")) {
      active = true;
      const cols = splitCsv(line);
      for (let i = 0; i < cols.length; i++) {
        const h = cols[i].trim();
        if (h === "利用日") dateCol = i;
        else if (h === "利用店名及び摘要" || h === "ご利用店名及び商品名") descCol = i;
        else if (h.endsWith("利用金額")) amountCol = i;
        else if (h === "摘要" || h === "備考") memoCol = i;
      }
      continue;
    }

    if (line.includes("支払方法名称") || line.includes("支払区分名称")) continue;
    if (line.includes("小計") || line.includes("合計")) continue;

    if (!active) continue;

    const cols = splitCsv(line);
    if (cols.length <= Math.max(dateCol, descCol, amountCol)) continue;

    const date = cols[dateCol].trim();
    if (!isDate(date)) continue;

    const description = cols[descCol].trim();
    const amount = parseAmount(cols[amountCol]);
    if (isNaN(amount) || amount === 0) continue;

    const [y, m] = date.split("/");
    const memo = cols[memoCol]?.trim() || undefined;

    records.push({ year: +y, month: +m, date, description, amount, card: "セゾンAMEX", user: currentUser, memo });
  }

  return { records };
}

// ---- LIFEカード ----
// 明細No.(0), 分類(1), 回数(2), 利用日(3), 利用店(4), 利用金額(5), ATM手数料(6), 手数料(7)...
function parseLifeCard(lines: string[]): ParseResult {
  const records: CardRecord[] = [];

  // 会員名をヘッダー部から取得（カタカナ・漢字のみの列値）
  let user = "";
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cols = splitCsv(lines[i]);
    if (cols.length >= 2) {
      const val = cols[1].trim();
      if (val && /^[゠-ヿ一-龯\s]+$/.test(val)) {
        user = val;
        break;
      }
    }
  }
  if (!user) user = "本人";

  // 明細No. ヘッダー行を探す
  let dataStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("明細No.") && lines[i].includes("利用日")) {
      dataStart = i + 1;
      break;
    }
  }
  if (dataStart < 0) return { error: "LIFEカードの明細ヘッダーが見つかりません" };

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cols = splitCsv(line);
    if (cols.length < 6) continue;

    const date = cols[3].trim();
    if (!isDate(date)) continue;

    const description = cols[4].trim();
    const amount = parseAmount(cols[5]);
    if (isNaN(amount) || amount === 0) continue;

    const [y, m] = date.split("/");
    records.push({ year: +y, month: +m, date, description, amount, card: "LIFEカード", user });
  }

  return { records };
}

// ---- 三井住友 ----
// 1行目: 名義, カード番号, カナ
// データ行: 利用日(0), 店名(1), 金額(2), ?(3), ?(4), 累計(5), 備考(6)
function parseSmbc(lines: string[]): ParseResult {
  const records: CardRecord[] = [];

  const firstCols = splitCsv(lines[0] || "");
  let user = firstCols[0]?.trim() || "本人";
  // カード番号行の可能性があれば除外
  if (!user || /^\d/.test(user) || user.includes("*")) user = "本人";

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cols = splitCsv(line);
    if (cols.length < 3) continue;

    const date = cols[0].trim();
    if (!isDate(date)) continue;

    const description = cols[1].trim();
    const amount = parseAmount(cols[2]);
    if (isNaN(amount) || amount === 0) continue;

    const [y, m] = date.split("/");
    const memo = cols[6]?.trim() || undefined;

    records.push({ year: +y, month: +m, date, description, amount, card: "三井住友", user, memo });
  }

  return { records };
}

// ---- utilities ----

function isDate(s: string): boolean {
  return /^\d{4}\/\d{2}\/\d{2}$/.test(s);
}

function parseAmount(raw: string): number {
  return Number(raw.replace(/"/g, "").replace(/,/g, "").trim());
}

function splitCsv(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      cols.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cols.push(cur);
  return cols;
}
