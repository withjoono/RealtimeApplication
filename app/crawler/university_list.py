import httpx
from bs4 import BeautifulSoup
import re
import asyncio
from typing import Optional
from dataclasses import dataclass
from app.config import get_settings

settings = get_settings()


@dataclass
class UniversityInfo:
    code: str
    name: str
    region: Optional[str] = None
    type: Optional[str] = None  # 4년제/전문대
    ratio_url: Optional[str] = None


class UniversityListCrawler:
    """
    진학사 SmartRatio 페이지에서 대학 목록 및 경쟁률 페이지 URL 수집

    URL 패턴: https://addon.jinhakapply.com/RatioV1/RatioH/Ratio{code}.html
    - code 구조: {대학코드}{전형구분코드}
    - 예: 10030311 = 가톨릭대(1003) + 수시(031) + 버전(1)
    """

    def __init__(self):
        self.base_url = settings.smart_ratio_url
        self.ratio_base = settings.ratio_base_url
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        }

    async def fetch_university_list_from_api(self, admission_type: str = "정시") -> list[UniversityInfo]:
        """
        SmartRatio API에서 대학 목록 조회

        Args:
            admission_type: 수시/정시/편입학
        """
        universities = []

        # 진학사 API 엔드포인트 (개발자 도구에서 확인 필요)
        api_url = "https://apply.jinhakapply.com/SmartRatio/GetRatioList"

        async with httpx.AsyncClient(headers=self.headers, timeout=30.0) as client:
            try:
                # API 호출 시도 (실제 파라미터는 확인 필요)
                params = {
                    "admission_type": admission_type,
                    "page": 1,
                    "pageSize": 500
                }
                response = await client.get(api_url, params=params)

                if response.status_code == 200:
                    data = response.json()
                    # API 응답 구조에 맞게 파싱 (실제 구조 확인 필요)
                    for item in data.get("list", []):
                        universities.append(UniversityInfo(
                            code=item.get("univ_code", ""),
                            name=item.get("univ_name", ""),
                            region=item.get("region", ""),
                            type=item.get("univ_type", ""),
                            ratio_url=item.get("ratio_url", "")
                        ))
            except Exception as e:
                print(f"API 호출 실패: {e}")

        return universities

    async def fetch_universities_from_page(self, url: str) -> list[UniversityInfo]:
        """
        경쟁률 조회 페이지에서 대학 목록 및 링크 추출
        """
        universities = []

        async with httpx.AsyncClient(headers=self.headers, timeout=30.0) as client:
            try:
                response = await client.get(url)
                response.raise_for_status()

                soup = BeautifulSoup(response.text, "lxml")

                # 대학 링크 패턴 찾기
                # 예: href="https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10030311.html"
                links = soup.find_all("a", href=re.compile(r"Ratio\d+\.html"))

                for link in links:
                    href = link.get("href", "")
                    name = link.get_text(strip=True)

                    # URL에서 코드 추출
                    match = re.search(r"Ratio(\d+)\.html", href)
                    if match:
                        code = match.group(1)
                        universities.append(UniversityInfo(
                            code=code,
                            name=name,
                            ratio_url=href
                        ))

            except Exception as e:
                print(f"페이지 크롤링 실패: {e}")

        return universities

    async def discover_ratio_urls(self, admission_type: str = "정시", year: int = 2026) -> list[UniversityInfo]:
        """
        알려진 대학 코드를 기반으로 경쟁률 URL 탐색

        정시 URL 패턴 추정:
        - 수시: Ratio{대학코드}0311.html
        - 정시: Ratio{대학코드}0321.html (추정)
        """
        # 주요 대학 코드 (확장 필요)
        known_university_codes = {
            "1001": "서울대학교",
            "1002": "연세대학교",
            "1003": "가톨릭대학교",
            "1004": "고려대학교",
            "1005": "서강대학교",
            "1006": "성균관대학교",
            "1007": "한양대학교",
            "1008": "중앙대학교",
            "1009": "경희대학교",
            "1010": "한국외국어대학교",
            # ... 더 많은 대학 추가 필요
        }

        # 전형 구분 코드 (추정, 실제 확인 필요)
        type_codes = {
            "수시": "031",
            "정시": "032",
            "편입학": "033"
        }

        type_code = type_codes.get(admission_type, "032")
        universities = []

        async with httpx.AsyncClient(headers=self.headers, timeout=10.0) as client:
            for univ_code, univ_name in known_university_codes.items():
                # URL 패턴 시도
                for suffix in ["1", "2", ""]:
                    url = f"{self.ratio_base}Ratio{univ_code}{type_code}{suffix}.html"
                    try:
                        response = await client.head(url)
                        if response.status_code == 200:
                            universities.append(UniversityInfo(
                                code=f"{univ_code}{type_code}{suffix}",
                                name=univ_name,
                                ratio_url=url
                            ))
                            break
                    except:
                        continue

                await asyncio.sleep(0.1)  # Rate limiting

        return universities

    async def get_universities(self, admission_type: str = "정시") -> list[UniversityInfo]:
        """
        대학 목록 조회 (여러 방법 시도)
        """
        # 1. API 시도
        universities = await self.fetch_university_list_from_api(admission_type)

        # 2. API 실패 시 페이지 크롤링
        if not universities:
            universities = await self.fetch_universities_from_page(self.base_url)

        # 3. 그래도 없으면 URL 탐색
        if not universities:
            universities = await self.discover_ratio_urls(admission_type)

        return universities
