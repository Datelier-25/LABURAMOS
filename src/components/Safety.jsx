import { AlertTriangle, ArrowRight, Banknote, FileText, Handshake, IdCard, MessageCircle, ShieldAlert, ShieldCheck } from 'lucide-react';

const ANTES = [
  {
    icon: MessageCircle,
    title: 'Pedí referencias',
    text: 'Preguntá por trabajos anteriores, pedí el nombre de alguien que ya haya trabajado ahí y llamalo. Un comercio serio no tiene problema en darte referencias.',
  },
  {
    icon: FileText,
    title: 'Dejá todo por escrito',
    text: 'Antes de empezar, acordá por WhatsApp: tareas, horario, sueldo y forma de pago. Ese chat es tu comprobante si después hay diferencias.',
  },
  {
    icon: Handshake,
    title: 'Conocé el lugar',
    text: 'Para trabajos presenciales, andá a ver el lugar y hablá con alguien del comercio. Si insisten en manejarse solo por mensajes, prestá atención.',
  },
  {
    icon: IdCard,
    title: 'No entregues documentos originales',
    text: 'Nadie necesita tu DNI en la mano ni fotos de tu tarjeta. Para un contrato alcanza con los datos, nunca con los originales.',
  },
  {
    icon: Banknote,
    title: 'No pagues por adelantado',
    text: 'Un trabajo no se cobra: se paga. Si te piden plata para "reservar el puesto", por un uniforme, una capacitación o un "seguro", es una estafa.',
  },
];

const ALERTAS = [
  'Te piden dinero por adelantado, por transferencia o por un link de pago.',
  'Te ofrecen un sueldo muy por encima del mercado y mucha urgencia para empezar.',
  'Te piden fotos de tu DNI, de tu tarjeta o códigos que llegan por mensaje.',
  'Te dicen que te depositaron de más y te piden devolver la diferencia.',
  'Te piden instalar una aplicación o entrar a un link para "registrarte".',
  'El aviso no tiene dirección, el nombre del comercio no coincide y evitan las llamadas.',
];

export default function Safety({ go }) {
  return (
    <section className="wrap page safety">
      <header className="page-head">
        <div>
          <h1 className="page-title">Consejos para operar seguro</h1>
          <p className="lede">
            En LaburamosApp el contacto es directo entre las partes y los acuerdos los arreglan ustedes. Por eso, estos recaudos te
            cubren mejor que cualquier intermediario.
          </p>
        </div>
      </header>

      <div className="safety-hero">
        <ShieldCheck size={30} aria-hidden="true" />
        <p>
          <b>LaburamosApp nunca te va a pedir dinero, contraseñas ni datos de tarjeta por WhatsApp.</b> Si alguien dice ser de la app y
          te pide algo así, es un engaño.
        </p>
      </div>

      <h2 className="block-title">Antes de empezar</h2>
      <div className="safety-grid">
        {ANTES.map(({ icon: Icon, title, text }) => (
          <article className="safety-card" key={title}>
            <span className="safety-ic" aria-hidden="true">
              <Icon size={20} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <h2 className="block-title">Señales de alerta</h2>
      <div className="safety-warn">
        <span className="safety-ic warn" aria-hidden="true">
          <ShieldAlert size={20} />
        </span>
        <div>
          <p>
            Si aparece alguna de estas situaciones, <b>frená</b>: no mandes dinero ni datos y cortá el contacto.
          </p>
          <ul>
            {ALERTAS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="block-title">Si publicás un aviso</h2>
      <div className="safety-two">
        <div>
          <h3>Para comercios y vecinos</h3>
          <ul>
            <li>Pedí el CV y una referencia antes de tomar a alguien.</li>
            <li>No pidas dinero, documentos originales ni datos bancarios.</li>
            <li>Cumplí lo acordado: sueldo, horario y condiciones.</li>
            <li>Si la persona no cumplió, no la expongas en público: calificala y seguí adelante.</li>
          </ul>
        </div>
        <div>
          <h3>Para quien busca trabajo</h3>
          <ul>
            <li>Desconfiá de los pagos por adelantado, en cualquier forma.</li>
            <li>Pedí que el acuerdo quede por escrito en WhatsApp.</li>
            <li>Contale a alguien dónde vas y a qué hora volvés.</li>
            <li>Si algo no cierra, calificá la experiencia: ayuda al que viene.</li>
          </ul>
        </div>
      </div>

      <h2 className="block-title">Qué hace la app por vos</h2>
      <div className="safety-grid three">
        <article className="safety-card">
          <span className="safety-ic" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <h3>Comercios verificados</h3>
          <p>Solo los comercios aprobados por el administrador pueden abrir los CVs de quienes se postulan.</p>
        </article>
        <article className="safety-card">
          <span className="safety-ic" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <h3>Reseñas de ambas partes</h3>
          <p>Después de una postulación, cada parte puede calificar a la otra. La reputación queda a la vista.</p>
        </article>
        <article className="safety-card">
          <span className="safety-ic" aria-hidden="true">
            <ShieldAlert size={20} />
          </span>
          <h3>Cuentas bloqueadas</h3>
          <p>Si alguien abusa, el administrador puede bloquear la cuenta y pausar sus publicaciones al instante.</p>
        </article>
      </div>

      <div className="safety-cta">
        <button className="btn btn-ink btn-lg" onClick={() => go('laburos')}>
          Ver laburos <ArrowRight size={18} aria-hidden="true" />
        </button>
        <button className="btn btn-line btn-lg" onClick={() => go('oficios')}>
          Ver oficios
        </button>
      </div>
    </section>
  );
}
