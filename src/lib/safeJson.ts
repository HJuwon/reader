/**
 * 서버 응답을 안전하게 JSON으로 읽는다.
 *
 * 서버가 JSON이 아닌 응답(예: "Request Entity Too Large", 502 오류 페이지)을 주면
 * response.json()이 `Unexpected token 'R'...` 같은 알아보기 힘든 오류를 낸다.
 * 이 함수는 그런 경우에 `{ error: "사람이 읽을 수 있는 문구" }`를 돌려준다.
 * 그래서 기존 코드의 `data.error` 처리를 그대로 쓸 수 있다.
 */
export function describeHttpStatus(status: number): string {
  if (status === 401) return "로그인이 필요합니다. 다시 로그인해 주세요.";
  if (status === 403) return "권한이 없습니다.";
  if (status === 404) return "요청한 내용을 찾을 수 없습니다.";
  if (status === 408 || status === 504)
    return "서버 응답이 너무 오래 걸립니다. 잠시 후 다시 시도해 주세요.";
  if (status === 413) return "보내는 내용이 너무 큽니다.";
  if (status === 429)
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  if (status >= 500)
    return `서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요. (오류 ${status})`;

  return `서버 응답을 읽지 못했습니다. (오류 ${status})`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJsonSafe(response: Response): Promise<any> {
  const raw = await response.text();

  try {
    return JSON.parse(raw);
  } catch {
    return { error: describeHttpStatus(response.status) };
  }
}
