import { toDateKey } from '@furlogic/shared';
import { getDailyStats } from '../api/client';
import useAsync from './useAsync';

/**
 * 每日熱量統計 [{ dateKey, calories, count }](由舊到新,補零)。
 * today 預設為瀏覽器當地日期;沒有 petId 時不發請求。
 */
export default function useDailyStats({ petId, days = 7, today } = {}) {
  const todayKey = today ?? toDateKey(new Date());
  return useAsync(
    (signal) =>
      petId
        ? getDailyStats({ petId, days, today: todayKey }, { signal })
        : Promise.resolve(null),
    [petId, days, todayKey],
  );
}
