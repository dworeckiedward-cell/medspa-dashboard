/**
 * Dashboard shell translations.
 *
 * Covers: sidebar labels, settings section titles/descriptions, dashboard tab
 * labels, and common UI strings used in modified components.
 *
 * Intentionally lightweight — no heavy i18n library.
 * Unknown keys fall back to English automatically via useLanguage().
 */

export type LangKey = 'en' | 'pl' | 'es'

export const LANG_STORAGE_KEY = 'dashboard-language'
export const DEFAULT_LANG: LangKey = 'en'

export const LANGUAGE_LABELS: Record<LangKey, string> = {
  en: 'English',
  pl: 'Polski',
  es: 'Español',
}

const dict = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      callLogs: 'Call Logs',
      settings: 'Settings',
      aiReceptionist: 'AI Receptionist',
    },
    settings: {
      pageTitle: 'Settings',
      pageSubtitle: 'Manage your workspace appearance and preferences.',
      appearance: 'Appearance',
      appearanceDesc:
        'Choose how the dashboard looks on your device. Preferences are saved locally.',
      theme: 'Theme',
      themeDesc: 'System follows your operating system preference.',
      accentColor: 'Accent Color',
      accentColorDesc: 'Highlight color for active nav items and controls. Saved locally.',
      language: 'Language',
      languageDesc: 'Interface language for the dashboard shell. Saved locally.',
      notifications: 'Notifications',
      notificationsDesc: 'Control how you are alerted about activity in your workspace.',
      workspace: 'Workspace',
      workspaceDesc:
        'Tenant configuration managed from the Servify platform. Contact support to make changes.',
      advanced: 'Advanced',
      advancedDesc: 'Runtime diagnostics and session information.',
      support: 'Support',
      supportDesc: 'Get help or report an issue with your workspace.',
      savedLocally: 'Saved locally',
    },
    dashboard: {
      overview: 'Overview',
      inbound: 'Inbound',
      outbound: 'Outbound',
      speedToLead: 'Speed-to-Lead',
      remindersReactivation: 'Reminders & Reactivation',
      inboundCalls: 'Inbound Calls',
      leadsGenerated: 'Leads Generated',
      inquiriesValue: 'Inquiries Value',
      newLeads: 'New Leads',
      followUpsNeeded: 'Follow-ups Needed',
      leadBookingRate: 'Lead → Booking Rate',
      comingSoon: 'Coming Soon',
      comingSoonDesc: 'This section is being built. Backend data classification coming next.',
    },
    callLogs: {
      title: 'Call Logs',
      subtitle: 'All calls handled by your AI receptionist.',
    },
    loader: {
      preparingWorkspace: 'Preparing your workspace',
    },
    common: {
      poweredByServify: 'Powered by Servify',
      contactSupport: 'Contact support',
    },
  },

  pl: {
    nav: {
      dashboard: 'Dashboard',
      callLogs: 'Dziennik połączeń',
      settings: 'Ustawienia',
      aiReceptionist: 'Asystent AI',
    },
    settings: {
      pageTitle: 'Ustawienia',
      pageSubtitle: 'Zarządzaj wyglądem i preferencjami obszaru roboczego.',
      appearance: 'Wygląd',
      appearanceDesc: 'Wybierz, jak wygląda panel na Twoim urządzeniu. Preferencje są zapisywane lokalnie.',
      theme: 'Motyw',
      themeDesc: 'System podąża za preferencjami systemu operacyjnego.',
      accentColor: 'Kolor akcentu',
      accentColorDesc: 'Kolor wyróżnienia aktywnych elementów nawigacji. Zapisywany lokalnie.',
      language: 'Język',
      languageDesc: 'Język interfejsu panelu. Zapisywany lokalnie.',
      notifications: 'Powiadomienia',
      notificationsDesc: 'Kontroluj, jak jesteś informowany o aktywności w obszarze roboczym.',
      workspace: 'Obszar roboczy',
      workspaceDesc:
        'Konfiguracja tenanta zarządzana z platformy Servify. Skontaktuj się z pomocą, aby dokonać zmian.',
      advanced: 'Zaawansowane',
      advancedDesc: 'Diagnostyka środowiska uruchomieniowego i informacje o sesji.',
      support: 'Wsparcie',
      supportDesc: 'Uzyskaj pomoc lub zgłoś problem z obszarem roboczym.',
      savedLocally: 'Zapisano lokalnie',
    },
    dashboard: {
      overview: 'Przegląd',
      inbound: 'Przychodzące',
      outbound: 'Wychodzące',
      speedToLead: 'Czas reakcji na lead',
      remindersReactivation: 'Przypomnienia i reaktywacja',
      inboundCalls: 'Połączenia przychodzące',
      leadsGenerated: 'Wygenerowane leady',
      inquiriesValue: 'Wartość zapytań',
      newLeads: 'Nowe leady',
      followUpsNeeded: 'Wymagane follow-upy',
      leadBookingRate: 'Lead → Rezerwacja',
      comingSoon: 'Wkrótce dostępne',
      comingSoonDesc: 'Ta sekcja jest w budowie. Klasyfikacja danych backendu już wkrótce.',
    },
    callLogs: {
      title: 'Dziennik połączeń',
      subtitle: 'Wszystkie połączenia obsługiwane przez Twojego asystenta AI.',
    },
    loader: {
      preparingWorkspace: 'Przygotowuję obszar roboczy',
    },
    common: {
      poweredByServify: 'Obsługiwane przez Servify',
      contactSupport: 'Kontakt z pomocą',
    },
  },

  es: {
    nav: {
      dashboard: 'Panel',
      callLogs: 'Registro de llamadas',
      settings: 'Configuración',
      aiReceptionist: 'Recepcionista IA',
    },
    settings: {
      pageTitle: 'Configuración',
      pageSubtitle: 'Gestiona la apariencia y preferencias de tu espacio de trabajo.',
      appearance: 'Apariencia',
      appearanceDesc:
        'Elige cómo se ve el panel en tu dispositivo. Las preferencias se guardan localmente.',
      theme: 'Tema',
      themeDesc: 'El sistema sigue la preferencia de tu sistema operativo.',
      accentColor: 'Color de acento',
      accentColorDesc: 'Color de resaltado para elementos activos de navegación. Guardado localmente.',
      language: 'Idioma',
      languageDesc: 'Idioma de la interfaz del panel. Guardado localmente.',
      notifications: 'Notificaciones',
      notificationsDesc: 'Controla cómo se te alerta sobre la actividad en tu espacio de trabajo.',
      workspace: 'Espacio de trabajo',
      workspaceDesc:
        'Configuración del inquilino gestionada desde la plataforma Servify. Contacta al soporte para realizar cambios.',
      advanced: 'Avanzado',
      advancedDesc: 'Diagnósticos de tiempo de ejecución e información de sesión.',
      support: 'Soporte',
      supportDesc: 'Obtén ayuda o reporta un problema con tu espacio de trabajo.',
      savedLocally: 'Guardado localmente',
    },
    dashboard: {
      overview: 'Resumen',
      inbound: 'Entrantes',
      outbound: 'Salientes',
      speedToLead: 'Velocidad de respuesta',
      remindersReactivation: 'Recordatorios y reactivación',
      inboundCalls: 'Llamadas entrantes',
      leadsGenerated: 'Leads generados',
      inquiriesValue: 'Valor de consultas',
      newLeads: 'Nuevos leads',
      followUpsNeeded: 'Seguimientos necesarios',
      leadBookingRate: 'Lead → Reserva',
      comingSoon: 'Próximamente',
      comingSoonDesc: 'Esta sección está en construcción. La clasificación de datos backend llegará pronto.',
    },
    callLogs: {
      title: 'Registro de llamadas',
      subtitle: 'Todas las llamadas gestionadas por tu recepcionista IA.',
    },
    loader: {
      preparingWorkspace: 'Preparando tu espacio de trabajo',
    },
    common: {
      poweredByServify: 'Impulsado por Servify',
      contactSupport: 'Contactar soporte',
    },
  },
}

// TranslationDict is defined structurally (all string fields) so every language
// entry is assignable even though the actual values differ across languages.
// `as const` was intentionally omitted to allow this.
export type TranslationDict = {
  nav: { dashboard: string; callLogs: string; settings: string; aiReceptionist: string }
  settings: {
    pageTitle: string; pageSubtitle: string; appearance: string; appearanceDesc: string
    theme: string; themeDesc: string; accentColor: string; accentColorDesc: string
    language: string; languageDesc: string; notifications: string; notificationsDesc: string
    workspace: string; workspaceDesc: string; advanced: string; advancedDesc: string
    support: string; supportDesc: string; savedLocally: string
  }
  dashboard: {
    overview: string; inbound: string; outbound: string
    speedToLead: string; remindersReactivation: string
    inboundCalls: string; leadsGenerated: string; inquiriesValue: string
    newLeads: string; followUpsNeeded: string; leadBookingRate: string
    comingSoon: string; comingSoonDesc: string
  }
  callLogs: { title: string; subtitle: string }
  loader: { preparingWorkspace: string }
  common: { poweredByServify: string; contactSupport: string }
}

export const DICT: Record<LangKey, TranslationDict> = dict
