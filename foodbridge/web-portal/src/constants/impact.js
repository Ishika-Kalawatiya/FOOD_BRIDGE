/**
 * Environmental Impact Conversion Constants
 * 
 * Sources:
 * 1. UN Food and Agriculture Organization (FAO) "Food Wastage Footprint: Impacts on Natural Resources" (2013):
 *    Lifecycle greenhouse gas emissions factor = 2.50 kg CO2e per 1.0 kg of avoidable municipal food waste diverted from landfill.
 * 2. UNEP Food Waste Index Report & WRAP Standard Portion Estimates:
 *    Average edible cooked meal portion = 0.40 kg (400 grams) per serving.
 * 
 * Consequently:
 * - Waste Diverted (kg) = meals * KG_PER_MEAL (0.40 kg/meal)
 * - CO2e Emissions Offset (kg) = waste_kg * CO2E_PER_KG_WASTE (2.50 kg CO2e/kg waste)
 *   (equivalently: 1.0 kg CO2e per rescued meal)
 */

export const KG_PER_MEAL = 0.40;
export const CO2E_PER_KG_WASTE = 2.50;

/**
 * Calculates kilograms of food waste avoided given meal portions.
 * @param {number} meals - Number of meals
 * @returns {number} kg of food waste (rounded to 1 decimal place)
 */
export function calculateWasteKg(meals) {
  const count = Number(meals) || 0;
  return Math.round(count * KG_PER_MEAL * 10) / 10;
}

/**
 * Calculates kilograms of CO2e greenhouse gas emissions prevented.
 * @param {number} meals - Number of meals
 * @returns {number} kg of CO2e (rounded to 1 decimal place)
 */
export function calculateCo2eKg(meals) {
  const waste = calculateWasteKg(meals);
  return Math.round(waste * CO2E_PER_KG_WASTE * 10) / 10;
}
