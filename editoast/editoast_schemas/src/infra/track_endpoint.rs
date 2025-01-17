use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Direction;
use super::Endpoint;
use crate::primitives::Identifier;

editoast_common::schemas! {
    TrackEndpoint,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash, ToSchema)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct TrackEndpoint {
    #[derivative(Default(value = "Endpoint::Begin"))]
    pub endpoint: Endpoint,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
    pub track: Identifier,
}

impl TrackEndpoint {
    /// Create a new `TrackEndpoint` from a track id and an endpoint.
    pub fn new<T: AsRef<str>>(track: T, endpoint: Endpoint) -> Self {
        TrackEndpoint {
            track: track.as_ref().into(),
            endpoint,
        }
    }

    /// Create a `TrackEndpoint` from a track id and a direction.
    pub fn from_track_and_direction<T: AsRef<str>>(track: T, dir: Direction) -> TrackEndpoint {
        let endpoint = match dir {
            Direction::StartToStop => Endpoint::End,
            Direction::StopToStart => Endpoint::Begin,
        };
        TrackEndpoint {
            track: track.as_ref().into(),
            endpoint,
        }
    }
}
