import { createPortal } from 'react-dom';
import CvSheet from './CvSheet';

// Versión para el PDF. Se monta en <body> SOLO después de registrar la descarga (consume_cv_download),
// así el CV limpio no está en la página mientras se edita.
export default function CvPrint({ form, photoUrl }) {
  return createPortal(
    <div className="cv-print" aria-hidden="true">
      <CvSheet form={form} photoUrl={photoUrl} />
      <p className="pv-foot">
        <img src="/marca/favicon-48.png" alt="" /> CV hecho con LaburamosApp
      </p>
    </div>,
    document.body
  );
}
