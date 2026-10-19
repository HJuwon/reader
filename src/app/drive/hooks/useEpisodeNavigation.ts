diff --git a/src/app/drive/hooks/useEpisodeNavigation.ts b/src/app/drive/hooks/useEpisodeNavigation.ts
index a02c4c7..764c052 100644
--- a/src/app/drive/hooks/useEpisodeNavigation.ts
+++ b/src/app/drive/hooks/useEpisodeNavigation.ts
@@ -1,6 +1,6 @@
 "use client";
 
-import { useCallback } from "react";
+import { useCallback, useRef } from "react";
 
 type Episode = {
   episode: number;
@@ -15,7 +15,8 @@ type UseEpisodeNavigationParams = {
 
   selectedEpisodeIndex: number;
 
-  progressSaving: boolean;
+  /** 더 이상 쓰지 않지만 호출부 호환을 위해 남겨 둔다 */
+  progressSaving?: boolean;
 
   roundStatus: string | null;
 
@@ -67,7 +68,6 @@ type UseEpisodeNavigationParams = {
 export function useEpisodeNavigation({
   parsedNovel,
   selectedEpisodeIndex,
-  progressSaving,
   roundStatus,
   selectedFile,
   setSelectedEpisodeIndex,
@@ -80,6 +80,23 @@ export function useEpisodeNavigation({
   scrollPositionRef,
   restoreScrollPositionRef,
 }: UseEpisodeNavigationParams) {
+  /*
+   * 읽기 진행 저장은 화면 전환을 기다리게 하지 않고 뒤에서 순서대로 처리한다.
+   * (큐로 이어 붙여서 저장 순서가 뒤바뀌지 않게 한다)
+   */
+  const saveQueueRef = useRef<Promise<unknown>>(
+    Promise.resolve()
+  );
+
+  const enqueue = useCallback(
+    (task: () => Promise<unknown>) => {
+      saveQueueRef.current = saveQueueRef.current
+        .then(task)
+        .catch(() => undefined);
+    },
+    []
+  );
+
   /*
    * 회차 변경
    */
@@ -89,10 +106,6 @@ export function useEpisodeNavigation({
         return;
       }
 
-      if (progressSaving) {
-        return;
-      }
-
       if (
         index < 0 ||
         index >= parsedNovel.episodes.length
@@ -115,15 +128,7 @@ export function useEpisodeNavigation({
           Math.round(window.scrollY)
         );
 
-      if (
-        roundStatus !== "completed"
-      ) {
-        await saveProgress(
-          selectedEpisodeIndex,
-          currentScrollPosition
-        );
-      }
-
+      // 화면 전환이 먼저. 저장은 뒤에서 처리한다.
       setSelectedEpisodeIndex(index);
 
       setEpisodeListOpen(false);
@@ -142,10 +147,14 @@ export function useEpisodeNavigation({
       if (
         roundStatus !== "completed"
       ) {
-        await saveProgress(
-          index,
-          0
+        const fromIndex = selectedEpisodeIndex;
+        const fromScroll = currentScrollPosition;
+
+        // 떠나는 화의 위치 → 새 화 위치 순서로 저장
+        enqueue(() =>
+          saveProgress(fromIndex, fromScroll)
         );
+        enqueue(() => saveProgress(index, 0));
       }
 
       const episode =
@@ -155,7 +164,7 @@ export function useEpisodeNavigation({
         episode &&
         selectedFile
       ) {
-        await getBookmarkStatus(
+        void getBookmarkStatus(
           selectedFile.id,
           episode.episode
         );
@@ -163,7 +172,6 @@ export function useEpisodeNavigation({
     },
     [
       parsedNovel,
-      progressSaving,
       selectedEpisodeIndex,
       roundStatus,
       selectedFile,
@@ -176,6 +184,7 @@ export function useEpisodeNavigation({
       getBookmarkStatus,
       scrollPositionRef,
       restoreScrollPositionRef,
+      enqueue,
     ]
   );
 
@@ -184,10 +193,7 @@ export function useEpisodeNavigation({
    */
   const goToPrevEpisode = useCallback(
     async () => {
-      if (
-        !parsedNovel ||
-        progressSaving
-      ) {
+      if (!parsedNovel) {
         return;
       }
 
@@ -210,7 +216,6 @@ export function useEpisodeNavigation({
     },
     [
       parsedNovel,
-      progressSaving,
       selectedEpisodeIndex,
       changeEpisode,
     ]
@@ -221,10 +226,7 @@ export function useEpisodeNavigation({
    */
   const goToNextEpisode = useCallback(
     async () => {
-      if (
-        !parsedNovel ||
-        progressSaving
-      ) {
+      if (!parsedNovel) {
         return;
       }
 
@@ -247,7 +249,6 @@ export function useEpisodeNavigation({
     },
     [
       parsedNovel,
-      progressSaving,
       selectedEpisodeIndex,
       changeEpisode,
     ]
