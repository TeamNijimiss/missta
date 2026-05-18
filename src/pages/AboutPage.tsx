import { appConfig } from '@/lib/app-config';

export function AboutPage() {
  return (
    <section className="panel about-page">
      <h1>{appConfig.appName}</h1>
      <p className="about-version">{appConfig.appNameLatin}</p>
      <p className="about-version">Version {appConfig.appVersion}</p>

      <section className="about-section">
        <h2>GitHub</h2>
        <a className="inline-link" href="https://github.com/TeamNijimiss/misssta" target="_blank" rel="noreferrer">
          https://github.com/TeamNijimiss/misssta
        </a>
      </section>

      <section className="about-section">
        <h2>開発者</h2>
        <p>Nijimiss Project</p>
        <a className="inline-link" href="https://nijimiss.com/" target="_blank" rel="noreferrer">
          https://nijimiss.com/
        </a>
      </section>

      <section className="about-section">
        <h2>ライセンス</h2>
        <p>MIT License</p>
      </section>
    </section>
  );
}
