import { AppShell } from './components/AppShell'
import { SettingsProvider } from './components/SettingsProvider'
import { I18nProvider } from './i18n'

function App() {
  return (
    <SettingsProvider>
      <I18nProvider>
        <AppShell />
      </I18nProvider>
    </SettingsProvider>
  )
}

export default App
