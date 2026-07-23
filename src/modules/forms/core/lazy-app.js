/** Breaks app ↔ conditions/events circular imports — set once from app.js. */
let formAppRef = null;

export function setFormApp(app) {
  formAppRef = app;
}

export function getFormApp() {
  return formAppRef;
}
