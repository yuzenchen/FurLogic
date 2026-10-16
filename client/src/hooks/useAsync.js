import { useCallback, useEffect, useRef, useState } from 'react';

const shallowEqual = (a, b) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** deps 有變(淺比較)時遞增版本號,讓 effect 可用字面陣列當依賴 */
function useDepsVersion(deps) {
  const ref = useRef({ deps, version: 0 });
  if (!shallowEqual(ref.current.deps, deps)) {
    ref.current = { deps, version: ref.current.version + 1 };
  }
  return ref.current.version;
}

/**
 * 執行非同步函式並追蹤狀態。
 * @param {(signal: AbortSignal) => Promise<any>} fn 每次 deps 改變或 refetch 時呼叫
 * @param {any[]} deps 觸發重新取得的依賴(淺比較)
 * @returns {{ data: any, loading: boolean, error: Error|null, refetch: () => void,
 *   setData: (updater: any | ((prev: any) => any)) => void }}
 * setData 可在 mutation 成功後直接更新本地資料(不必重新取得)。
 * 卸載或 deps 過期後回來的結果會被忽略(並 abort 請求)。
 * 重新取得時保留上一次的 data,直到新結果回來。
 */
export default function useAsync(fn, deps = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const version = useDepsVersion(deps);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState((s) =>
      s.loading && !s.error ? s : { ...s, loading: true, error: null },
    );

    Promise.resolve()
      .then(() => fnRef.current(controller.signal))
      .then(
        (data) => {
          if (active) setState({ data, loading: false, error: null });
        },
        (error) => {
          if (!active || error?.name === 'AbortError') return;
          setState((s) => ({ data: s.data, loading: false, error }));
        },
      );

    return () => {
      active = false;
      controller.abort();
    };
  }, [version, reloadToken]);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);
  const setData = useCallback(
    (updater) =>
      setState((s) => ({
        ...s,
        data: typeof updater === 'function' ? updater(s.data) : updater,
      })),
    [],
  );

  return { ...state, refetch, setData };
}
