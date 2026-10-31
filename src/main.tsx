import { render } from 'preact';
import { App } from './App';
import { config } from './config';
import { albumTitle, lang } from './i18n';
// Self-hosted fonts (bundled by Vite, so they work under the strict Content-Security-Policy):
// Fraunces, a warm serif for titles; Atkinson Hyperlegible Next, designed for readers with low vision.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import './styles.css';

document.documentElement.lang = lang;
document.documentElement.style.setProperty('--accent', config.color);
document.title = albumTitle;
render(<App />, document.getElementById('app')!);
