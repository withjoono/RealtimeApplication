# -*- coding: utf-8 -*-
"""Catholic University Competition Rate Crawl Test"""
import asyncio
import sys
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from app.crawler.ratio_crawler import RatioCrawler


async def main():
    crawler = RatioCrawler()

    # 수시 경쟁률 페이지 (예시)
    url = "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10030311.html"

    print(f"[Crawling] {url}\n")

    result = await crawler.crawl(url, admission_type="수시", year=2025)

    if result:
        print(f"[OK] University: {result.university_name}")
        print(f"[OK] Code: {result.university_code}")
        print(f"[OK] Type: {result.admission_type} {result.year}")
        print(f"[OK] Admissions: {len(result.admissions)}\n")

        for adm in result.admissions:
            print(f"\n{'='*60}")
            print(f"[Admission] {adm.admission_name}")
            print(f"[Departments] {len(adm.departments)}")
            print("-" * 60)

            # 상위 5개 학과만 출력
            for dept in adm.departments[:5]:
                rate_str = f"{dept.competition_rate:.2f}:1" if dept.competition_rate else "-"
                campus = dept.campus or ""
                print(f"  - {campus} {dept.name}: "
                      f"Recruit {dept.recruit_count}, "
                      f"Apply {dept.apply_count}, "
                      f"Rate {rate_str}")

            if len(adm.departments) > 5:
                print(f"  ... and {len(adm.departments) - 5} more")
    else:
        print("[FAIL] Crawling failed")


if __name__ == "__main__":
    asyncio.run(main())
