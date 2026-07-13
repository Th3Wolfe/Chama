import { IconPicker } from './IconPicker';
import { CATEGORIA_ICONES_PRINCIPAIS, CATEGORIA_ICONES_EXTRA } from '../utils/categoriaIcones';

export function CategoriaIconPicker({
  selecionado,
  onSelecionar,
}: {
  selecionado: string;
  onSelecionar: (chave: string) => void;
}) {
  return (
    <IconPicker
      principais={CATEGORIA_ICONES_PRINCIPAIS}
      extras={CATEGORIA_ICONES_EXTRA}
      selecionado={selecionado}
      onSelecionar={onSelecionar}
    />
  );
}
