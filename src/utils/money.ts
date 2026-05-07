// Formato de montos en centavos para mostrar al usuario.
// Nunca usar estos valores para aritmética — solo para display.

export function formatMoney(minor: number): string {
  const abs = Math.abs(minor);
  const sign = minor < 0 ? '-' : '';
  const soles = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${sign}S/ ${soles}.${centavos.toString().padStart(2, '0')}`;
}

export function formatMoneyCompact(minor: number): string {
  const abs = Math.abs(minor);
  const sign = minor < 0 ? '-' : '';
  if (abs >= 100_000_00) {
    return `${sign}S/ ${(abs / 100_000_00).toFixed(1)}M`;
  }
  if (abs >= 1_000_00) {
    return `${sign}S/ ${(abs / 1_000_00).toFixed(1)}k`;
  }
  return formatMoney(minor);
}

/** Parsea input del usuario "10.50" → 1050 centavos. */
export function parseMoneyInput(s: string): number {
  const clean = s.replace(/,/g, '').trim();
  if (!clean || isNaN(Number(clean))) return 0;
  const [intPart, decPart = ''] = clean.split('.');
  const intVal = parseInt(intPart || '0', 10) || 0;
  const decStr = decPart.padEnd(2, '0').slice(0, 2);
  const decVal = parseInt(decStr, 10) || 0;
  return intVal * 100 + decVal;
}

/** Devuelve el valor en soles para mostrar en un input ("10.50"). */
export function minorToInputStr(minor: number): string {
  const abs = Math.abs(minor);
  return `${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`;
}

export const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function formatPeriod(year: number, month: number): string {
  return `${MONTHS_ES[month - 1]} ${year}`;
}
