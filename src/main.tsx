import { render } from 'preact';
import { App } from './App';
import { lang, t } from './i18n';
import './styles.css';

document.documentElement.lang = lang;
document.title = t.appTitle;
render(<App />, document.getElementById('app')!);
