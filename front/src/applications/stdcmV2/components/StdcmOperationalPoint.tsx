import React, { useEffect, useMemo } from 'react';

import type { ActionCreatorWithPayload } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import useSearchOperationalPoint, {
  MAIN_OP_CH_CODES,
} from 'common/Map/Search/useSearchOperationalPoint';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import StdcmSuggestions from './StdcmSuggestions';

type UpdatePointActions =
  | ActionCreatorWithPayload<PathStep | null, 'stdcmConf/updateOriginV2'>
  | ActionCreatorWithPayload<PathStep | null, 'stdcmConf/updateDestinationV2'>;

type StdcmOperationalPointProps = {
  updatePoint: UpdatePointActions;
  point: PathStep | null;
  disabled?: boolean;
};

function formatChCode(chCode: string) {
  return MAIN_OP_CH_CODES.includes(chCode) ? 'BV' : chCode;
}

const StdcmOperationalPoint = ({ updatePoint, point, disabled }: StdcmOperationalPointProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('stdcm');

  const {
    searchTerm,
    chCodeFilter,
    sortedSearchResults,
    filteredAndSortedSearchResults,
    setSearchTerm,
    setChCodeFilter,
  } = useSearchOperationalPoint({ initialSearchTerm: point?.name, initialChCodeFilter: point?.ch });

  const operationalPointsSuggestions = useMemo(
    () =>
      sortedSearchResults.reduce(
        (acc, p) => {
          const newObject = {
            label: [p.trigram, p.name].join(' '),
            value: p.name,
            uic: p.uic,
          };
          const isDuplicate = acc.some((pr) => pr.label === newObject.label);
          if (!isDuplicate) acc.push(newObject);
          return acc;
        },
        [] as { label: string; value: string; uic: number }[]
      ),
    [sortedSearchResults]
  );

  const sortedChOptions = useMemo(
    () =>
      sortedSearchResults.reduce(
        (acc, pr) => {
          const newObject = {
            label: formatChCode(pr.ch),
            id: pr.ch,
          };
          const isDuplicate = acc.some((option) => option.label === newObject.label);
          if (!isDuplicate) acc.push(newObject);
          return acc;
        },
        [] as { label: string; id: string }[]
      ),
    [point, sortedSearchResults]
  );

  const dispatchNewPoint = (p?: SearchResultItemOperationalPoint) => {
    const newPoint = p
      ? {
          name: p.name,
          ch: p.ch,
          id: nextId(),
          uic: p.uic,
          coordinates: p.geographic.coordinates,
        }
      : null;
    dispatch(updatePoint(newPoint));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim().length === 0) {
      dispatchNewPoint(undefined);
    }
  };

  const onInputOnblur = () => {
    const newPoint =
      operationalPointsSuggestions.length === 1
        ? filteredAndSortedSearchResults.find(
            (pr) => pr.name === operationalPointsSuggestions[0].value
          )
        : undefined;
    dispatchNewPoint(newPoint);
    if (newPoint === undefined) {
      setSearchTerm('');
      setChCodeFilter(undefined);
    }
  };

  useEffect(() => {
    if (point) {
      setSearchTerm(point.name || '');
      setChCodeFilter(point.ch || '');
    } else {
      setSearchTerm('');
      setChCodeFilter(undefined);
    }
  }, [point]);

  const updateSelectedPoint = (
    refList: SearchResultItemOperationalPoint[],
    selectedUic: number,
    selectedChCode?: string
  ) => {
    const newPoint = refList.find(
      (pr) => pr.uic === selectedUic && (selectedChCode ? pr.ch === selectedChCode : true)
    );
    dispatchNewPoint(newPoint);
  };

  const onSelectSuggestion = ({ value: suggestionName, uic }: { value: string; uic: number }) => {
    setSearchTerm(suggestionName);
    updateSelectedPoint(sortedSearchResults, uic);
  };

  const onSelectChCodeFilter = (selectedChCode?: { id: string }) => {
    setChCodeFilter(selectedChCode?.id);
    if (point && 'uic' in point)
      updateSelectedPoint(sortedSearchResults, point.uic, selectedChCode?.id);
  };

  return (
    <div className="flex">
      <div className="suggestions col-8">
        <StdcmSuggestions
          id="ci"
          label={t('trainPath.ci')}
          value={searchTerm}
          onChange={onInputChange}
          onBlur={onInputOnblur}
          autoComplete="off"
          options={operationalPointsSuggestions}
          onSelectSuggestion={onSelectSuggestion}
          disabled={disabled}
        />
      </div>
      <div className="suggestions w-100 py-2 col-4">
        <SelectSNCF
          label={t('trainPath.ch')}
          id="ch"
          value={chCodeFilter ? { id: chCodeFilter, label: formatChCode(chCodeFilter) } : undefined}
          options={sortedChOptions}
          onChange={onSelectChCodeFilter}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default StdcmOperationalPoint;