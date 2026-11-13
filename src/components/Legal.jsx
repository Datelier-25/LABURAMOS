import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Cookie,
  FileText,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { COOKIE_CATEGORIES } from '../lib/cookies';
import { LEGAL_DOCS, LEGAL_VERSION, legalDate, legalOperator, mailtoLegal, openCookieSettings } from '../lib/legal';

function DocHead({ doc, operator, go }) {
  return (
    <header className="legal-head">
      <button type="button" className="legal-back" onClick={() => go?.('home')}>
        <ArrowLeft size={16} aria-hidden="true" /> Volver al inicio
      </button>
      <p className="legal-kicker">Documentos legales de LaburamosApp</p>
      <h1 className="page-title">{doc.title}</h1>
      <p className="lede">{doc.description}</p>
      <p className="legal-meta">
        Versión {LEGAL_VERSION} · Última actualización: {legalDate(operator.lastUpdate)}
      </p>
    </header>
  );
}

function OperatorBox({ operator }) {
  return (
    <aside className="legal-box" aria-label="Datos del responsable">
      <h2>Responsable del sitio</h2>
      <p>
        <b>{operator.name || 'LaburamosApp'}</b>
        {operator.cuit ? ` · CUIT ${operator.cuit}` : ''}
      </p>
      {operator.address && <p>{operator.address}</p>}
      <p>
        Correo legal:{' '}
        <a href={mailtoLegal(operator.email, 'Consulta legal - LaburamosApp', 'Hola, les escribo por:')}>{operator.email}</a>
      </p>
      <p className="legal-small">
        LaburamosApp es una plataforma de avisos y contacto directo. No es una agencia de empleo ni interviene en los acuerdos entre
        las personas.
      </p>
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Terms({ operator, go }) {
  return (
    <>
      <OperatorBox operator={operator} />
      <Section title="1. Qué es LaburamosApp y qué aceptás">
        <p>
          LaburamosApp es un sitio y una aplicación para publicar avisos de trabajo, ofrecer oficios y servicios, armar un CV y
          contactar a otras personas. Al crear una cuenta, publicar, postularte, contratar un anuncio o descargar tu CV, aceptás estos
          Términos y la <a href="/privacidad">Política de Privacidad</a>.
        </p>
        <p>
          Si no estás de acuerdo, no uses el servicio. Podés mirar avisos sin cuenta; para publicar, postularte, guardar avisos o
          contratar anuncios necesitás una cuenta.
        </p>
      </Section>

      <Section title="2. Quién puede usar la app">
        <p>
          Podés crear una cuenta si tenés al menos 18 años y capacidad para contratar. Si representás a un comercio, declarás que
          tenés facultades para obligarlo. No se permiten cuentas de personas menores de edad ni suplantaciones de identidad.
        </p>
      </Section>

      <Section title="3. Tu cuenta y tu seguridad">
        <ul>
          <li>Tenés que dar datos verdaderos, actualizados y propios. No podés usar el correo o el teléfono de otra persona sin permiso.</li>
          <li>La contraseña es personal. Si sospechás que alguien entró a tu cuenta, cambiala y escribinos.</li>
          <li>Podemos pedirte una verificación (por ejemplo, del comercio o del oficio) para mostrar un sello de confianza.</li>
          <li>Podés eliminar tu cuenta desde “Mi perfil”. La eliminación borra tus datos y publicaciones, salvo los registros que la ley obliga a conservar.</li>
        </ul>
      </Section>

      <Section title="4. Cómo funciona el contacto">
        <p>
          LaburamosApp acerca a quien busca trabajo, contrata o necesita un servicio con quien lo ofrece. El contacto es directo por
          WhatsApp, correo o el canal que el aviso indique. <b>No somos parte del acuerdo</b>, no fijamos salarios, no cobramos
          comisiones por contratar y no garantizamos que una búsqueda termine en una contratación.
        </p>
        <p>
          Antes de aceptar un trabajo, verificá identidad, domicilio, condiciones y pagos. En la sección{' '}
          <button type="button" className="legal-inline-link" onClick={() => go?.('seguridad')}>
            Consejos de seguridad
          </button>{' '}
          hay pautas para evitar estafas.
        </p>
      </Section>

      <Section title="5. Tus publicaciones y tu contenido">
        <ul>
          <li>El contenido que publicás es tuyo. Nos das una licencia gratuita, no exclusiva y limitada para mostrarlo, almacenarlo, moderarlo y compartirlo dentro de la app y en enlaces de vista previa.</li>
          <li>Garantizás que el texto, las fotos, los videos, los logos y los enlaces son tuyos o que tenés autorización suficiente para usarlos. No podés subir imágenes de otras personas sin su consentimiento.</li>
          <li>Las publicaciones tienen que ser verdaderas, actuales y referidas a una oferta o servicio real. No se permite duplicar avisos para aparecer más veces.</li>
          <li>Podemos acortar, editar, pausar o eliminar contenido que incumpla estos Términos o la ley, y avisarte cuando sea razonable.</li>
        </ul>
        <div className="legal-callout">
          <BadgeCheck size={18} aria-hidden="true" />
          <p>
            <b>Derechos de imagen.</b> Si subís una foto o un video, declarás que tenés los derechos o el permiso de las personas que
            aparecen. Si recibimos una denuncia fundada, podemos dar de baja el contenido y pedirte que acredites la autorización.
          </p>
        </div>
      </Section>

      <Section title="6. Conductas prohibidas">
        <p>No está permitido:</p>
        <ul>
          <li>Publicar avisos falsos, engañosos, discriminatorios, violentos, sexuales, ilegales o que pidan dinero por adelantado para conseguir un trabajo.</li>
          <li>Suplantar personas, comercios o marcas; acosar, amenazar o divulgar datos privados de terceros.</li>
          <li>Ofrecer empleo a menores, trata de personas, trabajo no registrado engañoso o cualquier actividad prohibida.</li>
          <li>Usar la app para spam, scraping, virus, intentos de acceso no autorizado o sobrecargar el servicio.</li>
          <li>Subir material protegido por derechos de autor sin autorización.</li>
        </ul>
      </Section>

      <Section title="7. Anuncios publicitarios">
        <ul>
          <li>Los anuncios se revisan antes de publicarse. Podemos rechazarlos o pedir cambios si el contenido no cumple la ley o estas reglas.</li>
          <li>El precio y la duración se muestran antes de contratar. El pago se acredita de forma manual o por el medio que indique la app; el anuncio empieza cuando está aprobado y pago.</li>
          <li>No garantizamos una cantidad de vistas, clics o ventas. Las métricas son informativas y solo las ve el anunciante y el administrador.</li>
          <li>El anunciante es responsable del contenido, de la veracidad de la oferta y de los derechos de las imágenes o videos que sube.</li>
        </ul>
      </Section>

      <Section title="8. CV y descargas pagas">
        <p>
          Armar y guardar el CV es gratis. La descarga en PDF puede tener un costo que se muestra antes de pagar. El pago se procesa
          con Mercado Pago; no guardamos los datos de tu tarjeta. El acceso puede ser por cantidad de descargas o por un plazo, según
          la configuración vigente.
        </p>
        <p>
          El precio se informa en pesos argentinos antes de confirmar. Si el pago no se acredita, no se te habilita la descarga. Las
          condiciones de reembolso y el derecho de arrepentimiento están en la <a href="/reembolsos">Política de Reembolsos</a>.
        </p>
      </Section>

      <Section title="9. Precios, pagos y facturación">
        <ul>
          <li>Los precios se muestran en pesos argentinos (ARS) y son los vigentes al momento de contratar.</li>
          <li>Cuando corresponda, el precio incluye impuestos. Si un error evidente de precio o de sistema permite contratar en condiciones manifiestamente incorrectas, podemos cancelar la operación y devolver lo pagado.</li>
          <li>Los pagos los procesa Mercado Pago o el proveedor informado. Podemos pedir un comprobante para acreditar una transferencia manual.</li>
        </ul>
      </Section>

      <Section title="10. Propiedad intelectual de la plataforma">
        <p>
          La marca, el diseño, los textos, los íconos y el código de LaburamosApp pertenecen a sus titulares o se usan con licencia.
          No podés copiarlos, modificarlos ni usarlos para crear un servicio que se confunda con este, salvo autorización escrita.
        </p>
      </Section>

      <Section title="11. Moderación, suspensión y baja">
        <p>
          Podemos suspender o eliminar cuentas y contenidos ante incumplimientos, denuncias verosímiles, riesgo de fraude o pedidos de
          autoridades. Cuando sea posible, avisamos y damos la chance de corregir. Podés eliminar tu cuenta cuando quieras desde “Mi
          perfil”.
        </p>
      </Section>

      <Section title="12. Responsabilidad">
        <p>
          Hacemos lo razonable para que la app funcione y para moderar el contenido, pero no podemos garantizar disponibilidad
          ininterrumpida ni la conducta de todas las personas. En la medida permitida por la ley, no respondemos por acuerdos, pagos o
          daños entre usuarios. <b>Nada de esto limita los derechos que la Ley de Defensa del Consumidor te reconoce.</b>
        </p>
      </Section>

      <Section title="13. Servicios de terceros y enlaces">
        <p>
          La app usa Supabase, Cloudflare, Mercado Pago y enlaces a WhatsApp u otros sitios. Cada servicio tiene sus propias condiciones
          y políticas. No controlamos ni respondemos por sitios de terceros.
        </p>
      </Section>

      <Section title="14. Cambios">
        <p>
          Podemos actualizar estos Términos por cambios legales o del servicio. Publicamos la versión nueva con su fecha y, si el cambio
          es relevante, te avisamos por correo o dentro de la app antes de que rija. Si no aceptás, podés dejar de usar el servicio y
          eliminar tu cuenta.
        </p>
      </Section>

      <Section title="15. Ley aplicable y reclamos">
        <p>
          Estos Términos se rigen por las leyes de la República Argentina, en especial la Ley 24.240 de Defensa del Consumidor y el
          Código Civil y Comercial. Podés reclamar ante los organismos de defensa del consumidor de tu jurisdicción o ante la
          Ventanilla Única Federal de Defensa del Consumidor. Para datos personales, la autoridad de aplicación es la Agencia de Acceso
          a la Información Pública (AAIP).
        </p>
      </Section>

      <Section title="16. Contacto">
        <p>
          Escribinos a <a href={mailtoLegal(operator.email, 'Consulta sobre los Términos - LaburamosApp', 'Hola, les escribo por:')}>{operator.email}</a>{' '}
          o por el Instagram oficial. Respondemos en un plazo razonable y, cuando la ley fija uno, dentro de ese plazo.
        </p>
      </Section>
    </>
  );
}

function Privacy({ operator, go }) {
  return (
    <>
      <OperatorBox operator={operator} />
      <div className="legal-summary">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          <b>En resumen:</b> pedimos solo los datos necesarios para que puedas publicar, postularte y contactarte. No vendemos datos.
          Podés acceder, corregir o eliminar tu cuenta y tus datos desde la app o escribiéndonos.
        </p>
      </div>

      <Section title="1. Responsable del tratamiento">
        <p>
          El responsable es {operator.name || 'LaburamosApp'}{operator.cuit ? ` (CUIT ${operator.cuit})` : ''}
          {operator.address ? `, con domicilio en ${operator.address}` : ', con domicilio en la República Argentina'}. Para cualquier
          consulta o reclamo sobre datos personales, escribí a{' '}
          <a href={mailtoLegal(operator.email, 'Datos personales - LaburamosApp', 'Hola, quiero ejercer un derecho sobre mis datos:')}>{operator.email}</a>.
        </p>
      </Section>

      <Section title="2. Qué datos tratamos">
        <h3>Cuenta</h3>
        <ul>
          <li>Nombre o nombre del comercio, correo electrónico, contraseña (guardada de forma cifrada por Supabase), tipo de cuenta y localidad/provincia.</li>
          <li>Fecha de alta, estado de verificación, bloqueo y, si corresponde, condición de administrador.</li>
        </ul>
        <h3>Perfil y CV</h3>
        <ul>
          <li>WhatsApp, foto de perfil, profesión u oficio, presentación, habilidades, experiencia, educación, disponibilidad y enlaces.</li>
          <li>Barrio y fecha de nacimiento son <b>opcionales</b>: solo se muestran si decidís completarlos.</li>
        </ul>
        <h3>Publicaciones y postulaciones</h3>
        <ul>
          <li>Avisos y servicios: título, descripción, categoría, localidad, teléfono, fotos, enlaces y condiciones.</li>
          <li>Postulaciones: CV elegido, nombre, teléfono, correo y el aviso al que te postulaste.</li>
        </ul>
        <h3>Anuncios y pagos</h3>
        <ul>
          <li>Anuncios: título, anunciante, video o imagen, enlace, duración, estado de revisión y de pago.</li>
          <li>Compras de CV: importe, estado, identificadores de Mercado Pago y fechas. <b>No recibimos ni guardamos el número de tu tarjeta.</b></li>
        </ul>
        <h3>Consultas, denuncias y seguridad</h3>
        <ul>
          <li>Mensajes que enviás por sugerencias o denuncias, y el aviso al que se refieren.</li>
          <li>Registros técnicos: dirección IP, navegador, fecha y página desde la que aceptaste los documentos, para seguridad y prueba del consentimiento.</li>
          <li>Preferencias guardadas en tu navegador (sesión, zona, avisos guardados y cookies).</li>
        </ul>
      </Section>

      <Section title="3. Para qué usamos los datos y con qué base legal">
        <ul>
          <li><b>Crear y mantener tu cuenta, publicar y contactarte:</b> ejecución del contrato y tu consentimiento.</li>
          <li><b>Mostrar tu CV a comercios cuando te postulás:</b> tu consentimiento al enviar la postulación.</li>
          <li><b>Procesar pagos y emitir comprobantes:</b> ejecución del contrato y obligaciones legales/contables.</li>
          <li><b>Moderar, prevenir fraudes y cuidar la seguridad:</b> interés legítimo y cumplimiento legal.</li>
          <li><b>Responder consultas y reclamos:</b> tu consentimiento y obligaciones legales.</li>
          <li><b>Mejorar la app:</b> datos agregados o anónimos; si usáramos analítica con cookies, pediríamos consentimiento.</li>
        </ul>
        <p>No usamos tus datos para decisiones automatizadas que produzcan efectos legales ni para vender perfiles.</p>
      </Section>

      <Section title="4. Datos sensibles y mínimos">
        <p>
          No pedimos DNI, datos de salud, religión, ideología, vida sexual ni datos biométricos. Te pedimos que no los publiques en
          avisos, CV o mensajes. Si aparecen por error, podés pedir su eliminación. Pedimos solo los datos necesarios para cada
          finalidad; los campos opcionales están marcados como tales.
        </p>
      </Section>

      <Section title="5. Quién puede ver tus datos">
        <ul>
          <li><b>Otros usuarios:</b> ven lo que publicás (avisos, servicios, perfil público del CV y reseñas). Tu correo de cuenta no se muestra.</li>
          <li><b>Comercios:</b> ven tu postulación y el CV que elegiste enviar.</li>
          <li><b>Administradores:</b> acceden a los datos necesarios para moderar, verificar cuentas, gestionar pagos y atender denuncias.</li>
          <li><b>Proveedores:</b> Supabase (base de datos, autenticación y archivos), Cloudflare (hosting y CDN), Mercado Pago (pagos), Google Fonts (tipografías) y WhatsApp o tu correo cuando decidís contactar.</li>
          <li><b>Autoridades:</b> cuando existe una obligación legal o una orden válida.</li>
        </ul>
        <p>
          Algunos proveedores pueden alojar datos fuera de Argentina. En esos casos se aplican las garantías contractuales y de
          seguridad del proveedor. No vendemos ni alquilamos datos personales.
        </p>
      </Section>

      <Section title="6. Cuánto tiempo conservamos los datos">
        <ul>
          <li><b>Cuenta y perfil:</b> mientras la cuenta esté activa. Si la eliminás, se borran o se anonimizan.</li>
          <li><b>Avisos, servicios y CV:</b> hasta que venzan, los elimines o elimines tu cuenta.</li>
          <li><b>Postulaciones:</b> mientras la cuenta esté activa o hasta 12 meses desde el envío, salvo que las borres antes.</li>
          <li><b>Compras de CV:</b> se conservan sin tu usuario como registro contable, por el plazo legal aplicable (hasta 10 años).</li>
          <li><b>Denuncias y consultas:</b> hasta 2 años, o más si hay un reclamo en curso.</li>
          <li><b>Registros de consentimiento:</b> mientras sean necesarios para demostrar la aceptación; si eliminás la cuenta, quedan sin tu identificador directo.</li>
          <li><b>Registros técnicos de seguridad:</b> hasta 90 días, salvo investigación de incidentes.</li>
        </ul>
      </Section>

      <Section title="7. Tus derechos">
        <p>
          De acuerdo con la Ley 25.326, podés pedir acceso, rectificación, actualización, supresión y confidencialidad de tus datos, y
          oponerte a un tratamiento. También podés retirar tu consentimiento cuando el tratamiento se base en él.
        </p>
        <ul>
          <li>Desde “Mi perfil” podés corregir tus datos y eliminar tu cuenta.</li>
          <li>Para otros pedidos, escribí a <a href={mailtoLegal(operator.email, 'Derechos sobre datos personales - LaburamosApp', 'Hola, quiero ejercer el derecho de:')}>{operator.email}</a> con tu nombre y el correo de la cuenta.</li>
          <li>Respondemos dentro de los plazos de la ley. El ejercicio es gratuito.</li>
          <li>Si no quedás conforme, podés reclamar ante la Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley 25.326.</li>
        </ul>
      </Section>

      <Section title="8. Seguridad">
        <p>
          Usamos conexiones cifradas (HTTPS), autenticación, permisos por fila en la base, archivos privados para los CV y registros de
          acceso. Ningún sistema es infalible. Si ocurre un incidente que afecte tus datos, lo investigamos y notificamos a las personas
          afectadas y a la autoridad cuando corresponda.
        </p>
      </Section>

      <Section title="9. Menores de edad">
        <p>
          El servicio es para mayores de 18 años. No recopilamos datos de menores de forma consciente. Si detectamos una cuenta de una
          persona menor, la damos de baja y eliminamos los datos asociados. Si creés que hay datos de un menor, escribinos.
        </p>
      </Section>

      <Section title="10. Cookies y almacenamiento local">
        <p>
          Usamos almacenamiento necesario para la sesión y tus preferencias. Las categorías opcionales están desactivadas por defecto.
          Podés ver el detalle y cambiar tus preferencias en la <a href="/cookies">Política de Cookies</a>.
        </p>
        <button type="button" className="btn btn-line btn-sm" onClick={openCookieSettings}>
          <Cookie size={15} aria-hidden="true" /> Configurar cookies
        </button>
      </Section>

      <Section title="11. Cambios a esta política">
        <p>
          Podemos actualizarla por cambios legales o del servicio. Publicamos la versión nueva con su fecha y, si el cambio es
          relevante, te avisamos antes de que rija. La versión que aceptaste queda registrada.
        </p>
      </Section>

      <Section title="12. Contacto">
        <p>
          Responsable de datos: {operator.name || 'LaburamosApp'}. Correo:{' '}
          <a href={mailtoLegal(operator.email, 'Privacidad - LaburamosApp', 'Hola, les escribo por la Política de Privacidad:')}>{operator.email}</a>.
          También podés usar la sección{' '}
          <button type="button" className="legal-inline-link" onClick={() => go?.('contacto')}>
            Sugerencias y denuncias
          </button>{' '}
          de la app.
        </p>
      </Section>
    </>
  );
}

function Cookies({ operator }) {
  return (
    <>
      <OperatorBox operator={operator} />
      <div className="legal-summary">
        <Cookie size={20} aria-hidden="true" />
        <p>
          <b>Respuesta corta:</b> hoy solo usamos almacenamiento necesario para que la app funcione y recuerde tus preferencias. Eso no
          requiere consentimiento previo. Las categorías de analítica y publicidad están desactivadas y, si las activamos, te las vamos
          a pedir antes.
        </p>
      </div>

      <Section title="1. Qué son las cookies y el almacenamiento local">
        <p>
          Las cookies son archivos pequeños que un sitio guarda en tu navegador. El almacenamiento local (localStorage) cumple una
          función parecida: guarda datos en tu dispositivo para que la app recuerde la sesión o tus preferencias. En esta política
          hablamos de “cookies” para referirnos a ambos.
        </p>
      </Section>

      <Section title="2. Qué usa hoy LaburamosApp">
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Para qué</th>
                <th>¿Requiere consentimiento?</th>
              </tr>
            </thead>
            <tbody>
              {COOKIE_CATEGORIES.map((category) => (
                <tr key={category.id}>
                  <td><b>{category.title}</b></td>
                  <td>{category.text}</td>
                  <td>{category.required ? 'No: es necesaria' : 'Sí, y está desactivada por defecto'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Claves que podemos guardar en tu navegador</h3>
        <ul>
          <li><code>sb-*-auth-token</code>: sesión de Supabase, para que no tengas que ingresar en cada visita.</li>
          <li><code>laburamos_cookies_v1</code>: tu decisión sobre cookies y su fecha.</li>
          <li><code>laburamos_bienvenida_vista</code>: si ya viste el cartel de bienvenida.</li>
          <li>Claves de zona, avisos guardados, servicios guardados y control de anuncios vistos.</li>
        </ul>
      </Section>

      <Section title="3. Cookies de terceros">
        <p>
          Supabase y Cloudflare pueden usar almacenamiento técnico para autenticación, seguridad y entrega del sitio. Google Fonts
          entrega las tipografías y puede registrar la IP de la conexión. WhatsApp y Mercado Pago se abren recién cuando decidís
          contactar o pagar, y ahí se aplican sus propias políticas. No hay píxeles publicitarios ni herramientas de analítica activas.
        </p>
      </Section>

      <Section title="4. Cómo aceptar, rechazar o cambiar tu decisión">
        <p>
          Cuando entrás por primera vez, ves un aviso con tres opciones: aceptar todas, usar solo las necesarias o configurar. Podés
          cambiar la decisión cuando quieras desde este botón o desde el pie de página:
        </p>
        <p>
          <button type="button" className="btn btn-ink btn-sm" onClick={openCookieSettings}>
            <Cookie size={15} aria-hidden="true" /> Configurar mis cookies
          </button>
        </p>
        <p>
          También podés borrar las cookies y el almacenamiento local desde la configuración de tu navegador. Si bloqueás las necesarias,
          es posible que no puedas iniciar sesión o guardar preferencias.
        </p>
      </Section>

      <Section title="5. ¿Necesito consentimiento en Argentina?">
        <p>
          La Ley 25.326 protege los datos personales y exige consentimiento informado para tratarlos, con excepciones. Las cookies
          estrictamente necesarias para prestar el servicio no requieren consentimiento previo porque sin ellas la app no funciona. Las
          cookies de analítica, publicidad o seguimiento sí lo requieren. Por eso las dejamos desactivadas hasta que las aceptes.
        </p>
        <p>
          Si la persona navega desde la Unión Europea, también puede aplicar el Reglamento General de Protección de Datos (RGPD) y la
          Directiva ePrivacy, que exigen consentimiento previo para cookies no esenciales. Nuestro aviso sigue el criterio más protector:
          nada opcional se activa solo.
        </p>
      </Section>

      <Section title="6. Conservación y cambios">
        <p>
          La decisión de cookies se guarda hasta que la cambies o borres los datos del navegador. Los registros de consentimiento se
          conservan como prueba. Si cambiamos las categorías o sumamos un proveedor, actualizamos esta política y volvemos a pedir tu
          decisión cuando corresponda.
        </p>
        <p>
          Última actualización: {legalDate(operator.lastUpdate)}. Contacto:{' '}
          <a href={mailtoLegal(operator.email, 'Cookies - LaburamosApp', 'Hola, les escribo por la Política de Cookies:')}>{operator.email}</a>.
        </p>
      </Section>
    </>
  );
}

function RefundForm({ operator }) {
  const [form, setForm] = useState({ name: '', email: '', order: '', reason: '' });
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (patch) => setForm((value) => ({ ...value, ...patch }));

  const submit = (event) => {
    event.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.reason.trim()) {
      setError('Completá tu nombre, tu correo y el motivo.');
      return;
    }
    const body = [
      'Solicitud de arrepentimiento o reembolso - LaburamosApp',
      '',
      `Nombre: ${form.name.trim()}`,
      `Correo: ${form.email.trim()}`,
      `Comprobante o referencia: ${form.order.trim() || 'No informado'}`,
      '',
      'Motivo:',
      form.reason.trim(),
      '',
      `Fecha: ${new Date().toLocaleString('es-AR')}`,
    ].join('\n');
    window.location.href = mailtoLegal(operator.email, 'Arrepentimiento o reembolso - LaburamosApp', body);
    setSent(true);
  };

  return (
    <section className="legal-section legal-refund" id="arrepentimiento">
      <h2>Botón de arrepentimiento y solicitud de reembolso</h2>
      <p>
        Si contrataste a distancia, podés arrepentirte dentro de los 10 días corridos desde la compra (Ley 24.240, art. 34, y
        Resolución 424/2020). Completá el formulario y se abre tu correo con la solicitud lista para enviar. También podés escribir
        directamente a <a href={mailtoLegal(operator.email, 'Arrepentimiento o reembolso - LaburamosApp', 'Hola, quiero solicitar un reembolso:')}>{operator.email}</a>.
      </p>
      <form className="legal-form" onSubmit={submit}>
        <div className="two">
          <label className="field">
            <span>Nombre y apellido</span>
            <input required value={form.name} onChange={(event) => set({ name: event.target.value })} autoComplete="name" />
          </label>
          <label className="field">
            <span>Correo de la compra</span>
            <input required type="email" value={form.email} onChange={(event) => set({ email: event.target.value })} autoComplete="email" />
          </label>
        </div>
        <label className="field">
          <span>Comprobante, referencia o fecha (opcional)</span>
          <input value={form.order} onChange={(event) => set({ order: event.target.value })} placeholder="Ej: pago de CV del 12/11/2026" />
        </label>
        <label className="field">
          <span>Contanos qué pasó</span>
          <textarea required rows={4} maxLength={1200} value={form.reason} onChange={(event) => set({ reason: event.target.value })} />
        </label>
        {error && <p className="note err">{error}</p>}
        {sent && (
          <p className="note ok">
            Se abrió tu correo con la solicitud. Si no se abrió, escribinos a {operator.email} con los mismos datos.
          </p>
        )}
        <button type="submit" className="btn btn-sun">
          <RefreshCcw size={17} aria-hidden="true" /> Enviar solicitud de arrepentimiento
        </button>
      </form>
    </section>
  );
}

function Refunds({ operator }) {
  return (
    <>
      <OperatorBox operator={operator} />
      <div className="legal-summary">
        <RefreshCcw size={20} aria-hidden="true" />
        <p>
          <b>En resumen:</b> si compraste a distancia, tenés 10 días para arrepentirte. Si el pago falló, se duplicó o la descarga no
          funcionó, lo resolvemos. Si ya descargaste el CV o la campaña de anuncios empezó, el reembolso se evalúa según la ley y el
          caso.
        </p>
      </div>

      <Section title="1. Qué cubre esta política">
        <p>
          Cubre las compras de descarga de CV en PDF y las campañas de anuncios (video o imagen) que se contratan en LaburamosApp. No
          cubre acuerdos, pagos o servicios que las personas hagan entre sí por fuera de la app.
        </p>
      </Section>

      <Section title="2. Derecho de arrepentimiento">
        <p>
          En las contrataciones a distancia, la Ley 24.240 reconoce el derecho a revocar la aceptación dentro de los 10 días corridos
          contados desde la celebración del contrato o desde la entrega del bien, lo que ocurra último. La Resolución 424/2020 exige
          que el sitio tenga un botón de arrepentimiento visible y de fácil acceso.
        </p>
        <p>
          Para el contenido digital entregado de inmediato, la ley permite que el derecho se pierda si diste tu consentimiento previo y
          expreso y se te informó que perdías el derecho. En LaburamosApp te mostramos el precio y las condiciones antes de pagar; si
          descargaste el CV, igual podés escribirnos y evaluamos el caso.
        </p>
        <p>
          <a className="btn btn-sun" href="#arrepentimiento">
            <RefreshCcw size={17} aria-hidden="true" /> Ir al botón de arrepentimiento
          </a>
        </p>
      </Section>

      <Section title="3. Descarga de CV">
        <ul>
          <li><b>Pago no acreditado, duplicado o error de cobro:</b> devolvemos el importe o corregimos el acceso.</li>
          <li><b>Falla técnica que impide la descarga:</b> primero intentamos resolverlo; si no es posible, devolvemos.</li>
          <li><b>Descarga ya realizada:</b> no corresponde un reembolso automático, salvo el derecho de arrepentimiento o un error atribuible al servicio.</li>
          <li><b>Acceso por plazo o por descargas:</b> se rige por lo informado antes de pagar. Si el acceso no se usó por una falla nuestra, lo reponemos o devolvemos.</li>
        </ul>
      </Section>

      <Section title="4. Anuncios">
        <ul>
          <li><b>Antes de la aprobación o del inicio:</b> podés pedir la devolución del importe.</li>
          <li><b>Anuncio rechazado:</b> no se publica y se devuelve lo pagado, salvo que el rechazo se deba a un contenido prohibido y ya se haya explicado.</li>
          <li><b>Campaña ya iniciada:</b> no se devuelven los días transcurridos. Si la app no mostró el anuncio por una falla nuestra, evaluamos una reposición o devolución proporcional.</li>
          <li><b>Pago manual:</b> el anuncio empieza cuando el pago se acredita. Si transferiste y no se acreditó, escribinos con el comprobante.</li>
        </ul>
      </Section>

      <Section title="5. Cómo pedir un reembolso">
        <ol>
          <li>Usá el botón de arrepentimiento de esta página o escribí a {operator.email}.</li>
          <li>Indicá nombre, correo de la compra, fecha, importe y el motivo.</li>
          <li>Si corresponde, adjuntá el comprobante de Mercado Pago o de la transferencia.</li>
          <li>Respondemos dentro de los 10 días hábiles. Si aprobamos, devolvemos por el mismo medio de pago o coordinamos la alternativa.</li>
        </ol>
        <p>
          El plazo para resolver no suspende tu derecho a reclamar ante Defensa del Consumidor. No te pedimos que renuncies a ningún
          derecho para estudiar el caso.
        </p>
      </Section>

      <RefundForm operator={operator} />

      <Section title="6. Defensa del consumidor y datos personales">
        <p>
          Podés reclamar ante la Ventanilla Única Federal de Defensa del Consumidor o ante el organismo de tu provincia o municipio. Para
          datos personales, la autoridad es la Agencia de Acceso a la Información Pública (AAIP). Antes de reclamar, te pedimos que nos
          escribas: muchas veces lo resolvemos directo.
        </p>
      </Section>

      <Section title="7. Ley aplicable">
        <p>
          Esta política se rige por la Ley 24.240, la Resolución 424/2020, el Código Civil y Comercial y demás normas argentinas de
          defensa del consumidor. Si alguna cláusula no es válida, el resto sigue vigente.
        </p>
      </Section>
    </>
  );
}

export default function Legal({ doc = 'terms', settings, go }) {
  const meta = LEGAL_DOCS[doc] || LEGAL_DOCS.terms;
  const operator = useMemo(() => legalOperator(settings), [settings]);

  return (
    <section className="wrap page legal-page">
      <DocHead doc={meta} operator={operator} go={go} />
      <div className="legal-body">
        {doc === 'privacy' && <Privacy operator={operator} go={go} />}
        {doc === 'cookies' && <Cookies operator={operator} />}
        {doc === 'refund' && <Refunds operator={operator} />}
        {doc === 'terms' && <Terms operator={operator} go={go} />}
      </div>
      <div className="legal-foot">
        <FileText size={16} aria-hidden="true" />
        <p>
          Versión {LEGAL_VERSION}. Si tenés dudas, escribinos a{' '}
          <a href={mailtoLegal(operator.email, 'Consulta legal - LaburamosApp', 'Hola, les escribo por:')}>{operator.email}</a>.
        </p>
      </div>
    </section>
  );
}
