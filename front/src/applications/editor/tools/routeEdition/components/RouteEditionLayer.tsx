import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layer, Popup, Source, LineLayer } from 'react-map-gl/maplibre';
import { featureCollection } from '@turf/helpers';
import { FaFlagCheckered } from 'react-icons/fa';
import { BsArrowBarRight } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { isNil } from 'lodash';

import {
  NULL_GEOMETRY,
  type EditorEntity,
  type OmitLayer,
  type WayPointEntity,
  type NullGeometry,
} from 'types';
import {
  getRoutesLineLayerProps,
  getRoutesPointLayerProps,
  getRoutesTextLayerProps,
} from 'common/Map/Layers/Routes';
import colors from 'common/Map/Consts/colors';
import { getMapStyle } from 'reducers/map/selectors';
import { useInfraID } from 'common/osrdContext';
import EntitySumUp from 'applications/editor/components/EntitySumUp';
import { nestEntity } from 'applications/editor/data/utils';
import { Feature, LineString } from 'geojson';
import type { RouteEditionState } from '../types';
import { getOptionsStateType, getRouteGeometryByRouteId } from '../utils';

export const RouteEditionLayers: FC<{ state: RouteEditionState }> = ({ state }) => {
  const mapStyle = useSelector(getMapStyle);
  const { t } = useTranslation();
  const infraID = useInfraID();
  const dispatch = useDispatch();
  const [entityGeo, setEntityGeo] = useState<null | Feature<LineString> | Feature<NullGeometry>>(
    null
  );

  const shouldDisplayOptions = useMemo(
    () => state.optionsState.type === 'options',
    [state.optionsState.type]
  );

  /**
   * Map style for lines.
   */
  const lineProps = useMemo(() => {
    const layer = getRoutesLineLayerProps({ colors: colors[mapStyle] });
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-dasharray': [2, 1],
        'line-offset': ['get', 'offset'],
      },
    } as OmitLayer<LineLayer>;
  }, [mapStyle]);

  /**
   * Map style for points
   */
  const pointProps = useMemo(
    () => getRoutesPointLayerProps({ colors: colors[mapStyle] }),
    [mapStyle]
  );

  /**
   * Map style for  line text
   */
  const textProps = useMemo(
    () => getRoutesTextLayerProps({ colors: colors[mapStyle] }),
    [mapStyle]
  );

  /**
   * Compute hovered entity.
   */
  const hoveredWayPoint = useMemo(
    () =>
      state.hovered?.type === 'BufferStop' || state.hovered?.type === 'Detector'
        ? (nestEntity(
            state.hovered.renderedEntity as EditorEntity,
            state.hovered.type
          ) as WayPointEntity)
        : null,
    [state.hovered?.renderedEntity, state.hovered?.type]
  );

  /**
   * Compute feature collection of route options.
   */
  const geoOptionsFeature = useMemo(() => {
    const options = getOptionsStateType(state.optionsState);
    return featureCollection(
      options
        .map((opt) => ({
          ...opt.feature,
          properties: {
            ...opt.feature.properties,
            offset: opt.feature.properties.index * 2 + 3,
          },
        }))
        .reverse()
    );
  }, [state.optionsState]);

  const getRouteGeometry = useCallback(
    async (id: string) => {
      if (!infraID) throw new Error('No infra selected');
      return getRouteGeometryByRouteId(infraID, id, dispatch);
    },
    [infraID, dispatch]
  );

  const entryPointLocation = useMemo(() => {
    const geo = state.extremitiesEntity.BEGIN?.geometry;
    if (geo && geo.type === 'Point') return geo.coordinates;
    return undefined;
  }, [state.extremitiesEntity.BEGIN]);

  const exitPointLocation = useMemo(() => {
    const geo = state.extremitiesEntity.END?.geometry;
    if (geo && geo.type === 'Point') return geo.coordinates;
    return undefined;
  }, [state.extremitiesEntity.END]);

  /**
   * When initial entity changed
   * => load its geometry
   */
  useEffect(() => {
    // if there is an initial entity
    if (!isNil(state.initialEntity)) {
      getRouteGeometry(state.initialEntity.properties.id).then((d) => {
        setEntityGeo({
          ...d,
          properties: {
            ...d.properties,
            color: colors[mapStyle].routes.text,
          },
        });
      });
    }
    return () => {
      setEntityGeo({ type: 'Feature', properties: {}, geometry: NULL_GEOMETRY });
    };
  }, [state.initialEntity, state.entity, mapStyle]);

  return (
    <>
      {/* Displaying options */}
      {shouldDisplayOptions && (
        <Source type="geojson" data={geoOptionsFeature}>
          <Layer {...lineProps} />
          <Layer {...pointProps} />
          <Layer {...textProps} />
        </Source>
      )}

      {!shouldDisplayOptions && (
        <Source type="geojson" data={entityGeo}>
          <Layer {...lineProps} />
          <Layer {...pointProps} />
          <Layer {...textProps} />
        </Source>
      )}

      {entryPointLocation && (
        <Popup
          key="entry-popup"
          className="popup"
          anchor="bottom"
          longitude={entryPointLocation[0]}
          latitude={entryPointLocation[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <small>
            <BsArrowBarRight /> {t('Editor.tools.routes-edition.start')}
          </small>
        </Popup>
      )}
      {exitPointLocation && (
        <Popup
          key="exit-popup"
          className="popup"
          anchor="bottom"
          longitude={exitPointLocation[0]}
          latitude={exitPointLocation[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <small>
            <FaFlagCheckered /> {t('Editor.tools.routes-edition.end')}
          </small>
        </Popup>
      )}

      {/* Hovered waypoint */}
      {state.extremityState.type === 'selection' && hoveredWayPoint && state.mousePosition && (
        <Popup
          key="hover-popup"
          className="popup"
          anchor="bottom"
          longitude={state.mousePosition[0]}
          latitude={state.mousePosition[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <EntitySumUp objType={hoveredWayPoint.objType} id={hoveredWayPoint.properties.id} />
        </Popup>
      )}
    </>
  );
};

export default RouteEditionLayers;