import Logo from './Logo';

// Pantalla que se muestra cuando faltan las variables de Supabase en Vite.
// Evita que la app intente conectarse a una base equivocada y explica qué hacer.
export default function ConfigScreen() {
  return (
    <main
      style={{
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'var(--mist, #f4f7fb)',
      }}
    >
      <section
        style={{
          width: 'min(680px, 100%)',
          background: '#fff',
          border: '1px solid var(--line, #dbe3ef)',
          borderRadius: '18px',
          padding: 'clamp(24px, 5vw, 40px)',
          boxShadow: '0 20px 60px rgba(10, 30, 60, .10)',
        }}
      >
        <div style={{ marginBottom: 22 }}><Logo size={38} /></div>
        <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)', lineHeight: 1.1, margin: '0 0 10px' }}>
          Falta conectar Supabase
        </h1>
        <p style={{ color: 'var(--muted, #53627a)', lineHeight: 1.55, margin: '0 0 20px' }}>
          La app está lista, pero todavía no tiene la URL y la clave pública de un
          proyecto Supabase. Hasta configurarlas no se puede iniciar sesión ni leer
          datos.
        </p>

        <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
          Creá un archivo <code>.env</code> en la raíz del proyecto:
        </p>
        <pre
          style={{
            margin: '0 0 20px',
            padding: '14px 16px',
            borderRadius: '10px',
            background: '#0d1b2f',
            color: '#eaf2ff',
            overflowX: 'auto',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {`VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY`}
        </pre>

        <ol style={{ color: 'var(--muted, #53627a)', lineHeight: 1.65, paddingLeft: 22, margin: '0 0 20px' }}>
          <li>Crealo al lado de <code>package.json</code>, no dentro de <code>src/</code>.</li>
          <li>Usá la URL y la clave <strong>anon / publishable</strong> de un Supabase nuevo y vacío.</li>
          <li>Reiniciá Vite o el preview de StackBlitz.</li>
        </ol>

        <p style={{ margin: 0, color: 'var(--muted, #53627a)', fontSize: 14, lineHeight: 1.55 }}>
          No uses la base de Workeo. La guía completa está en{' '}
          <code>supabase/INSTALACION_NUEVA.md</code>.
        </p>
      </section>
    </main>
  );
}
