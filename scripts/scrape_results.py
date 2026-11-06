import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

SOURCE_URL = "https://www.smbc.co.jp/kojin/takarakuji/result.html"
OUT = Path("data/results.json")
JST = timezone(timedelta(hours=9))


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\u3000", " ")).strip()


def parse_date(text: str):
    patterns = [
        r"抽せん日\s*[：:]?\s*(20\d{2})[年/]\s*(\d{1,2})[月/]\s*(\d{1,2})日?",
        r"(20\d{2})[年/]\s*(\d{1,2})[月/]\s*(\d{1,2})日?",
    ]
    for pattern in patterns:
        matches = list(re.finditer(pattern, text))
        if matches:
            y, m, d = map(int, matches[-1].groups())
            return f"{y:04d}-{m:02d}-{d:02d}"
    return None


def parse_yen(value: str) -> int:
    return int(value.replace(",", ""))


def extract_rank_prizes(block: str, max_rank: int):
    prizes = {}
    for rank in range(1, max_rank + 1):
        match = re.search(
            rf"{rank}\s*等\s+(?:該当なし|[\d,]+口)\s+(?:該当なし|([\d,]+)円)",
            block,
        )
        prizes[str(rank)] = parse_yen(match.group(1)) if match and match.group(1) else 0
    return prizes


def extract_numbers_prizes(block: str, include_mini: bool):
    labels = {
        "setStraight": r"セット[（(]ストレート[）)]",
        "setBox": r"セット[（(]ボックス[）)]",
        "straight": r"(?<!セット[（(])ストレート",
        "box": r"(?<!セット[（(])ボックス",
    }
    if include_mini:
        labels["mini"] = r"ミニ"

    prizes = {}
    for key, label in labels.items():
        match = re.search(
            rf"{label}\s+(?:該当なし|[\d,]+口)\s+(?:該当なし|([\d,]+)円)",
            block,
        )
        prizes[key] = parse_yen(match.group(1)) if match and match.group(1) else 0
    return prizes


def classify(main):
    count = len(main)
    if count == 7:
        return "loto7"
    if count == 6:
        return "loto6"
    if count == 5:
        return "mini"
    if count == 4:
        return "n4"
    if count == 3:
        return "n3"
    return None


def parse_results(raw_text: str):
    text = normalize(raw_text)
    starts = list(re.finditer(r"第\s*(\d+)\s*回", text))
    found = {"loto7": [], "loto6": [], "mini": [], "n4": [], "n3": []}

    for index, start in enumerate(starts):
        draw = int(start.group(1))
        block_end = starts[index + 1].start() if index + 1 < len(starts) else min(len(text), start.start() + 2500)
        block = text[start.start():block_end]
        context = text[max(0, start.start() - 140):block_end]

        date = parse_date(text[max(0, start.start() - 180):start.start() + 120])
        if not date:
            date = parse_date(context)
        if not date:
            continue

        number_match = re.search(
            r"当せん番号\s+((?:\d{1,2}\s+){2,8}\d{1,2})\s+(?:ボーナス番号|当せん金額)",
            block,
        )
        if not number_match:
            continue

        main = [int(value) for value in re.findall(r"\d{1,2}", number_match.group(1))]
        kind = classify(main)
        if not kind:
            continue

        bonus = []
        bonus_match = re.search(
            r"ボーナス番号\s+((?:\d{1,2}\s*){1,2})\s+当せん金額",
            block,
        )
        if bonus_match:
            bonus = [int(value) for value in re.findall(r"\d{1,2}", bonus_match.group(1))]

        if kind == "loto7":
            prizes = extract_rank_prizes(block, 6)
        elif kind == "loto6":
            prizes = extract_rank_prizes(block, 5)
        elif kind == "mini":
            prizes = extract_rank_prizes(block, 4)
        else:
            prizes = extract_numbers_prizes(block, include_mini=(kind == "n3"))

        found[kind].append(
            {
                "draw": draw,
                "date": date,
                "main": main,
                "bonus": bonus,
                "prizes": prizes,
                "source": "SMBC",
            }
        )

    # 同じ回号がページ内に複数回出る場合は、情報が豊富な後勝ちで統合
    for kind, rows in found.items():
        unique = {}
        for row in rows:
            key = str(row["draw"])
            old = unique.get(key)
            score = sum(1 for v in row["prizes"].values() if v > 0) + len(row["bonus"])
            old_score = -1 if old is None else sum(1 for v in old["prizes"].values() if v > 0) + len(old["bonus"])
            if old is None or score >= old_score:
                unique[key] = row
        found[kind] = sorted(unique.values(), key=lambda row: row["draw"])

    return found


def merge(old_rows, new_rows, keep=180):
    merged = {str(row["draw"]): row for row in old_rows}
    merged.update({str(row["draw"]): row for row in new_rows})
    return sorted(merged.values(), key=lambda row: row["draw"])[-keep:]


def validate(results):
    required = {"loto7", "loto6", "n4", "n3"}
    missing = [kind for kind in required if not results.get(kind)]
    if missing:
        raise RuntimeError("取得件数0: " + ", ".join(sorted(missing)))

    limits = {
        "loto7": (7, 1, 37),
        "loto6": (6, 1, 43),
        "mini": (5, 1, 31),
        "n4": (4, 0, 9),
        "n3": (3, 0, 9),
    }
    for kind, rows in results.items():
        count, low, high = limits[kind]
        for row in rows:
            if len(row["main"]) != count:
                raise RuntimeError(f"{kind} 第{row['draw']}回: 数字個数エラー")
            if not all(low <= value <= high for value in row["main"]):
                raise RuntimeError(f"{kind} 第{row['draw']}回: 数字範囲エラー")
            if kind in {"loto7", "loto6", "mini"} and len(set(row["main"])) != count:
                raise RuntimeError(f"{kind} 第{row['draw']}回: 重複数字エラー")


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(locale="ja-JP")
        page.goto(SOURCE_URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(4000)
        body_text = page.locator("body").inner_text(timeout=30000)
        browser.close()

    fresh = parse_results(body_text)
    validate(fresh)

    if OUT.exists():
        current = json.loads(OUT.read_text(encoding="utf-8"))
    else:
        current = {"loto7": [], "loto6": [], "mini": [], "n4": [], "n3": []}

    for kind in ("loto7", "loto6", "mini", "n4", "n3"):
        current[kind] = merge(current.get(kind, []), fresh.get(kind, []))
        print(kind, len(fresh.get(kind, [])), "latest", fresh.get(kind, [{}])[-1].get("draw"))

    current["updated"] = datetime.now(JST).isoformat()
    current["source"] = SOURCE_URL
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Saved:", OUT)


if __name__ == "__main__":
    main()
