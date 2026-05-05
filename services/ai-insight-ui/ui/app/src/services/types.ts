/**
 * Domain types for the AI Insight UI.
 *
 * Extracted from the legacy services/api.ts so that types can be imported
 * independently of the dispatch wrappers (and so future view code can
 * call services/transport submit() without pulling in the wrapper layer).
 */

/* ─── Simulation runtime ─────────────────────────────────────────────────── */

export interface SimMeter {
  meter_id: string
  type: string
  base_power_kw: number
  peak_power_kw: number
}

export interface SimMetersResponse {
  meters: SimMeter[]
  count: number
}

export interface SimMeterReadings {
  active_power_l1_w: number
  active_power_l2_w: number
  active_power_l3_w: number
  voltage_l1_v: number
  voltage_l2_v: number
  voltage_l3_v: number
  current_l1_a: number
  current_l2_a: number
  current_l3_a: number
  power_factor: number
  frequency_hz: number
  total_energy_kwh: number
}

export interface SimMeterCurrent {
  timestamp: string
  meter_id: string
  readings: SimMeterReadings
}

export interface SimMeterHistoryReading extends SimMeterReadings {
  timestamp: string
}

export interface SimMeterHistory {
  meter_id: string
  readings: SimMeterHistoryReading[]
}

export interface SimWeatherStation {
  station_id: string
  latitude: number
  longitude: number
}

export interface SimWeatherStationsResponse {
  stations: SimWeatherStation[]
  count: number
}

export interface SimWeatherConditions {
  temperature_c: number
  humidity_percent: number
  wind_speed_ms: number
  cloud_cover_percent: number
  ghi_w_m2: number
}

export interface SimWeatherCurrent {
  timestamp: string
  conditions: SimWeatherConditions
}

export interface SimWeatherHistoryReading extends SimWeatherConditions {
  timestamp: string
}

export interface SimWeatherHistory {
  station_id: string
  readings: SimWeatherHistoryReading[]
}

export interface SimPrice {
  timestamp: string
  price_eur_per_kwh: number
  tariff_type: string
}

export interface SimPriceCurrent {
  feed_id: string
  current: SimPrice
}

export interface SimPriceHistory {
  feed_id: string
  prices: SimPrice[]
}

export interface SimPVSystem {
  system_id: string
  nominal_capacity_kwp: number
}

export interface SimPVSystemsResponse {
  systems: SimPVSystem[]
  count: number
}

export interface SimPVReadings {
  power_kw: number
  irradiance_w_m2: number
  panel_temp_c: number
  efficiency: number
}

export interface SimPVCurrent {
  timestamp: string
  system_id: string
  readings: SimPVReadings
}

export interface SimPVHistoryReading extends SimPVReadings {
  timestamp: string
}

export interface SimPVHistory {
  system_id: string
  readings: SimPVHistoryReading[]
}

export interface SimDevice {
  device_id: string
  device_type: string
  rated_power_kw: number
  duty_cycle_pct: number
  operating_windows: unknown[]
}

export interface SimLoadsResponse {
  devices: SimDevice[]
  count: number
}

export interface SimLoadCurrent {
  timestamp: string
  device_id: string
  state: 'on' | 'off' | 'standby'
  power_kw: number
}

export interface SimLoadHistoryReading {
  timestamp: string
  state: 'on' | 'off' | 'standby'
  power_kw: number
}

export interface SimLoadHistory {
  device_id: string
  readings: SimLoadHistoryReading[]
}

export interface SimSimulationStatus {
  state: string
  simulation_time: string
  seed: number
  acceleration: number
}

export interface SimHealth {
  status: string
  service: string
  version: string
  timestamp: string
}

export interface SimConfig {
  seed: number
  time_acceleration: number
  start_time: string
  simulation_state: string
  registered_meters: number
  registered_price_feeds: number
}

export interface SimPriceForecast {
  feed_id: string
  forecast: SimPrice[]
}

/* ─── Smart City ─────────────────────────────────────────────────────────── */

export interface SimStreetlight {
  light_id: string
  zone_id: string
  rated_power_w: number
}

