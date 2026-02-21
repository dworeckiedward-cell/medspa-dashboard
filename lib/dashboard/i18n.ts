/**
 * Dashboard shell translations.
 *
 * Covers: sidebar labels, settings section titles/descriptions, dashboard tab
 * labels, leads/follow-up/integrations page labels, and common UI strings.
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
      leads: 'Leads',
      callLogs: 'Call Logs',
      followUp: 'Follow-up',
      integrations: 'Integrations',
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
    leads: {
      pageTitle: 'Leads',
      pageSubtitle: 'All leads captured and qualified by your AI receptionist.',
      search: 'Search leads…',
      allStatuses: 'All statuses',
      allSources: 'All sources',
      allDirections: 'All calls',
      needsFollowUp: 'Follow-up only',
      today: 'Today',
      last7d: 'Last 7 days',
      last30d: 'Last 30 days',
      allTime: 'All time',
      noLeads: 'No leads found',
      noLeadsHint: 'Adjust your filters or wait for new calls',
      clearFilters: 'Clear filters',
      colName: 'Name',
      colSource: 'Source',
      colStatus: 'Status',
      colLastContact: 'Last contact',
      colNextAction: 'Next action',
      colOwner: 'Owner',
      colPriority: 'Priority',
      ownerAi: 'AI',
      ownerHuman: 'Human',
      overdue: 'Overdue',
      dueSoon: 'Due soon',
    },
    followUp: {
      pageTitle: 'Follow-up Queue',
      pageSubtitle: `Operational queue for leads the AI couldn't fully close.`,
      tabCallBackNow: 'Call Back Now',
      tabInterested: 'Interested',
      tabNoShow: 'No-show',
      tabReminders: 'Reminders',
      tabHumanReview: 'Human Review',
      noTasks: 'No tasks in this queue',
      noTasksHint: 'Great job — all caught up!',
      overdue: 'Overdue',
      dueSoon: 'Due soon',
      onTrack: 'On track',
      markDone: 'Mark done',
      snooze: 'Snooze',
      openLead: 'Open lead',
      suggestedScript: 'Suggested script',
      suggestedAction: 'Suggested action',
    },
    integrations: {
      pageTitle: 'Integrations',
      pageSubtitle: 'Sync lead activity with your CRM and automation tools.',
      customWebhook: 'Custom Webhook',
      customWebhookDesc: 'Send real-time events to any endpoint via HTTP POST.',
      connected: 'Connected',
      notConfigured: 'Not configured',
      comingSoon: 'Coming Soon',
      endpoint: 'Endpoint URL',
      secret: 'Webhook Secret',
      events: 'Events',
      sendTest: 'Send test event',
      recentActivity: 'Recent activity',
      noActivity: 'No sync activity yet',
      success: 'Success',
      failed: 'Failed',
      pending: 'Pending',
      lastSync: 'Last sync',
      copyUrl: 'Copy URL',
      copySecret: 'Copy secret',
      reveal: 'Reveal',
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
      leads: 'Leady',
      callLogs: 'Dziennik połączeń',
      followUp: 'Follow-up',
      integrations: 'Integracje',
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
    leads: {
      pageTitle: 'Leady',
      pageSubtitle: 'Wszystkie leady pozyskane i zakwalifikowane przez asystenta AI.',
      search: 'Szukaj leadów…',
      allStatuses: 'Wszystkie statusy',
      allSources: 'Wszystkie źródła',
      allDirections: 'Wszystkie połączenia',
      needsFollowUp: 'Tylko follow-up',
      today: 'Dziś',
      last7d: 'Ostatnie 7 dni',
      last30d: 'Ostatnie 30 dni',
      allTime: 'Wszystkie',
      noLeads: 'Nie znaleziono leadów',
      noLeadsHint: 'Zmień filtry lub poczekaj na nowe połączenia',
      clearFilters: 'Wyczyść filtry',
      colName: 'Imię i nazwisko',
      colSource: 'Źródło',
      colStatus: 'Status',
      colLastContact: 'Ostatni kontakt',
      colNextAction: 'Następna akcja',
      colOwner: 'Opiekun',
      colPriority: 'Priorytet',
      ownerAi: 'AI',
      ownerHuman: 'Człowiek',
      overdue: 'Przeterminowane',
      dueSoon: 'Wkrótce',
    },
    followUp: {
      pageTitle: 'Kolejka follow-up',
      pageSubtitle: 'Operacyjna kolejka dla leadów, których AI nie zamknęła.',
      tabCallBackNow: 'Oddzwoń teraz',
      tabInterested: 'Zainteresowani',
      tabNoShow: 'Nieobecni',
      tabReminders: 'Przypomnienia',
      tabHumanReview: 'Weryfikacja',
      noTasks: 'Brak zadań w tej kolejce',
      noTasksHint: 'Dobra robota — wszystko ogarnięte!',
      overdue: 'Przeterminowane',
      dueSoon: 'Wkrótce',
      onTrack: 'Na czas',
      markDone: 'Oznacz jako zrobione',
      snooze: 'Odłóż',
      openLead: 'Otwórz lead',
      suggestedScript: 'Sugerowany skrypt',
      suggestedAction: 'Sugerowana akcja',
    },
    integrations: {
      pageTitle: 'Integracje',
      pageSubtitle: 'Synchronizuj aktywność leadów z CRM i narzędziami automatyzacji.',
      customWebhook: 'Własny webhook',
      customWebhookDesc: 'Wysyłaj zdarzenia w czasie rzeczywistym do dowolnego endpointu via HTTP POST.',
      connected: 'Połączono',
      notConfigured: 'Nieskonfigurowane',
      comingSoon: 'Wkrótce',
      endpoint: 'Adres URL endpointu',
      secret: 'Klucz webhooka',
      events: 'Zdarzenia',
      sendTest: 'Wyślij testowe zdarzenie',
      recentActivity: 'Ostatnia aktywność',
      noActivity: 'Brak aktywności synchronizacji',
      success: 'Sukces',
      failed: 'Błąd',
      pending: 'Oczekuje',
      lastSync: 'Ostatnia sync',
      copyUrl: 'Kopiuj URL',
      copySecret: 'Kopiuj klucz',
      reveal: 'Pokaż',
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
      leads: 'Leads',
      callLogs: 'Registro de llamadas',
      followUp: 'Seguimiento',
      integrations: 'Integraciones',
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
    leads: {
      pageTitle: 'Leads',
      pageSubtitle: 'Todos los leads capturados y calificados por tu recepcionista IA.',
      search: 'Buscar leads…',
      allStatuses: 'Todos los estados',
      allSources: 'Todas las fuentes',
      allDirections: 'Todas las llamadas',
      needsFollowUp: 'Solo seguimiento',
      today: 'Hoy',
      last7d: 'Últimos 7 días',
      last30d: 'Últimos 30 días',
      allTime: 'Todo el tiempo',
      noLeads: 'No se encontraron leads',
      noLeadsHint: 'Ajusta los filtros o espera nuevas llamadas',
      clearFilters: 'Limpiar filtros',
      colName: 'Nombre',
      colSource: 'Fuente',
      colStatus: 'Estado',
      colLastContact: 'Último contacto',
      colNextAction: 'Próxima acción',
      colOwner: 'Responsable',
      colPriority: 'Prioridad',
      ownerAi: 'IA',
      ownerHuman: 'Humano',
      overdue: 'Vencido',
      dueSoon: 'Próximo',
    },
    followUp: {
      pageTitle: 'Cola de seguimiento',
      pageSubtitle: 'Cola operativa para leads que la IA no pudo cerrar.',
      tabCallBackNow: 'Llamar ahora',
      tabInterested: 'Interesados',
      tabNoShow: 'No presentados',
      tabReminders: 'Recordatorios',
      tabHumanReview: 'Revisión humana',
      noTasks: 'No hay tareas en esta cola',
      noTasksHint: '¡Buen trabajo — todo al día!',
      overdue: 'Vencido',
      dueSoon: 'Próximo',
      onTrack: 'A tiempo',
      markDone: 'Marcar como hecho',
      snooze: 'Posponer',
      openLead: 'Abrir lead',
      suggestedScript: 'Guión sugerido',
      suggestedAction: 'Acción sugerida',
    },
    integrations: {
      pageTitle: 'Integraciones',
      pageSubtitle: 'Sincroniza la actividad de leads con tu CRM y herramientas de automatización.',
      customWebhook: 'Webhook personalizado',
      customWebhookDesc: 'Envía eventos en tiempo real a cualquier endpoint via HTTP POST.',
      connected: 'Conectado',
      notConfigured: 'No configurado',
      comingSoon: 'Próximamente',
      endpoint: 'URL del endpoint',
      secret: 'Clave del webhook',
      events: 'Eventos',
      sendTest: 'Enviar evento de prueba',
      recentActivity: 'Actividad reciente',
      noActivity: 'Sin actividad de sincronización',
      success: 'Éxito',
      failed: 'Error',
      pending: 'Pendiente',
      lastSync: 'Última sincronización',
      copyUrl: 'Copiar URL',
      copySecret: 'Copiar clave',
      reveal: 'Revelar',
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
  nav: {
    dashboard: string; leads: string; callLogs: string; followUp: string
    integrations: string; settings: string; aiReceptionist: string
  }
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
  leads: {
    pageTitle: string; pageSubtitle: string; search: string
    allStatuses: string; allSources: string; allDirections: string
    needsFollowUp: string; today: string; last7d: string; last30d: string; allTime: string
    noLeads: string; noLeadsHint: string; clearFilters: string
    colName: string; colSource: string; colStatus: string
    colLastContact: string; colNextAction: string; colOwner: string; colPriority: string
    ownerAi: string; ownerHuman: string; overdue: string; dueSoon: string
  }
  followUp: {
    pageTitle: string; pageSubtitle: string
    tabCallBackNow: string; tabInterested: string; tabNoShow: string
    tabReminders: string; tabHumanReview: string
    noTasks: string; noTasksHint: string
    overdue: string; dueSoon: string; onTrack: string
    markDone: string; snooze: string; openLead: string
    suggestedScript: string; suggestedAction: string
  }
  integrations: {
    pageTitle: string; pageSubtitle: string
    customWebhook: string; customWebhookDesc: string
    connected: string; notConfigured: string; comingSoon: string
    endpoint: string; secret: string; events: string
    sendTest: string; recentActivity: string; noActivity: string
    success: string; failed: string; pending: string
    lastSync: string; copyUrl: string; copySecret: string; reveal: string
  }
  callLogs: { title: string; subtitle: string }
  loader: { preparingWorkspace: string }
  common: { poweredByServify: string; contactSupport: string }
}

export const DICT: Record<LangKey, TranslationDict> = dict
