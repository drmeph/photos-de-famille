import { render } from 'preact';
import { App } from './App';
import { config } from './config';
import { albumTitle, lang } from './i18n';
import './styles.css';

document.documentElement.lang = lang;
document.documentElement.style.setProperty('--accent', config.color);
document.title = albumTitle;
render(<App />, document.getElementById('app')!);
