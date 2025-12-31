/**
 * 營養計算工具函式
 */

/**
 * 計算 RER (Resting Energy Requirement) - 靜止能量需求
 * @param {number} weight - 體重 (kg)
 * @returns {number} RER (kcal)
 */
export const calculateRER = (weight) => {
  return Math.round(70 * Math.pow(weight, 0.75));
};

/**
 * 計算 DER (Daily Energy Requirement) - 每日能量需求
 * @param {number} rer - RER 值
 * @param {number} factor - 活動係數
 * @returns {number} DER (kcal)
 */
export const calculateDER = (rer, factor) => {
  return Math.round(rer * factor);
};

/**
 * 計算活動係數
 * @param {boolean} isNeutered - 是否結紮
 * @param {string} activityLevel - 活動量 ('low', 'normal', 'high')
 * @returns {number} 活動係數
 */
export const calculateActivityFactor = (isNeutered, activityLevel) => {
  let base = isNeutered ? 1.6 : 1.8;
  if (activityLevel === 'low') base -= 0.2;
  if (activityLevel === 'high') base += 0.4;
  return base;
};

/**
 * 計算建議飲水量
 * @param {number} weight - 體重 (kg)
 * @returns {number} 飲水量 (ml)
 */
export const calculateWaterNeed = (weight) => {
  return Math.round(weight * 60);
};

/**
 * 分析鈣磷比
 * @param {number} totalCa - 總鈣含量 (mg)
 * @param {number} totalP - 總磷含量 (mg)
 * @returns {object} 分析結果
 */
export const analyzeCaPRatio = (totalCa, totalP) => {
  if (totalP === 0) {
    return {
      ratio: 0,
      status: 'unknown',
      advice: '無法計算鈣磷比'
    };
  }

  const ratio = totalCa / totalP;

  // 理想比例約 1:1 ~ 1.5:1
  if (ratio < 1.0) {
    return {
      ratio: ratio.toFixed(2),
      status: 'low',
      advice: `缺鈣警告 (1:${(1 / ratio).toFixed(1)})。肉類磷含量高,務必添加鈣粉或蛋殼粉平衡。`
    };
  } else if (ratio > 2.0) {
    return {
      ratio: ratio.toFixed(2),
      status: 'high',
      advice: `鈣質過高 (1:${ratio.toFixed(1)})。請減少骨頭或鈣粉攝取。`
    };
  }

  return {
    ratio: ratio.toFixed(2),
    status: 'good',
    advice: '鈣磷比完美!'
  };
};

/**
 * 生成食譜
 * @param {array} selectedIngredients - 選擇的食材
 * @param {number} targetCalories - 目標熱量
 * @returns {object} 食譜結果
 */
export const generateRecipe = (selectedIngredients, targetCalories) => {
  const proteins = selectedIngredients.filter(i => i.type === 'protein');
  const vegs = selectedIngredients.filter(i => i.type !== 'protein');

  let recipeItems = [];
  let totalCa = 0;
  let totalP = 0;
  let totalProtein = 0;
  let totalFat = 0;

  // 分配邏輯:如果有肉,肉拿走 70% 熱量;沒肉就平均分
  const proteinCalBudget = proteins.length > 0 ? targetCalories * 0.7 : 0;
  const vegCalBudget = proteins.length > 0 ? targetCalories * 0.3 : targetCalories;

  // 計算肉類份量
  proteins.forEach(p => {
    const targetCal = proteinCalBudget / proteins.length;
    const amount = Math.round((targetCal / p.calories) * 100); // 克數
    recipeItems.push({ ...p, amount });
    totalCa += (p.ca * amount) / 100;
    totalP += (p.p * amount) / 100;
    totalProtein += (p.protein * amount) / 100;
    totalFat += (p.fat * amount) / 100;
  });

  // 計算蔬菜份量
  vegs.forEach(v => {
    const targetCal = vegCalBudget / vegs.length;
    const amount = Math.round((targetCal / v.calories) * 100);
    recipeItems.push({ ...v, amount });
    totalCa += (v.ca * amount) / 100;
    totalP += (v.p * amount) / 100;
    totalProtein += (v.protein * amount) / 100;
    totalFat += (v.fat * amount) / 100;
  });

  // 檢查鈣磷比
  const caPAnalysis = analyzeCaPRatio(totalCa, totalP);

  // 生成補充品建議
  const supplements = [];
  if (caPAnalysis.status === 'low') {
    const targetCa = totalP * 1.2;
    const missingCa = targetCa - totalCa;
    // 假設蛋殼粉 1g 約含 350mg 鈣
    const eggShellPowder = (missingCa / 350).toFixed(1);
    supplements.push({
      name: '蛋殼粉',
      amount: `${eggShellPowder}g`,
      reason: '平衡鈣磷比'
    });
  }
  supplements.push({
    name: '魚油',
    amount: '1顆',
    reason: '補充 Omega-3'
  });

  return {
    items: recipeItems,
    macros: {
      p: Math.round(totalProtein),
      f: Math.round(totalFat),
      c: Math.round((targetCalories - totalProtein * 4 - totalFat * 9) / 4)
    },
    calories: targetCalories,
    analysis: caPAnalysis,
    supplements
  };
};