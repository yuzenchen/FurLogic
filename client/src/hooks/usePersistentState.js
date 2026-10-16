import { useState, useEffect } from 'react';

/**
 * useState 的 localStorage 持久化版本。
 *
 * @param {() => T} loader      讀取器,通常包成 () => getX()
 * @param {(value: T) => void} saver 寫入器,通常 setX
 * @returns {[T, React.Dispatch<React.SetStateAction<T>>]}
 */
export default function usePersistentState(loader, saver) {
  const [value, setValue] = useState(loader);

  useEffect(() => {
    saver(value);
  }, [value, saver]);

  return [value, setValue];
}
