-- 食材子類:'organ'(內臟)| 'fatty_fish'(高脂魚)| NULL。
-- 計算器用來判斷每餐上限;值由 seed / API schema 把關,這裡不加 CHECK
-- 以免日後新增子類還要再改 schema。
ALTER TABLE foods ADD COLUMN subtype TEXT;
