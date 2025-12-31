/**
 * 食材資料庫
 * 包含常見寵物食材的營養成分與安全性資訊
 */

export const FOOD_DATABASE = [
  {
    id: 1,
    name: '雞胸肉',
    type: 'protein',
    safety: 'safe',
    calories: 105,
    protein: 23,
    fat: 1,
    ca: 5,
    p: 200,
    desc: '低脂優質蛋白,鮮食基底。',
    warning: null
  },
  {
    id: 2,
    name: '雞腿肉',
    type: 'protein',
    safety: 'safe',
    calories: 150,
    protein: 18,
    fat: 8,
    ca: 8,
    p: 180,
    desc: '適口性佳,脂肪含量稍高。',
    warning: null
  },
  {
    id: 3,
    name: '南瓜',
    type: 'veg',
    safety: 'safe',
    calories: 26,
    protein: 1,
    fat: 0.1,
    ca: 21,
    p: 44,
    desc: '富含纖維,對腸胃好。需煮熟。',
    warning: null
  },
  {
    id: 4,
    name: '紅蘿蔔',
    type: 'veg',
    safety: 'safe',
    calories: 41,
    protein: 0.9,
    fat: 0.2,
    ca: 33,
    p: 35,
    desc: '富含維生素A,油炒吸收更好。',
    warning: null
  },
  {
    id: 5,
    name: '地瓜',
    type: 'veg',
    safety: 'safe',
    calories: 86,
    protein: 1.6,
    fat: 0.1,
    ca: 30,
    p: 47,
    desc: '優質碳水,但熱量較高需控制。',
    warning: null
  },
  {
    id: 6,
    name: '鮭魚',
    type: 'protein',
    safety: 'safe',
    calories: 208,
    protein: 20,
    fat: 13,
    ca: 9,
    p: 200,
    desc: '富含 Omega-3,務必去刺煮熟。',
    warning: null
  },
  {
    id: 7,
    name: '花椰菜',
    type: 'veg',
    safety: 'caution',
    calories: 34,
    protein: 2.8,
    fat: 0.4,
    ca: 47,
    p: 66,
    desc: '十字花科,甲狀腺問題犬少吃。',
    warning: '建議每日不超過總食量 10%,需煮熟'
  },
  {
    id: 8,
    name: '巧克力',
    type: 'snack',
    safety: 'toxic',
    calories: 546,
    protein: 5,
    fat: 30,
    ca: 0,
    p: 0,
    desc: '絕對禁止!含可可鹼。',
    warning: '致死風險:心臟衰竭'
  },
  {
    id: 9,
    name: '葡萄',
    type: 'fruit',
    safety: 'toxic',
    calories: 67,
    protein: 0.6,
    fat: 0.4,
    ca: 0,
    p: 0,
    desc: '絕對禁止!含未知毒素。',
    warning: '致死風險:急性腎衰竭'
  },
  {
    id: 10,
    name: '洋蔥',
    type: 'veg',
    safety: 'toxic',
    calories: 40,
    protein: 1.1,
    fat: 0.1,
    ca: 0,
    p: 0,
    desc: '破壞紅血球。',
    warning: '致死風險:溶血性貧血'
  },
];

/**
 * 食材類型標籤
 */
export const FOOD_TYPES = {
  protein: '蛋白質',
  veg: '蔬菜',
  fruit: '水果',
  snack: '零食'
};

/**
 * 安全等級標籤
 */
export const SAFETY_LEVELS = {
  safe: { label: '安全', color: 'green' },
  caution: { label: '注意', color: 'yellow' },
  toxic: { label: '禁止', color: 'red' }
};