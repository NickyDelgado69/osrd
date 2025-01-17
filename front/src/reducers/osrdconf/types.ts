import type { Feature, Position } from 'geojson';

import type { PowerRestriction } from 'applications/operationalStudies/types';
import type {
  AllowanceValue,
  ArrivalTimeTypes,
  LinkedTrains,
  StdcmStopTypes,
} from 'applications/stdcm/types';
import type {
  Comfort,
  Distribution,
  OperationalPointReference,
  PathItemLocation,
  ReceptionSignal,
} from 'common/api/osrdEditoastApi';
import type { IsoDurationString } from 'common/types';
import type { InfraState } from 'reducers/infra';

export interface OsrdConfState extends InfraState {
  constraintDistribution: Distribution;
  name: string;
  trainCount: number;
  trainStep: number;
  trainDelta: number;
  usingElectricalProfiles: boolean;
  labels: string[];
  projectID?: number;
  studyID?: number;
  scenarioID?: number;
  timetableID?: number;
  electricalProfileSetId?: number;
  workScheduleGroupId?: number;
  temporarySpeedLimitGroupId?: number;
  searchDatetimeWindow?: { begin: Date; end: Date };
  rollingStockID?: number;
  speedLimitByTag?: string;
  powerRestriction: PowerRestriction[];
  initialSpeed?: number;
  gridMarginBefore?: number;
  gridMarginAfter?: number;
  featureInfoClick: { displayPopup: boolean; feature?: Feature; coordinates?: number[] };
  pathSteps: (PathStep | null)[];
  rollingStockComfort: Comfort;
  // Format ISO 8601
  startTime: string;
}

export interface StandardAllowance {
  type: AllowanceValue['value_type'];
  value?: number;
}

export interface OsrdStdcmConfState extends OsrdConfState {
  stdcmPathSteps: StdcmPathStep[];
  standardStdcmAllowance?: StandardAllowance;
  totalMass?: number;
  totalLength?: number;
  maxSpeed?: number;
  towedRollingStockID?: number;
  linkedTrains: LinkedTrains;
}

export type PathStep = PathItemLocation & {
  id: string;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: IsoDurationString | null;
  arrivalType?: ArrivalTimeTypes;
  arrivalToleranceBefore?: number;
  arrivalToleranceAfter?: number;
  locked?: boolean;
  stopFor?: string | null;
  stopType?: StdcmStopTypes;
  theoreticalMargin?: string;
  receptionSignal?: ReceptionSignal;
  kp?: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath?: number;
  coordinates?: Position;
  // Metadatas given by the search endpoint in TypeAndPath (name)
  name?: string;
  // Metadatas given by ManageTrainScheduleMap click event to add origin/destination/via
  metadata?: {
    lineCode: number;
    lineName: string;
    trackName: string;
    trackNumber: number;
  };
  isInvalid?: boolean;
};

export type StdcmPathStep = {
  id: string;
  location?: Extract<OperationalPointReference, { uic: number }> & {
    secondary_code: string;
    name: string;
    coordinates: [number, number];
  };
} & (
  | { isVia: true; stopType: StdcmStopTypes; stopFor?: number /* in minutes */ }
  | {
      isVia: false;
      arrivalType: ArrivalTimeTypes;
      arrival?: Date;
      tolerances?: { before: number; after: number };
    }
);
