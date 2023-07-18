import { LinearMetadataItem } from 'common/IntervalsDataViz/data';

export enum INTERVAL_TYPES {
  NUMBER_WITH_UNIT = 'number-with-unit',
  SELECT = 'select',
}

export type IntervalItem = LinearMetadataItem<{ value: number | string; unit?: string }>;

export enum INTERVALS_EDITOR_TOOLS {
  ADD_TOOL = 'add-tool',
  CUT_TOOL = 'cut-tool',
  DELETE_TOOL = 'delete-tool',
  TRANSLATE_TOOL = 'translate-tool',
}
export type IntervalsEditorTool =
  | INTERVALS_EDITOR_TOOLS.ADD_TOOL
  | INTERVALS_EDITOR_TOOLS.CUT_TOOL
  | INTERVALS_EDITOR_TOOLS.DELETE_TOOL
  | INTERVALS_EDITOR_TOOLS.TRANSLATE_TOOL;

export type IntervalsEditorToolsConfig = {
  cutTool?: boolean;
  deleteTool?: boolean;
  translateTool?: boolean;
  addTool?: boolean;
};
