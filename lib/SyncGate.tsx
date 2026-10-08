// iOS / Android : les données sont locales (SQLite), rien à attendre.
// La version web (SyncGate.web.tsx) charge les données depuis le serveur avant d'afficher l'appli.
import { useState, type ReactNode } from 'react';

type Props = { onReady: () => void; children: ReactNode };

export default function SyncGate({ onReady, children }: Props) {
  useState(() => onReady()); // une seule fois, au premier affichage
  return <>{children}</>;
}
