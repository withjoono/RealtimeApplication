# -*- coding: utf-8 -*-
"""Debug HTML structure"""
import asyncio
import httpx
from bs4 import BeautifulSoup
import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')


async def main():
    url = "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10030311.html"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        response = await client.get(url)
        html = response.content.decode("utf-8", errors="ignore")

    soup = BeautifulSoup(html, "lxml")

    tables = soup.find_all("table")
    print(f"Found {len(tables)} tables\n")

    for i, table in enumerate(tables[:5]):  # First 5 tables
        print(f"\n{'='*60}")
        print(f"[Table {i}]")

        # Check table ID or class
        table_id = table.get("id", "")
        table_class = table.get("class", [])
        print(f"ID: {table_id}, Class: {table_class}")

        rows = table.find_all("tr")
        print(f"Rows: {len(rows)}")

        for j, row in enumerate(rows[:6]):  # First 6 rows
            cells = row.find_all(["th", "td"])
            cell_info = []
            for c in cells:
                text = c.get_text(strip=True)[:25]
                colspan = c.get("colspan", "1")
                rowspan = c.get("rowspan", "1")
                if colspan != "1" or rowspan != "1":
                    cell_info.append(f"{text}[c{colspan}r{rowspan}]")
                else:
                    cell_info.append(text)
            print(f"  Row {j}: {cell_info}")


if __name__ == "__main__":
    asyncio.run(main())
