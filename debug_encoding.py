# -*- coding: utf-8 -*-
"""Debug encoding issue"""
import asyncio
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from app.crawler.ratio_crawler import RatioCrawler


async def main():
    crawler = RatioCrawler()
    url = "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10030311.html"

    result = await crawler.crawl(url, admission_type="수시", year=2025)

    if result:
        print(f"University name: {result.university_name}")
        print(f"University name bytes: {result.university_name.encode('utf-8')}")
        print(f"University name type: {type(result.university_name)}")

        if result.admissions:
            adm = result.admissions[0]
            print(f"\nAdmission name: {adm.admission_name}")
            print(f"Admission name bytes: {adm.admission_name.encode('utf-8')}")

            if adm.departments:
                dept = adm.departments[0]
                print(f"\nDepartment name: {dept.name}")
                print(f"Campus: {dept.campus}")


if __name__ == "__main__":
    asyncio.run(main())
