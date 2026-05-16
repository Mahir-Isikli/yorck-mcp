export interface Env {
  CACHE: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace;
  PUBLIC_MCP_OBJECT: DurableObjectNamespace;
  BROWSER: Fetcher;

  PREFERRED_CINEMAS: string;
  DEFAULT_FORMATS: string;
  COGNITO_USER_POOL: string;
  COGNITO_CLIENT_ID: string;
  COGNITO_REGION: string;
  VISTA_BASE: string;
  YORCK_AUTH_BASE: string;
  YORCK_BASE: string;
  PUBLIC_BASE_URL?: string;

  YORCK_EMAIL?: string;
  YORCK_PASSWORD?: string;
  YORCK_UNLIMITED_CARD?: string;
  YORCK_MCP_AUTH_TOKEN?: string;
}

export interface Showtime {
  film: string;
  slug: string;
  tagline?: string;
  runtime: number;
  fsk?: number;
  genre?: string;
  yorckPick: boolean;
  start: string;
  end: string;
  cinema: string;
  cinemaSlug: string;
  district?: string;
  format: string;
  url: string;
  sessionId: string;
}

export interface Cinema {
  name: string;
  slug: string;
  shortName: string;
  vistaId: string;
  district: string;
  address: string;
  coordinates?: { lat: number; lon: number };
  numberOfAuditoriums?: number;
}

export interface FilmDetail {
  title: string;
  slug: string;
  vistaId: string;
  runtime: number;
  fsk?: number;
  genre?: string;
  director?: string;
  cast?: string[];
  year?: number;
  countries?: string[];
  originalLanguage?: string;
  tagline?: string;
  about?: string;
  trailerYouTubeId?: string;
  poster?: string;
  url: string;
}
