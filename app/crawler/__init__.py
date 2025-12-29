from app.crawler.ratio_crawler import RatioCrawler
from app.crawler.university_list import UniversityListCrawler
from app.crawler.smartratio_crawler import (
    SmartRatioCrawler,
    SmartRatioUniversity,
    UniversityStatus,
    get_jungsi_universities,
    check_jungsi_pages_open
)

__all__ = [
    "RatioCrawler",
    "UniversityListCrawler",
    "SmartRatioCrawler",
    "SmartRatioUniversity",
    "UniversityStatus",
    "get_jungsi_universities",
    "check_jungsi_pages_open"
]
