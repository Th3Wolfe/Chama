import { IconPicker } from './IconPicker';
import { SETOR_ICONES_PRINCIPAIS, SETOR_ICONES_EXTRA } from '../utils/setorIcones';

export function SetorIconPicker({
  selecionado,
  onSelecionar,
}: {
  selecionado: string;
  onSelecionar: (chave: string) => void;
}) {
  return (
    <IconPicker
      principais={SETOR_ICONES_PRINCIPAIS}
      extras={SETOR_ICONES_EXTRA}
      selecionado={selecionado}
      onSelecionar={onSelecionar}
    />
  );
}
