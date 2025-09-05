use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    Json,
};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::database::DbPool;
use crate::models::{
    ApiResponse, CreateEventRequest, CreateNoteRequest, Event, EventFile, EventNote,
    EventWithDetails, FileUploadResponse, UpdateEventRequest,
};

pub async fn create_event(
    State(pool): State<DbPool>,
    Json(payload): Json<CreateEventRequest>,
) -> Result<Json<ApiResponse<Event>>, StatusCode> {
    let event = sqlx::query_as::<_, Event>(
        r#"
        INSERT INTO events (id, title, description, course, event_type, start_time, end_time, location, instructor, priority, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, NOW(), NOW())
        RETURNING *
        "#,
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.course)
    .bind(&payload.event_type)
    .bind(&payload.start_time)
    .bind(&payload.end_time)
    .bind(&payload.location)
    .bind(&payload.instructor)
    .bind(payload.priority.as_deref().unwrap_or("medium"))
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create event: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(ApiResponse::success(event)))
}

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

pub async fn update_event(
    State(pool): State<DbPool>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<UpdateEventRequest>,
) -> Result<Json<ApiResponse<Event>>, StatusCode> {
    let updated_event = sqlx::query_as::<_, Event>(
        r#"
        UPDATE events SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            course = COALESCE($4, course),
            event_type = COALESCE($5, event_type),
            start_time = COALESCE($6, start_time),
            end_time = COALESCE($7, end_time),
            location = COALESCE($8, location),
            instructor = COALESCE($9, instructor),
            priority = COALESCE($10, priority),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(event_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.course)
    .bind(&payload.event_type)
    .bind(&payload.start_time)
    .bind(&payload.end_time)
    .bind(&payload.location)
    .bind(&payload.instructor)
    .bind(&payload.priority)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ApiResponse::success(updated_event)))
}

pub async fn delete_event(
    State(pool): State<DbPool>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    sqlx::query("DELETE FROM events WHERE id = $1")
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ApiResponse::success(())))
}

// Get event with all details (files and notes)
pub async fn get_event_details(
    State(pool): State<DbPool>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<ApiResponse<EventWithDetails>>, StatusCode> {
    // Get the event
    let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(event_id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let event = match event {
        Some(event) => event,
        None => return Err(StatusCode::NOT_FOUND),
    };

    // Get files for this event
    let files = sqlx::query_as::<_, EventFile>(
        "SELECT * FROM event_files WHERE event_id = $1 ORDER BY created_at DESC"
    )
    .bind(event_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get notes for this event
    let notes = sqlx::query_as::<_, EventNote>(
        "SELECT * FROM event_notes WHERE event_id = $1 ORDER BY created_at ASC"
    )
    .bind(event_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let event_details = EventWithDetails {
        event,
        files,
        notes,
    };

    Ok(Json(ApiResponse::success(event_details)))
}

// Upload file to event
pub async fn upload_file(
    State(pool): State<DbPool>,
    Path(event_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<FileUploadResponse>>, StatusCode> {
    let mut uploaded_by = "Anonymous".to_string();
    let mut file_data: Option<(String, Vec<u8>, String)> = None;

    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or("").to_string();
        
        match name.as_str() {
            "uploaded_by" => {
                let data = field.bytes().await.unwrap();
                uploaded_by = String::from_utf8_lossy(&data).to_string();
            }
            "file" => {
                let filename = field.file_name().unwrap_or("unknown").to_string();
                let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
                let data = field.bytes().await.unwrap();
                file_data = Some((filename, data.to_vec(), content_type));
            }
            _ => {}
        }
    }

    let (original_filename, data, mime_type) = file_data.ok_or(StatusCode::BAD_REQUEST)?;
    
    // Generate unique filename
    let file_id = Uuid::new_v4();
    let extension = std::path::Path::new(&original_filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    let filename = if extension.is_empty() {
        file_id.to_string()
    } else {
        format!("{}.{}", file_id, extension)
    };

    // Create uploads directory if it doesn't exist
    fs::create_dir_all("uploads").await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Save file to disk
    let file_path = format!("uploads/{}", filename);
    let mut file = fs::File::create(&file_path).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    file.write_all(&data).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Save file info to database
    let file_record = sqlx::query_as::<_, EventFile>(
        r#"
        INSERT INTO event_files (id, event_id, filename, original_filename, file_size, mime_type, uploaded_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
        "#
    )
    .bind(file_id)
    .bind(event_id)
    .bind(&filename)
    .bind(&original_filename)
    .bind(data.len() as i64)
    .bind(&mime_type)
    .bind(&uploaded_by)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to save file record: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = FileUploadResponse {
        id: file_record.id,
        filename: file_record.filename,
        original_filename: file_record.original_filename,
        file_size: file_record.file_size,
        uploaded_by: file_record.uploaded_by,
    };

    Ok(Json(ApiResponse::success(response)))
}

// Add note to event
pub async fn add_note(
    State(pool): State<DbPool>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreateNoteRequest>,
) -> Result<Json<ApiResponse<EventNote>>, StatusCode> {
    let note = sqlx::query_as::<_, EventNote>(
        r#"
        INSERT INTO event_notes (id, event_id, author_name, content, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
        RETURNING *
        "#
    )
    .bind(event_id)
    .bind(&payload.author_name)
    .bind(&payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create note: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(ApiResponse::success(note)))
}

// Get notes for an event
pub async fn get_notes(
    State(pool): State<DbPool>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<ApiResponse<Vec<EventNote>>>, StatusCode> {
    let notes = sqlx::query_as::<_, EventNote>(
        "SELECT * FROM event_notes WHERE event_id = $1 ORDER BY created_at ASC"
    )
    .bind(event_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ApiResponse::success(notes)))
}

// Download file
pub async fn download_file(
    State(pool): State<DbPool>,
    Path(file_id): Path<Uuid>,
) -> Result<Response<Body>, StatusCode> {
    let file_record = sqlx::query_as::<_, EventFile>(
        "SELECT * FROM event_files WHERE id = $1"
    )
    .bind(file_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let file_record = match file_record {
        Some(record) => record,
        None => return Err(StatusCode::NOT_FOUND),
    };

    let file_path = format!("uploads/{}", file_record.filename);
    let file_data = fs::read(&file_path).await.map_err(|_| StatusCode::NOT_FOUND)?;

    // Build response with proper headers
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            file_record.mime_type.as_str()
        )
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file_record.original_filename)
        )
        .header(
            header::CONTENT_LENGTH,
            file_data.len().to_string()
        )
        .body(Body::from(file_data))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(response)
}

