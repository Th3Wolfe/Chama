/** Formata uma data ISO como "hoje", "ontem", "há N dias/semanas/meses/anos". */
export function tempoRelativoDias(iso: string): string {
  const agora = new Date();
  const data = new Date(iso);
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicioData = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const diffDias = Math.round((inicioHoje.getTime() - inicioData.getTime()) / 86400000);

  if (diffDias <= 0) return 'hoje';
  if (diffDias === 1) return 'ontem';
  if (diffDias < 7) return `há ${diffDias} dias`;
  if (diffDias < 30) {
    const semanas = Math.floor(diffDias / 7);
    return semanas === 1 ? 'há 1 semana' : `há ${semanas} semanas`;
  }
  if (diffDias < 365) {
    const meses = Math.floor(diffDias / 30);
    return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
  }
  const anos = Math.floor(diffDias / 365);
  return anos === 1 ? 'há 1 ano' : `há ${anos} anos`;
}
