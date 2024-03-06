use crate::error::Result;
use crate::modelsv2::{
    OperationalPointModel, RetrieveBatch, RetrieveBatchUnchecked, TrackSectionModel,
};
use crate::redis_utils::{RedisClient, RedisConnection};
use crate::schema::operational_point::OperationalPoint;
use crate::schema::track_section::LoadingGaugeType;
use crate::schema::utils::Identifier;
use crate::schema::v2::trainschedule::PathItemLocation;
use crate::schema::Direction;
use crate::schema::TrackOffset;
use crate::views::get_app_version;
use crate::DbPool;
use actix_web::post;
use actix_web::web::{Data, Json, Path};
use chrono::Duration;
use diesel_async::AsyncPgConnection as PgConnection;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use thiserror::Error;
use utoipa::ToSchema;

type TrackOffsetResult = std::result::Result<Vec<Vec<TrackOffset>>, PathfindingResult>;

crate::routes! {
    "/v2/infra/{infra_id}/pathfinding/blocks" => {post},
}

crate::schemas! {
    PathfindingInput,
    PathfindingResult,
    TrackRange,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
enum PathfindingError {
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum PathfindingResult {
    Success {
        #[schema(inline)]
        blocks: Vec<Identifier>,
        #[schema(inline)]
        routes: Vec<Identifier>,
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    NotFoundInBlocks {
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    NotFoundInRoutes {
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    NotFoundInTracks,
    IncompatibleElectrification {
        #[schema(inline)]
        blocks: Vec<Identifier>,
        #[schema(inline)]
        routes: Vec<Identifier>,
        track_section_ranges: Vec<TrackRange>,
        length: u64,
        incompatible_ranges: Vec<(u64, u64)>,
    },
    IncompatibleLoadingGauge {
        #[schema(inline)]
        blocks: Vec<Identifier>,
        #[schema(inline)]
        routes: Vec<Identifier>,
        track_section_ranges: Vec<TrackRange>,
        length: u64,
        incompatible_ranges: Vec<(u64, u64)>,
    },
    IncompatibleSignalingSystem {
        #[schema(inline)]
        blocks: Vec<Identifier>,
        #[schema(inline)]
        routes: Vec<Identifier>,
        track_section_ranges: Vec<TrackRange>,
        length: u64,
        incompatible_ranges: Vec<(u64, u64)>,
    },
    InvalidPathItem {
        index: usize,
        #[schema(inline)]
        path_item: PathItemLocation,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
pub struct TrackRange {
    #[schema(inline)]
    track_section: Identifier,
    begin: u64,
    end: u64,
    direction: Direction,
}

/// Path input is described by some rolling stock information
/// and a list of path waypoints
#[derive(Deserialize, Clone, Debug, Hash, ToSchema)]
pub struct PathfindingInput {
    /// The loading gauge of the rolling stock
    rolling_stock_loading_gauge: LoadingGaugeType,
    /// Can the rolling stock run on non-electrified tracks
    rolling_stock_is_thermal: bool,
    /// List of supported electrification modes.
    /// Empty if does not support any electrification
    rolling_stock_supported_electrification: Vec<String>,
    /// List of supported signaling systems
    rolling_stock_supported_signaling_systems: Vec<String>,
    /// List of waypoints given to the pathfinding
    #[schema(inline)]
    path_items: Vec<PathItemLocation>,
}

/// Compute a pathfinding
#[utoipa::path(
    tag = "pathfindingv2",
    request_body = PathfindingInput,
    responses(
        (status = 200, description = "Pathfinding Result", body = PathfindingResult),
    ),
)]
#[post("")]
async fn post(
    db_pool: Data<DbPool>,
    redis_client: Data<RedisClient>,
    infra_id: Path<i64>,
    data: Json<PathfindingInput>,
) -> Result<Json<PathfindingResult>> {
    let infra_id = infra_id.into_inner();
    let path_input = data.into_inner();
    let conn = &mut db_pool.get().await?;
    let mut redis_conn = redis_client.get_connection().await?;
    Ok(Json(
        pathfinding_blocks(conn, &mut redis_conn, infra_id, &path_input).await?,
    ))
}

pub async fn pathfinding_blocks(
    conn: &mut PgConnection,
    redis_conn: &mut RedisConnection,
    infra_id: i64,
    path_input: &PathfindingInput,
) -> Result<PathfindingResult> {
    use crate::models::Infra;
    use crate::models::Retrieve;
    // Deduce infra version from infra
    let infra = Infra::retrieve_conn(conn, infra_id)
        .await?
        .ok_or(PathfindingError::InfraNotFound { infra_id })?;
    let infra_version = infra.version.unwrap();
    // Compute unique hash of PathInput
    let hash = path_input_hash(infra_id, &infra_version, path_input);
    // Try to retrieve the result from Redis
    let seconds = Duration::weeks(1).num_seconds();
    let result: Option<PathfindingResult> = redis_conn.json_get_ex(&hash, seconds as usize).await?;
    if let Some(pathfinding) = result {
        return Ok(pathfinding);
    }
    // If miss cache:
    // 1) extract locations from path items
    let path_items = path_input.clone().path_items;
    let result = extract_location_from_path_items(conn, infra_id, &path_items).await?;
    let track_offsets = match result {
        Ok(track_offsets) => track_offsets,
        Err(e) => return Ok(e),
    };

    // Check if tracks exist
    if let Err(pathfinding_result) =
        check_tracks_from_path_items(conn, infra_id, track_offsets).await?
    {
        return Ok(pathfinding_result);
    }

    // 2) compute path from core
    // TODO : a function that call the pathfinding core endpoint will be soon implemented
    // issue: https://github.com/osrd-project/osrd/issues/6741
    let pathfinding_result = PathfindingResult::Success {
        blocks: vec![],
        routes: vec![],
        track_section_ranges: vec![],
        length: 0,
    };
    // 3) Put in cache
    redis_conn
        .json_set_ex(&hash, &pathfinding_result, seconds as u64)
        .await?;

    Ok(pathfinding_result)
}

/// Generates a unique hash based on the pathfinding entries.
/// We need to recalculate the path if:
///   - The path entry is different
///   - The infrastructure has been modified
///   - The application has been updated (the algorithm or payloads may have changed)
fn path_input_hash(infra: i64, infra_version: &String, path_input: &PathfindingInput) -> String {
    // Retrieve OSRD Version
    let osrd_version = get_app_version().unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    path_input.hash(&mut hasher);
    let hash_path_input = hasher.finish();
    format!("{osrd_version}.{infra}.{infra_version}.{hash_path_input}")
}

fn collect_path_item_ids(path_items: &[PathItemLocation]) -> (Vec<String>, Vec<i64>, Vec<String>) {
    let mut trigrams: Vec<String> = Vec::new();
    let mut ops_uic: Vec<i64> = Vec::new();
    let mut ops_id: Vec<String> = Vec::new();

    for item in path_items {
        match item {
            PathItemLocation::OperationalPointDescription { trigram, .. } => {
                trigrams.push(trigram.clone().0);
            }
            PathItemLocation::OperationalPointUic { uic, .. } => {
                ops_uic.push(*uic as i64);
            }
            PathItemLocation::OperationalPointId {
                operational_point, ..
            } => {
                ops_id.push(operational_point.clone().0);
            }
            _ => {}
        }
    }
    (trigrams, ops_uic, ops_id)
}

async fn retrieve_op_from_locations(
    conn: &mut PgConnection,
    infra_id: i64,
    ops_uic: &[i64],
    trigrams: &[String],
    ops_id: &[String],
) -> Result<(
    HashMap<i64, Vec<OperationalPointModel>>,
    HashMap<String, Vec<OperationalPointModel>>,
    HashMap<String, OperationalPointModel>,
)> {
    let mut uic_to_ops: HashMap<i64, Vec<OperationalPointModel>> = HashMap::new();
    OperationalPointModel::retrieve_from_uic(conn, infra_id, ops_uic)
        .await?
        .into_iter()
        .for_each(|op| {
            uic_to_ops
                .entry(op.extensions.identifier.clone().unwrap().uic)
                .or_default()
                .push(op)
        });

    let mut trigrams_to_ops: HashMap<String, Vec<OperationalPointModel>> = HashMap::new();
    OperationalPointModel::retrieve_from_trigrams(conn, infra_id, trigrams)
        .await?
        .into_iter()
        .for_each(|op| {
            trigrams_to_ops
                .entry(op.extensions.sncf.clone().unwrap().trigram)
                .or_default()
                .push(op)
        });

    let ops_id = ops_id.iter().map(|obj_id| (infra_id, obj_id.clone()));
    // a check for missing ids is performed later
    let ids_to_ops: HashMap<_, _> =
        OperationalPointModel::retrieve_batch_unchecked::<_, Vec<_>>(conn, ops_id)
            .await?
            .into_iter()
            .map(|op| (op.obj_id.clone(), op))
            .collect();

    Ok((uic_to_ops, trigrams_to_ops, ids_to_ops))
}

/// extract locations from path items
async fn extract_location_from_path_items(
    conn: &mut PgConnection,
    infra_id: i64,
    path_items: &[PathItemLocation],
) -> Result<TrackOffsetResult> {
    let (trigrams, ops_uic, ops_id) = collect_path_item_ids(path_items);

    let (uic_to_ops, trigrams_to_ops, ids_to_ops) =
        retrieve_op_from_locations(conn, infra_id, &ops_uic, &trigrams, &ops_id).await?;

    let mut result: Vec<Vec<_>> = Vec::default();
    for (index, path_item) in path_items.iter().enumerate() {
        let track_offsets = match path_item {
            PathItemLocation::TrackOffset(track_offset) => {
                vec![TrackOffset {
                    track: track_offset.track.clone(),
                    offset: track_offset.offset,
                }]
            }
            PathItemLocation::OperationalPointId { operational_point } => {
                match ids_to_ops.get(&operational_point.0) {
                    Some(op) => OperationalPoint::track_offset(op),
                    None => {
                        return Ok(Err(PathfindingResult::InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        }))
                    }
                }
            }
            PathItemLocation::OperationalPointDescription {
                trigram,
                secondary_code,
            } => {
                let ops = trigrams_to_ops.get(&trigram.0).cloned();
                let ops = secondary_code_filter(secondary_code, ops);
                match ops {
                    Some(ops) if !ops.is_empty() => track_offsets_from_ops(&ops),
                    _ => {
                        return Ok(Err(PathfindingResult::InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        }))
                    }
                }
            }
            PathItemLocation::OperationalPointUic {
                uic,
                secondary_code,
            } => {
                let mut ops = uic_to_ops.get(&(*uic as i64)).cloned();
                ops = secondary_code_filter(secondary_code, ops);
                match ops {
                    Some(ops) if !ops.is_empty() => track_offsets_from_ops(&ops),
                    _ => {
                        return Ok(Err(PathfindingResult::InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        }))
                    }
                }
            }
        };
        result.push(track_offsets);
    }
    Ok(Ok(result))
}

async fn check_tracks_from_path_items(
    conn: &mut PgConnection,
    infra_id: i64,
    track_offsets: Vec<Vec<TrackOffset>>,
) -> Result<std::result::Result<(), PathfindingResult>> {
    for tracks in track_offsets.clone() {
        let ids = tracks
            .iter()
            .map(|track_offset| (infra_id, track_offset.track.0.clone()));
        let (_, missings): (Vec<_>, _) = TrackSectionModel::retrieve_batch(conn, ids).await?;
        if !missings.is_empty() {
            return Ok(Err(PathfindingResult::NotFoundInTracks));
        }
    }
    Ok(Ok(()))
}

fn track_offsets_from_ops(ops: &[OperationalPointModel]) -> Vec<TrackOffset> {
    ops.iter()
        .flat_map(OperationalPoint::track_offset)
        .collect()
}

fn secondary_code_filter(
    secondary_code: &Option<String>,
    ops: Option<Vec<OperationalPointModel>>,
) -> Option<Vec<OperationalPointModel>> {
    if let Some(secondary_code) = secondary_code {
        ops.map(|ops| {
            ops.into_iter()
                .filter(|op| &op.extensions.sncf.as_ref().unwrap().ch == secondary_code)
                .collect()
        })
    } else {
        None
    }
}