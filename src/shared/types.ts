// src/shared/types.ts — Gstack Ecosystem shared types
//
// Ecosystem-wide type definitions following snake_case convention.
// These types are shared across RenderForge, ProfileCore, CubeInsight,
// VoiceCore, and VisualCore projects.

/** Video metadata tracked across the ecosystem pipeline */
export interface EcosystemVideo {
  video_id: string;
  channel_id: string;
  ci_score: number;       // CubeInsight relevance score
  tier: string;           // T1-T10
  view_count: number;
  status: 'draft' | 'rendering' | 'ready' | 'uploaded' | 'published';
}

/** Pipeline stage identifiers for the Infinity Loop */
export type PipelineStage =
  | 'topic_selection'
  | 'script_generation'
  | 'voice_synthesis'
  | 'image_generation'
  | 'video_generation'
  | 'rendering'
  | 'quality_check'
  | 'youtube_upload';

/** Execution record for a pipeline run */
export interface PipelineExecution {
  execution_id: string;
  workflow_name: string;
  stage: PipelineStage;
  status: 'running' | 'success' | 'failed' | 'waiting';
  started_at: string;
  completed_at?: string;
  channel_id?: string;
  tier?: string;
}

/** Anti-detect browser profile (ProfileCore) */
export interface BrowserProfile {
  profile_id: string;       // e.g. ML-T2-001
  tier: string;
  channel_name: string;
  proxy_ip: string;
  status: 'active' | 'blocked' | 'idle';
  last_session_at?: string;
}
