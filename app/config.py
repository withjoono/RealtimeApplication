from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///./application_rate.db"

    # Crawler Settings
    crawl_interval_minutes: int = 10
    max_concurrent_requests: int = 5

    # API Settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Jinhak Apply URLs
    smart_ratio_url: str = "https://apply.jinhakapply.com/SmartRatio"
    ratio_base_url: str = "https://addon.jinhakapply.com/RatioV1/RatioH/"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
