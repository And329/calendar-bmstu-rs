use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::database::DbPool;
use crate::models::{ApiResponse, Event};

pub async fn get_events(
    State(pool): State<DbPool>,
) -> Result<Json<ApiResponse<Vec<Event>>>, StatusCode> {
    let events = sqlx::query_as::<_, Event>("SELECT * FROM events ORDER BY start_time ASC")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ApiResponse::success(events)))
}

pub async fn get_event(
    State(pool): State<DbPool>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<ApiResponse<Event>>, StatusCode> {
    let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(event_id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match event {
        Some(event) => Ok(Json(ApiResponse::success(event))),
        None => Err(StatusCode::NOT_FOUND),
    }
}
