import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';
import { useDispatch, useSelector } from 'react-redux';

import studyIcon from 'assets/pictures/views/study.svg';
import projectIcon from 'assets/pictures/views/projects.svg';
import infraIcon from 'assets/pictures/components/tracks.svg';
import scenarioIcon from 'assets/pictures/home/operationalStudies.svg';

import { getDocument } from 'common/api/documentApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import type { TrainScheduleSummary } from 'common/api/osrdEditoastApi';

import ScenarioExplorerModal, { type ScenarioExplorerProps } from './ScenarioExplorerModal';

const ScenarioExplorer = ({
  globalProjectId,
  globalStudyId,
  globalScenarioId,
}: ScenarioExplorerProps) => {
  const { t } = useTranslation('common/scenarioExplorer');
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { getTimetableID } = useOsrdConfSelectors();
  const timetableID = useSelector(getTimetableID);
  const [imageUrl, setImageUrl] = useState<string>();

  const { data: projectDetails } = osrdEditoastApi.endpoints.getProjectsByProjectId.useQuery(
    { projectId: globalProjectId as number },
    { skip: !globalProjectId }
  );

  const { data: studyDetails } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyId.useQuery(
      { projectId: globalProjectId as number, studyId: globalStudyId as number },
      { skip: !globalProjectId && !globalStudyId }
    );

  const { data: scenarioDetails } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
      {
        projectId: globalProjectId as number,
        studyId: globalStudyId as number,
        scenarioId: globalScenarioId as number,
      },
      { skip: !globalProjectId && !globalStudyId && !globalScenarioId }
    );

  const { data: timetable } = osrdEditoastApi.useGetTimetableByIdQuery(
    { id: timetableID as number },
    { skip: !timetableID }
  );

  const { updateInfraID, updateTimetableID } = useOsrdConfActions();

  const getProjectImage = async (imageId: number) => {
    try {
      const blobImage = await getDocument(imageId);
      setImageUrl(URL.createObjectURL(blobImage));
    } catch (error) {
      console.error(error);
    }
  };

  const validTrainCount = (trains: TrainScheduleSummary[]): number => {
    const validTrains = trains.filter(
      (train) => train.invalid_reasons && train.invalid_reasons.length === 0
    );
    return validTrains.length;
  };

  useEffect(() => {
    if (scenarioDetails?.timetable_id) {
      dispatch(updateTimetableID(scenarioDetails.timetable_id));
      dispatch(updateInfraID(scenarioDetails.infra_id));
    }
  }, [scenarioDetails]);

  useEffect(() => {
    if (projectDetails?.image) {
      getProjectImage(projectDetails?.image);
    } else {
      setImageUrl(undefined);
    }
  }, [projectDetails]);

  return (
    <div
      className="scenario-explorator-card"
      data-testid="scenario-explorator"
      onClick={() => {
        openModal(
          <ScenarioExplorerModal
            globalProjectId={globalProjectId}
            globalStudyId={globalStudyId}
            globalScenarioId={globalScenarioId}
          />,
          'lg'
        );
      }}
      role="button"
      tabIndex={0}
    >
      {globalProjectId &&
      projectDetails &&
      globalStudyId &&
      studyDetails &&
      globalScenarioId &&
      scenarioDetails ? (
        <div className="scenario-explorator-card-head">
          {imageUrl && (
            <div className="scenario-explorator-card-head-img">
              <img src={imageUrl} alt="Project logo" />
            </div>
          )}
          <div className={`scenario-explorator-card-head-content ${imageUrl ? '' : 'no-image'}`}>
            <div className="scenario-explorator-card-head-content-item">
              <img src={projectIcon} alt="project icon" />
              <span className="scenario-explorator-card-head-legend">{t('projectLegend')}</span>
              <div className="scenario-explorator-card-head-project">{projectDetails.name}</div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={studyIcon} alt="study icon" />
              <span className="scenario-explorator-card-head-legend">{t('studyLegend')}</span>
              <div className="scenario-explorator-card-head-study">{studyDetails.name}</div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={scenarioIcon} alt="scenario icon" />
              <span className="scenario-explorator-card-head-legend">{t('scenarioLegend')}</span>
              <div className="scenario-explorator-card-head-scenario">
                {scenarioDetails.name}
                {timetable && (
                  <span className="scenario-explorator-card-head-scenario-traincount">
                    {validTrainCount(timetable.train_schedule_summaries)}
                    <MdTrain />
                  </span>
                )}
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={infraIcon} alt="infra icon" />
              <span className="scenario-explorator-card-head-legend">{t('infraLegend')}</span>
              <div className="scenario-explorator-card-head-infra">
                {scenarioDetails.infra_name}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="scenario-explorator-card-noscenario">{t('noScenarioSelected')}</div>
      )}
    </div>
  );
};

export default ScenarioExplorer;