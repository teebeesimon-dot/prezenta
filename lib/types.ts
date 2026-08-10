export type AttendanceStatus = "vin" | "poate" | "nu_vin";

export type Sport = "football" | "tennis" | "padel";

export type FootballFormat = "2x6" | "3x5" | "3x6";

export type UserRole = "super_admin" | "organizer" | "user";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: unknown;
  updatedAt?: unknown;
}

export interface Response {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  status: AttendanceStatus;
  goingRegisteredAt?: unknown;
  createdAt: unknown;
  updatedAt?: unknown;
}

export interface ParticipantEntry {
  userId: string;
  name: string;
  photoURL: string | null;
}

export interface RankedParticipantEntry extends ParticipantEntry {
  positionLabel: string;
  isWaitlisted: boolean;
}

export interface GroupedResponses {
  vin: ParticipantEntry[];
  poate: ParticipantEntry[];
  nu_vin: ParticipantEntry[];
}

export interface ResponseCounts {
  vin: number;
  poate: number;
  nu_vin: number;
}

export interface Participant {
  name: string;
  status: AttendanceStatus;
}

export interface GeneratedTeams {
  teamA: ParticipantEntry[];
  teamB: ParticipantEntry[];
  teams?: ParticipantEntry[][];
  generatedAt?: unknown;
}

/** How a series/event is paid for: per game (weekly) or a monthly subscription. */
export type PaymentModel = "per_game" | "monthly";

export interface Event {
  id: string;
  title: string;
  sport: Sport;
  date: string;
  time: string;
  durationMinutes?: number;
  pricePerHour?: number;
  location: string;
  placeId?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  maxParticipants: number;
  footballFormat?: FootballFormat;
  ownerId: string;
  seriesId?: string;
  seriesIndex?: number;
  seriesTotal?: number;
  /** Explicit occurrence date for a series instance (mirrors `date`). */
  occurrenceDate?: string;
  /** Payment model snapshot from the parent series. */
  paymentModel?: PaymentModel;
  payments?: Record<string, "paid" | "unpaid">;
  teams?: GeneratedTeams | null;
  participants?: Participant[];
  createdAt?: string;
}

/**
 * A recurring series is the source of truth for recurrence. Individual
 * occurrences are materialized lazily as `events` documents linked by `seriesId`.
 */
export interface Series {
  id: string;
  title: string;
  sport: Sport;
  time: string;
  durationMinutes?: number;
  maxParticipants: number;
  footballFormat?: FootballFormat;
  location: string;
  placeId?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  ownerId: string;
  frequency: "weekly" | "biweekly";
  startDate: string;
  /** null = open-ended series (auto-advances to the next occurrence). */
  endDate: string | null;
  status: "active" | "closed";
  paymentModel: PaymentModel;
  /** Default per-game price (editable "from now on"). */
  pricePerHour?: number;
  /** Default monthly subscription price per player (editable). */
  monthlyPrice?: number;
  /**
   * Fixed number of paying members in the group. The monthly subscription total
   * is split across this many people, regardless of attendance per game.
   */
  groupSize?: number;
  /** The currently materialized (upcoming) occurrence. */
  currentEventId: string;
  currentOccurrenceDate: string;
  createdAt?: unknown;
}
