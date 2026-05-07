import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            Перейти к документации →
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Техническая документация платформы ArtHunt — маркетплейс творческих специалистов">
      <HomepageHeader />
      <main>
        <div className="container" style={{padding: '2rem 0'}}>
          <div className="row">
            <div className="col col--4">
              <div className="card" style={{padding: '1.5rem', height: '100%'}}>
                <h3>🏗️ Архитектура</h3>
                <p>Описание компонентов системы, технического стека и архитектурных решений.</p>
                <Link to="/docs/architecture/overview">Читать →</Link>
              </div>
            </div>
            <div className="col col--4">
              <div className="card" style={{padding: '1.5rem', height: '100%'}}>
                <h3>📡 API Reference</h3>
                <p>Полная спецификация REST API и AsyncAPI для уведомлений.</p>
                <Link to="/api/">Открыть →</Link>
              </div>
            </div>
            <div className="col col--4">
              <div className="card" style={{padding: '1.5rem', height: '100%'}}>
                <h3>🗄️ Модель данных</h3>
                <p>Схема базы данных PostgreSQL: таблицы, связи, индексы.</p>
                <Link to="/docs/db/data-model">Читать →</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
