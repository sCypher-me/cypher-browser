// Elemento da biblioteca electron-chrome-extensions: botões das extensões (ação e popup).
import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'browser-action-list': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { partition?: string; tab?: string; alignment?: string };
    }
  }
}
