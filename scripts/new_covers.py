
import hashlib
import logging
import os
import re
import time
import unicodedata
import urllib.robotparser

from collections import defaultdict
from io import BytesIO
from urllib.parse import quote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


# ============================================================
# 설정
# ============================================================

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

MAX_NEW = int(os.getenv("MAX_NEW", "40"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
PAGE_TIMEOUT_MS = int(os.getenv("PAGE_TIMEOUT_MS", "60000"))
WEBP_QUALITY = int(os.getenv("WEBP_QUALITY", "85"))
MAX_WIDTH = int(os.getenv("MAX_WIDTH", "800"))

BUCKET_NAME = "covers"
STORAGE_FOLDER = ""

BOOKS_TABLE = "books"
COVERS_TABLE = "book_covers"
PENDING_TABLE = "cover_pending"

# 웹사이트 검색용 User-Agent
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)

# Supabase 서버 요청 전용 User-Agent
SUPABASE_USER_AGENT = "reader-cover-worker/1.0"

NAVER_SEARCH_URL = "https://series.naver.com/search/search.series"
KAKAO_SEARCH_URL = "https://page.kakao.com/search/result/"

# 자동 검색에서 검색어로만 제거할 선행 숫자 접두어
# 예: "1-작품명" -> "작품명"
# DB의 books.title 및 원문 파일명은 변경하지 않음.
SEARCH_PREFIX_RE = re.compile(r"^\s*\d+\s*[-~]\s*")

# 제목 정리 시 제외할 단어
SUFFIX_WORDS = [
    "본편",
    "외전",
    "번외",
    "에필로그",
    "프롤로그",
    "후기",
    "완결",
    "개정판",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

session = requests.Session()

# 일반 웹사이트 검색·다운로드용 기본 헤더
session.headers.update({"User-Agent": USER_AGENT})

# Supabase REST API 전용 헤더
# 중요: requests.Session의 웹 브라우저 User-Agent를 덮어쓴다.
SUPABASE_HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    "User-Agent": SUPABASE_USER_AGENT,
}

# 기존 JWT 형식의 service_role 키는 Authorization 헤더도 사용.
# sb_secret_ 형식의 새 키는 apikey 헤더로 전달.
if SUPABASE_SERVICE_ROLE_KEY.startswith("eyJ"):
    SUPABASE_HEADERS["Authorization"] = (
        f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    )

ROBOTS_CACHE = {}
BOOK_IDS = defaultdict(list)


# ============================================================
# 공통 HTTP / Supabase 함수
# ============================================================

def supa(method, table, params=None, payload=None, extra_headers=None):
    """Supabase REST API 요청."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"

    headers = dict(SUPABASE_HEADERS)
    if extra_headers:
        headers.update(extra_headers)

    response = session.request(
        method=method,
        url=url,
        params=params,
        json=payload,
        headers=headers,
        timeout=REQUEST_TIMEOUT,
    )

    if not response.ok:
        logging.error(
            "Supabase 요청 실패: %s %s | %s | %s",
            method,
            table,
            response.status_code,
            response.text[:1000],
        )
        response.raise_for_status()

    if response.status_code == 204 or not response.text.strip():
        return []

    return response.json()



def get_all(table, params=None, page_size=1000, order=None):
    """페이지 단위로 테이블 데이터를 모두 조회."""
    results = []
    offset = 0
    base_params = dict(params or {})

    while True:
        query = dict(base_params)
        query["select"] = query.get("select", "*")

        if order:
            query["order"] = order

        query["limit"] = page_size
        query["offset"] = offset

        rows = supa("GET", table, params=query)

        if not isinstance(rows, list) or not rows:
            break

        results.extend(rows)

        if len(rows) < page_size:
            break

        offset += len(rows)

    return results


def normalize_title(text):
    return str(text or "").casefold().strip()


def normalize_key(text):
    """비교용 키: 유니코드 정규화 후 영문·숫자·한글만 남김."""
    value = unicodedata.normalize("NFKC", str(text or "")).casefold()
    return "".join(ch for ch in value if ch.isalnum())


def clean_title(text):
    """
    기존 표지 처리 방식과 호환되는 비교용 제목 정리.

    주의:
    - books.title 원본은 수정하지 않음.
    - 이 함수 결과는 title_key 생성과 작품 묶음에만 사용.
    - 플랫폼 검색어는 별도의 make_search_title()로 생성.
    """
    title = unicodedata.normalize("NFKC", str(text or "")).strip()

    title = re.sub(
        r"\.(?:txt|epub|docx?)$",
        "",
        title,
        flags=re.IGNORECASE,
    )

    title = re.sub(r"\s*\((?:완|미완)\)\s*$", "", title)
    title = re.sub(r"\s*\[(?:완|미완)\]\s*$", "", title)

    # 제목 끝에 붙은 회차·부 정보 제거
    title = re.sub(
        r"\s+\d+\s*(?:[-~]\s*\d+|\s*부)\s*$",
        "",
        title,
    )

    # 제목 끝에 붙은 괄호·대괄호 등의 부가 문구 제거
    title = re.sub(r"\s*[\(\[（【][^\)\]）】]*[\)\]）】]\s*$", "", title)

    for suffix in SUFFIX_WORDS:
        title = re.sub(
            rf"\s*{re.escape(suffix)}\s*$",
            "",
            title,
            flags=re.IGNORECASE,
        )

    return title.strip()


def make_title_key(title):
    return normalize_key(clean_title(title))


def make_search_title(title):
    """
    플랫폼 검색에만 사용할 제목.
    선행 숫자 접두어와 앞뒤 공백만 제거한다.
    """
    value = str(title or "").strip()
    value = SEARCH_PREFIX_RE.sub("", value)
    return value.strip()


def get_storage_filename(key):
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    return f"{digest}.webp"


def identify_platform(url):
    host = urlparse(url).netloc.lower()

    if "series.naver.com" in host:
        return "naver"

    if "page.kakao.com" in host:
        return "kakao"

    if "ridibooks.com" in host:
        return "ridibooks"

    return None


# ============================================================
# robots.txt 확인
# ============================================================

def robots_ok(url):
    """
    robots.txt에서 접근이 허용된 URL만 요청한다.
    robots.txt 요청 자체에 오류가 발생하면 접근하지 않는다.
    """
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False

    origin = f"{parsed.scheme}://{parsed.netloc}"

    if origin not in ROBOTS_CACHE:
        robots_url = urljoin(origin, "/robots.txt")
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(robots_url)

        try:
            response = session.get(
                robots_url,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )

            # 4xx는 robots.txt가 없거나 제공되지 않는 경우로 처리.
            # 5xx 및 기타 서버 오류는 안전을 위해 접근을 허용하지 않음.
            if 400 <= response.status_code < 500:
                parser.parse([])
            elif response.ok:
                parser.parse(response.text.splitlines())
            else:
                ROBOTS_CACHE[origin] = False
                logging.warning("robots.txt 확인 실패: %s", robots_url)
                return False

            ROBOTS_CACHE[origin] = parser

        except requests.RequestException as exc:
            ROBOTS_CACHE[origin] = False
            logging.warning("robots.txt 요청 오류: %s | %s", robots_url, exc)
            return False

    cached = ROBOTS_CACHE[origin]

    if cached is False:
        return False

    return cached.can_fetch(USER_AGENT, url)


# ============================================================
# 작품 검색
# ============================================================

def extract_links(page):
    """현재 페이지의 링크를 (표시 텍스트, URL) 형태로 반환."""
    return page.locator("a").evaluate_all(
        """
        elements => elements.map(a => ({
            text: (a.innerText || a.textContent || '').trim(),
            href: a.href || ''
        }))
        """
    )


def choose_naver_match(links, title):
    """
    네이버 시리즈의 소설 상세 페이지 후보를 찾는다.
    정확히 일치하는 제목을 우선하고, 그다음 짧은 텍스트를 우선한다.
    """
    target = normalize_title(title)
    candidates = {}

    for item in links:
        text = normalize_title(item.get("text", ""))
        href = item.get("href", "").strip()

        if not text or not href:
            continue

        if "series.naver.com/novel/detail.series" not in href:
            continue

        if target not in text:
            continue

        candidates[href] = {
            "text": text,
            "href": href,
        }

    if not candidates:
        return None

    ordered = sorted(
        candidates.values(),
        key=lambda item: (
            item["text"] != target,
            len(item["text"]),
            item["href"],
        ),
    )

    return ordered[0]["href"]


def search_naver(page, title):
    """네이버 시리즈에서 작품 상세 URL을 검색한다."""
    search_title = make_search_title(title)

    if not search_title:
        return None

    search_url = (
        f"{NAVER_SEARCH_URL}?t=all&fs=novel&q="
        f"{quote(search_title)}"
    )

    if not robots_ok(search_url):
        logging.info("네이버 검색 robots.txt 접근 불가: %s", search_title)
        return None

    try:
        page.goto(
            search_url,
            wait_until="domcontentloaded",
            timeout=PAGE_TIMEOUT_MS,
        )
        page.wait_for_timeout(2500)

        links = extract_links(page)
        match_url = choose_naver_match(links, search_title)

        if match_url:
            logging.info(
                "네이버 검색 결과: %s -> %s",
                search_title,
                match_url,
            )
            return match_url

        body_text = normalize_title(page.locator("body").inner_text())

        no_result_phrases = [
            "검색결과가없습니다",
            "검색결과가없어요",
            "검색결과가존재하지않습니다",
        ]

        if any(phrase in body_text for phrase in no_result_phrases):
            logging.info("네이버 검색 결과 없음: %s", search_title)
        else:
            logging.info("네이버에서 일치하는 상세 URL을 찾지 못함: %s", search_title)

        return None

    except (PlaywrightTimeoutError, Exception) as exc:
        logging.warning("네이버 검색 오류: %s | %s", search_title, exc)
        return None


def search_kakao(page, title):
    """
    카카오페이지에서 웹소설 제목이 정확히 일치하는 결과만 선택한다.
    """
    search_title = make_search_title(title)

    if not search_title:
        return None

    search_url = (
        f"{KAKAO_SEARCH_URL}?keyword={quote(search_title)}"
    )

    if not robots_ok(search_url):
        logging.info("카카오페이지 검색 robots.txt 접근 불가: %s", search_title)
        return None

    try:
        page.goto(
            search_url,
            wait_until="domcontentloaded",
            timeout=PAGE_TIMEOUT_MS,
        )
        page.wait_for_timeout(2500)

        target = normalize_title(search_title)
        candidates = {}

        for item in extract_links(page):
            text = item.get("text", "")
            href = item.get("href", "").strip()

            if not text or not href:
                continue

            if not re.search(r"page\.kakao\.com/content/\d+", href):
                continue

            # 결과 텍스트 중 한 줄이 제목과 정확히 일치해야 한다.
            lines = [
                normalize_title(line)
                for line in text.splitlines()
                if normalize_title(line)
            ]

            if target not in lines:
                continue

            if "웹소설" not in text:
                continue

            candidates[href] = text

        if len(candidates) == 1:
            result_url = next(iter(candidates))
            logging.info(
                "카카오페이지 검색 결과: %s -> %s",
                search_title,
                result_url,
            )
            return result_url

        if len(candidates) > 1:
            logging.warning(
                "카카오페이지 정확 일치 결과가 여러 개여서 보류: %s | %s",
                search_title,
                list(candidates.keys()),
            )
        else:
            logging.info("카카오페이지 검색 결과 없음: %s", search_title)

        return None

    except Exception as exc:
        logging.warning("카카오페이지 검색 오류: %s | %s", search_title, exc)
        return None


# ============================================================
# 이미지 다운로드 / WEBP 변환
# ============================================================

def download_image(url, referer=None):
    if not url:
        return None

    if not robots_ok(url):
        logging.warning("이미지 URL robots.txt 접근 불가: %s", url)
        return None

    headers = {}
    if referer:
        headers["Referer"] = referer

    try:
        response = session.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        response.raise_for_status()

        # 이미지 파일인지 검증
        with Image.open(BytesIO(response.content)) as image:
            image.verify()

        return response.content

    except (
        requests.RequestException,
        UnidentifiedImageError,
        OSError,
        Exception,
    ) as exc:
        logging.warning("이미지 다운로드 실패: %s | %s", url, exc)
        return None


def convert_webp(image_bytes):
    if not image_bytes:
        return None

    try:
        with Image.open(BytesIO(image_bytes)) as original:
            original.load()

            width, height = original.size

            # 너무 작거나 비정상적인 비율의 이미지는 표지로 사용하지 않음
            if width < 180 or height < 240:
                logging.warning(
                    "표지 이미지 해상도가 너무 작음: %sx%s",
                    width,
                    height,
                )
                return None

            ratio = width / height
            if ratio < 0.35 or ratio > 1.05:
                logging.warning(
                    "표지 이미지 비율이 비정상적임: %.3f",
                    ratio,
                )
                return None

            image = original.copy()

            if image.width > MAX_WIDTH:
                new_height = round(image.height * MAX_WIDTH / image.width)
                image = image.resize(
                    (MAX_WIDTH, new_height),
                    Image.Resampling.LANCZOS,
                )

            if image.mode not in ("RGB", "RGBA"):
                if "A" in image.getbands():
                    image = image.convert("RGBA")
                else:
                    image = image.convert("RGB")

            output = BytesIO()
            image.save(
                output,
                format="WEBP",
                quality=WEBP_QUALITY,
                method=6,
            )

            return output.getvalue()

    except Exception as exc:
        logging.warning("WEBP 변환 실패: %s", exc)
        return None


def get_naver_cover_url(page_url, html):
    soup = BeautifulSoup(html, "html.parser")

    meta = (
        soup.find("meta", attrs={"property": "og:image"})
        or soup.find("meta", attrs={"name": "og:image"})
    )

    if not meta:
        return None

    image_url = (meta.get("content") or "").strip()

    if not image_url:
        return None

    image_url = urljoin(page_url, image_url)

    # 크기 옵션이 붙은 URL은 기본 이미지 URL로 정리
    image_url = re.sub(r"\?type=.*$", "", image_url)

    return image_url


def download_naver_cover(page_url):
    """네이버 작품 상세 페이지의 og:image에서 표지를 추출한다."""
    if not robots_ok(page_url):
        logging.warning("네이버 상세 페이지 robots.txt 접근 불가: %s", page_url)
        return None

    try:
        response = session.get(
            page_url,
            headers={"Referer": "https://series.naver.com/"},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        response.raise_for_status()

        image_url = get_naver_cover_url(response.url, response.text)

        if not image_url:
            logging.warning("네이버 상세 페이지에서 og:image를 찾지 못함: %s", page_url)
            return None

        image_bytes = download_image(image_url, referer=response.url)
        return convert_webp(image_bytes)

    except Exception as exc:
        logging.warning("네이버 표지 추출 실패: %s | %s", page_url, exc)
        return None


def download_kakao_cover(page, page_url):
    """
    카카오페이지 상세 페이지에서 content/overview API 응답의
    thumbnail 값을 추출해 표지를 다운로드한다.
    """
    if not robots_ok(page_url):
        logging.warning("카카오 상세 페이지 robots.txt 접근 불가: %s", page_url)
        return None

    thumbnail_values = []

    def on_response(response):
        try:
            if "content/overview" not in response.url:
                return

            if response.status >= 400:
                return

            data = response.json()
            if not isinstance(data, dict):
                return

            # 응답 구조가 달라질 수 있으므로 가능한 구조를 순차 확인
            result = data.get("result", data)
            if not isinstance(result, dict):
                return

            content = result.get("content", result)
            if not isinstance(content, dict):
                return

            thumbnail = content.get("thumbnail")
            if thumbnail:
                thumbnail_values.append(str(thumbnail))

        except Exception:
            pass

    page.on("response", on_response)

    try:
        page.goto(
            page_url,
            wait_until="domcontentloaded",
            timeout=PAGE_TIMEOUT_MS,
        )
        page.wait_for_timeout(3500)

    except Exception as exc:
        logging.warning("카카오 상세 페이지 접근 실패: %s | %s", page_url, exc)

    finally:
        try:
            page.remove_listener("response", on_response)
        except Exception:
            pass

    if not thumbnail_values:
        logging.warning("카카오 API 응답에서 thumbnail을 찾지 못함: %s", page_url)
        return None

    thumbnail = thumbnail_values[-1]

    if thumbnail.startswith(("http://", "https://")):
        image_url = thumbnail
    else:
        image_url = (
            "https://page-images.kakaoentcdn.com/download/resource"
            f"?kid={quote(thumbnail)}&filename=o1"
        )

    image_bytes = download_image(image_url, referer=page_url)
    return convert_webp(image_bytes)


# ============================================================
# 리디북스: 직접 입력한 URL만 처리
# ============================================================

def get_ridibooks_id(url):
    match = re.search(r"/books/(\d+)", url)
    return match.group(1) if match else None


def download_ridibooks_cover(page, page_url):
    """
    리디북스는 자동 검색하지 않는다.
    cover_pending.url에 직접 입력된 작품 상세 URL만 처리한다.
    """
    if not robots_ok(page_url):
        logging.warning("리디북스 상세 페이지 robots.txt 접근 불가: %s", page_url)
        return None

    book_id = get_ridibooks_id(page_url)

    if not book_id:
        logging.warning("리디북스 URL에서 작품 ID를 찾지 못함: %s", page_url)
        return None

    candidate_urls = [
        f"https://img.ridicdn.net/cover/{book_id}/xxlarge?dpi=xxxhdpi",
        f"https://img.ridicdn.net/cover/{book_id}/xxlarge?dpi=xxhdpi",
        f"https://img.ridicdn.net/cover/{book_id}/xlarge?dpi=xxxhdpi",
        f"https://img.ridicdn.net/cover/{book_id}/large?dpi=xhdpi",
    ]

    for image_url in candidate_urls:
        image_bytes = download_image(image_url, referer=page_url)
        webp_bytes = convert_webp(image_bytes)

        if webp_bytes:
            return webp_bytes

    # 직접 URL 페이지에서 표지 이미지 후보를 찾는 보조 경로
    try:
        page.goto(
            page_url,
            wait_until="domcontentloaded",
            timeout=PAGE_TIMEOUT_MS,
        )
        page.wait_for_timeout(2000)

        image_urls = page.locator("img").evaluate_all(
            """
            elements => elements
              .map(img => img.currentSrc || img.src || '')
              .filter(src => src.includes('ridicdn.net/cover/'))
            """
        )

        for image_url in image_urls:
            image_bytes = download_image(image_url, referer=page_url)
            webp_bytes = convert_webp(image_bytes)

            if webp_bytes:
                return webp_bytes

    except Exception as exc:
        logging.warning("리디북스 페이지 표지 추출 실패: %s | %s", page_url, exc)

    return None


def download_cover_by_url(page, url):
    platform = identify_platform(url)

    if platform == "naver":
        return download_naver_cover(url)

    if platform == "kakao":
        return download_kakao_cover(page, url)

    if platform == "ridibooks":
        return download_ridibooks_cover(page, url)

    logging.warning("지원하지 않는 플랫폼 URL: %s", url)
    return None


# ============================================================
# Supabase Storage / 표지 테이블
# ============================================================

def upload_storage(key, webp_bytes):
    filename = get_storage_filename(key)

    if STORAGE_FOLDER:
        object_path = f"{STORAGE_FOLDER.strip('/')}/{filename}"
    else:
        object_path = filename

    encoded_path = quote(object_path, safe="/")
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{encoded_path}"

    # Storage 요청에도 브라우저 User-Agent가 전달되지 않도록 명시한다.
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "image/webp",
        "x-upsert": "true",
        "User-Agent": SUPABASE_USER_AGENT,
    }

    if SUPABASE_SERVICE_ROLE_KEY.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"

    response = session.post(
        url,
        headers=headers,
        data=webp_bytes,
        timeout=REQUEST_TIMEOUT,
    )

    if not response.ok:
        logging.error(
            "Storage 업로드 실패: %s | %s",
            response.status_code,
            response.text[:1000],
        )
        response.raise_for_status()

    return object_path


def public_storage_url(object_path):
    encoded_path = quote(object_path, safe="/")
    return (
        f"{SUPABASE_URL}/storage/v1/object/public/"
        f"{BUCKET_NAME}/{encoded_path}"
    )


def save_cover_record(key, title, object_path, source_url):
    payload = {
        "title_key": key,
        "title": title,
        "cover_url": public_storage_url(object_path),
        "source_url": source_url,
    }

    rows = supa(
        "POST",
        COVERS_TABLE,
        params={"on_conflict": "title_key"},
        payload=payload,
        extra_headers={
            "Prefer": "resolution=merge-duplicates,return=representation"
        },
    )

    if rows:
        return rows[0]["id"]

    # 응답이 비어 있는 경우 기존 레코드에서 ID를 다시 조회
    existing = supa(
        "GET",
        COVERS_TABLE,
        params={
            "select": "id",
            "title_key": f"eq.{key}",
            "limit": 1,
        },
    )

    if existing:
        return existing[0]["id"]

    raise RuntimeError(f"표지 DB 저장 후 ID를 확인할 수 없습니다: {key}")


def link_books(key, cover_id):
    """
    표지가 없는 책에만 cover_id를 연결한다.
    기존 cover_id 및 읽기 진행 데이터는 수정하지 않는다.
    """
    ids = BOOK_IDS.get(key, [])

    if not ids:
        return 0

    linked_count = 0

    for start in range(0, len(ids), 100):
        batch = ids[start:start + 100]
        id_filter = "in.(" + ",".join(str(book_id) for book_id in batch) + ")"

        updated = supa(
            "PATCH",
            BOOKS_TABLE,
            params={
                "id": id_filter,
                "cover_id": "is.null",
            },
            payload={"cover_id": cover_id},
            extra_headers={"Prefer": "return=representation"},
        )

        linked_count += len(updated) if isinstance(updated, list) else 0

    return linked_count


def pending_upsert(key, title, url, status, note):
    """
    실패한 작품을 cover_pending에 기록한다.
    전달된 URL이 비어 있으면 기존 URL을 덮어쓰지 않는다.
    """
    existing = supa(
        "GET",
        PENDING_TABLE,
        params={
            "select": "title_key,url",
            "title_key": f"eq.{key}",
            "limit": 1,
        },
    )

    old_url = existing[0].get("url") if existing else None
    final_url = url or old_url

    payload = {
        "title_key": key,
        "title": title,
        "status": status,
        "note": note,
    }

    if final_url:
        payload["url"] = final_url

    supa(
        "POST",
        PENDING_TABLE,
        params={"on_conflict": "title_key"},
        payload=payload,
        extra_headers={
            "Prefer": "resolution=merge-duplicates,return=representation"
        },
    )


def update_pending_status(key, status, note):
    supa(
        "PATCH",
        PENDING_TABLE,
        params={"title_key": f"eq.{key}"},
        payload={"status": status, "note": note},
        extra_headers={"Prefer": "return=minimal"},
    )


# ============================================================
# DB 데이터 로드
# ============================================================

def load_existing_covers():
    rows = get_all(
        COVERS_TABLE,
        params={"select": "id,title_key,title,cover_url,source_url"},
    )

    return {
        str(row["title_key"]): row
        for row in rows
        if row.get("title_key")
    }


def load_books_without_cover():
    """
    cover_id가 NULL인 책만 가져온다.
    책의 실제 title은 수정하지 않고, 비교용 키로만 묶는다.
    """
    rows = get_all(
        BOOKS_TABLE,
        params={
            "select": "id,title,cover_id",
            "cover_id": "is.null",
            "title": "not.is.null",
        },
    )

    grouped = {}

    for row in rows:
        title = str(row.get("title") or "").strip()

        if not title:
            continue

        key = make_title_key(title)

        if not key:
            continue

        if key not in grouped:
            grouped[key] = {
                "title": title,
                "ids": [],
            }

        grouped[key]["ids"].append(row["id"])
        BOOK_IDS[key].append(row["id"])

    return grouped


def load_pending_rows():
    return get_all(
        PENDING_TABLE,
        params={
            "select": "title_key,title,url,status,note",
        },
    )


# ============================================================
# 표지 저장 처리
# ============================================================

def process_cover(page, key, title, source_url):
    """
    상세 URL에서 표지를 가져와 Storage에 저장하고 DB에 연결.
    성공하면 True, 실패하면 False.
    """
    try:
        webp_bytes = download_cover_by_url(page, source_url)

        if not webp_bytes:
            logging.warning("표지 추출 실패: %s | %s", title, source_url)
            return False

        object_path = upload_storage(key, webp_bytes)
        cover_id = save_cover_record(
            key=key,
            title=title,
            object_path=object_path,
            source_url=source_url,
        )

        linked = link_books(key, cover_id)

        logging.info(
            "표지 저장 완료: title=%s, cover_id=%s, 연결=%s, url=%s",
            title,
            cover_id,
            linked,
            source_url,
        )

        return True

    except Exception as exc:
        logging.exception("표지 저장 처리 오류: %s | %s", title, exc)
        return False


def process_manual_pending(page, pending_rows, existing_keys):
    """
    사용자가 cover_pending.url에 직접 입력한 URL을 먼저 처리한다.
    needs_url 상태이며 URL이 있는 항목만 처리한다.
    """
    success_count = 0
    failure_count = 0

    for row in pending_rows:
        key = str(row.get("title_key") or "")
        title = str(row.get("title") or "")
        url = str(row.get("url") or "").strip()
        status = str(row.get("status") or "")

        if not key or not url:
            continue

        if status != "needs_url":
            continue

        # 기존 표지가 있으면 새 표지를 다운로드하지 않고 책만 연결
        if key in existing_keys:
            cover_id = existing_keys[key]["id"]
            link_books(key, cover_id)
            update_pending_status(key, "done", "기존 표지와 연결 완료")
            success_count += 1
            continue

        if not identify_platform(url):
            pending_upsert(
                key,
                title,
                url,
                "url_only",
                "지원하지 않는 URL입니다. 네이버 시리즈, 카카오페이지 또는 리디북스 URL을 확인하세요.",
            )
            failure_count += 1
            continue

        logging.info("수동 URL 표지 처리: %s | %s", title, url)

        if process_cover(page, key, title, url):
            # 표지 테이블 갱신
            existing_keys[key] = {
                "id": get_cover_id_by_key(key),
                "title_key": key,
            }
            update_pending_status(key, "done", "수동 URL 표지 저장 완료")
            success_count += 1
        else:
            update_pending_status(
                key,
                "url_only",
                "URL은 등록되어 있으나 표지 저장에 실패했습니다. URL 확인 후 status를 needs_url로 변경해 재시도하세요.",
            )
            failure_count += 1

        time.sleep(1.5)

    return success_count, failure_count


def get_cover_id_by_key(key):
    rows = supa(
        "GET",
        COVERS_TABLE,
        params={
            "select": "id",
            "title_key": f"eq.{key}",
            "limit": 1,
        },
    )

    if not rows:
        raise RuntimeError(f"저장된 표지 ID를 찾을 수 없습니다: {key}")

    return rows[0]["id"]


# ============================================================
# 메인 처리
# ============================================================

def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다."
        )

    logging.info("표지 처리 작업 시작")
    logging.info("최대 신규 작품 처리 수: %s", MAX_NEW)

    existing_covers = load_existing_covers()
    books_without_cover = load_books_without_cover()
    pending_rows = load_pending_rows()

    logging.info("기존 표지 레코드: %s", len(existing_covers))
    logging.info("표지가 없는 작품 키: %s", len(books_without_cover))
    logging.info("수동 처리 대기 레코드: %s", len(pending_rows))

    # 기존 표지가 있으면 책에 연결하고 자동 검색 대상에서 제외
    for key in list(books_without_cover.keys()):
        if key in existing_covers:
            linked = link_books(key, existing_covers[key]["id"])
            logging.info(
                "기존 표지 재사용: %s | 연결=%s",
                books_without_cover[key]["title"],
                linked,
            )
            books_without_cover.pop(key, None)

    pending_by_key = {
        str(row.get("title_key") or ""): row
        for row in pending_rows
        if row.get("title_key")
    }

    success_count = 0
    failure_count = 0
    attempted = 0

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )

        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1365, "height": 900},
            locale="ko-KR",
        )

        page = context.new_page()
        page.set_default_timeout(PAGE_TIMEOUT_MS)

        # ----------------------------------------------------
        # 1) 수동 URL이 등록된 pending 항목부터 처리
        # ----------------------------------------------------
        manual_success, manual_failure = process_manual_pending(
            page,
            pending_rows,
            existing_covers,
        )

        success_count += manual_success
        failure_count += manual_failure

        # ----------------------------------------------------
        # 2) 신규 작품 자동 검색
        #    네이버 -> 표지 저장 성공 시 종료
        #    네이버 실패 -> 카카오페이지
        #    둘 다 실패 -> cover_pending 기록
        # ----------------------------------------------------
        for key, item in books_without_cover.items():
            if attempted >= MAX_NEW:
                logging.info(
                    "MAX_NEW=%s에 도달하여 자동 검색을 종료합니다.",
                    MAX_NEW,
                )
                break

            title = item["title"]

            # 이미 pending에 기록된 작품은 자동 재검색하지 않는다.
            # 수동 URL 처리는 위 단계에서 별도로 수행한다.
            if key in pending_by_key:
                logging.info("기존 pending 작품이므로 자동 검색 생략: %s", title)
                continue

            # 앞선 작업에서 표지가 저장됐을 가능성도 확인
            if key in existing_covers:
                link_books(key, existing_covers[key]["id"])
                continue

            attempted += 1
            logging.info(
                "[%s/%s] 신규 작품 처리: %s",
                attempted,
                MAX_NEW,
                title,
            )

            naver_url = None
            kakao_url = None
            last_found_url = None

            # ----------------------------
            # 네이버 검색 및 표지 저장
            # ----------------------------
            naver_url = search_naver(page, title)

            if naver_url:
                last_found_url = naver_url

                if process_cover(page, key, title, naver_url):
                    existing_covers[key] = {
                        "id": get_cover_id_by_key(key),
                        "title_key": key,
                    }
                    success_count += 1
                    time.sleep(1.5)
                    continue

                logging.info(
                    "네이버 URL은 찾았지만 표지 저장에 실패하여 카카오페이지로 이동: %s",
                    title,
                )

            # ----------------------------
            # 카카오페이지 검색 및 표지 저장
            # ----------------------------
            kakao_url = search_kakao(page, title)

            if kakao_url:
                last_found_url = kakao_url

                if process_cover(page, key, title, kakao_url):
                    existing_covers[key] = {
                        "id": get_cover_id_by_key(key),
                        "title_key": key,
                    }
                    success_count += 1
                    time.sleep(1.5)
                    continue

                logging.info(
                    "카카오페이지 URL은 찾았지만 표지 저장에 실패: %s",
                    title,
                )

            # ----------------------------
            # 양쪽 모두 표지 저장 실패
            # ----------------------------
            if last_found_url:
                status = "url_only"
                note = (
                    "네이버·카카오 자동 표지 저장에 실패했습니다. "
                    "등록된 URL을 확인한 뒤 재시도하려면 status를 needs_url로 변경하세요."
                )
            else:
                status = "needs_url"
                note = (
                    "네이버 시리즈와 카카오페이지에서 일치하는 작품을 찾지 못했습니다. "
                    "수동으로 작품 상세 URL을 입력하세요."
                )

            pending_upsert(
                key=key,
                title=title,
                url=last_found_url,
                status=status,
                note=note,
            )

            failure_count += 1
            logging.warning(
                "수동 확인 대상으로 등록: %s | status=%s | url=%s",
                title,
                status,
                last_found_url or "",
            )

            time.sleep(1.5)

        context.close()
        browser.close()

    logging.info("=" * 60)
    logging.info("표지 처리 작업 완료")
    logging.info("자동 검색 시도: %s", attempted)
    logging.info("표지 저장 성공: %s", success_count)
    logging.info("처리 실패 또는 수동 확인: %s", failure_count)
    logging.info("=" * 60)


if __name__ == "__main__":
    main()
