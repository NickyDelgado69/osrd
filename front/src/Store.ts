import { legacy_createStore as createStore, combineReducers } from 'redux';
import { configureStore, createListenerMiddleware, Middleware } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import { persistStore, getStoredState } from 'redux-persist';
import { Config } from '@redux-devtools/extension';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import persistedReducer, {
  rootReducer,
  rootInitialState,
  RootState,
  persistConfig,
} from 'reducers';
import { registerSimulationUpdateInfraIDListeners } from 'reducers/osrdconf2/simulationConf';
import { registerStdcmUpdateInfraIDListeners } from 'reducers/osrdconf2/stdcmConf';

const reduxDevToolsOptions: Config = {
  serialize: {
    options: {
      symbol: true,
    },
  },
};

const buildListenerMiddleware = () => {
  const listener = createListenerMiddleware();
  registerSimulationUpdateInfraIDListeners(listener);
  registerStdcmUpdateInfraIDListeners(listener);

  return listener;
};

const middlewares: Middleware[] = [thunk, osrdEditoastApi.middleware];

const store = configureStore({
  reducer: persistedReducer,
  devTools: reduxDevToolsOptions,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false })
      // As mentionned in the Doc(https://redux-toolkit.js.org/api/createListenerMiddleware), Since this can receive actions with functions inside,
      // listenerMiddleware should go before the serializability check middleware
      .prepend(buildListenerMiddleware().middleware)
      .concat(...middlewares),
});

const persistor = persistStore(store);

// Retrieve the persisted state from storage and purge if new front version
getStoredState(persistConfig)
  .then((persistedState) => {
    console.info('Front OSRD Version', import.meta.env.OSRD_GIT_DESCRIBE);

    const envInterfaceVersion = import.meta.env.OSRD_GIT_DESCRIBE;
    const persistedRootState = persistedState as RootState;

    if (
      envInterfaceVersion &&
      persistedRootState?.main?.lastInterfaceVersion !== envInterfaceVersion
    )
      persistor.purge().then(() => {
        console.warn('New Front Version since last launch, persisted Store purged');
      });
  })
  .catch((err) => {
    console.error('Error retrieving persisted state:', err);
  });

const createStoreWithoutMiddleware = (initialStateExtra: Partial<RootState>) =>
  createStore(combineReducers<RootState>(rootReducer), {
    ...rootInitialState,
    ...initialStateExtra,
  });

export { store, persistor, createStoreWithoutMiddleware };
