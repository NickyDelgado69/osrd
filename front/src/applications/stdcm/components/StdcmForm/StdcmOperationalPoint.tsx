import { useEffect, useMemo } from 'react';

import { Select, ComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import { type SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import useSearchOperationalPoint from 'common/Map/Search/useSearchOperationalPoint';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { normalized } from 'utils/strings';
import { createFixedSelectOptions } from 'utils/uiCoreHelpers';

type StdcmOperationalPointProps = {
  point: StdcmPathStep;
  opPointId: string;
  disabled?: boolean;
};

type Option = { label: string; value: string; uic: number };

function formatChCode(chCode: string) {
  return chCode === '' ? 'BV' : chCode;
}

const StdcmOperationalPoint = ({ point, opPointId, disabled }: StdcmOperationalPointProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const pointCh =
    'secondary_code' in point && point.secondary_code ? point.secondary_code : undefined;

  const { searchTerm, chCodeFilter, sortedSearchResults, setSearchTerm, setChCodeFilter } =
    useSearchOperationalPoint({ initialSearchTerm: point.name, initialChCodeFilter: pointCh });

  const { updateStdcmPathStep } = useOsrdConfActions() as StdcmConfSliceActions;

  const operationalPointsSuggestions = useMemo(
    () =>
      // Temporary filter added to show a more restrictive list of suggestions inside the stdcm app.
      sortedSearchResults
        .filter(
          (op) =>
            normalized(op.name).startsWith(normalized(searchTerm)) ||
            op.trigram === searchTerm.toUpperCase()
        )
        .reduce((acc, p) => {
          const newObject = {
            label: [p.trigram, p.name].join(' '),
            value: p.name,
            uic: p.uic,
          };
          const isDuplicate = acc.some((pr) => pr.label === newObject.label);
          if (!isDuplicate) acc.push(newObject);
          return acc;
        }, [] as Option[]),
    [sortedSearchResults]
  );

  const sortedChOptions = useMemo(
    () =>
      sortedSearchResults
        .filter((pr) => pr.name === searchTerm)
        .reduce(
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
    if (p && 'uic' in point && p.ch === point.secondary_code && p.uic === point.uic) return;
    const newPoint = p
      ? {
          name: p.name,
          secondary_code: p.ch,
          uic: p.uic,
          coordinates: p.geographic.coordinates,
        }
      : { name: undefined, secondary_code: undefined, uic: -1, coordinates: undefined };
    dispatch(updateStdcmPathStep({ id: point.id, updates: newPoint }));
  };

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

  const onSelectSuggestion = (selectedSuggestion?: Option) => {
    if (!selectedSuggestion) {
      setSearchTerm('');
      return;
    }
    const { value: suggestionName, uic } = selectedSuggestion;
    setSearchTerm(suggestionName);
    updateSelectedPoint(sortedSearchResults, uic);
  };

  const onSelectChCodeFilter = (selectedChCode?: { id: string }) => {
    setChCodeFilter(selectedChCode?.id);
    if (point && 'uic' in point)
      updateSelectedPoint(sortedSearchResults, point.uic, selectedChCode?.id);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim().length === 0) {
      dispatchNewPoint(undefined);
    }
  };

  useEffect(() => {
    if (point) {
      setSearchTerm(point.name || '');
      setChCodeFilter(pointCh || '');
    } else {
      setSearchTerm('');
      setChCodeFilter(undefined);
    }
  }, [point]);

  return (
    <div className="location-line">
      <div className="col-9 ci-input">
        <ComboBox
          id={`${opPointId}-ci`}
          label={t('trainPath.ci')}
          value={searchTerm}
          onChange={onInputChange}
          autoComplete="off"
          suggestions={operationalPointsSuggestions}
          disabled={disabled}
          getSuggestionLabel={(option: Option) => option?.label}
          onSelectSuggestion={onSelectSuggestion}
          disableDefaultFilter
        />
      </div>
      <div className="col-3 p-0">
        <Select
          label={t('trainPath.ch')}
          id={`${opPointId}-ch`}
          value={chCodeFilter ? { label: formatChCode(chCodeFilter), id: chCodeFilter } : undefined}
          onChange={(e) => onSelectChCodeFilter(e)}
          {...createFixedSelectOptions(sortedChOptions)}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default StdcmOperationalPoint;
