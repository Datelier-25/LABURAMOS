import { Component } from 'react';

// Red de seguridad: si una vista falla al renderizar, en lugar de dejar la
// pantalla en blanco (y la app desmontada) mostramos un aviso con salida.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error inesperado en la app:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="wrap page">
        <header className="page-head">
          <div>
            <h1 className="page-title">Algo falló</h1>
            <p className="lede">No pudimos mostrar esta pantalla. Podés volver al inicio o recargar; si el problema sigue, avisanos.</p>
          </div>
        </header>
        <div style={{ display: 'grid', gap: 10, maxWidth: 320 }}>
          <button className="btn btn-ink" onClick={() => window.location.assign('/')}>
            Volver al inicio
          </button>
          <button className="btn btn-line" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </section>
    );
  }
}
