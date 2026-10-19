/**
 * 구글 드라이브 파일/폴더 ID 형식 검사.
 * 실제 ID는 영문·숫자·'-'·'_'로만 이루어지고(루트는 "root"),
 * 그 밖의 문자(/ ? & ' 공백 등)는 URL·검색 조건에 끼워 넣어
 * 다른 요청을 만드는 데 쓰일 수 있으므로 모두 거절한다.
 */
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

export function isValidDriveId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && DRIVE_ID_PATTERN.test(value);
}
