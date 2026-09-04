'use client';
import { useEffect, useState } from 'react';
import { type FiscalYear, currentFiscalYear, parseFiscalYear } from './fiscalYear';

/**
 * 画面が見ている会計期。URLの `?fy=` を正とする（2026-09-04 新設）。
 *
 * このDBは3ページ（サマリー／事業部・会館／宗派・宗教者）に分かれていて、
 * ページを移っても同じ期を見ていてほしい。だから期を state ではなくURLに持たせる。
 *
 * `useSearchParams()` は使わない。このページ群は静的プリレンダリングの対象で、
 * Suspenseで囲まないとビルドが落ちるため。マウント後に window から読む。
 *
 * `ready` が true になるまでAPIを叩かないこと。叩くと既定の期で1回、
 * URLの期でもう1回、計2回取りに行くことになる。
 */
export function useFiscalYear(): { fy: FiscalYear; ready: boolean } {
  const [fy, setFy] = useState<FiscalYear>(() => currentFiscalYear());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('fy');
    if (q) setFy(parseFiscalYear(q));
    setReady(true);
  }, []);

  return { fy, ready };
}

/** 同じページのまま期だけ差し替えたURL。期セレクタのリンク先に使う */
export function fyHref(pathname: string, fy: FiscalYear): string {
  return `${pathname}?fy=${fy}`;
}
