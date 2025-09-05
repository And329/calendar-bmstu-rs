use sqlx::{PgPool, Pool, Postgres};
use std::env;

pub type DbPool = Pool<Postgres>;

pub async fn create_pool() -> Result<DbPool, sqlx::Error> {
    let database_url: String = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPool::connect(&database_url).await?;
    
    Ok(pool)
}

pub async fn init_database() -> Result<DbPool, Box<dyn std::error::Error>> {
    let pool = create_pool().await?;
    
    tracing::info!("Database connection established");
    
    Ok(pool)
}
