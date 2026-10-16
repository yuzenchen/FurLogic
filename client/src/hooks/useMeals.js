import { listMeals } from '../api/client';
import useAsync from './useAsync';

/** 餐點紀錄(新到舊)。沒有 petId 時不發請求,data 為 null。 */
export default function useMeals({ petId, from, to } = {}) {
  return useAsync(
    (signal) =>
      petId
        ? listMeals({ petId, from, to }, { signal })
        : Promise.resolve(null),
    [petId, from, to],
  );
}
