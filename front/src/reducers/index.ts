import { Action, Reducer, ReducersMapObject, AnyAction } from 'redux';
import { persistCombineReducers, persistReducer, PersistConfig } from 'redux-persist';
import createCompressor from 'redux-persist-transform-compress';
import { createFilter } from 'redux-persist-transform-filter';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage

import {
  OsrdConfState,
  OsrdMultiConfState,
  OsrdStdcmConfState,
} from 'applications/operationalStudies/consts';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import userReducer, { UserState, userInitialState } from 'reducers/user';
import mainReducer, { MainState, mainInitialState } from 'reducers/main';
import mapReducer, { MapState, mapInitialState } from './map';
import editorReducer, { EditorActions, initialState as editorInitialState } from './editor';
import osrdconfReducer, { initialState as osrdconfInitialState } from './osrdconf';
// Dependency cycle will be removed during the refactoring of store
// eslint-disable-next-line import/no-cycle
import osrdsimulationReducer, {
  initialState as osrdSimulationInitialState,
} from './osrdsimulation';
import { OsrdSimulationState } from './osrdsimulation/types';

import { EditorState } from '../applications/editor/tools/types';
import rollingstockeditorReducer, {
  RsEditorCurvesState,
  initialState as rsEditorCurvesInitialState,
} from './rollingstockEditor';
import stdcmConfReducer, { stdcmConfInitialState } from './osrdconf2/stdcmConf';
import simulationConfReducer, { simulationConfInitialState } from './osrdconf2/simulationConf';

const compressor = createCompressor({
  whitelist: ['rollingstock'],
});

const mapWhiteList = [
  'mapStyle',
  'showOrthoPhoto',
  'showOSM',
  'layers',
  'layersSettings',
  'userPreference',
  'terrain3DExaggeration',
];

const userWhiteList = ['account', 'userPreferences'];

const mainWhiteList = ['lastInterfaceVersion'];

const simulationWhiteList = ['marginsSettings'];

const saveMapFilter = createFilter('map', mapWhiteList);

const saveUserFilter = createFilter('user', userWhiteList);

const saveMainFilter = createFilter('main', mainWhiteList);

const saveSimulationFilter = createFilter('osrdsimulation', simulationWhiteList);

// Useful to only blacklist a sub-propertie of osrdconf
const osrdconfPersistConfig: PersistConfig<OsrdMultiConfState> = {
  key: 'osrdconf',
  storage,
  blacklist: ['featureInfoClick', 'switchTypes'],
};

export const persistConfig = {
  key: 'root',
  storage,
  transforms: [compressor, saveMapFilter, saveUserFilter, saveMainFilter, saveSimulationFilter],
  blacklist: ['osrdconf'],
  whitelist: ['user', 'map', 'main', 'simulation'],
};

type AllActions = EditorActions | Action;

export interface RootState {
  user: UserState;
  map: MapState;
  editor: EditorState;
  main: MainState;
  stdcmconf: OsrdStdcmConfState;
  simulationconf: OsrdConfState;
  osrdconf: OsrdMultiConfState;
  osrdsimulation: OsrdSimulationState;
  [osrdEditoastApi.reducerPath]: ReturnType<typeof osrdEditoastApi.reducer>;
  rsEditorCurvesParams: RsEditorCurvesState;
}

export const rootInitialState: RootState = {
  user: userInitialState,
  map: mapInitialState,
  editor: editorInitialState,
  main: mainInitialState,
  stdcmconf: stdcmConfInitialState,
  simulationconf: simulationConfInitialState,
  osrdconf: osrdconfInitialState,
  osrdsimulation: osrdSimulationInitialState,
  [osrdEditoastApi.reducerPath]: {} as ReturnType<typeof osrdEditoastApi.reducer>,
  rsEditorCurvesParams: rsEditorCurvesInitialState,
};

export type AnyReducerState =
  | UserState
  | MapState
  | EditorState
  | MainState
  | OsrdConfState
  | OsrdSimulationState
  | RsEditorCurvesState;

export const rootReducer: ReducersMapObject<RootState> = {
  user: userReducer,
  map: mapReducer,
  editor: editorReducer,
  main: mainReducer,
  stdcmconf: stdcmConfReducer,
  simulationconf: simulationConfReducer,
  osrdconf: persistReducer(osrdconfPersistConfig, osrdconfReducer) as unknown as Reducer<
    OsrdMultiConfState,
    AnyAction
  >,
  osrdsimulation: osrdsimulationReducer,
  [osrdEditoastApi.reducerPath]: osrdEditoastApi.reducer,
  rsEditorCurvesParams: rollingstockeditorReducer,
};

export default persistCombineReducers<RootState, AllActions>(persistConfig, rootReducer);
