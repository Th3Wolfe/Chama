import { Megaphone } from 'lucide-react';
import { AppLayout } from '../components/Layout/AppLayout';

export function Comunicados() {
  return (
    <AppLayout titulo="Comunicados" subtitulo="Novidades e manutenções programadas">
      <div className="card placeholder-page">
        <span className="placeholder-page__icon"><Megaphone size={36} strokeWidth={1.75} /></span>
        <h2 className="placeholder-page__title">Em construção</h2>
        <p className="placeholder-page__desc">
          Em breve os avisos da equipe de TI — manutenções programadas, indisponibilidades
          e novidades do sistema — vão aparecer aqui.
        </p>
      </div>
    </AppLayout>
  );
}
