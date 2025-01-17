import { useMemo } from 'react';

import { Location } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import IntermediatePointIcon from 'assets/pictures/mapMarkers/intermediate-point.svg';
import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import StdcmCard from './StdcmCard';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmInputVia from './StdcmInputVia';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmStopType from './StdcmStopType';
import { StdcmStopTypes } from '../../types';
import type { StdcmConfigCardProps } from '../../types';

const StdcmVias = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getStdcmPathSteps } = useOsrdConfSelectors() as StdcmConfSelectors;
  const { updateStdcmPathStep, addStdcmVia, deleteStdcmVia } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const pathSteps = useSelector(getStdcmPathSteps);

  const intermediatePoints = useMemo(() => pathSteps.slice(1, -1), [pathSteps]);

  const updateStopType = (newStopType: StdcmStopTypes, pathStep: StdcmPathStep) => {
    let defaultStopTime: number | undefined;
    if (newStopType === StdcmStopTypes.DRIVER_SWITCH) {
      defaultStopTime = 3;
    } else if (newStopType === StdcmStopTypes.SERVICE_STOP) {
      defaultStopTime = 0;
    }
    dispatch(
      updateStdcmPathStep({
        id: pathStep.id,
        updates: { stopType: newStopType, stopFor: defaultStopTime },
      })
    );
  };

  const updateStopDuration = (stopTime: string, pathStep: StdcmPathStep) => {
    const stopFor = stopTime ? Number(stopTime) : undefined;
    dispatch(
      updateStdcmPathStep({
        id: pathStep.id,
        updates: { stopFor },
      })
    );
  };

  const deleteViaOnClick = (pathStepId: string) => {
    dispatch(deleteStdcmVia(pathStepId));
  };

  const addViaOnClick = (pathStepIndex: number) => {
    dispatch(addStdcmVia(pathStepIndex));
  };

  return (
    <div className="stdcm-vias-list">
      {intermediatePoints.map((pathStep, index) => {
        if (!pathStep.isVia) return null;
        const pathStepIndex = index + 1;
        return (
          <div className="stdcm-vias-bundle" key={pathStep.id}>
            <StdcmDefaultCard
              hasTip
              text={t('trainPath.addVia')}
              Icon={<Location size="lg" variant="base" />}
              onClick={() => addViaOnClick(pathStepIndex)}
              disabled={disabled}
            />
            <StdcmCard
              name={t('trainPath.vias')}
              title={
                <div className="stdcm-via-icons">
                  <div className="icon-bundle mt-1">
                    <img src={IntermediatePointIcon} alt="intermediate-point" />
                    <span className="icon-index">{pathStepIndex}</span>
                  </div>
                  <button
                    data-testid="delete-via-button"
                    type="button"
                    onClick={() => deleteViaOnClick(pathStep.id)}
                  >
                    {t('translation:common.delete')}
                  </button>
                </div>
              }
              hasTip
              disabled={disabled}
              className="via"
            >
              <StdcmOperationalPoint
                location={pathStep.location}
                pathStepId={pathStep.id}
                disabled={disabled}
              />
              <StdcmStopType
                stopTypes={pathStep.stopType}
                updatePathStepStopType={(newStopType) => updateStopType(newStopType, pathStep)}
              />
              <StdcmInputVia
                stopType={pathStep.stopType}
                stopDuration={pathStep.stopFor}
                updatePathStepStopTime={(e) => updateStopDuration(e, pathStep)}
              />
            </StdcmCard>
          </div>
        );
      })}
      <StdcmDefaultCard
        hasTip
        text={t('trainPath.addVia')}
        Icon={<Location size="lg" variant="base" />}
        onClick={() => addViaOnClick(pathSteps.length - 1)}
        disabled={disabled}
      />
    </div>
  );
};

export default StdcmVias;
