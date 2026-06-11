import MeasurementGrid from './MeasurementGrid';

interface CalibrationMatrixTableProps {
  j: number;
  n: number;
  measurementData: number[][];
  ttn1: number[];
  ttn2: number[];
  channelMeans?: number[];
  channelCorrectedMeans?: number[];
  channelStdDevs?: number[];
  channelTypeAUncertainties?: number[];
  onChange: (data: number[][], nextTtn1: number[], nextTtn2: number[]) => void;
}

export default function CalibrationMatrixTable({
  j,
  n,
  measurementData,
  ttn1,
  ttn2,
  channelMeans,
  channelCorrectedMeans,
  channelStdDevs,
  channelTypeAUncertainties,
  onChange,
}: CalibrationMatrixTableProps) {
  return (
    <MeasurementGrid
      j={j}
      n={n}
      value={measurementData}
      ttn1={ttn1}
      ttn2={ttn2}
      channelMeans={channelMeans}
      channelCorrectedMeans={channelCorrectedMeans}
      channelStdDevs={channelStdDevs}
      channelTypeAUncertainties={channelTypeAUncertainties}
      onChange={onChange}
    />
  );
}
