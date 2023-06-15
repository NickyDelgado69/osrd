import React, { SetStateAction, useState, Dispatch } from 'react';
import { RollingStock } from 'common/api/osrdEditoastApi';
import RollingStockCardDetail, {
  listCurvesComfort,
} from 'common/RollingStockSelector/RollingStockCardDetail';
import { RollingStockInfo } from 'common/RollingStockSelector/RollingStockHelpers';
import RollingStockCurve from 'common/RollingStockSelector/RollingStockCurves';
import RollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';
import RollingStockEditorForm from './RollingStockEditorForm';

type RollingStockEditorCardProps = {
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  rollingStock: RollingStock;
};

export default function RollingStockEditorCard({
  isEditing,
  setIsEditing,
  rollingStock,
}: RollingStockEditorCardProps) {
  const [curvesComfortList, setCurvesComfortList] = useState<string[]>([]);

  return (
    <div className={`rollingstock-editor-form ${!isEditing ? 'borders' : ''} w-100`}>
      {isEditing ? (
        <RollingStockEditorForm rollingStockData={rollingStock} setAddOrEditState={setIsEditing} />
      ) : (
        <div>
          <div className="rollingstock-header">
            <div className="rollingstock-title">
              <RollingStockInfo rollingStock={rollingStock} />
            </div>
          </div>
          <RollingStockCardDetail
            id={rollingStock.id}
            hideCurves
            form="rollingstock-editor-form-text"
            curvesComfortList={curvesComfortList}
            setCurvesComfortList={setCurvesComfortList}
          />
          <div className="rollingstock-body border-0">
            <RollingStockCurve
              curvesComfortList={listCurvesComfort(rollingStock.effort_curves)}
              data={rollingStock.effort_curves.modes}
            />
            <div className="rollingstock-detail-container-img">
              <div className="rollingstock-detail-img">
                <RollingStock2Img rollingStock={rollingStock} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
