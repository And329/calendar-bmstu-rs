use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub course: Option<String>,
    pub event_type: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub location: Option<String>,
    pub instructor: Option<String>,
    pub priority: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: Option<String>,
    pub course: Option<String>,
    pub event_type: String,
    pub start_time: String,
    pub end_time: String,
    pub location: Option<String>,
    pub instructor: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateEventRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub course: Option<String>,
    pub event_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub location: Option<String>,
    pub instructor: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventFile {
    pub id: Uuid,
    pub event_id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub uploaded_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventNote {
    pub id: Uuid,
    pub event_id: Uuid,
    pub author_name: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateNoteRequest {
    pub author_name: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileUploadResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub uploaded_by: String,
}


#[derive(Debug, Serialize, Deserialize)]
pub struct EventsQuery {
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub event_type: Option<String>,
    pub course: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecurrencePattern {
    pub frequency: String, // "weekly", "daily", etc.
    pub days_of_week: Option<Vec<u8>>, // 0=Sunday, 1=Monday, etc.
    pub interval: Option<u32>, // Every N weeks/days
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventWithDetails {
    #[serde(flatten)]
    pub event: Event,
    pub files: Vec<EventFile>,
    pub notes: Vec<EventNote>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
        }
    }

    #[allow(dead_code)]
    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            message: Some(message),
        }
    }
}
