import React, { useEffect, useState, useRef } from 'react';
import {
  persistentRedoSimulation,
  persistentUndoSimulation,
} from 'reducers/osrdsimulation/simulation';
import {
  updateMustRedraw,
  updateSelectedProjection,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import SimulationResultsMap from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap';
import { Rnd } from 'react-rnd';
import SpaceCurvesSlopes from 'applications/operationalStudies/components/SimulationResults/SpaceCurvesSlopes';
import SpaceTimeChartIsolated from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/withOSRDData';
import SpeedSpaceChart from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/SpeedSpaceChart';
import TimeButtons from 'applications/operationalStudies/components/SimulationResults/TimeButtons';
import TimeLine from 'applications/operationalStudies/components/SimulationResults/TimeLine/TimeLine';
import TrainDetails from 'applications/operationalStudies/components/SimulationResults/TrainDetails';
import getTimetable from 'applications/operationalStudies/components/Scenario/getSimulationResults';

import { updateViewport, Viewport } from 'reducers/map';
import DriverTrainSchedule from 'applications/operationalStudies/components/SimulationResults/DriverTrainSchedule/DriverTrainSchedule';
import { getTimetableID } from 'reducers/osrdconf/selectors';
import cx from 'classnames';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import {
  getDisplaySimulation,
  getSelectedProjection,
  getSelectedTrain,
} from 'reducers/osrdsimulation/selectors';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';

const MAP_MIN_HEIGHT = 450;

type Props = {
  isDisplayed: boolean;
  collapsedTimetable: boolean;
};

export default function SimulationResults({ isDisplayed, collapsedTimetable }: Props) {
  const timeTableRef = useRef<HTMLDivElement | null>(null);
  const [extViewport, setExtViewport] = useState<Viewport | undefined>(undefined);
  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(600);

  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(250);

  const [heightOfSimulationMap] = useState(MAP_MIN_HEIGHT);

  const [heightOfSpaceCurvesSlopesChart, setHeightOfSpaceCurvesSlopesChart] = useState(150);
  const [initialHeightOfSpaceCurvesSlopesChart, setInitialHeightOfSpaceCurvesSlopesChart] =
    useState(heightOfSpaceCurvesSlopesChart);

  const displaySimulation = useSelector(getDisplaySimulation);
  const selectedTrain = useSelector(getSelectedTrain);
  const selectedProjection = useSelector(getSelectedProjection);
  const timetableID = useSelector(getTimetableID);

  const dispatch = useDispatch();

  const [getTimetableWithTrainSchedulesDetails] = osrdEditoastApi.useLazyGetTimetableByIdQuery();

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'z' && e.metaKey) {
      dispatch(persistentUndoSimulation());
    }
    if (e.key === 'e' && e.metaKey) {
      dispatch(persistentRedoSimulation());
    }
  };

  useEffect(() => {
    // Setup the listener to undi /redo
    window.addEventListener('keydown', handleKey);
    return function cleanup() {
      window.removeEventListener('keydown', handleKey);
      dispatch(updateSelectedProjection(undefined));
      dispatch(updateSimulation({ trains: [] }));
    };
  }, []);

  useEffect(() => {
    if (timetableID && selectedProjection) {
      getTimetableWithTrainSchedulesDetails({ id: timetableID })
        .unwrap()
        .then((result) => {
          getTimetable(result);
        });
    }
    return function cleanup() {
      dispatch(updateSimulation({ trains: [] }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjection, timetableID]);

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(
        updateViewport({
          ...extViewport,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extViewport]);

  return (
    <div className="simulation-results">
      {/* SIMULATION : STICKY BAR */}
      <div
        className={cx(
          'osrd-simulation-sticky-bar',
          collapsedTimetable && 'with-collapsed-timetable'
        )}
      >
        <div className="row">
          <div className="col-xl-4">
            <TimeButtons />
          </div>
          <div className="col-xl-8 d-flex justify-content-end mt-2 mt-xl-0">
            <TrainDetails />
          </div>
        </div>
      </div>

      {/* SIMULATION : TIMELINE */}
      <TimeLine />

      {/* SIMULATION : SPACE TIME CHART */}
      <div className="simulation-warped-map d-flex flex-row align-items-stretch mb-2 bg-white">
        <button
          type="button"
          className="show-warped-map-button my-3 ml-3 mr-1"
          onClick={() => setShowWarpedMap(!showWarpedMap)}
        >
          <i className={showWarpedMap ? 'icons-arrow-prev' : 'icons-arrow-next'} />
        </button>
        <SimulationWarpedMap collapsed={!showWarpedMap} />

        <div className="osrd-simulation-container d-flex flex-grow-1 flex-shrink-1">
          <div
            className="spacetimechart-container"
            style={{ height: `${heightOfSpaceTimeChart}px` }}
          >
            {displaySimulation && (
              <SpaceTimeChartIsolated
                initialHeightOfSpaceTimeChart={heightOfSpaceTimeChart}
                onSetBaseHeightOfSpaceTimeChart={setHeightOfSpaceTimeChart}
                isDisplayed={isDisplayed}
              />
            )}
          </div>
        </div>
      </div>

      {/* TRAIN : SPACE SPEED CHART */}
      {selectedTrain && (
        <div className="osrd-simulation-container d-flex mb-2">
          <div
            className="speedspacechart-container"
            style={{ height: `${heightOfSpeedSpaceChart}px` }}
          >
            <SpeedSpaceChart
              initialHeight={heightOfSpeedSpaceChart}
              onSetChartBaseHeight={setHeightOfSpeedSpaceChart}
              selectedTrain={selectedTrain}
            />
          </div>
        </div>
      )}

      {/* TRAIN : CURVES & SLOPES */}
      <div className="osrd-simulation-container d-flex mb-2">
        <div
          className="spacecurvesslopes-container"
          style={{ height: `${heightOfSpaceCurvesSlopesChart}px` }}
        >
          {displaySimulation && (
            <Rnd
              default={{
                x: 0,
                y: 0,
                width: '100%',
                height: `${heightOfSpaceCurvesSlopesChart}px`,
              }}
              disableDragging
              enableResizing={{
                bottom: true,
              }}
              onResizeStart={() =>
                setInitialHeightOfSpaceCurvesSlopesChart(heightOfSpaceCurvesSlopesChart)
              }
              onResize={(_e, _dir, _refToElement, delta) => {
                setHeightOfSpaceCurvesSlopesChart(
                  initialHeightOfSpaceCurvesSlopesChart + delta.height
                );
              }}
            >
              <SpaceCurvesSlopes height={heightOfSpaceCurvesSlopesChart} />
            </Rnd>
          )}
        </div>
      </div>

      {/* TRAIN : DRIVER TRAIN SCHEDULE */}
      {selectedTrain && (
        <div className="osrd-simulation-container mb-2">
          <DriverTrainSchedule train={selectedTrain} />
        </div>
      )}

      {/* SIMULATION : MAP */}
      <div ref={timeTableRef}>
        <div className="osrd-simulation-container mb-2">
          <div className="osrd-simulation-map" style={{ height: `${heightOfSimulationMap}px` }}>
            {/* <Rnd
                  className="map-resizer"
                  default={{
                    x: 0,
                    y: 0,
                    height: `${heightOfSimulationMap}px`,
                    width: 'auto',
                  }}
                  minHeight={MAP_MIN_HEIGHT}
                  maxHeight={mapMaxHeight}
                  style={{
                    paddingBottom: '12px',
                  }}
                  disableDragging
                  enableResizing={{
                    bottom: true,
                  }}
                  onResizeStart={() => setinitialHeightOfSimulationMap(heightOfSimulationMap)}
                  onResize={(_e, _dir, _refToElement, delta) => {
                    setHeightOfSimulationMap(initialHeightOfSimulationMap + delta.height);
                  }}
                  onResizeStop={() => {
                    dispatch(updateMustRedraw(true));
                  }}
                >
                  <Map setExtViewport={setExtViewport} />
                </Rnd> */}
            <SimulationResultsMap setExtViewport={setExtViewport} />
          </div>
        </div>
      </div>
    </div>
  );
}
