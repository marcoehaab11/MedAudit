export function toothName(number: number, language: string, _short = false): string {
  const position = number % 10;
  const quadrant = Math.floor(number / 10);
  const sides = language === 'ar'
    ? ['أبر رايت', 'أبر لفت', 'لور لفت', 'لور رايت']
    : ['Upper Right', 'Upper Left', 'Lower Left', 'Lower Right'];
  const side = sides[quadrant - 1];
  if (!side || position < 1 || position > 8) return '';
  const label = language === 'ar'
    ? String(position).replace(/[0-9]/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
    : String(position);
  return `${side} ${label}`;
}

export function allowedCariesClasses(teeth: number[]): number[] {
  if (!teeth.length) return [];
  const hasAnterior = teeth.some(tooth => tooth % 10 <= 3);
  const hasPosterior = teeth.some(tooth => tooth % 10 >= 4);
  if (hasAnterior && hasPosterior) return [5, 6];
  return hasAnterior ? [3, 4, 5, 6] : [6, 1, 2, 5];
}
