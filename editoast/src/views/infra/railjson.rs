use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::header;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Extension;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_schemas::infra::RailJson;
use editoast_schemas::infra::RAILJSON_VERSION;
use enum_map::EnumMap;
use futures::future::try_join_all;
use serde::Deserialize;
use serde::Serialize;
use strum::IntoEnumIterator;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::models::prelude::*;
use crate::models::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::AppState;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::primitives::ObjectType;

crate::routes! {
    "/{infra_id}/railjson" => get_railjson,
    "/railjson" => post_railjson,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:railjson")]
enum ListErrorsRailjson {
    #[error("Wrong Railjson version provided")]
    WrongRailjsonVersionProvided,
}

/// Serialize an infra
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200,  description = "The infra in railjson format", body = RailJson),
        (status = 404, description = "The infra was not found"),
    )
)]
async fn get_railjson(
    Path(infra): Path<InfraIdParam>,
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let infra_id = infra.infra_id;
    let infra_meta = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    let futures: Vec<_> = ObjectType::iter()
        .map(|object_type| (object_type, db_pool.get()))
        .map(|(object_type, conn_future)| async move {
            let conn = &mut conn_future.await?;
            let railjson_data = Infra::get_railjson(conn, infra_id, &object_type).await?;
            let result: Result<_> = Ok((object_type, railjson_data));
            result
        })
        .collect();

    // TODO: we could map the objects in the async loop above, so we can start processing some objects
    // even if we didn’t get everything back yet
    let res: EnumMap<_, _> = try_join_all(futures)
        .await?
        .into_iter()
        .map(|(obj_type, objects)| {
            let obj_list = objects
                .into_iter()
                .map(|obj| obj.railjson)
                .collect::<Vec<_>>()
                .join(",");
            (obj_type, format!("[{obj_list}]"))
        })
        .collect();

    // Here we avoid the deserialization of the whole RailJson object
    let railjson = format!(
        r#"{{
            "version": "{version}",
            "track_sections": {track_sections},
            "signals": {signals},
            "speed_sections": {speed_sections},
            "detectors": {detectors},
            "switches": {switches},
            "extended_switch_types": {switch_types},
            "buffer_stops": {buffer_stops},
            "routes": {routes},
            "operational_points": {operational_points},
            "electrifications": {electrifications},
            "neutral_sections": {neutral_sections}
        }}"#,
        version = infra_meta.railjson_version,
        track_sections = res[ObjectType::TrackSection],
        signals = res[ObjectType::Signal],
        speed_sections = res[ObjectType::SpeedSection],
        detectors = res[ObjectType::Detector],
        switches = res[ObjectType::Switch],
        switch_types = res[ObjectType::SwitchType],
        buffer_stops = res[ObjectType::BufferStop],
        routes = res[ObjectType::Route],
        operational_points = res[ObjectType::OperationalPoint],
        electrifications = res[ObjectType::Electrification],
        neutral_sections = res[ObjectType::NeutralSection]
    );

    Ok((
        StatusCode::OK,
        [
            (
                header::CONTENT_TYPE.as_str(),
                headers::ContentType::json().to_string(),
            ),
            ("x-infra-version", infra_meta.version),
        ],
        railjson,
    ))
}

/// Represents the query parameters for a `POST /infra/railjson` request
#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct PostRailjsonQueryParams {
    /// The name of the infrastructure.
    name: String,
    /// Flag indicating whether to generate data.
    #[serde(default)]
    generate_data: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
struct PostRailjsonResponse {
    pub infra: i64,
}

/// Import an infra from railjson
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(PostRailjsonQueryParams),
    request_body = RailJson,
    responses(
        (status = 201,  description = "The imported infra id", body = inline(PostRailjsonResponse)),
        (status = 404, description = "The infra was not found"),
    )
)]
async fn post_railjson(
    State(AppState {
        db_pool,
        infra_caches,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Query(params): Query<PostRailjsonQueryParams>,
    Json(railjson): Json<RailJson>,
) -> Result<Json<PostRailjsonResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    if railjson.version != RAILJSON_VERSION {
        return Err(ListErrorsRailjson::WrongRailjsonVersionProvided.into());
    }
    let mut infra = Infra::changeset()
        .name(params.name.clone())
        .last_railjson_version()
        .persist(railjson, &mut db_pool.get().await?)
        .await?;
    let infra_id = infra.id;

    infra
        .bump_version(&mut db_pool.get().await?)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    if params.generate_data {
        let infra_cache =
            InfraCache::get_or_load(&mut db_pool.get().await?, &infra_caches, &infra).await?;
        infra.refresh(db_pool, true, &infra_cache).await?;
    }

    Ok(Json(PostRailjsonResponse { infra: infra.id }))
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::models::fixtures::create_empty_infra;
    use crate::views::test_app::TestAppBuilder;
    use editoast_schemas::infra::SwitchType;

    #[rstest]
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    #[serial_test::serial]
    async fn test_get_railjson() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        apply_create_operation(
            &SwitchType::default().into(),
            empty_infra.id,
            &mut db_pool.get_ok(),
        )
        .await
        .expect("Failed to create SwitchType object");

        let request = app.get(&format!("/infra/{}/railjson", empty_infra.id));

        let railjson: RailJson = app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(railjson.version, RAILJSON_VERSION);
        assert_eq!(railjson.extended_switch_types.len(), 1);
    }

    #[rstest]
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    #[serial_test::serial]
    async fn test_post_railjson() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let railjson = RailJson {
            buffer_stops: (0..10).map(|_| Default::default()).collect(),
            routes: (0..10).map(|_| Default::default()).collect(),
            extended_switch_types: (0..10).map(|_| Default::default()).collect(),
            switches: (0..10).map(|_| Default::default()).collect(),
            track_sections: (0..10).map(|_| Default::default()).collect(),
            speed_sections: (0..10).map(|_| Default::default()).collect(),
            electrifications: (0..10).map(|_| Default::default()).collect(),
            signals: (0..10).map(|_| Default::default()).collect(),
            detectors: (0..10).map(|_| Default::default()).collect(),
            operational_points: (0..10).map(|_| Default::default()).collect(),
            ..Default::default()
        };

        let req = app
            .post("/infra/railjson?name=post_railjson_test")
            .json(&railjson);

        let res: PostRailjsonResponse = app.fetch(req).assert_status(StatusCode::OK).json_into();

        assert!(Infra::delete_static(&mut db_pool.get_ok(), res.infra)
            .await
            .unwrap());
    }
}
