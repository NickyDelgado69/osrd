import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { cloneDeep } from 'lodash';

import { useInfraID } from 'common/osrdContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import type { ElectrificationEntity, SpeedSectionEntity, SpeedSectionPslEntity } from 'types';

import EditorContext from '../../../context';
import { NEW_ENTITY_ID } from '../../../data/utils';
import EntityError from '../../../components/EntityError';
import type { ExtendedEditorContextType, PartialOrReducer } from '../../editorContextTypes';
import type { RangeEditionState } from '../types';
import { speedSectionIsPsl } from '../utils';
import EditPSLSection from '../speedSection/EditPSLSection';
import ElectrificationMetadataForm from '../electrification/ElectrificationMetadataForm';
import SpeedSectionMetadataForm from '../speedSection/SpeedSectionMetadataForm';
import TrackRangesList from './RangeEditionTrackRangeList';

const RangeEditionLeftPanel = () => {
  const { t } = useTranslation();
  const {
    setState,
    state: { entity, initialEntity, trackSectionsCache },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;

  const isNew = entity.properties.id === NEW_ENTITY_ID;
  const isPSL = speedSectionIsPsl(entity as SpeedSectionEntity);
  const infraID = useInfraID();

  const { data: voltages } = osrdEditoastApi.useGetInfraByIdVoltagesQuery(
    {
      id: infraID as number,
    },
    { skip: !infraID }
  );

  const updateSpeedSectionExtensions = (
    extensions: SpeedSectionEntity['properties']['extensions']
  ) => {
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    newEntity.properties.extensions = extensions;
    setState({
      entity: newEntity,
    });
  };

  return (
    <div>
      <legend className="mb-4">
        {t(
          `Editor.obj-types.${
            entity.objType === 'SpeedSection' ? 'SpeedSection' : 'Electrification'
          }`
        )}
      </legend>
      {initialEntity.objType === 'SpeedSection' ? (
        <SpeedSectionMetadataForm />
      ) : (
        voltages && <ElectrificationMetadataForm voltages={voltages} />
      )}
      <hr />
      {initialEntity.objType === 'SpeedSection' && (
        <>
          <div>
            <div className="d-flex">
              <CheckboxRadioSNCF
                type="checkbox"
                id="is-psl-checkbox"
                name="is-psl-checkbox"
                checked={isPSL}
                disabled={entity.properties.track_ranges?.length === 0}
                label={t('Editor.tools.speed-edition.toggle-psl')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  let newExtension: SpeedSectionEntity['properties']['extensions'] = {
                    psl_sncf: null,
                  };
                  if (e.target.checked) {
                    const firstRange = (entity.properties?.track_ranges || [])[0];
                    if (!firstRange) return;
                    newExtension = {
                      psl_sncf: initialEntity.properties?.extensions?.psl_sncf || {
                        announcement: [],
                        r: [],
                        z: {
                          angle_sch: 0,
                          angle_geo: 0,
                          position: firstRange.begin,
                          side: 'LEFT',
                          track: firstRange.track,
                          type: 'Z',
                          value: '',
                          kp: '',
                        },
                      },
                    };
                  }
                  updateSpeedSectionExtensions(newExtension);
                }}
              />
            </div>
            {entity.properties.track_ranges?.length === 0 && (
              <p className="mt-3 font-size-1">{t('Editor.tools.speed-edition.toggle-psl-help')}</p>
            )}
            {isPSL && (
              <EditPSLSection
                entity={entity as SpeedSectionPslEntity}
                setState={
                  setState as (
                    stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>
                  ) => void
                }
                trackSectionsCache={trackSectionsCache}
              />
            )}
          </div>
          <hr />
        </>
      )}
      <TrackRangesList />

      {!isNew && <EntityError className="mt-1" entity={entity} />}
    </div>
  );
};

export default RangeEditionLeftPanel;