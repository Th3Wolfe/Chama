interface ToggleProps {
  ativo: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
  label?: string;
}

/** Interruptor liga/desliga usado em formulários (ex: "Categoria ativa"). */
export function Toggle({ ativo, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${ativo ? 'toggle--ligado' : ''}`}
      onClick={() => onChange(!ativo)}
    >
      <span className="toggle__bolinha" />
    </button>
  );
}
