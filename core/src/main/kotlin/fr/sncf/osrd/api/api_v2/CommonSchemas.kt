package fr.sncf.osrd.api.api_v2

import com.squareup.moshi.*
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

data class TrackRange(
    @Json(name = "track_section") val trackSection: String,
    var begin: Offset<TrackSection>,
    var end: Offset<TrackSection>,
    val direction: EdgeDirection,
)

class RangeValues<T>(val boundaries: List<Distance> = listOf(), val values: List<T> = listOf())

class ZoneUpdate(
    val zone: String,
    val time: TimeDelta,
    val position: Offset<Path>,
    @Json(name = "is_entry") val isEntry: Boolean,
)

class SignalSighting(
    val signal: String,
    val time: TimeDelta,
    val position: Offset<Path>,
    val state: String,
)

class RoutingRequirement(
    val route: String,
    @Json(name = "begin_time") val beginTime: TimeDelta,
    val zones: List<RoutingZoneRequirement>
)

class RoutingZoneRequirement(
    val zone: String,
    @Json(name = "entry_detector") val entryDetector: String,
    @Json(name = "exit_detector") val exitDetector: String,
    val switches: Map<String, String>,
    @Json(name = "end_time") val endTime: TimeDelta,
)

class SpacingRequirement(
    val zone: String,
    @Json(name = "begin_time") val beginTime: TimeDelta,
    @Json(name = "end_time") val endTime: TimeDelta,
)