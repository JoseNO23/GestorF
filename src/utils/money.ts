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

export const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function formatPeriod(year: number, month: number): string {
  return `${MONTHS_ES[month - 1]} ${year}`;
}
