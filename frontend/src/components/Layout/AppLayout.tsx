import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastHost } from '../Toast';

export function AppLayout({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <ToastHost />
      <Sidebar />
      <div className="content-area">
        <Topbar titulo={titulo} subtitulo={subtitulo} />
        <div className="page">
          <div className="page__inner">{children}</div>
        </div>
      </div>
    </div>
  );
}
