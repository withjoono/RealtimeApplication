# -*- coding: utf-8 -*-
"""Test DB encoding"""
import asyncio
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, select

# 새 DB 파일 사용
DATABASE_URL = "sqlite+aiosqlite:///./test_encoding.db"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


class TestModel(Base):
    __tablename__ = "test"
    id = Column(Integer, primary_key=True)
    name = Column(String(200))


async def main():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Insert Korean text
    korean_text = "가톨릭대학교 경쟁률 서비스"
    print(f"Original: {korean_text}")

    async with async_session() as session:
        # Insert
        test = TestModel(name=korean_text)
        session.add(test)
        await session.commit()
        print(f"Inserted ID: {test.id}")

        # Read back
        result = await session.execute(select(TestModel).where(TestModel.id == test.id))
        row = result.scalar_one()
        print(f"Retrieved: {row.name}")
        print(f"Match: {row.name == korean_text}")


if __name__ == "__main__":
    asyncio.run(main())
