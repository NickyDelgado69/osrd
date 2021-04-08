import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';
import { geoMainLayer, geoServiceLayer } from 'common/Map/Layers/geographiclayers';
import { trackNameLayer, lineNumberLayer, lineNameLayer } from 'common/Map/Layers/commonlayers';
import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';

const TracksGeographic = (props) => {
  const { colors, idHover } = props;
  return (
    <Source
      id="tracksGeographic"
      type="vector"
      url={`${MAP_URL}/chartis/layer/map_midi_tronconditinerairevoie/mvt/geo/`}
      source-layer={MAP_TRACK_SOURCES.geographic}
    >
      <Layer
        {...geoMainLayer(colors)}
        source-layer={MAP_TRACK_SOURCES.geographic}
      />
      <Layer
        {...geoServiceLayer(colors)}
        source-layer={MAP_TRACK_SOURCES.geographic}
      />
      <Layer
        {...{
          ...trackNameLayer(colors),
          layout: {
            ...trackNameLayer(colors).layout,
            'text-field': '{V_nom}',
            'text-size': 11,
          },
        }}
        source-layer={MAP_TRACK_SOURCES.geographic}
        filter={['==', 'type_voie', 'VP']}
      />
      <Layer
        {...{
          ...trackNameLayer(colors),
          layout: {
            ...trackNameLayer(colors).layout,
            'text-field': '{V_nom}',
            'text-size': 10,
          },
        }}
        source-layer={MAP_TRACK_SOURCES.geographic}
        filter={['!=', 'type_voie', 'VP']}
      />
      <Layer
        {...{
          ...lineNumberLayer(colors),
          layout: {
            ...lineNumberLayer(colors).layout,
            'text-field': '{L_code}',
          },
        }}
        source-layer={MAP_TRACK_SOURCES.geographic}
      />
      <Layer
        {...lineNameLayer(colors)}
        source-layer={MAP_TRACK_SOURCES.geographic}
      />

      {idHover !== undefined ? (
        <Layer
          type="line"
          paint={{ 'line-color': '#ffb612', 'line-width': 3 }}
          filter={['==', 'OP_id', idHover]}
          source-layer={MAP_TRACK_SOURCES.geographic}
        />
      ) : null}
    </Source>
  );
};

TracksGeographic.propTypes = {
  idHover: PropTypes.string,
  colors: PropTypes.object.isRequired,
};

TracksGeographic.defaultProps = {
  idHover: undefined,
};

export default TracksGeographic;
