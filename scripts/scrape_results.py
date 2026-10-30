import json
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

OUT = Path("data/results.json")

if OUT.exists():
    OLD = json.loads(OUT.read_text(encoding="utf-8"))
else:
    OLD = {
        "loto7": [],
        "loto6": [],
        "n4": [],
        "n3": []
    }

URLS = {
    "loto7": "https://www.mizuhobank.co.jp/takarakuji/check/loto/loto7/index.html",
    "loto6": "https://www.mizuhobank.co.jp/takarakuji/check/loto/loto6/index.html",
    "n4": "https://www.mizuhobank.co.jp/takarakuji/check/numbers/numbers4/index.html",
    "n3": "https://www.mizuhobank.co.jp/takarakuji/check/numbers/numbers3/index.html"
}


def yen(text):
    match = re.search(r"([\d,]+)円", text)

    if not match:
        return 0

    return int(match.group(1).replace(",", ""))


def date_norm(text):
    match = re.search(
        r"(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日",
        text
    )

    if not match:
        return None

    return (
        f"{int(match.group(1)):04d}-"
        f"{int(match.group(2)):02d}-"
        f"{int(match.group(3)):02d}"
    )


def parse(kind, html):
    soup = BeautifulSoup(html, "html.parser")

    rows = []

    for table in soup.find_all("table"):

        text = " ".join(table.stripped_strings)

        date = date_norm(text)

        draw_match = re.search(
            r"第\s*(\d+)\s*回",
            text
        )

        if not date or not draw_match:
            continue

        draw = int(draw_match.group(1))

        if kind.startswith("loto"):

            if kind == "loto7":
                need = 7
                max_number = 37
            else:
                need = 6
                max_number = 43

            cells = []

            for cell in table.find_all(["td", "th"]):

                value = " ".join(cell.stripped_strings)

                pattern = (
                    r"(?:\d{1,2}\s*){"
                    + str(need)
                    + r"}"
                )

                if re.fullmatch(pattern, value):

                    candidate = [
                        int(x)
                        for x in re.findall(
                            r"\d{1,2}",
                            value
                        )
                    ]

                    valid = [
                        x
                        for x in candidate
                        if 1 <= x <= max_number
                    ]

                    if len(valid) >= need:
                        cells.append(valid)

            if not cells:
                continue

            main = cells[0][:need]

            bonus_match = re.search(
                r"ボーナス(?:数字|番号)?\s*"
                r"\(?\s*(\d{1,2})\s*\)?"
                r"(?:\s*\(?\s*(\d{1,2})\s*\)?)?",
                text
            )

            if bonus_match:

                bonus = [
                    int(x)
                    for x in bonus_match.groups()
                    if x
                ]

            else:
                bonus = []

            prizes = {}

            if kind == "loto7":
                max_rank = 6
            else:
                max_rank = 5

            for rank in range(
                1,
                max_rank + 1
            ):

                match = re.search(
                    rf"{rank}\s*等.*?([\d,]+)円",
                    text
                )

                if match:

                    prizes[str(rank)] = int(
                        match.group(1).replace(",", "")
                    )

                else:

                    prizes[str(rank)] = 0

            rows.append(
                {
                    "draw": draw,
                    "date": date,
                    "main": main,
                    "bonus": bonus,
                    "prizes": prizes
                }
            )

        else:

            if kind == "n4":
                length = 4
            else:
                length = 3

            candidates = []

            for cell in table.find_all(
                ["td", "th"]
            ):

                raw = "".join(
                    cell.stripped_strings
                )

                if re.fullmatch(
                    r"\d{" + str(length) + r"}",
                    raw
                ):

                    candidates.append(
                        [int(c) for c in raw]
                    )

            if not candidates:
                continue

            prizes = {}

            labels = {
                "straight": "ストレート",
                "box": "ボックス",
                "setStraight": "セット（ストレート）",
                "setBox": "セット（ボックス）",
                "mini": "ミニ"
            }

            for key, label in labels.items():

                match = re.search(
                    re.escape(label)
                    + r".*?([\d,]+)円",
                    text
                )

                if match:

                    prizes[key] = int(
                        match.group(1).replace(",", "")
                    )

                else:

                    prizes[key] = 0

            rows.append(
                {
                    "draw": draw,
                    "date": date,
                    "main": candidates[0],
                    "bonus": [],
                    "prizes": prizes
                }
            )

    return rows


def merge(old_rows, new_rows):

    merged = {
        str(row["draw"]): row
        for row in old_rows
    }

    merged.update(
        {
            str(row["draw"]): row
            for row in new_rows
        }
    )

    return sorted(
        merged.values(),
        key=lambda row: row["draw"]
    )[-120:]


with sync_playwright() as playwright:

    browser = playwright.chromium.launch(
        headless=True
    )

    page = browser.new_page(
        locale="ja-JP"
    )

    for kind, url in URLS.items():

        try:

            page.goto(
                url,
                wait_until="networkidle",
                timeout=90000
            )

            page.wait_for_timeout(2500)

            new_rows = parse(
                kind,
                page.content()
            )

            print(
                kind,
                len(new_rows)
            )

            OLD[kind] = merge(
                OLD.get(kind, []),
                new_rows
            )

        except Exception as error:

            print(
                "ERROR",
                kind,
                error
            )

    browser.close()


jst = timezone(
    timedelta(hours=9)
)

OLD["updated"] = datetime.now(
    jst
).isoformat()

OUT.write_text(
    json.dumps(
        OLD,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)

print(
    "Saved:",
    OUT
)
