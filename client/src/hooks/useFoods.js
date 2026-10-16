import { listFoods } from '../api/client';
import useAsync from './useAsync';

/** 食材清單。q:名稱子字串;source:builtin|usda|ai|manual|custom */
export default function useFoods({ q, source } = {}) {
  return useAsync(
    (signal) => listFoods({ q, source }, { signal }),
    [q, source],
  );
}
