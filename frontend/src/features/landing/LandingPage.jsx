import { useEffect, useRef, useState } from 'react';
import { navigate } from '../../lib/router';
import './landing.css';

const GITHUB_URL = 'https://github.com/PandaEgames2/Heimdall_Tech';
const ORIGIN_TEXT = 'original project of PandaEgames2';
const ORIGIN_ART = String.raw`__________________d888b_______________d8b
_________________d88888b_____________d888b
_______________d88888888b__________d888888b
_______________d8888888b""""""""""""""8888 8888b
________88"""""""888P"_________________88888P
______888____,888_______________________8P,
____888____8888_________________________"8,
___88_____8888_______88888_______________"8,
__888____d88888_____8888888______88888____"8,
_8888____8888888_____888888_____8888888___"8
_88888___8888888______888_______888888___"8,
_888888___88888I88_______________888____"8,
__888888___888I888888_____88888________88,
___8888888__8888888888888__"""'''___8888888,
___888888888_88888888888888_""_88888888888
___8888888888888888888888888888888Id888888
____888888888888888888888888888888888888b
_____888888888_8888888888b____88888888888
______88888888__8888888888_____8888888888
_______8888888__8888888888_____ad8888888
________888888b__888888888______8888888
__________________88888888 `;

const FEATURES = [
  {
    label: 'Operación continua',
    detail: 'La operación sigue disponible sin conexión y se sincroniza al recuperar la red.',
  },
  {
    label: 'Jerarquía de permisos inteligente',
    detail: 'Cada rol ve y hace solo lo que le corresponde, con una estructura adaptable a tu establecimiento.',
  },
  {
    label: 'Accesos unificados',
    detail: 'QR, RFID, reconocimiento de placas y registro manual en una sola trazabilidad.',
  },
];

const PILLARS = [
  {
    index: '01',
    title: 'Propósito claro',
    detail: 'Convertir la seguridad cotidiana en información verificable: quién entra, en qué vehículo, a qué hora y con qué autorización.',
  },
  {
    index: '02',
    title: 'Control estructurado',
    detail: 'Una jerarquía de permisos inteligente y roles adaptables para que cada persona vea exactamente lo que necesita.',
  },
  {
    index: '03',
    title: 'Continuidad operativa',
    detail: 'La portería no se detiene cuando falla la red. Los registros se recuperan y se sincronizan al volver la conexión.',
  },
];

