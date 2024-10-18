import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import useStdcmTowedRollingStock from 'applications/stdcm/hooks/useStdcmTowedRollingStock';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import { extractDateAndTimefromISO } from 'utils/date';

import type { StdcmSimulationInputs } from '../types';

const useStdcmForm = (): StdcmSimulationInputs => {
  const { getStdcmPathSteps, getSpeedLimitByTag, getTotalMass, getTotalLength, getMaxSpeed } =
    useOsrdConfSelectors() as StdcmConfSelectors;
  const pathSteps = useSelector(getStdcmPathSteps);
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const totalMass = useSelector(getTotalMass);
  const totalLength = useSelector(getTotalLength);
  const maxSpeed = useSelector(getMaxSpeed);
  const { rollingStock } = useStoreDataForRollingStockSelector();
  const towedRollingStock = useStdcmTowedRollingStock();

  const currentSimulationInputs = useMemo(() => {
    const origin = pathSteps.at(0);
    const originArrival = origin?.arrival ? extractDateAndTimefromISO(origin.arrival) : undefined;

    return {
      pathSteps,
      departureDate: originArrival?.arrivalDate,
      departureTime: originArrival?.arrivalTime,
      consist: {
        tractionEngine: rollingStock,
        towedRollingStock,
        totalMass,
        totalLength,
        maxSpeed,
        speedLimitByTag,
      },
    };
  }, [
    pathSteps,
    rollingStock,
    towedRollingStock,
    speedLimitByTag,
    totalMass,
    totalLength,
    maxSpeed,
  ]);

  return currentSimulationInputs;
};

export default useStdcmForm;
