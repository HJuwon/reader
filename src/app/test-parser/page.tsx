"use client";

import { useState } from "react";
import { parseNovelText } from "@/lib/novelParser";
import { saveNovel } from "@/lib/novelStorage";

export default function ParserTestPage() {
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [chapters, setChapters] = useState<
    ReturnType<typeof parseNovelText>
  >([]);
  const [error, setError] = useState("");

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setFileName(file.name);
    setFileSize(file.size);
    setChapters([]);

    try {
      // TXT 파일 전체 읽기
      const text = await file.text();

      // 전체 TXT를 파서에 전달
        const result = parseNovelText(text);

        await saveNovel({
        id: "1",
        fileName: file.name,
        chapters: result,
        updatedAt: Date.now(),
        });

        setChapters(result);
    } catch (err) {
      console.error(err);
      setError("TXT 파일을 읽거나 파싱하는 중 오류가 발생했습니다.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* 제목 */}
        <section>
          <h1 className="text-2xl font-bold tracking-tight">
            TXT 파서 테스트
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            실제 소설 TXT 파일을 하나 선택하면 전체 내용을 읽어서
            회차별로 자동 분리합니다.
          </p>
        </section>

        {/* 파일 업로드 */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">
            TXT 파일 업로드
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            현재는 테스트를 위해 로컬 TXT 파일을 직접 선택합니다.
          </p>

          <label className="mt-5 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 transition hover:border-blue-300 hover:bg-blue-50">
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-700">
                TXT 파일 선택
              </div>

              <div className="mt-1 text-xs text-gray-400">
                .txt 파일 하나를 선택해주세요.
              </div>

              <input
                type="file"
                accept=".txt,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </label>
        </section>

        {/* 파일 정보 */}
        {fileName && (
          <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">
              파일 정보
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">파일명</p>
                <p className="mt-1 truncate text-sm font-medium text-gray-700">
                  {fileName}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">파일 크기</p>
                <p className="mt-1 text-sm font-medium text-gray-700">
                  {formatFileSize(fileSize)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 오류 */}
        {error && (
          <section className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-600">
              {error}
            </p>
          </section>
        )}

        {/* 파싱 결과 */}
        {chapters.length > 0 && (
          <section className="mt-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  파싱 결과
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  TXT 전체를 분석하여 아래와 같이 회차를 분리했습니다.
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-600">
                총 {chapters.length}개 회차
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {chapters.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
                      #{index + 1}
                    </span>

                    <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">
                      {chapter.type}
                    </span>

                    {chapter.number !== null && (
                      <span className="text-xs font-medium text-gray-400">
                        {chapter.number}화
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-gray-800">
                    {chapter.title}
                  </h3>

                  <div className="mt-3 rounded-xl bg-gray-50 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600">
                      {chapter.content.length > 500
                        ? `${chapter.content.slice(0, 500)}...`
                        : chapter.content}
                    </p>
                  </div>

                  <div className="mt-3 text-xs text-gray-400">
                    본문 {chapter.content.length.toLocaleString()}자
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 업로드 전 */}
        {!fileName && (
          <div className="mt-10 text-center text-sm text-gray-400">
            위에서 실제 TXT 파일을 선택하면 파싱 결과가 표시됩니다.
          </div>
        )}

        {/* 파싱 결과 없음 */}
        {fileName && chapters.length === 0 && !error && (
          <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="text-sm font-medium text-gray-500">
              회차를 찾지 못했습니다.
            </p>

            <p className="mt-2 text-xs text-gray-400">
              TXT의 회차 제목 형식을 확인해야 합니다.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}