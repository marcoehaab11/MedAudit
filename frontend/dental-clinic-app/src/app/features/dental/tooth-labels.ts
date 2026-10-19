export function toothName(number: number, _language: string, _short = false): string {
  const position = number % 10;
  const quadrant = Math.floor(number / 10);
  const side = ['Upper Right', 'Upper Left', 'Lower Left', 'Lower Right'][quadrant - 1];
  if (!side || position < 1 || position > 8) return '';
  return `${side} ${position}`;
}

export function allowedCariesClasses(teeth: number[]): number[] {
  return teeth.length ? [1, 2, 3, 4, 5, 6] : [];
}