export interface SimStreetlightList {
  streetlights: SimStreetlight[]
  count: number
}

export interface SimStreetlightCurrent {
  timestamp: string
  light_id: string
  zone_id: string
  dimming_level_pct: number
  power_w: number
}

export interface SimStreetlightHistoryReading {
  timestamp: string
  dimming_level_pct: number
  power_w: number
  zone_id: string
}

export interface SimStreetlightHistory {
  light_id: string
  readings: SimStreetlightHistoryReading[]
}

export interface SimTrafficZone {
  zone_id: string
}

export interface SimTrafficZoneList {
  zones: SimTrafficZone[]
  count: number
}

export interface SimTrafficCurrent {
  timestamp: string
  zone_id: string
  traffic_index: number
}

export interface SimTrafficHistoryReading {
  timestamp: string
  traffic_index: number
}

export interface SimTrafficHistory {
  zone_id: string
  readings: SimTrafficHistoryReading[]
}

export interface SimEventZone {
  zone_id: string
}

export interface SimEventZoneList {
  zones: SimEventZone[]
  count: number
}

export interface SimEventCurrent {
  timestamp: string
  zone_id: string
  event_type: string
  severity: string
  active: boolean
}

export interface SimEventHistoryReading {
  timestamp: string
  event_type: string
  severity: string
  active: boolean
}

export interface SimEventHistory {
  zone_id: string
  readings: SimEventHistoryReading[]
}

export interface SimCityWeatherCurrent {
  timestamp: string
  fog_index: number
  visibility: number
  sunrise_time: string
  sunset_time: string
}

export interface SimCityWeatherHistoryReading {
  timestamp: string
  fog_index: number
  visibility: number
  sunrise_time: string
  sunset_time: string
}

export interface SimCityWeatherHistory {
  readings: SimCityWeatherHistoryReading[]
}

/* ─── AI Insight ─────────────────────────────────────────────────────────── */

export interface AiInsightLatest {
  latest: {
    'energy-summary'?: unknown
    'anomaly-report'?: unknown
    'city-status'?: unknown
  }
}

export interface AiHealth {
  status: string
  service: string
}

/* ─── Platform endpoints (alerts/data-sources/provenance/integrations/
       schemas/admin) ─────────────────────────────────────────────────────── */

export interface PlatformAlert {
  id?: string
  useCase?: string
  source?: string
  category?: string
  severity?: 'info' | 'warning' | 'critical'
  timestamp?: string
  status?: 'open' | 'ack' | 'resolved'
  message?: string
}

export interface DataSourceRow {
  id: string
  name: string
  type: string
  protocol: string
  topic: string | null
  entity_count: number
  last_event_ts: string | null
  last_event_age_seconds: number | null
  status: string
}

export interface ProvenanceTransfer {
  id?: string
  contract_id?: string
  asset_id?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export interface ProvenanceInsight {
  output_id: string
  insight_type: string | null
  created_at: string | null
  user_roles: string | null
  asset_id: string | null
  agreement_id: string | null
  hmac: string | null
  bytes: number | null
}

export interface IntegrationServiceHealth {
  service: string
  url: string | null
  status: 'healthy' | 'degraded' | 'unreachable' | 'configured' | 'unconfigured'
  http_status?: number
  latency_ms?: number | null
  error?: string
  brokers?: string[]
  broker_count?: number
}

export interface IntegrationsHealth {
  generated_at: string
  summary: {
    healthy: number
    degraded: number
    unreachable: number
    configured: number
    total: number
  }
  services: IntegrationServiceHealth[]
}

export interface SchemaTable {
  catalog: string
  schema: string
  table: string
}

export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  position: number
}

export interface AdminUser {
  id: string
  username: string
  firstName: string
  lastName: string
  email: string
  enabled: boolean
  emailVerified: boolean
  createdTimestamp: number | null
  federationLink: string | null
}

export interface AdminRole {
  name: string
  description: string
  composite: boolean
  member_count: number | null
}

export interface AdminAccessEvent {
  id: string
  type: string
  timestamp: string
  user_id: string | null
  ip: string | null
  result: 'success' | 'failed'
  details: Record<string, unknown> | null
}