export default function LandingPage({ onNavigate = navigate }) {
  const [originOpen, setOriginOpen] = useState(false);
  const originTriggerRef = useRef(null);
  const originCloseRef = useRef(null);

  useEffect(() => {
    if (!originOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const trigger = originTriggerRef.current;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOriginOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    originCloseRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      trigger?.focus();
    };
  }, [originOpen]);

  const goLogin = (event) => {
    event.preventDefault();
    onNavigate('/login');
  };

  const closeOrigin = () => setOriginOpen(false);

  const handleOriginBackdrop = (event) => {
    if (event.target === event.currentTarget) closeOrigin();
  };

  return (
    <main className="landing">
      <div className="landing-aurora" aria-hidden="true" />
      <div className="landing-grid" aria-hidden="true" />

      <header className="landing-nav">
        <a
          className="landing-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('/');
          }}
        >
          <span className="landing-brand-mark" aria-hidden="true">H</span>
          <span className="landing-brand-copy">
            <strong>HEIMDALL</strong>
            <small>TECH</small>
          </span>
        </a>

        <div className="landing-nav-actions">
          <span className="landing-nav-pill">Operación continua</span>
          <a className="landing-nav-link" href="#origen">El origen</a>
          <a className="landing-nav-link" href="/login" onClick={goLogin}>
            Iniciar sesión
          </a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">
            <span className="landing-pulse" aria-hidden="true" />
            Control vehicular inteligente
          </span>

          <h1>
            Cada acceso bajo control.
            <span>Incluso sin conexión.</span>
          </h1>

          <p className="landing-lead">
            Heimdall Tech reúne el control de acceso vehicular y peatonal de tu
            establecimiento en una sola plataforma. Valida placas, QR y RFID, registra
            cada ingreso y salida y organiza el acceso de tu equipo con una jerarquía
            de permisos inteligente. La operación continúa offline y se sincroniza
            cuando vuelve la red.
          </p>

          <div className="landing-actions">
            <a className="landing-btn landing-btn-primary" href="/login" onClick={goLogin}>
              Iniciar Sesión
              <span aria-hidden="true">→</span>
            </a>
            <a
              className="landing-btn landing-btn-outline"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Ver código en GitHub
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <dl className="landing-proof">
            <div>
              <dt>24/7</dt>
              <dd>operación local</dd>
            </div>
            <div>
              <dt>3</dt>
              <dd>canales de acceso</dd>
            </div>
            <div>
              <dt>1</dt>
              <dd>fuente de verdad operativa</dd>
            </div>
          </dl>
        </div>

        <aside className="landing-panel" aria-label="Capacidades de Heimdall Tech">
          <div className="landing-panel-glow" aria-hidden="true" />
          <div className="landing-panel-head">
            <span className="landing-chip">HEIMDALL CORE</span>
            <span className="landing-status"><span aria-hidden="true" /> Sistema operativo</span>
          </div>

          <div className="landing-orbit" aria-hidden="true">
            <span className="landing-orbit-ring landing-orbit-ring-1" />
            <span className="landing-orbit-ring landing-orbit-ring-2" />
            <span className="landing-orbit-ring landing-orbit-ring-3" />
            <span className="landing-orbit-core">H</span>
          </div>

          <ul className="landing-features">
            {FEATURES.map((feature) => (
              <li key={feature.label}>
                <strong>{feature.label}</strong>
                <small>{feature.detail}</small>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="landing-story" id="origen" aria-labelledby="landing-story-title">
        <div className="landing-story-copy">
          <span className="landing-eyebrow">El origen del nombre</span>
          <h2 id="landing-story-title">Un guardián que todo lo ve.</h2>
          <p className="landing-story-lead">
            Heimdall Tech nació para que la portería deje de depender de planillas,
            radios y memoria. Cada acceso merece contexto: quién entra, en qué vehículo,
            a qué hora y con qué autorización.
          </p>
          <p>
            El nombre rinde homenaje a Heimdall, el dios nórdico que vigilaba el Bifröst,
            el puente entre los mundos. Su vista y su oído lo convertían en el guardián
            que todo lo percibía y que decidía quién podía cruzar. Esa misma idea sostiene
            la plataforma: observar cada movimiento, ordenar la información y abrir la
            puerta correcta en el momento correcto.
          </p>
          <p>
            Su montura, Gulltoppr, de crin dorada, inspira el acento cálido de la interfaz:
            una presencia serena, siempre atenta, que protege sin estorbar.
          </p>
        </div>

        <aside className="landing-story-note">
          <span className="landing-story-note-kicker">Del mito a la portería</span>
          <p>
            La seguridad no empieza cuando alguien intenta entrar. Empieza cuando sabes
            exactamente quién debería poder hacerlo, hacia dónde va y qué deja registrado
            a su paso.
          </p>
          <div className="landing-story-rule" aria-hidden="true" />
          <p className="landing-story-quote">
            “Un buen guardián no detiene el tránsito: hace que cada paso tenga sentido.”
          </p>
          <span className="landing-story-signature">Gulltoppr · crin dorada</span>
        </aside>

        <div className="landing-story-pillars">
          {PILLARS.map((pillar) => (
            <article className="landing-pillar" key={pillar.index}>
              <span className="landing-pillar-index">{pillar.index}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-copyright">
          © {new Date().getFullYear()} Heimdall Tech · Todos los derechos reservados<button
            ref={originTriggerRef}
            type="button"
            className="landing-copyright-dot"
            onClick={() => setOriginOpen(true)}
            tabIndex={-1}
          >
            .
          </button>
        </span>
        <span>Bifröst UI · Diseño y operación</span>
      </footer>

      {originOpen ? (
        <div className="landing-origin-backdrop" onClick={handleOriginBackdrop}>
          <div
            className="landing-origin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Créditos"
          >
            <button
              ref={originCloseRef}
              type="button"
              className="landing-origin-close"
              onClick={closeOrigin}
              aria-label="Cerrar"
            >
              ×
            </button>
            <pre className="landing-origin-art" aria-hidden="true">{ORIGIN_ART}</pre>
            <p className="landing-origin-caption">{ORIGIN_TEXT}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
