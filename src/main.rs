use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::env;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod database;
mod handlers;
mod models;

use database::init_database;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "calendar_rs=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Initialize database
    let pool = init_database().await?;

    let app = Router::new()
        // Simple event routes (no authentication)
        .route("/api/events", get(handlers::events::get_events))
        .route("/api/events", post(handlers::events::create_event))
        .route("/api/events/:id", get(handlers::events::get_event))
        .route("/api/events/:id", put(handlers::events::update_event))
        .route("/api/events/:id", delete(handlers::events::delete_event))
        
        // Event details with files and notes
        .route("/api/events/:id/details", get(handlers::events::get_event_details))
        
        // File upload and download
        .route("/api/events/:id/files", post(handlers::events::upload_file))
        .route("/api/files/:id/download", get(handlers::events::download_file))
        
        // Notes/chat for events
        .route("/api/events/:id/notes", get(handlers::events::get_notes))
        .route("/api/events/:id/notes", post(handlers::events::add_note))
        
        // Serve static files
        .nest_service("/", ServeDir::new("static"))
        
        // Add middleware
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
        )
        .with_state(pool);

    // Get server configuration
    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("{}:{}", host, port);

    tracing::info!("Starting server on {}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
