pub mod create;
mod delete;
mod update;

use super::ObjectRef;
use crate::{error::Result, infra_cache::ObjectCache};
use diesel_async::AsyncPgConnection as PgConnection;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use std::ops::Deref as _;
use thiserror::Error;
use utoipa::ToSchema;

pub use self::delete::DeleteOperation;
pub use create::RailjsonObject;
pub use update::UpdateOperation;

crate::schemas! { Operation, }

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(tag = "operation_type", deny_unknown_fields)]
pub enum Operation {
    #[serde(rename = "CREATE")]
    #[schema(value_type = RailjsonObject)]
    Create(Box<RailjsonObject>),
    #[serde(rename = "UPDATE")]
    Update(UpdateOperation),
    #[serde(rename = "DELETE")]
    Delete(DeleteOperation),
}

#[derive(Clone)]
pub enum CacheOperation {
    Create(ObjectCache),
    Update(ObjectCache),
    Delete(ObjectRef),
}

impl Operation {
    pub async fn apply(
        &self,
        infra_id: i64,
        conn: &mut PgConnection,
    ) -> Result<Option<RailjsonObject>> {
        match self {
            Operation::Delete(deletion) => {
                deletion.apply(infra_id, conn).await?;
                Ok(None)
            }
            Operation::Create(railjson_object) => {
                create::apply_create_operation(railjson_object, infra_id, conn).await?;
                Ok(Some(railjson_object.deref().clone()))
            }
            Operation::Update(update) => {
                let railjson_object = update.apply(infra_id, conn).await?;
                Ok(Some(railjson_object))
            }
        }
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "operation")]
enum OperationError {
    // To modify
    #[error("Object '{obj_id}', could not be found in the infrastructure '{infra_id}'")]
    #[editoast_error(status = 404)]
    ObjectNotFound { obj_id: String, infra_id: i64 },
    #[error("Empty string id is forbidden")]
    EmptyId,
    #[error("Update operation try to modify object id, which is forbidden")]
    ModifyId,
    #[error("A Json Patch error occurred: '{}'", .0)]
    InvalidPatch(String),
}
