import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';
import Logo from './Logo';

// Se muestra cuando la persona entra desde el enlace de "Olvidé mi contraseña"
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (password !== repeat) {
      setMessage({ type: 'err', text: 'Las contraseñas no coinciden.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setMessage({ type: 'err', text: friendlyError(error.message) });
    else setDone(true);
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <span className="brand">
          <Logo variant="claro" size={48} />
        </span>
        <h1>
          Elegí tu <em>contraseña nueva.</em>
        </h1>
        <div />
      </div>
      <div className="auth-form">
        <div className="auth-box">
          {done ? (
            <>
              <h2>Listo</h2>
              <p>Tu contraseña se cambió y ya tenés la sesión iniciada.</p>
              <button className="btn btn-ink btn-lg btn-block" onClick={onDone}>
                Entrar a LaburamosApp
              </button>
            </>
          ) : (
            <>
              <h2>Contraseña nueva</h2>
              <p>Escribí una contraseña de al menos 6 caracteres.</p>
              {message && <p className={`note ${message.type}`}>{message.text}</p>}
              <form onSubmit={handleSubmit}>
                <label className="field">
                  <span>Contraseña nueva</span>
                  <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                <label className="field">
                  <span>Repetila</span>
                  <input type="password" required minLength={6} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
                </label>
                <button className="btn btn-ink btn-lg btn-block" disabled={loading}>
                  {loading ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
