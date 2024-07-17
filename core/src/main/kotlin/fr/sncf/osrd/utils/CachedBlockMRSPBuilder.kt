package fr.sncf.osrd.utils

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim_infra.MRSP
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** Used to compute block MRSPs and min time required to reach a point, with proper caching */
data class CachedBlockMRSPBuilder(
    val rawInfra: RawInfra,
    val blockInfra: BlockInfra,
    val rollingStock: PhysicsRollingStock?,
) {
    private val mrspCache = mutableMapOf<BlockId, Envelope>()

    // 320km/h as default value (global max speed in France)
    private val rsMaxSpeed = rollingStock?.maxSpeed ?: (320.0 / 3.6)
    private val rsLength = rollingStock?.length ?: 0.0

    /** Returns the speed limits for the given block (cached). */
    fun getMRSP(block: BlockId): Envelope {
        return mrspCache.computeIfAbsent(block) {
            val pathProps = makePathProps(blockInfra, rawInfra, block, routes = listOf())
            MRSP.computeMRSP(pathProps, rsMaxSpeed, rsLength, false, null)
        }
    }

    /** Returns the time it takes to go through the given block, until `endOffset` if specified. */
    fun getBlockTime(
        block: BlockId,
        endOffset: Offset<Block>?,
    ): Double {
        if (endOffset?.distance == 0.meters) return 0.0
        val actualLength = endOffset ?: blockInfra.getBlockLength(block)
        val mrsp = getMRSP(block)
        return mrsp.interpolateArrivalAtClamp(actualLength.distance.meters)
    }
}