package fr.sncf.osrd.api.api_v2.standalone_sim

import fr.sncf.osrd.railjson.parser.RJSRollingStockParser.parseModeEffortCurves
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser.parseRollingResistance
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.*

/** Parse the rolling stock model into something the backend can work with */
fun parseRawRollingStock(
    rawRollingStock: PhysicsRollingStockModel,
    loadingGaugeType: RJSLoadingGaugeType = RJSLoadingGaugeType.G1,
    rollingStockSupportedSignalingSystems: List<String> = listOf(),
): RollingStock {
    // Parse effort_curves
    val rawModes = rawRollingStock.effortCurves.modes

    if (!rawModes.containsKey(rawRollingStock.effortCurves.defaultMode))
        throw OSRDError.newInvalidRollingStockError(
            ErrorType.InvalidRollingStockDefaultModeNotFound,
            rawRollingStock.effortCurves.defaultMode
        )

    // Parse tractive effort curves modes
    val modes = HashMap<String, ModeEffortCurves>()
    for ((key, value) in rawModes) {
        modes[key] = parseModeEffortCurves(value, "effort_curves.modes.$key")
    }

    val rollingResistance = parseRollingResistance(rawRollingStock.rollingResistance)

    return RollingStock(
        "placeholder_name",
        rawRollingStock.length.distance.meters,
        rawRollingStock.mass.toDouble(),
        rawRollingStock.inertiaCoefficient,
        rollingResistance.A,
        rollingResistance.B,
        rollingResistance.C,
        rawRollingStock.maxSpeed,
        rawRollingStock.startupTime.seconds,
        rawRollingStock.startupAcceleration,
        rawRollingStock.comfortAcceleration,
        rawRollingStock.constGamma,
        loadingGaugeType,
        modes,
        rawRollingStock.effortCurves.defaultMode,
        rawRollingStock.basePowerClass,
        rawRollingStock.powerRestrictions,
        rawRollingStock.electricalPowerStartupTime?.seconds,
        rawRollingStock.raisePantographTime?.seconds,
        rollingStockSupportedSignalingSystems.toTypedArray(),
    )
}
