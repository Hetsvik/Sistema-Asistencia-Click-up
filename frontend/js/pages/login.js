import { Auth } from '../api.js';
import { ROUTES } from '../config.js';
import { startWaves } from '../waves.js';
import { $ } from '../ui.js';

startWaves($('#gold-wave-canvas'));

// Si ya hay sesión activa, salta directo al panel.
Auth.me({ silent401: true }).then(({ user }) => location.replace(ROUTES[user.rol].inicio)).catch(() => {});

const form = $('#login-form');
const message = $('#login-message');
const submit = $('button[type="submit"]', form);

const showError = (text) => {
  message.textContent = text;
  message.hidden = false;
  message.classList.add('is-error');
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.hidden = true;
  const codigo = $('#login-code').value.trim();
  const pin = $('#login-pin').value;
  const esAdmin = $('#login-role').value === 'admin';
  if (!codigo || !pin) return showError('Ingresa tu código y tu PIN.');

  submit.disabled = true;
  submit.textContent = 'Ingresando…';
  try {
    const { user } = await Auth.login(codigo, pin, esAdmin);
    location.replace(ROUTES[user.rol].inicio);
  } catch (err) {
    showError(err.message);
    $('#login-pin').value = '';
    submit.disabled = false;
    submit.textContent = 'Ingresar';
  }
});
