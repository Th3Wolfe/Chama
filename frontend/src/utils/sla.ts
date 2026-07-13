export interface SlaInfo {
  texto: string;
  vencido: boolean;
  critico: boolean; // vencido ou vencendo em menos de 30min
}

export function formatarSla(segundos: number | null | undefined): SlaInfo | null {
  if (segundos === null || segundos === undefined) return null;
  const vencido = segundos < 0;
  const abs = Math.abs(segundos);
  const horas = Math.floor(abs / 3600);
  const minutos = Math.round((abs % 3600) / 60);
  const texto = horas > 0 ? `${horas}h ${minutos}min` : `${minutos} min`;
  return { texto, vencido, critico: vencido || segundos < 1800 };
}
