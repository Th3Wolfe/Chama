import { BookOpen } from 'lucide-react';
import { AppLayout } from '../components/Layout/AppLayout';

export function BaseConhecimento() {
  return (
    <AppLayout titulo="Base de conhecimento" subtitulo="Respostas rápidas para problemas comuns">
      <div className="card placeholder-page">
        <span className="placeholder-page__icon"><BookOpen size={36} strokeWidth={1.75} /></span>
        <h2 className="placeholder-page__title">Em construção</h2>
        <p className="placeholder-page__desc">
          Em breve você vai encontrar aqui artigos e tutoriais para resolver os problemas
          de TI mais comuns sem precisar abrir um chamado. Por enquanto, se precisar de
          ajuda, abra um chamado com a equipe de TI.
        </p>
      </div>
    </AppLayout>
  );
}
