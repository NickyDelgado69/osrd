package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.utils.JavaInteroperabilityToolsKt.rangeMapEntryToSpeedLimitProperty;
import static fr.sncf.osrd.utils.units.Distance.toMeters;
import static fr.sncf.osrd.utils.units.Speed.toMetersPerSecond;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.utils.SelfTypeHolder;
import java.util.ArrayList;
import java.util.List;

/** MRSP = most restrictive speed profile: maximum speed allowed at any given point. */
public class MRSP {

    /**
     * Computes the MSRP for a rolling stock on a given path.
     *
     * @param path corresponding path.
     * @param rollingStock corresponding rolling stock.
     * @param addRollingStockLength whether the rolling stock length should be taken into account in
     *     the computation.
     * @param trainTag corresponding train.
     * @return the corresponding MRSP as an Envelope.
     */
    public static Envelope computeMRSP(
            PathProperties path, PhysicsRollingStock rollingStock, boolean addRollingStockLength, String trainTag) {
        return computeMRSP(path, rollingStock.getMaxSpeed(), rollingStock.getLength(), addRollingStockLength, trainTag);
    }

    /**
     * Computes the MSRP for a rolling stock on a given path.
     *
     * @param path corresponding path.
     * @param rsMaxSpeed rolling stock max speed (m/s)
     * @param rsLength length of the rolling stock (m)
     * @param addRollingStockLength whether the rolling stock length should be taken into account in
     *     the computation.
     * @param trainTag corresponding train.
     * @return the corresponding MRSP as an Envelope.
     */
    public static Envelope computeMRSP(
            PathProperties path, double rsMaxSpeed, double rsLength, boolean addRollingStockLength, String trainTag) {
        var builder = new MRSPEnvelopeBuilder();
        var pathLength = toMeters(path.getLength());

        // Add a limit corresponding to the hardware's maximum operational speed
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.TRAIN_LIMIT),
                new double[] {0, pathLength},
                new double[] {rsMaxSpeed, rsMaxSpeed}));

        var offset = addRollingStockLength ? rsLength : 0.;
        var speedLimitProperties = path.getSpeedLimitProperties(trainTag);
        for (var speedLimitPropertyRange : speedLimitProperties) {
            // Compute where this limit is active from and to
            var start = toMeters(speedLimitPropertyRange.getLower());
            var end = Math.min(pathLength, offset + toMeters(speedLimitPropertyRange.getUpper()));
            var speedLimitProp = rangeMapEntryToSpeedLimitProperty(speedLimitPropertyRange);
            var speed = toMetersPerSecond(speedLimitProp.speed());
            var attrs = new ArrayList<SelfTypeHolder>(
                    List.of(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.SPEED_LIMIT));
            if (speedLimitProp.source() != null) {
                attrs.add(speedLimitProp.source());
            }
            if (speed != 0)
                // Add the envelope part corresponding to the restricted speed section
                builder.addPart(
                        EnvelopePart.generateTimes(attrs, new double[] {start, end}, new double[] {speed, speed}));
        }
        return builder.build();
    }
}
