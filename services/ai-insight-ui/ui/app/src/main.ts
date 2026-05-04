import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import 'primeicons/primeicons.css'
import './styles/tokens.css'      // FAP §14 design tokens (canonical)
import './styles/variables.css'   // legacy alias forwarders
import './styles/shell.css'        // FAP §15 main-shell layout
import './styles/components.css'   // FAP §15 button/input/card recipes
import './styles/overrides.css'   // PrimeVue Aura → FAP token bridges
import App from './App.vue'
import router from './router'
import { initAuth } from './auth'
import { useUiBuilderStore } from './stores/uibuilder'
import { registerInboundHandler, submit } from './services/transport'
import { reduceResult, reduceEvent } from './services/reducers'

// Authenticate BEFORE mounting the app.
// The index.html splash screen stays visible during this time.
// If user has no KC session, KC redirects to login (page unloads — mount never happens).
// If user has KC session, initAuth() resolves and we mount the app with sidebar + user data.
initAuth().then(async () => {
  const app = createApp(App)

  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  app.use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        prefix: 'p',
        darkModeSelector: false,
        cssLayer: false
      }
    }
  })

  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)

  // Boot UIBUILDER once, app-wide, so window.uibuilder is wired up before any
  // view mounts. The store guards against a missing client lib and falls back
  // to mock mode, so this is safe even if the page is opened standalone.
  await useUiBuilderStore().init()

  // FAP §11: register the single inbound handler. Every result/event arriving
  // over the UIBUILDER socket flows through reduceResult/reduceEvent — the
  // only writers to the app store.
  registerInboundHandler(reduceResult, reduceEvent)

  // FAP §11 "Refresh and recovery": after a hard reload the SPA has no local
  // session state. Ask ORCE to restore authoritative state. The reducer
  // persists the returned sessionId and seeds state.model.bootstrap with the
  // initial view-model (recent alerts, KPIs, conversation history). Failure
  // is non-fatal — we just mount with empty state and let per-view loaders
  // populate as the user navigates.
  if (useUiBuilderStore().connected) {
    submit('bootstrap.session', {}).catch(() => { /* see comment above */ })
  }

  app.mount('#app')
}).catch((err) => {
  // If KC init fails completely, show error in the splash area
  const el = document.getElementById('app')
  if (el) {
    const base = import.meta.env.BASE_URL
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:Inter,system-ui,sans-serif;">
        <img src="${base}facis-logo.svg" alt="FACIS" style="width:120px;opacity:0.8;" />
        <p style="margin-top:1.5rem;color:#dc2626;font-size:0.9rem;font-weight:600;">Authentication Failed</p>
        <p style="margin-top:0.5rem;color:#64748b;font-size:0.8rem;max-width:400px;text-align:center;">${err?.message || 'Could not connect to Keycloak. Please refresh the page.'}</p>
        <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;background:#005fff;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">Retry</button>
      </div>
    `
  }
})
