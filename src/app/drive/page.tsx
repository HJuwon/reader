import { Suspense } from "react";
import DriveBrowser from "./DriveBrowser";

export default function DrivePage() {
  return (
    <Suspense fallback={<div>불러오는 중...</div>}>
      <DriveBrowser />
    </Suspense>
  );
}