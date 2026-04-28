export type Channel = 'wa' | 'sms' | 'email'
export type PillVariant = 'g' | 'b' | 'o' | 'n'

// ─── Contact sub-types ────────────────────────────────────────────────────────

export type ContactType = 'person' | 'company'
export type ContactSource = 'manual' | 'google' | 'import'
export type EmailLabel = 'work' | 'personal' | 'booking' | 'press' | 'other'
export type PhoneLabel = 'mobile' | 'work' | 'home' | 'fax' | 'other'
export type SocialPlatform =
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'spotify'
  | 'website'
  | 'other'

/** ContactRoleListSerializer shape */
export interface ContactRole {
  uuid: string
  name: string
  slug: string
  icon?: string
  color: string
  is_system: boolean
}

/** ContactGroupListSerializer shape */
export interface ContactGroup {
  uuid: string
  name: string
  slug: string
  color: string
}

/** ContactEmailSerializer shape */
export interface ContactEmail {
  id: number
  email: string
  label: EmailLabel
  is_primary: boolean
}

/** ContactPhoneSerializer shape */
export interface ContactPhone {
  id: number
  phone: string
  label: PhoneLabel
  is_primary: boolean
}

/** ContactSocialMediaSerializer shape */
export interface ContactSocialMedia {
  id: number
  platform: SocialPlatform
  username: string
  url: string
}

/** ContactTourRelationSerializer shape */
export interface ContactTourRelation {
  tour: string          // tour UUID
  tour_name: string
  role: string | null   // role UUID
  role_name: string | null
  notes: string
  is_primary: boolean
}

/**
 * Contact — aligned with ContactSerializer (full) and ContactListSerializer.
 *
 * `uuid` is the canonical identifier (backend UUID).
 * `avatar` is frontend-only (not in backend).
 */
export interface Contact {
  uuid: string
  contact_type: ContactType
  first_name: string
  last_name: string
  company_name?: string
  job_title?: string
  role?: ContactRole
  groups?: ContactGroup[]
  emails?: ContactEmail[]
  phones?: ContactPhone[]
  social_media?: ContactSocialMedia[]
  tour_relations?: ContactTourRelation[]
  primary_email: string
  primary_phone: string
  website?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  notes?: string
  is_favorite: boolean
  is_emergency: boolean
  source?: ContactSource
  // Computed by backend (also set in mock)
  full_name: string
  display_name?: string
  full_address?: string
  // Frontend-only
  avatar?: string
}

// ─── Other types ─────────────────────────────────────────────────────────────

export interface DeliveryStats {
  sent: number
  opened: number
  clicked: number
}

export interface NotifEvent {
  id: number
  type: Channel
  title: string
  venue: string
  city: string
  group: string
  pc: PillVariant
  time: string
  preview: string
  fullDate: string
  isoDate: string      // YYYY-MM-DD — used for chronological filtering
  startTime: string
  endTime: string
  callTime: string
  doors: string
  tour: string
  tourId: number
  tourDates: string
  message: string
  stats: DeliveryStats
  contacts: Contact[]
  dateGroup: string
}

export type TourStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface Tour {
  id: number            // synthetic frontend key (session-stable)
  uuid: string          // backend UUID — canonical identifier
  name: string
  artist_name: string
  description?: string
  genre?: string
  start_date: string
  end_date: string
  status: TourStatus
  budget?: string
  currency: string
  team_size?: number
  notes?: string
  color: string         // stored in backend settings JSONField
  members_count?: number
  events_count?: number
  // Google Calendar assignment
  default_calendar_id?: number | null
  // Spotify integration
  spotify_artist_id?: string
  spotify_artist_url?: string
  spotify_image_url?: string
  spotify_followers?: number
  spotify_synced_at?: string
}

export interface CalendarEvent {
  id: number
  name: string
  date: string
  isoDate: string
  loc: string
  color: string
  sel: boolean
  tourId?: number
}

export interface NewTourForm {
  name: string
  artist_name: string
  description?: string
  genre?: string
  start_date: string
  end_date: string
  budget?: string
  currency: string
  team_size?: number
  notes?: string
  color?: string        // frontend-only
  spotify_artist_id?: string
  spotify_artist_url?: string
  spotify_image_url?: string
  spotify_followers?: number
  spotify_synced_at?: string
}

export interface NewNotifForm {
  ch: 'WhatsApp' | 'SMS' | 'Email'
  msg: string
  timing: string
}

export interface DayCell {
  isoDate: string
  dayNum: number
  isCurrentMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}
