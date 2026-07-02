using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using A = DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using W = DocumentFormat.OpenXml.Wordprocessing;
using HM_19MB_Core.Data;

namespace HM_19MB_Core
{
    internal static class ExcelExporter
    {
        private const double ZeroTolerance = 1e-9;

#if false
        public static async Task ExportWordAsync(
            SessionMetadata meta,
            List<CalibrationResultRow> calibRows,
            int kenhCount,
            IWin32Window owner)
        {
            using var dialog = new SaveFileDialog
            {
                Filter = "Word Documents (*.docx)|*.docx",
                FileName = $"GiayChungNhan_{meta.SoHieu}_{meta.NgayHieuChuan:yyyyMMdd}.docx"
            };

            if (dialog.ShowDialog(owner) != DialogResult.OK)
                return;

            string templatePath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "Resources", "Templates", "GiayChungNhanHieuChuan.docx");

            if (!File.Exists(templatePath))
                throw new FileNotFoundException($"Không tìm thấy template: {templatePath}");

            var values = new Dictionary<string, object>
            {
                ["TenThietBi"]       = meta.TenThietBi,
                ["KyHieu"]           = meta.KyHieu,
                ["SoHieu"]           = meta.SoHieu,
                ["SoTem"]            = meta.SoTem,
                ["NoiSanXuat"]       = meta.NoiSanXuat,
                ["DacTinhKyThuat"]   = meta.DacTinhKyThuat,
                ["DonViSuDung"]      = meta.DonViSuDung,
                ["PhuongPhap"]       = meta.PhuongPhap,
                ["NhietDoMoiTruong"] = meta.NhietDoMoiTruong,
                ["DoAmTuongDoi"]     = meta.DoAmTuongDoi,
                ["ThietBiChuan"]     = meta.ThietBiChuan,
                ["NgayHieuChuan"]    = meta.NgayHieuChuan.ToString("dd/MM/yyyy"),
            };

            await Task.Run(() =>
            {
                MiniSoftware.MiniWord.SaveAsByTemplate(
                    dialog.FileName, templatePath, values);
                ReplaceWordProbeImage(dialog.FileName, GetExportChannelCount(calibRows, kenhCount));
                FillWordResultTable(dialog.FileName, calibRows);
            });

            ToastNotification.ShowSuccess($"Đã xuất: {Path.GetFileName(dialog.FileName)}");
        }

        private static void ReplaceWordProbeImage(string filePath, int channelCount)
        {
            using var doc = WordprocessingDocument.Open(filePath, true);
            var mainPart = doc.MainDocumentPart;
            if (mainPart?.Document.Body == null)
                return;

            var blip = mainPart.Document.Body.Descendants<A.Blip>().FirstOrDefault();
            string? oldRelationshipId = blip?.Embed?.Value;
            if (blip == null || string.IsNullOrWhiteSpace(oldRelationshipId))
                return;

            var image = GetProbeGuideImage(channelCount);
            if (image == null)
                return;

            ImagePart? oldPart = null;
            try
            {
                oldPart = mainPart.GetPartById(oldRelationshipId) as ImagePart;
            }
            catch (ArgumentOutOfRangeException)
            {
                oldPart = null;
            }

            var imagePart = mainPart.AddImagePart(ImagePartType.Png);
            using (var stream = new MemoryStream())
            {
                image.Save(stream, System.Drawing.Imaging.ImageFormat.Png);
                stream.Position = 0;
                imagePart.FeedData(stream);
            }

            blip.Embed = mainPart.GetIdOfPart(imagePart);

            if (oldPart != null)
                mainPart.DeletePart(oldPart);

            mainPart.Document.Save();
        }

        private static System.Drawing.Image? GetProbeGuideImage(int channelCount)
        {
            return channelCount <= 3
                ? Properties.Resources.probe_3
                : channelCount <= 5
                    ? Properties.Resources.probe_5
                    : Properties.Resources.probe_9;
        }
#endif

        private static void FillWordResultTable(string filePath, List<CalibrationResultRow> calibRows)
        {
            using var doc = WordprocessingDocument.Open(filePath, true);
            var body = doc.MainDocumentPart?.Document.Body;
            if (body == null) return;

            var templateRow = body
                .Descendants<W.TableRow>()
                .FirstOrDefault(row => GetDirectWordRowText(row).Contains("{{STT}}", StringComparison.Ordinal));

            if (templateRow == null)
                return;

            var parentTable = templateRow.Ancestors<W.Table>().FirstOrDefault();
            if (parentTable == null)
                return;

            var rowsToRemove = GetTrailingWordTemplateRows(templateRow).ToList();

            foreach (var item in calibRows.Select((row, index) => new { row, index }))
            {
                var newRow = (W.TableRow)templateRow.CloneNode(true);
                RemoveWordPaginationArtifacts(newRow);
                ReplaceWordRowTokens(newRow, CreateWordResultValues(item.row, item.index));
                parentTable.InsertBefore(newRow, templateRow);
            }

            templateRow.Remove();
            foreach (var row in rowsToRemove)
                row.Remove();

            doc.MainDocumentPart!.Document.Save();
        }

        private static IEnumerable<W.TableRow> GetTrailingWordTemplateRows(W.TableRow templateRow)
        {
            var current = templateRow.NextSibling<W.TableRow>();
            while (current != null)
            {
                string firstCellText = current.Elements<W.TableCell>()
                    .FirstOrDefault()?
                    .Elements<W.Paragraph>()
                    .SelectMany(p => p.Descendants<W.Text>())
                    .Select(t => t.Text)
                    .Aggregate(string.Empty, (acc, text) => acc + text)
                    .Trim() ?? string.Empty;

                bool isPlaceholderTail =
                    string.Equals(firstCellText, ".", StringComparison.Ordinal) ||
                    string.Equals(firstCellText, "N", StringComparison.OrdinalIgnoreCase);

                if (!isPlaceholderTail)
                    yield break;

                var next = current.NextSibling<W.TableRow>();
                yield return current;
                current = next;
            }
        }

        private static Dictionary<string, string> CreateWordResultValues(CalibrationResultRow row, int index)
        {
            return new Dictionary<string, string>
            {
                ["{{STT}}"] = (row.STT > 0 ? row.STT : index + 1).ToString(),
                ["{{DaiLuong}}"] = row.TenDaiLuong,
                ["{{DonVi}}"] = row.Unit,
                ["{{GiaTriDat}}"] = row.GiaTriDat.ToString("F1"),
                ["{{GiaTriChiThi}}"] = row.GiaTriChiThi.ToString("F2"),
                ["{{TrungBinh}}"] = row.GiaTriTrungBinh.ToString("F2"),
                ["{{SoHieuChinh}}"] = row.SoHieuChinh.ToString("F2"),
                ["{{DoOnDinh}}"] = row.DoOnDinh.ToString("F2"),
                ["{{DoDongDeu}}"] = row.DoDongDeu.ToString("F2"),
                ["{{DKDB}}"] = $"±{row.DoKhongDamBao:F2}",
            };
        }

        private static void ReplaceWordRowTokens(W.TableRow row, Dictionary<string, string> values)
        {
            foreach (var text in row.Descendants<W.Text>())
            {
                string value = text.Text;
                foreach (var pair in values)
                    value = value.Replace(pair.Key, pair.Value, StringComparison.Ordinal);
                text.Text = value;
            }
        }

        private static void RemoveWordPaginationArtifacts(W.TableRow row)
        {
            foreach (var pageBreak in row.Descendants<W.LastRenderedPageBreak>().ToList())
                pageBreak.Remove();

            foreach (var pageBreakBefore in row.Descendants<W.PageBreakBefore>().ToList())
                pageBreakBefore.Remove();

            foreach (var br in row.Descendants<W.Break>()
                         .Where(b => b.Type != null && b.Type.Value == W.BreakValues.Page)
                         .ToList())
            {
                br.Remove();
            }
        }

        private static string GetWordText(OpenXmlElement element)
        {
            return string.Concat(element.Descendants<W.Text>().Select(t => t.Text));
        }

        private static string GetDirectWordRowText(W.TableRow row)
        {
            return string.Concat(row
                .Elements<W.TableCell>()
                .SelectMany(cell => cell.Elements<W.Paragraph>())
                .SelectMany(paragraph => paragraph.Descendants<W.Text>())
                .Select(text => text.Text));
        }

#if false
        public static async Task ExportExcelAsync(
            SessionMetadata meta,
            List<CalibrationResultRow> calibRows,
            int kenhCount,
            IWin32Window owner)
        {
            using var dialog = new SaveFileDialog
            {
                Filter = "Excel Files (*.xlsx)|*.xlsx",
                FileName = $"BienBan_{meta.SoHieu}_{meta.NgayHieuChuan:yyyyMMdd}.xlsx"
            };

            if (dialog.ShowDialog(owner) != DialogResult.OK)
                return;

            await Task.Run(() => CreateExcelFromTemplate(dialog.FileName, meta, calibRows, kenhCount));

            ToastNotification.ShowSuccess($"Đã xuất: {Path.GetFileName(dialog.FileName)}");
        }
#endif

        public static Task ExportExcelToFileAsync(
            SessionMetadata meta,
            List<CalibrationResultRow> calibRows,
            int kenhCount,
            string filePath)
            => Task.Run(() => CreateExcelFromTemplate(filePath, meta, calibRows, kenhCount));

        private static string ResolveExcelTemplateFileName(
            string templatesDir,
            int channelCount,
            List<CalibrationResultRow> calibRows)
        {
            string positionName = channelCount <= 3
                ? "3Pos"
                : channelCount <= 5
                    ? "5Pos"
                    : "9Pos";
            string baseName = $"Tu_nhiet_{positionName}.xlsx";

            bool hasHumidity = calibRows.Any(row => row.IsHumidity);
            bool hasTemperature = calibRows.Any(row => !row.IsHumidity);

            if (hasHumidity != hasTemperature)
            {
                string suffix = hasHumidity ? "Am" : "Nhiet";
                string quantityTemplate = $"Tu_nhiet_{positionName}_{suffix}.xlsx";
                if (File.Exists(Path.Combine(templatesDir, quantityTemplate)))
                    return quantityTemplate;
            }

            if (File.Exists(Path.Combine(templatesDir, baseName)))
                return baseName;

            if (channelCount > 5)
                return "Tu_nhiet_V3_-_Pos9.xlsx";

            return channelCount <= 3
                ? "Tu_nhiet_3Pos.xlsx"
                : "Tu_nhiet_5Pos.xlsx";
        }

        private static void CreateExcelFromTemplate(
            string filePath,
            SessionMetadata meta,
            List<CalibrationResultRow> calibRows,
            int kenhCount)
        {
            int channelCount = GetExportChannelCount(calibRows, kenhCount);
            string templatesDir = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "Resources", "Templates");
            string templateFileName = ResolveExcelTemplateFileName(
                templatesDir,
                channelCount,
                calibRows);

            string sheetName = channelCount <= 3
                ? "3 Pos"
                : channelCount <= 5
                    ? "5 Pos"
                    : "9 Pos";

            string templatePath = Path.Combine(templatesDir, templateFileName);

            if (!File.Exists(templatePath))
                throw new FileNotFoundException($"Không tìm thấy template: {templatePath}");

            // Copy template sang file đích
            File.Copy(templatePath, filePath, overwrite: true);

            // Mở file và chỉnh sửa
            using var doc = SpreadsheetDocument.Open(filePath, isEditable: true);
            var workbookPart = doc.WorkbookPart;
            if (workbookPart == null) 
                throw new InvalidOperationException("Workbook part không tồn tại");

            // Tìm sheet phù hợp
            var sheet = workbookPart.Workbook.Descendants<Sheet>()
                .FirstOrDefault(s => s.Name == sheetName);
            
            if (sheet == null || sheet.Id == null)
                throw new InvalidOperationException($"Không tìm thấy sheet '{sheetName}' trong template");

            var relationshipId = sheet.Id.Value;
            if (string.IsNullOrWhiteSpace(relationshipId))
                throw new InvalidOperationException($"Sheet '{sheetName}' không có relationship id");

            var worksheetPart = (WorksheetPart)workbookPart.GetPartById(relationshipId);
            var worksheet = worksheetPart.Worksheet;
            var sheetData = worksheet.GetFirstChild<SheetData>();
            
            if (sheetData == null)
                throw new InvalidOperationException("SheetData không tồn tại");

            // Chỉ xóa dữ liệu trong vùng bảng bên phải, không xóa nguyên dòng vì
            // các dòng 6-20 còn chứa phần thông tin biên bản ở cột A:I.
            ClearTemplateTableArea(worksheetPart, calibRows, channelCount);

            // Bảng mẫu bắt đầu từ J4: J=TT, K=điểm kiểm tra, L:N/L:P=các vị trí.
            InsertDynamicDataTable(worksheetPart, calibRows, channelCount, startRow: 4);
            InsertSummaryTable(worksheetPart, calibRows, channelCount, startRow: 5);
            InsertUncertaintyBudget(worksheetPart, calibRows, channelCount, startRow: 5);

            // Điền metadata sau cùng để đảm bảo phần biên bản luôn giữ đúng dữ liệu.
            FillMetadata(worksheetPart, meta, calibRows, sheetName);
            ApplyGeneratedTableBorders(workbookPart, worksheetPart, calibRows, channelCount);

            // Các công thức trong vùng bảng mẫu đã bị thay bằng dữ liệu mới.
            // Xóa calc chain cũ để Excel không recover workbook vì tham chiếu công thức đã lỗi thời.
            if (workbookPart.CalculationChainPart != null)
                workbookPart.DeletePart(workbookPart.CalculationChainPart);

            var calculationProperties = workbookPart.Workbook.CalculationProperties;
            if (calculationProperties == null)
            {
                calculationProperties = new CalculationProperties();
                workbookPart.Workbook.Append(calculationProperties);
            }
            calculationProperties.ForceFullCalculation = true;
            calculationProperties.FullCalculationOnLoad = true;
            calculationProperties.CalculationMode = CalculateModeValues.Auto;

            worksheet.Save();
            workbookPart.WorkbookStylesPart?.Stylesheet.Save();
            workbookPart.Workbook.Save();
        }

        private static void FillMetadata(
            WorksheetPart worksheetPart,
            SessionMetadata meta,
            List<CalibrationResultRow> calibRows,
            string sheetName)
        {
            // Điền thông tin vào các ô cố định theo template
            // Vị trí các ô có thể khác nhau giữa sheet 3 Pos và 5 Pos
            
            SetCellValue(worksheetPart, "C6", meta.TenThietBi);
            SetCellValue(worksheetPart, "H7", meta.SoHieu);
            SetCellValue(worksheetPart, "C8", meta.NoiSanXuat);
            SetCellValue(worksheetPart, "H8", meta.KyHieu);
            SetCellValue(worksheetPart, "C9", meta.DacTinhKyThuat);
            SetCellValue(worksheetPart, "C10",meta.NhietDoLamViec);
            SetCellValue(worksheetPart, "C11", FormatResolutionA(calibRows));
            SetCellValue(worksheetPart, "C13", meta.DonViSuDung);
            SetCellValue(worksheetPart, "D12", meta.PhuongPhap);
            SetCellValue(worksheetPart, "C16", meta.NhietDoMoiTruong);
            SetCellValue(worksheetPart, "G16", meta.DoAmTuongDoi);
            SetCellValue(worksheetPart, "C17", meta.ThietBiChuan);
            SetCellValue(worksheetPart, "C19", meta.NgayHieuChuan.ToString("dd-MM-yyyy"));
            SetCellValue(worksheetPart, "H19", meta.SoTem);
        }

        private static string FormatResolutionA(List<CalibrationResultRow> calibRows)
        {
            var values = new List<double>();

            foreach (var row in calibRows)
            {
                if (!HasFiniteValue(row.DoPhanGiai))
                    continue;

                double value = NormalizeNearZero(row.DoPhanGiai);
                if (!values.Any(existing => Math.Abs(existing - value) < ZeroTolerance))
                    values.Add(value);
            }

            if (values.Count == 0)
                return string.Empty;

            return string.Join("; ", values.Select(FormatMetadataNumber));
        }

        private static string FormatMetadataNumber(double value)
        {
            return NormalizeNearZero(value).ToString("0.#####");
        }

        private static void ClearTemplateTableArea(
            WorksheetPart worksheetPart,
            List<CalibrationResultRow> calibRows,
            int channelCount)
        {
            var sheetData = worksheetPart.Worksheet.GetFirstChild<SheetData>();
            if (sheetData == null) return;

            uint templateLastRow = sheetData.Elements<Row>()
                .Where(r => r.RowIndex != null)
                .Select(r => r.RowIndex!.Value)
                .DefaultIfEmpty(39U)
                .Max();

            uint requiredRawRows = 0;
            foreach (var row in calibRows)
                requiredRawRows += (uint)GetMeasurementCount(row) + 1U;

            uint clearEndRow = Math.Max(templateLastRow, 4U + requiredRawRows + 5U);
            string endColumn = channelCount <= 3 ? "AA" : "AD";

            for (uint rowIndex = 4; rowIndex <= clearEndRow; rowIndex++)
            {
                foreach (string column in EnumerateColumns("J", endColumn))
                {
                    var cell = TryGetCell(sheetData, rowIndex, column);
                    if (cell == null) continue;

                    cell.CellFormula = null;
                    cell.CellValue = null;
                    cell.InlineString = null;
                    cell.DataType = null;
                }
            }
        }

        private static void ApplyGeneratedTableBorders(
            WorkbookPart workbookPart,
            WorksheetPart worksheetPart,
            List<CalibrationResultRow> calibRows,
            int channelCount)
        {
            uint detailRows = 0;
            foreach (var row in calibRows)
                detailRows += (uint)GetMeasurementCount(row) + 1U;

            if (detailRows > 0)
            {
                ApplyBorderRange(
                    workbookPart,
                    worksheetPart,
                    startRow: 4U,
                    endRow: 4U + detailRows - 1U,
                    startColumn: "J",
                    endColumn: channelCount <= 3 ? "N" : "P");

                ApplyAverageRowHeaderStyle(workbookPart, worksheetPart, calibRows, channelCount);
            }

            uint summaryRows = (uint)Math.Min(calibRows.Count, 5);
            if (summaryRows > 0)
            {
                ApplyBorderRange(
                    workbookPart,
                    worksheetPart,
                    startRow: 5U,
                    endRow: 5U + summaryRows - 1U,
                    startColumn: channelCount <= 3 ? "O" : "Q",
                    endColumn: channelCount <= 3 ? "T" : "W");
            }

            uint uncertaintyRows = CountUncertaintyBudgetRows(calibRows);
            if (uncertaintyRows > 0)
            {
                ApplyBorderRange(
                    workbookPart,
                    worksheetPart,
                    startRow: 5U,
                    endRow: 5U + uncertaintyRows - 1U,
                    startColumn: channelCount <= 3 ? "U" : "X",
                    endColumn: channelCount <= 3 ? "AA" : "AD");
            }
        }

        private static uint CountUncertaintyBudgetRows(List<CalibrationResultRow> calibRows)
        {
            if (calibRows.Count == 0)
                return 0U;

            return (uint)(calibRows.Count * 4 + 2);
        }

        private static void ApplyAverageRowHeaderStyle(
            WorkbookPart workbookPart,
            WorksheetPart worksheetPart,
            List<CalibrationResultRow> calibRows,
            int channelCount)
        {
            string endColumn = channelCount <= 3 ? "N" : "P";
            uint currentRow = 4U;

            foreach (var calibRow in calibRows)
            {
                currentRow += (uint)GetMeasurementCount(calibRow);
                ApplyTemplateRowStyle(worksheetPart, sourceRow: 3U, targetRow: currentRow, "J", endColumn);
                ApplyBorderRange(
                    workbookPart,
                    worksheetPart,
                    currentRow,
                    currentRow,
                    "J",
                    endColumn,
                    preserveFontAndFill: true);
                currentRow++;
            }
        }

        private static void InsertDynamicDataTable(
            WorksheetPart worksheetPart,
            List<CalibrationResultRow> calibRows,
            int channelCount,
            uint startRow)
        {
            uint currentRow = startRow;
            int rawIndex = 1;
            string[] channelCols = channelCount <= 3
                ? new[] { "L", "M", "N" }
                : new[] { "L", "M", "N", "O", "P" };
            
            foreach (var calibRow in calibRows)
            {
                int measurementCount = GetMeasurementCount(calibRow);

                for (int lanDo = 1; lanDo <= measurementCount; lanDo++)
                {
                    SetCellNumber(worksheetPart, $"J{currentRow}", rawIndex);
                    SetCellNumber(worksheetPart, $"K{currentRow}", calibRow.GiaTriDat);

                    for (int ch = 0; ch < channelCount && ch < channelCols.Length; ch++)
                    {
                        double? value = GetChannelValue(calibRow, lanDo, ch + 1);
                        SetCellNullableNumber(worksheetPart, $"{channelCols[ch]}{currentRow}", value);
                    }

                    currentRow++;
                    rawIndex++;
                }

                SetCellValue(worksheetPart, $"J{currentRow}", "Trung bình");
                SetCellNumber(worksheetPart, $"K{currentRow}", calibRow.GiaTriDat);

                for (int ch = 0; ch < channelCount && ch < channelCols.Length; ch++)
                {
                    double sum = 0;
                    int count = 0;
                    for (int lanDo = 1; lanDo <= measurementCount; lanDo++)
                    {
                        double? value = GetChannelValue(calibRow, lanDo, ch + 1);
                        if (value.HasValue)
                        {
                            sum += value.Value;
                            count++;
                        }
                    }

                    SetCellNullableNumber(worksheetPart, $"{channelCols[ch]}{currentRow}",
                        count > 0 ? sum / count : null);
                }

                ApplyTemplateAverageStyle(worksheetPart, currentRow, channelCols);
                currentRow++;
            }
        }

        private static void ApplyTemplateAverageStyle(
            WorksheetPart worksheetPart,
            uint targetRow,
            string[] channelColumns)
        {
            ApplyTemplateCellStyle(worksheetPart, "J", templateRow: 9, targetRow);
            ApplyTemplateCellStyle(worksheetPart, "K", templateRow: 9, targetRow);

            foreach (string column in channelColumns)
                ApplyTemplateCellStyle(worksheetPart, column, templateRow: 9, targetRow);
        }

        private static void ApplyTemplateCellStyle(
            WorksheetPart worksheetPart,
            string column,
            uint templateRow,
            uint targetRow)
        {
            var sheetData = worksheetPart.Worksheet.GetFirstChild<SheetData>();
            if (sheetData == null) return;

            var templateCell = TryGetCell(sheetData, templateRow, column);
            if (templateCell?.StyleIndex == null) return;

            var targetCell = GetOrCreateTemplateCell(worksheetPart, $"{column}{targetRow}");
            if (targetCell == null) return;

            targetCell.StyleIndex = templateCell.StyleIndex.Value;
        }

        private static void ApplyTemplateRowStyle(
            WorksheetPart worksheetPart,
            uint sourceRow,
            uint targetRow,
            string startColumn,
            string endColumn)
        {
            var sheetData = worksheetPart.Worksheet.GetFirstChild<SheetData>();
            if (sheetData == null) return;

            foreach (string column in EnumerateColumns(startColumn, endColumn))
            {
                var sourceCell = TryGetCell(sheetData, sourceRow, column);
                if (sourceCell?.StyleIndex == null) continue;

                var targetCell = GetOrCreateTemplateCell(worksheetPart, $"{column}{targetRow}");
                if (targetCell == null) continue;

                targetCell.StyleIndex = sourceCell.StyleIndex.Value;
            }
        }

        private static void InsertSummaryTable(
            WorksheetPart worksheetPart,
            List<CalibrationResultRow> calibRows,
            int channelCount,
            uint startRow)
        {
            bool isThreePosition = channelCount <= 3;
            string[] columns = isThreePosition
                ? new[] { "O", "P", "Q", "R", "S", "T" }
                : new[] { "Q", "R", "S", "T", "U", "V", "W" };

            const uint fixedSummaryRows = 5U;
            ClearFixedRowsKeepStyle(worksheetPart, startRow, startRow + fixedSummaryRows - 1U, columns);

            uint rowIndex = startRow;
            int rowsToWrite = Math.Min(calibRows.Count, (int)fixedSummaryRows);
            for (int i = 0; i < rowsToWrite; i++)
            {
                var row = calibRows[i];
                int stt = row.STT > 0 ? row.STT : i + 1;

                SetCellNumber(worksheetPart, $"{columns[0]}{rowIndex}", stt);
                SetCellNumber(worksheetPart, $"{columns[1]}{rowIndex}", row.GiaTriDat);
                SetCellNumber(worksheetPart, $"{columns[2]}{rowIndex}", row.GiaTriTrungBinh);

                if (isThreePosition)
                {
                    SetCellNumber(worksheetPart, $"{columns[3]}{rowIndex}", row.DoOnDinh);
                    SetCellNumber(worksheetPart, $"{columns[4]}{rowIndex}", row.DoDongDeu);
                    SetCellNumber(worksheetPart, $"{columns[5]}{rowIndex}", row.DoKhongDamBao);
                }
                else
                {
                    SetCellNumber(worksheetPart, $"{columns[3]}{rowIndex}", row.SoHieuChinh);
                    SetCellNumber(worksheetPart, $"{columns[4]}{rowIndex}", row.DoOnDinh);
                    SetCellNumber(worksheetPart, $"{columns[5]}{rowIndex}", row.DoDongDeu);
                    SetCellNumber(worksheetPart, $"{columns[6]}{rowIndex}", row.DoKhongDamBao);
                }

                rowIndex++;
            }
        }

        private static void InsertUncertaintyBudget(
            WorksheetPart worksheetPart,
            List<CalibrationResultRow> calibRows,
            int channelCount,
            uint startRow)
        {
            string[] columns = channelCount <= 3
                ? new[] { "U", "V", "W", "X", "Y", "Z", "AA" }
                : new[] { "X", "Y", "Z", "AA", "AB", "AC", "AD" };

            uint rowIndex = startRow;
            for (int i = 0; i < calibRows.Count; i++)
            {
                var row = calibRows[i];
                int stt = row.STT > 0 ? row.STT : i + 1;
                double uch1 = CalculateStandardTypeA(row, channelCount);

                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    $"u1-{stt}", "\u0054\u1ea3\u006e \u006d\u00e1\u0074 \u004b\u0051 \u0111\u006f \u0063\u1ee7\u0061 \u0063\u0068\u0075\u1ea9\u006e",
                    uch1, "\u00b0C", 1.0, 1.0, uch1);
            }

            for (int i = 0; i < calibRows.Count; i++)
            {
                var row = calibRows[i];
                int stt = row.STT > 0 ? row.STT : i + 1;
                double ubk1 = CalculateIndicatorTypeA(row);

                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    $"u2-{stt}", "\u0054\u1ea3\u006e \u006d\u00e1\u0074 \u004b\u0051 \u0111\u006f \u0063\u1ee7\u0061 \u0055\u0055\u0054",
                    ubk1, "\u00b0C", 1.0, 1.0, ubk1);
            }

            double uch2 = CalculateMaxStandardTypeB(calibRows, channelCount);
            if (HasFiniteValue(uch2))
            {
                bool useDelta = calibRows.Any(r =>
                    string.Equals(r.PhuongPhapB, "Delta", StringComparison.OrdinalIgnoreCase));
                double divisor = useDelta ? Math.Sqrt(3.0) : 2.0;

                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    "u3", "\u0110K\u0110B\u0110 \u0063\u1ee7\u0061 \u0063\u0068\u0075\u1ea9\u006e",
                    uch2 * divisor, "\u00b0C", divisor, 1.0, uch2);
            }

            double ubk4 = CalculateMaxResolutionUncertainty(calibRows);
            if (HasFiniteValue(ubk4))
            {
                double divisor = Math.Sqrt(3.0);
                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    "u4", "\u0110\u1ed9 \u0070\u0068\u00e2\u006e \u0067\u0069\u1ea3\u0069 \u0063\u1ee7\u0061 \u0055\u0055\u0054",
                    ubk4 * divisor, "\u00b0C", divisor, 1.0, ubk4);
            }

            for (int i = 0; i < calibRows.Count; i++)
            {
                var row = calibRows[i];
                int stt = row.STT > 0 ? row.STT : i + 1;
                double ui = HasFiniteValue(row.DoOnDinh) ? row.DoOnDinh / Math.Sqrt(3.0) : double.NaN;

                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    $"u5-{stt}", "\u0110\u1ed9 \u1ed5\u006e \u0111\u1ecb\u006e\u0068",
                    row.DoOnDinh, "\u00b0C", Math.Sqrt(3.0), 1.0, ui);
            }

            for (int i = 0; i < calibRows.Count; i++)
            {
                var row = calibRows[i];
                int stt = row.STT > 0 ? row.STT : i + 1;
                double ui = HasFiniteValue(row.DoDongDeu) ? row.DoDongDeu / Math.Sqrt(3.0) : double.NaN;

                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    $"u6-{stt}", "\u0110\u1ed9 \u0111\u1ed3\u006e\u0067 \u0111\u1ec1\u0075",
                    row.DoDongDeu, "\u00b0C", Math.Sqrt(3.0), 1.0, ui);
            }
        }

        private static void InsertCompactUncertaintyBudget(
            WorksheetPart worksheetPart,
            List<CalibrationResultRow> calibRows,
            int channelCount,
            uint startRow)
        {
            string[] columns = channelCount <= 3
                ? new[] { "U", "V", "W", "X", "Y", "Z", "AA" }
                : new[] { "X", "Y", "Z", "AA", "AB", "AC", "AD" };

            uint fixedEndRow = channelCount <= 3 ? 26U : 21U;
            ClearFixedRowsKeepStyle(worksheetPart, startRow, fixedEndRow, columns);

            uint rowIndex = startRow;

            double u1 = MaxFinite(calibRows.Select(row => CalculateStandardTypeA(row, channelCount)));
            WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                "u1", "Tản mát KQ đo của chuẩn (max)",
                u1, "°C", 1.0, 1.0, u1);

            double u2 = MaxFinite(calibRows.Select(CalculateIndicatorTypeA));
            WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                "u2", "Tản mát KQ đo của UUT (max)",
                u2, "°C", 1.0, 1.0, u2);

            double u3 = CalculateMaxStandardTypeB(calibRows, channelCount);
            if (HasFiniteValue(u3))
            {
                bool useDelta = calibRows.Any(r =>
                    string.Equals(r.PhuongPhapB, "Delta", StringComparison.OrdinalIgnoreCase));
                double divisor = useDelta ? Math.Sqrt(3.0) : 2.0;
                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    "u3", "ĐKĐBĐ của chuẩn (max)",
                    u3 * divisor, "°C", divisor, 1.0, u3);
            }

            double u4 = CalculateMaxResolutionUncertainty(calibRows);
            if (HasFiniteValue(u4))
            {
                double divisor = Math.Sqrt(3.0);
                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    "u4", "Độ phân giải của UUT (max)",
                    u4 * divisor, "°C", divisor, 1.0, u4);
            }

            double maxStability = MaxFinite(calibRows.Select(row => row.DoOnDinh));
            if (HasFiniteValue(maxStability))
            {
                double divisor = Math.Sqrt(3.0);
                WriteUncertaintyRow(worksheetPart, columns, rowIndex++,
                    "u5", "Độ ổn định (max)",
                    maxStability, "°C", divisor, 1.0, maxStability / divisor);
            }

            double maxUniformity = MaxFinite(calibRows.Select(row => row.DoDongDeu));
            if (HasFiniteValue(maxUniformity))
            {
                double divisor = Math.Sqrt(3.0);
                WriteUncertaintyRow(worksheetPart, columns, rowIndex,
                    "u6", "Độ đồng đều (max)",
                    maxUniformity, "°C", divisor, 1.0, maxUniformity / divisor);
            }
        }

        private static void ClearFixedRowsKeepStyle(
            WorksheetPart worksheetPart,
            uint startRow,
            uint endRow,
            string[] columns)
        {
            var sheetData = worksheetPart.Worksheet.GetFirstChild<SheetData>();
            if (sheetData == null) return;

            for (uint rowIndex = startRow; rowIndex <= endRow; rowIndex++)
            {
                foreach (string column in columns)
                {
                    var cell = TryGetCell(sheetData, rowIndex, column);
                    if (cell != null)
                        ClearCellValue(cell);
                }
            }
        }

        private static void WriteUncertaintyRow(
            WorksheetPart worksheetPart,
            string[] columns,
            uint rowIndex,
            string symbol,
            string source,
            double rawValue,
            string unit,
            double divisor,
            double sensitivity,
            double standardUncertainty)
        {
            SetCellValue(worksheetPart, $"{columns[0]}{rowIndex}", symbol);
            SetCellValue(worksheetPart, $"{columns[1]}{rowIndex}", source);
            SetCellNullableNumber(worksheetPart, $"{columns[2]}{rowIndex}", HasFiniteValue(rawValue) ? rawValue : null);
            SetCellValue(worksheetPart, $"{columns[3]}{rowIndex}", unit);
            SetCellNullableNumber(worksheetPart, $"{columns[4]}{rowIndex}", HasFiniteValue(divisor) ? divisor : null);
            SetCellNullableNumber(worksheetPart, $"{columns[5]}{rowIndex}", HasFiniteValue(sensitivity) ? sensitivity : null);
            SetCellNullableNumber(worksheetPart, $"{columns[6]}{rowIndex}", HasFiniteValue(standardUncertainty) ? standardUncertainty : null);
        }

        private static void AddDetailedUncertaintySheet(
            WorkbookPart workbookPart,
            List<CalibrationResultRow> calibRows,
            int channelCount)
        {
            string sheetName = GetUniqueSheetName(workbookPart, "DKDBD_ChiTiet");
            var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
            var sheetData = new SheetData();
            worksheetPart.Worksheet = new Worksheet(
                CreateDetailedUncertaintyColumns(),
                sheetData);

            var sheets = workbookPart.Workbook.GetFirstChild<Sheets>();
            if (sheets == null)
                sheets = workbookPart.Workbook.AppendChild(new Sheets());

            uint sheetId = sheets.Elements<Sheet>()
                .Where(s => s.SheetId != null)
                .Select(s => s.SheetId!.Value)
                .DefaultIfEmpty(0U)
                .Max() + 1U;

            sheets.Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(worksheetPart),
                SheetId = sheetId,
                Name = sheetName
            });

            uint lastDataRow = BuildDetailedUncertaintySheet(sheetData, calibRows, channelCount);
            if (lastDataRow >= 3U)
                ApplyBorderRange(workbookPart, worksheetPart, 3U, lastDataRow, "A", "J");

            worksheetPart.Worksheet.Save();
        }

        private static string GetUniqueSheetName(WorkbookPart workbookPart, string baseName)
        {
            var existingNames = workbookPart.Workbook.Descendants<Sheet>()
                .Select(s => s.Name?.Value)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (!existingNames.Contains(baseName))
                return baseName;

            for (int i = 1; i < 100; i++)
            {
                string candidate = $"{baseName}_{i}";
                if (!existingNames.Contains(candidate))
                    return candidate;
            }

            return baseName[..Math.Min(baseName.Length, 27)] + "_99";
        }

        private static Columns CreateDetailedUncertaintyColumns()
        {
            double[] widths = { 8D, 13D, 11D, 34D, 14D, 10D, 12D, 10D, 14D, 14D };
            var columns = new Columns();

            for (uint i = 0; i < widths.Length; i++)
            {
                columns.Append(new Column
                {
                    Min = i + 1U,
                    Max = i + 1U,
                    Width = widths[i],
                    CustomWidth = true
                });
            }

            return columns;
        }

        private static uint BuildDetailedUncertaintySheet(
            SheetData sheetData,
            List<CalibrationResultRow> calibRows,
            int channelCount)
        {
            WritePlainText(sheetData, 1, 1, "ƯỚC LƯỢNG ĐỘ KHÔNG ĐẢM BẢO ĐO - CHI TIẾT");

            string[] headers =
            {
                "STT",
                "Điểm đo",
                "Ký hiệu",
                "Nguồn không đảm bảo",
                "Giá trị",
                "Đơn vị",
                "Số chia",
                "Hệ số",
                "u_i",
                "U điểm"
            };

            for (int i = 0; i < headers.Length; i++)
                WritePlainText(sheetData, 3, (uint)(i + 1), headers[i]);

            uint rowIndex = 4;
            for (int i = 0; i < calibRows.Count; i++)
            {
                var row = calibRows[i];
                int stt = row.STT > 0 ? row.STT : i + 1;

                double u1 = CalculateStandardTypeA(row, channelCount);
                WriteDetailedUncertaintyRow(sheetData, rowIndex++, stt, row.GiaTriDat,
                    $"u1-{stt}", "Tản mát KQ đo của chuẩn",
                    u1, "°C", 1.0, 1.0, u1, row.DoKhongDamBao);

                double u2 = CalculateIndicatorTypeA(row);
                WriteDetailedUncertaintyRow(sheetData, rowIndex++, stt, row.GiaTriDat,
                    $"u2-{stt}", "Tản mát KQ đo của UUT",
                    u2, "°C", 1.0, 1.0, u2, row.DoKhongDamBao);

                double u3 = CalculateStandardTypeB(row, channelCount);
                if (HasFiniteValue(u3))
                {
                    double divisor = string.Equals(row.PhuongPhapB, "Delta", StringComparison.OrdinalIgnoreCase)
                        ? Math.Sqrt(3.0)
                        : 2.0;
                    WriteDetailedUncertaintyRow(sheetData, rowIndex++, stt, row.GiaTriDat,
                        $"u3-{stt}", "ĐKĐBĐ của chuẩn",
                        u3 * divisor, "°C", divisor, 1.0, u3, row.DoKhongDamBao);
                }

                double u4 = CalculateResolutionUncertainty(row);
                if (HasFiniteValue(u4))
                {
                    double divisor = Math.Sqrt(3.0);
                    WriteDetailedUncertaintyRow(sheetData, rowIndex++, stt, row.GiaTriDat,
                        $"u4-{stt}", "Độ phân giải của UUT",
                        u4 * divisor, "°C", divisor, 1.0, u4, row.DoKhongDamBao);
                }

                if (HasFiniteValue(row.DoOnDinh))
                {
                    double divisor = Math.Sqrt(3.0);
                    WriteDetailedUncertaintyRow(sheetData, rowIndex++, stt, row.GiaTriDat,
                        $"u5-{stt}", "Độ ổn định",
                        row.DoOnDinh, "°C", divisor, 1.0, row.DoOnDinh / divisor, row.DoKhongDamBao);
                }

                if (HasFiniteValue(row.DoDongDeu))
                {
                    double divisor = Math.Sqrt(3.0);
                    WriteDetailedUncertaintyRow(sheetData, rowIndex++, stt, row.GiaTriDat,
                        $"u6-{stt}", "Độ đồng đều",
                        row.DoDongDeu, "°C", divisor, 1.0, row.DoDongDeu / divisor, row.DoKhongDamBao);
                }
            }

            return rowIndex > 4U ? rowIndex - 1U : 3U;
        }

        private static void WriteDetailedUncertaintyRow(
            SheetData sheetData,
            uint rowIndex,
            int stt,
            double setPoint,
            string symbol,
            string source,
            double rawValue,
            string unit,
            double divisor,
            double sensitivity,
            double standardUncertainty,
            double expandedUncertainty)
        {
            WritePlainNumber(sheetData, rowIndex, 1, stt);
            WritePlainNumber(sheetData, rowIndex, 2, setPoint);
            WritePlainText(sheetData, rowIndex, 3, symbol);
            WritePlainText(sheetData, rowIndex, 4, source);
            WritePlainNullableNumber(sheetData, rowIndex, 5, rawValue);
            WritePlainText(sheetData, rowIndex, 6, unit);
            WritePlainNullableNumber(sheetData, rowIndex, 7, divisor);
            WritePlainNullableNumber(sheetData, rowIndex, 8, sensitivity);
            WritePlainNullableNumber(sheetData, rowIndex, 9, standardUncertainty);
            WritePlainNullableNumber(sheetData, rowIndex, 10, expandedUncertainty);
        }

        private static void WritePlainNullableNumber(
            SheetData sheetData,
            uint rowIndex,
            uint columnIndex,
            double value)
        {
            if (HasFiniteValue(value))
                WritePlainNumber(sheetData, rowIndex, columnIndex, value);
            else
                WritePlainText(sheetData, rowIndex, columnIndex, string.Empty);
        }

        private static void WritePlainNumber(
            SheetData sheetData,
            uint rowIndex,
            uint columnIndex,
            double value)
        {
            value = NormalizeNearZero(value);
            var cell = GetOrCreateCell(sheetData, rowIndex, columnIndex);
            cell.DataType = CellValues.Number;
            cell.CellValue = new CellValue(value.ToString(System.Globalization.CultureInfo.InvariantCulture));
            cell.InlineString = null;
        }

        private static void WritePlainText(
            SheetData sheetData,
            uint rowIndex,
            uint columnIndex,
            string value)
        {
            var cell = GetOrCreateCell(sheetData, rowIndex, columnIndex);
            cell.DataType = CellValues.InlineString;
            cell.InlineString = new InlineString(new Text(value ?? string.Empty)
            {
                Space = SpaceProcessingModeValues.Preserve
            });
            cell.CellValue = null;
        }

        private static double CalculateStandardTypeA(CalibrationResultRow row, int channelCount)
        {
            var matrix = row.GetRawMatrix();
            if (matrix == null) return double.NaN;

            int n = matrix.GetLength(0);
            int k = Math.Min(channelCount, matrix.GetLength(1));
            if (n <= 1 || k <= 0) return double.NaN;

            var typeAValues = new List<double>();
            for (int channel = 0; channel < k; channel++)
            {
                var values = new List<double>();
                for (int i = 0; i < n; i++)
                {
                    double value = matrix[i, channel];
                    if (HasFiniteValue(value))
                        values.Add(value);
                }

                if (values.Count <= 1) continue;

                double mean = UncertaintyCalculator.CalculateMean(values.ToArray());
                double stdDev = UncertaintyCalculator.CalculateStandardDeviation(values.ToArray(), mean);
                typeAValues.Add(UncertaintyCalculator.CalculateTypeAUncertainty(stdDev, values.Count));
            }

            return typeAValues.Count == 0
                ? double.NaN
                : UncertaintyCalculator.CalculateCombinedTypeA(typeAValues.ToArray());
        }

        private static double CalculateIndicatorTypeA(CalibrationResultRow row)
        {
            var values = row.GetChiThiArray()?
                .Where(HasFiniteValue)
                .ToArray();

            return values == null || values.Length <= 1
                ? double.NaN
                : UncertaintyCalculator.CalculateIndicatorTypeA(values);
        }

        private static double CalculateMaxStandardTypeB(List<CalibrationResultRow> rows, int channelCount)
        {
            double max = double.NaN;
            foreach (var row in rows)
            {
                double uch1 = CalculateStandardTypeA(row, channelCount);
                double uc = row.Uch;
                if (!HasFiniteValue(uch1) || !HasFiniteValue(uc) || uc < uch1)
                    continue;

                double value = Math.Sqrt(Math.Max(0.0, uc * uc - uch1 * uch1));
                if (!HasFiniteValue(max) || value > max)
                    max = value;
            }

            return max;
        }

        private static double CalculateMaxResolutionUncertainty(List<CalibrationResultRow> rows)
        {
            double max = double.NaN;
            foreach (var row in rows)
            {
                if (!HasFiniteValue(row.DoPhanGiai) || !HasFiniteValue(row.HeSoPhanGiai))
                    continue;

                double value = row.DoPhanGiai * row.HeSoPhanGiai / Math.Sqrt(3.0);
                if (!HasFiniteValue(max) || value > max)
                    max = value;
            }

            return max;
        }

        private static double CalculateStandardTypeB(CalibrationResultRow row, int channelCount)
        {
            double uch1 = CalculateStandardTypeA(row, channelCount);
            double uc = row.Uch;
            if (!HasFiniteValue(uch1) || !HasFiniteValue(uc) || uc < uch1)
                return double.NaN;

            return Math.Sqrt(Math.Max(0.0, uc * uc - uch1 * uch1));
        }

        private static double CalculateResolutionUncertainty(CalibrationResultRow row)
        {
            if (!HasFiniteValue(row.DoPhanGiai) || !HasFiniteValue(row.HeSoPhanGiai))
                return double.NaN;

            return row.DoPhanGiai * row.HeSoPhanGiai / Math.Sqrt(3.0);
        }

        private static double MaxFinite(IEnumerable<double> values)
        {
            double max = double.NaN;
            foreach (double value in values)
            {
                if (!HasFiniteValue(value))
                    continue;

                if (!HasFiniteValue(max) || value > max)
                    max = value;
            }

            return max;
        }

        private static bool HasFiniteValue(double value)
        {
            return !double.IsNaN(value) && !double.IsInfinity(value);
        }

        private static double NormalizeNearZero(double value)
        {
            return Math.Abs(value) < ZeroTolerance ? 0.0 : value;
        }

        private static void InsertUncertaintySummary(
            WorksheetPart worksheetPart,
            List<CalibrationResultRow> calibRows,
            int channelCount,
            uint startRow)
        {
            string[] columns = channelCount <= 3
                ? new[] { "U", "V", "W", "X", "Y", "Z", "AA" }
                : new[] { "X", "Y", "Z", "AA", "AB", "AC", "AD" };

            uint rowIndex = startRow;
            for (int i = 0; i < calibRows.Count; i++)
            {
                var row = calibRows[i];
                int stt = row.STT > 0 ? row.STT : i + 1;

                SetCellValue(worksheetPart, $"{columns[0]}{rowIndex}", $"u{stt}");
                SetCellValue(worksheetPart, $"{columns[1]}{rowIndex}", $"ĐKĐBĐ điểm {row.GiaTriDat:F1} °C");
                SetCellNumber(worksheetPart, $"{columns[2]}{rowIndex}", row.DoKhongDamBao);
                SetCellValue(worksheetPart, $"{columns[3]}{rowIndex}", "°C");
                SetCellNumber(worksheetPart, $"{columns[4]}{rowIndex}", 1);
                SetCellNumber(worksheetPart, $"{columns[5]}{rowIndex}", 1);
                SetCellNumber(worksheetPart, $"{columns[6]}{rowIndex}", row.DoKhongDamBao);

                rowIndex++;
            }
        }

        private static void SetCellValue(WorksheetPart worksheetPart, string cellReference, string value)
        {
            var cell = GetOrCreateTemplateCell(worksheetPart, cellReference);
            if (cell == null) return;

            ClearCellValue(cell);
            cell.DataType = CellValues.InlineString;
            cell.InlineString = new InlineString(new Text(value ?? string.Empty));
        }

        private static void SetCellNumber(WorksheetPart worksheetPart, string cellReference, double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                SetCellBlank(worksheetPart, cellReference);
                return;
            }

            value = NormalizeNearZero(value);

            var cell = GetOrCreateTemplateCell(worksheetPart, cellReference);
            if (cell == null) return;

            ClearCellValue(cell);
            cell.DataType = CellValues.Number;
            cell.CellValue = new CellValue(value.ToString(System.Globalization.CultureInfo.InvariantCulture));
        }

        private static void SetCellNullableNumber(WorksheetPart worksheetPart, string cellReference, double? value)
        {
            if (value.HasValue)
                SetCellNumber(worksheetPart, cellReference, value.Value);
            else
                SetCellBlank(worksheetPart, cellReference);
        }

        private static void SetCellBlank(WorksheetPart worksheetPart, string cellReference)
        {
            var cell = GetOrCreateTemplateCell(worksheetPart, cellReference);
            if (cell == null) return;
            ClearCellValue(cell);
        }

        private static Cell? GetOrCreateTemplateCell(WorksheetPart worksheetPart, string cellReference)
        {
            var sheetData = worksheetPart.Worksheet.GetFirstChild<SheetData>();
            if (sheetData == null) return null;

            string columnName = new string(cellReference.Where(char.IsLetter).ToArray()).ToUpperInvariant();
            if (!uint.TryParse(new string(cellReference.Where(char.IsDigit).ToArray()), out uint rowIndex))
                return null;

            var row = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex?.Value == rowIndex);
            if (row == null)
            {
                row = new Row { RowIndex = rowIndex };
                var refRow = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex?.Value > rowIndex);
                sheetData.InsertBefore(row, refRow);
            }

            var cell = row.Elements<Cell>().FirstOrDefault(c =>
                string.Equals(c.CellReference?.Value, cellReference, StringComparison.OrdinalIgnoreCase));
            if (cell != null)
                return cell;

            cell = new Cell { CellReference = cellReference };

            uint? styleIndex = FindNearestColumnStyle(sheetData, columnName, rowIndex);
            if (styleIndex.HasValue)
                cell.StyleIndex = styleIndex.Value;

            var refCell = row.Elements<Cell>().FirstOrDefault(c =>
            {
                string? refValue = c.CellReference?.Value;
                if (string.IsNullOrEmpty(refValue)) return false;
                string refColumn = new string(refValue.Where(char.IsLetter).ToArray());
                return GetColumnIndex(refColumn) > GetColumnIndex(columnName);
            });
            row.InsertBefore(cell, refCell);

            return cell;
        }

        private static Cell? TryGetCell(SheetData sheetData, uint rowIndex, string columnName)
        {
            var row = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex?.Value == rowIndex);
            if (row == null) return null;

            return row.Elements<Cell>().FirstOrDefault(c =>
            {
                string? reference = c.CellReference?.Value;
                if (string.IsNullOrEmpty(reference)) return false;
                string cellColumn = new string(reference.Where(char.IsLetter).ToArray());
                return string.Equals(cellColumn, columnName, StringComparison.OrdinalIgnoreCase);
            });
        }

        private static uint? FindNearestColumnStyle(SheetData sheetData, string columnName, uint targetRowIndex)
        {
            var candidates = sheetData.Elements<Row>()
                .Where(r => r.RowIndex != null)
                .OrderBy(r => Math.Abs((long)r.RowIndex!.Value - targetRowIndex));

            foreach (var row in candidates)
            {
                var cell = TryGetCell(sheetData, row.RowIndex!.Value, columnName);
                if (cell?.StyleIndex != null)
                    return cell.StyleIndex.Value;
            }

            return null;
        }

        private static IEnumerable<string> EnumerateColumns(string startColumn, string endColumn)
        {
            uint start = GetColumnIndex(startColumn);
            uint end = GetColumnIndex(endColumn);

            for (uint column = start; column <= end; column++)
                yield return GetColumnName(column);
        }

        private static void ClearCellValue(Cell cell)
        {
            cell.CellFormula = null;
            cell.CellValue = null;
            cell.InlineString = null;
            cell.DataType = null;
        }

        private static void ApplyBorderRange(
            WorkbookPart workbookPart,
            WorksheetPart worksheetPart,
            uint startRow,
            uint endRow,
            string startColumn,
            string endColumn,
            bool preserveFontAndFill = false)
        {
            if (endRow < startRow)
                return;

            uint startColumnIndex = GetColumnIndex(startColumn);
            uint endColumnIndex = GetColumnIndex(endColumn);
            if (endColumnIndex < startColumnIndex)
                return;

            var styleCache = new Dictionary<uint, uint>();
            for (uint rowIndex = startRow; rowIndex <= endRow; rowIndex++)
            {
                for (uint columnIndex = startColumnIndex; columnIndex <= endColumnIndex; columnIndex++)
                {
                    string cellReference = GetCellReference(columnIndex, rowIndex);
                    var cell = GetOrCreateTemplateCell(worksheetPart, cellReference);
                    if (cell == null) continue;

                    uint sourceStyle = cell.StyleIndex?.Value ?? 0U;
                    cell.StyleIndex = GetBorderedStyleIndex(
                        workbookPart,
                        sourceStyle,
                        styleCache,
                        preserveFontAndFill);
                }
            }
        }

        private static uint GetBorderedStyleIndex(
            WorkbookPart workbookPart,
            uint sourceStyleIndex,
            Dictionary<uint, uint> styleCache,
            bool preserveFontAndFill)
        {
            if (styleCache.TryGetValue(sourceStyleIndex, out uint cachedStyleIndex))
                return cachedStyleIndex;

            var stylesPart = workbookPart.WorkbookStylesPart ?? workbookPart.AddNewPart<WorkbookStylesPart>();
            stylesPart.Stylesheet ??= CreateStylesheet();

            var stylesheet = stylesPart.Stylesheet;
            stylesheet.Borders ??= new Borders();
            stylesheet.CellFormats ??= new CellFormats();

            uint borderId = EnsureThinBorder(stylesheet);
            var cellFormats = stylesheet.CellFormats;

            CellFormat sourceFormat;
            if (cellFormats.Count != null &&
                sourceStyleIndex < cellFormats.Count.Value &&
                cellFormats.Elements<CellFormat>().ElementAtOrDefault((int)sourceStyleIndex) is CellFormat existingFormat)
            {
                sourceFormat = (CellFormat)existingFormat.CloneNode(true);
            }
            else
            {
                sourceFormat = new CellFormat { FormatId = 0U };
            }

            if (!preserveFontAndFill)
            {
                sourceFormat.FontId = EnsureTimesNewRomanFont(stylesheet);
                sourceFormat.FillId = 0U;
                sourceFormat.ApplyFont = true;
                sourceFormat.ApplyFill = true;
            }
            sourceFormat.BorderId = borderId;
            sourceFormat.ApplyBorder = true;

            cellFormats.Append(sourceFormat);
            cellFormats.Count = (uint)cellFormats.Elements<CellFormat>().Count();

            uint newStyleIndex = cellFormats.Count.Value - 1U;
            styleCache[sourceStyleIndex] = newStyleIndex;
            return newStyleIndex;
        }

        private static uint EnsureTimesNewRomanFont(Stylesheet stylesheet)
        {
            stylesheet.Fonts ??= new Fonts();
            var fonts = stylesheet.Fonts;

            uint index = 0U;
            foreach (var font in fonts.Elements<DocumentFormat.OpenXml.Spreadsheet.Font>())
            {
                var name = font.FontName?.Val?.Value;
                double? size = font.FontSize?.Val?.Value;
                bool isPlain = font.Bold == null && font.Italic == null;

                if (string.Equals(name, "Times New Roman", StringComparison.OrdinalIgnoreCase) &&
                    isPlain &&
                    size.HasValue &&
                    Math.Abs(size.Value - 12D) < 0.001D)
                {
                    return index;
                }

                index++;
            }

            fonts.Append(new DocumentFormat.OpenXml.Spreadsheet.Font(
                new FontSize { Val = 12D },
                new FontName { Val = "Times New Roman" }));
            fonts.Count = (uint)fonts.Elements<DocumentFormat.OpenXml.Spreadsheet.Font>().Count();
            return fonts.Count.Value - 1U;
        }

        private static uint EnsureThinBorder(Stylesheet stylesheet)
        {
            var borders = stylesheet.Borders ??= new Borders();
            uint borderId = (uint)borders.Elements<Border>().Count();
            borders.Append(CreateThinBorder());
            borders.Count = (uint)borders.Elements<Border>().Count();
            return borderId;
        }

        private static Cell CreateCell(string cellReference, string value, CellValues dataType)
        {
            var cell = new Cell { CellReference = cellReference };
            
            if (dataType == CellValues.Number && !string.IsNullOrEmpty(value))
            {
                cell.DataType = CellValues.Number;
                cell.CellValue = new CellValue(value);
            }
            else
            {
                cell.DataType = CellValues.InlineString;
                cell.InlineString = new InlineString(new Text(value ?? string.Empty));
            }
            
            return cell;
        }

        private static void MergeCellsInWorksheet(Worksheet worksheet, string cellRange)
        {
            var mergeCells = worksheet.Elements<MergeCells>().FirstOrDefault();
            if (mergeCells == null)
            {
                mergeCells = new MergeCells();
                worksheet.InsertAfter(mergeCells, worksheet.Elements<SheetData>().First());
            }

            var mergeCell = new MergeCell { Reference = cellRange };
            mergeCells.Append(mergeCell);
        }

        private static void CreateExcelReport(
            string filePath,
            SessionMetadata meta,
            List<CalibrationResultRow> calibRows,
            int kenhCount)
        {
            int channelCount = GetExportChannelCount(calibRows, kenhCount);
            int totalColumns = 4 + channelCount + 5;
            string sheetName = channelCount <= 3 ? "3 Pos" : "5 Pos";

            using var stream = new FileStream(filePath, FileMode.Create, FileAccess.ReadWrite, FileShare.None);
            using var doc = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook);

            var workbookPart = doc.AddWorkbookPart();
            workbookPart.Workbook = new Workbook();

            var stylesPart = workbookPart.AddNewPart<WorkbookStylesPart>();
            stylesPart.Stylesheet = CreateStylesheet();
            stylesPart.Stylesheet.Save();

            var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
            var sheetData = new SheetData();
            var mergeCells = new MergeCells();
            worksheetPart.Worksheet = new Worksheet(
                new SheetViews(new SheetView { WorkbookViewId = 0U }),
                CreateColumns(totalColumns, channelCount),
                sheetData,
                mergeCells,
                new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.3D, Footer = 0.3D },
                new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });

            var sheets = workbookPart.Workbook.AppendChild(new Sheets());
            sheets.Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(worksheetPart),
                SheetId = 1U,
                Name = sheetName
            });

            BuildReportSheet(sheetData, mergeCells, meta, calibRows, channelCount, totalColumns);

            worksheetPart.Worksheet.Save();
            workbookPart.Workbook.Save();
        }

        private static void BuildReportSheet(
            SheetData sheetData,
            MergeCells mergeCells,
            SessionMetadata meta,
            List<CalibrationResultRow> calibRows,
            int channelCount,
            int totalColumns)
        {
            WriteMergedText(sheetData, mergeCells, 1, 1, 1, (uint)totalColumns,
                "BIÊN BẢN HIỆU CHUẨN THIẾT BỊ", Styles.Title);
            WriteMergedText(sheetData, mergeCells, 2, 1, 2, (uint)totalColumns,
                $"Bảng kết quả tự động - {DateTime.Now:dd/MM/yyyy HH:mm}", Styles.Subtitle);

            WriteMergedText(sheetData, mergeCells, 4, 1, 4, (uint)totalColumns,
                "THÔNG TIN THIẾT BỊ", Styles.Section);

            WriteMetadataRow(sheetData, mergeCells, 5, totalColumns,
                "Tên thiết bị", meta.TenThietBi,
                "Số hiệu", meta.SoHieu);
            WriteMetadataRow(sheetData, mergeCells, 6, totalColumns,
                "Ký hiệu", meta.KyHieu,
                "Số tem", meta.SoTem);
            WriteMetadataRow(sheetData, mergeCells, 7, totalColumns,
                "Nơi sản xuất", meta.NoiSanXuat,
                "Đặc tính kỹ thuật", meta.DacTinhKyThuat);
            WriteMetadataRow(sheetData, mergeCells, 8, totalColumns,
                "Đơn vị sử dụng", meta.DonViSuDung,
                "Phương pháp", meta.PhuongPhap);
            WriteMetadataRow(sheetData, mergeCells, 9, totalColumns,
                "Nhiệt độ môi trường", meta.NhietDoMoiTruong,
                "Độ ẩm tương đối", meta.DoAmTuongDoi);
            WriteMetadataRow(sheetData, mergeCells, 10, totalColumns,
                "Thiết bị chuẩn", meta.ThietBiChuan,
                "Ngày hiệu chuẩn", meta.NgayHieuChuan.ToString("dd/MM/yyyy"));

            uint rowIndex = 12;
            WriteMergedText(sheetData, mergeCells, rowIndex, 1, rowIndex, (uint)totalColumns,
                "KẾT QUẢ ĐO CHI TIẾT", Styles.Section);

            rowIndex++;
            WriteDetailHeader(sheetData, rowIndex, channelCount);
            rowIndex++;

            for (int i = 0; i < calibRows.Count; i++)
            {
                var resultRow = calibRows[i];
                uint startRow = rowIndex;
                int measurementCount = GetMeasurementCount(resultRow);

                for (int lanDo = 1; lanDo <= measurementCount; lanDo++)
                {
                    WriteText(sheetData, rowIndex, 3, lanDo.ToString(), Styles.CenterBorder);

                    double? chiThi = GetChiThiUut(resultRow, lanDo);
                    WriteNullableNumber(sheetData, rowIndex, 4, chiThi, Styles.Number2Border);

                    for (int channel = 1; channel <= channelCount; channel++)
                    {
                        double? value = GetChannelValue(resultRow, lanDo, channel);
                        WriteNullableNumber(sheetData, rowIndex, (uint)(4 + channel), value, Styles.Number2Border);
                    }

                    rowIndex++;
                }

                uint endRow = rowIndex - 1;
                uint summaryStartColumn = (uint)(5 + channelCount);
                int stt = resultRow.STT > 0 ? resultRow.STT : i + 1;

                WriteMergedText(sheetData, mergeCells, startRow, 1, endRow, 1,
                    stt.ToString(), Styles.CenterBorder);
                WriteMergedNumber(sheetData, mergeCells, startRow, 2, endRow, 2,
                    resultRow.GiaTriDat, Styles.Number1Border);
                WriteMergedNumber(sheetData, mergeCells, startRow, summaryStartColumn, endRow, summaryStartColumn,
                    resultRow.GiaTriTrungBinh, Styles.Number2Border);
                WriteMergedNumber(sheetData, mergeCells, startRow, summaryStartColumn + 1, endRow, summaryStartColumn + 1,
                    resultRow.SoHieuChinh, Styles.Number2Border);
                WriteMergedNumber(sheetData, mergeCells, startRow, summaryStartColumn + 2, endRow, summaryStartColumn + 2,
                    resultRow.DoOnDinh, Styles.Number2Border);
                WriteMergedNumber(sheetData, mergeCells, startRow, summaryStartColumn + 3, endRow, summaryStartColumn + 3,
                    resultRow.DoDongDeu, Styles.Number2Border);
                WriteMergedNumber(sheetData, mergeCells, startRow, summaryStartColumn + 4, endRow, summaryStartColumn + 4,
                    resultRow.DoKhongDamBao, Styles.Number2Border);
            }

            rowIndex += 1;
            WriteMergedText(sheetData, mergeCells, rowIndex, 1, rowIndex, (uint)totalColumns,
                "TỔNG HỢP KẾT QUẢ HIỆU CHUẨN", Styles.Section);

            rowIndex++;
            WriteSummaryHeader(sheetData, rowIndex);
            rowIndex++;

            for (int i = 0; i < calibRows.Count; i++)
            {
                var resultRow = calibRows[i];
                int stt = resultRow.STT > 0 ? resultRow.STT : i + 1;

                WriteText(sheetData, rowIndex, 1, stt.ToString(), Styles.CenterBorder);
                WriteNumber(sheetData, rowIndex, 2, resultRow.GiaTriDat, Styles.Number1Border);
                WriteNumber(sheetData, rowIndex, 3, resultRow.GiaTriChiThi, Styles.Number2Border);
                WriteNumber(sheetData, rowIndex, 4, resultRow.GiaTriTrungBinh, Styles.Number2Border);
                WriteNumber(sheetData, rowIndex, 5, resultRow.SoHieuChinh, Styles.Number2Border);
                WriteNumber(sheetData, rowIndex, 6, resultRow.DoOnDinh, Styles.Number2Border);
                WriteNumber(sheetData, rowIndex, 7, resultRow.DoDongDeu, Styles.Number2Border);
                WriteNumber(sheetData, rowIndex, 8, resultRow.DoKhongDamBao, Styles.Number2Border);
                rowIndex++;
            }
        }

        private static void WriteMetadataRow(
            SheetData sheetData,
            MergeCells mergeCells,
            uint rowIndex,
            int totalColumns,
            string leftLabel,
            string leftValue,
            string rightLabel,
            string rightValue)
        {
            int rightLabelColumn = Math.Max(6, totalColumns / 2 + 1);
            int leftValueEnd = Math.Max(2, rightLabelColumn - 1);
            int rightValueStart = rightLabelColumn + 1;

            WriteText(sheetData, rowIndex, 1, leftLabel, Styles.Label);
            WriteMergedText(sheetData, mergeCells, rowIndex, 2, rowIndex, (uint)leftValueEnd, leftValue, Styles.Value);
            WriteText(sheetData, rowIndex, (uint)rightLabelColumn, rightLabel, Styles.Label);
            WriteMergedText(sheetData, mergeCells, rowIndex, (uint)rightValueStart, rowIndex, (uint)totalColumns, rightValue, Styles.Value);
        }

        private static void WriteDetailHeader(SheetData sheetData, uint rowIndex, int channelCount)
        {
            WriteText(sheetData, rowIndex, 1, "STT", Styles.Header);
            WriteText(sheetData, rowIndex, 2, "Điểm đặt (°C)", Styles.Header);
            WriteText(sheetData, rowIndex, 3, "Lần đo", Styles.Header);
            WriteText(sheetData, rowIndex, 4, "Chỉ thị UUT (°C)", Styles.Header);

            for (int channel = 1; channel <= channelCount; channel++)
                WriteText(sheetData, rowIndex, (uint)(4 + channel), $"Kênh {channel} (°C)", Styles.Header);

            uint summaryStartColumn = (uint)(5 + channelCount);
            WriteText(sheetData, rowIndex, summaryStartColumn, "Trung bình (°C)", Styles.Header);
            WriteText(sheetData, rowIndex, summaryStartColumn + 1, "Số hiệu chỉnh (°C)", Styles.Header);
            WriteText(sheetData, rowIndex, summaryStartColumn + 2, "Độ ổn định (°C)", Styles.Header);
            WriteText(sheetData, rowIndex, summaryStartColumn + 3, "Độ đồng đều (°C)", Styles.Header);
            WriteText(sheetData, rowIndex, summaryStartColumn + 4, "U (°C)", Styles.Header);
        }

        private static void WriteSummaryHeader(SheetData sheetData, uint rowIndex)
        {
            string[] headers =
            {
                "STT",
                "Giá trị đặt (°C)",
                "Giá trị chỉ thị (°C)",
                "Giá trị trung bình (°C)",
                "Số hiệu chỉnh (°C)",
                "Độ ổn định (°C)",
                "Độ đồng đều (°C)",
                "ĐKĐBĐ (°C)"
            };

            for (int i = 0; i < headers.Length; i++)
                WriteText(sheetData, rowIndex, (uint)(i + 1), headers[i], Styles.Header);
        }

        private static int GetExportChannelCount(List<CalibrationResultRow> rows, int kenhCount)
        {
            int maxChannel = kenhCount;

            foreach (var row in rows)
            {
                if (row.SoKenh > maxChannel)
                    maxChannel = row.SoKenh;

                if (row.ChiTietLanDos == null) continue;

                foreach (var detail in row.ChiTietLanDos)
                {
                    if (detail.KenhValues != null)
                    {
                        for (int i = 0; i < detail.KenhValues.Length; i++)
                        {
                            if (detail.KenhValues[i].HasValue && i + 1 > maxChannel)
                                maxChannel = i + 1;
                        }
                    }
                    else if (detail.Kenh > maxChannel)
                    {
                        maxChannel = detail.Kenh;
                    }
                }
            }

            if (maxChannel <= 0) maxChannel = 1;
            if (maxChannel > 10) maxChannel = 10;
            return maxChannel;
        }

        private static int GetMeasurementCount(CalibrationResultRow row)
        {
            int maxLanDo = row.SoLanDo;

            if (row.ChiTietLanDos != null)
            {
                foreach (var detail in row.ChiTietLanDos)
                    if (detail.LanDo > maxLanDo)
                        maxLanDo = detail.LanDo;
            }

            return Math.Max(maxLanDo, 1);
        }

        private static double? GetChiThiUut(CalibrationResultRow row, int lanDo)
        {
            var value = row.ChiTietLanDos?
                .Where(d => d.LanDo == lanDo && d.ChiThiUut.HasValue)
                .Select(d => d.ChiThiUut)
                .FirstOrDefault();

            if (value.HasValue)
                return value.Value;

            return lanDo == 1 ? row.GiaTriChiThi : null;
        }

        private static double? GetChannelValue(CalibrationResultRow row, int lanDo, int channel)
        {
            var denormalizedDetail = row.ChiTietLanDos?
                .FirstOrDefault(d =>
                    d.LanDo == lanDo &&
                    d.KenhValues != null &&
                    channel >= 1 &&
                    channel <= d.KenhValues.Length &&
                    d.KenhValues[channel - 1].HasValue);

            if (denormalizedDetail != null)
                return denormalizedDetail.KenhValues![channel - 1]!.Value;

            var detail = row.ChiTietLanDos?
                .FirstOrDefault(d => d.LanDo == lanDo && d.Kenh == channel);

            if (detail != null)
                return detail.GiaTri;

            if (lanDo == 1 &&
                channel >= 1 &&
                channel <= row.Kenh.Length &&
                !double.IsNaN(row.Kenh[channel - 1]))
            {
                return row.Kenh[channel - 1];
            }

            return null;
        }

        private static Columns CreateColumns(int totalColumns, int channelCount)
        {
            var columns = new Columns();

            for (uint column = 1; column <= totalColumns; column++)
            {
                double width = column switch
                {
                    1 => 6D,
                    2 => 13D,
                    3 => 8D,
                    4 => 15D,
                    _ when column <= 4 + channelCount => 12D,
                    _ => 15D
                };

                columns.Append(new Column
                {
                    Min = column,
                    Max = column,
                    Width = width,
                    CustomWidth = true
                });
            }

            return columns;
        }

        private static Stylesheet CreateStylesheet()
        {
            return new Stylesheet(
                new NumberingFormats(
                    new NumberingFormat { NumberFormatId = 164U, FormatCode = "0.0" },
                    new NumberingFormat { NumberFormatId = 165U, FormatCode = "0.00" })
                { Count = 2U },
                new Fonts(
                    new DocumentFormat.OpenXml.Spreadsheet.Font(
                        new FontSize { Val = 11D },
                        new FontName { Val = "Calibri" }),
                    new DocumentFormat.OpenXml.Spreadsheet.Font(
                        new Bold(),
                        new FontSize { Val = 11D },
                        new FontName { Val = "Calibri" }),
                    new DocumentFormat.OpenXml.Spreadsheet.Font(
                        new Bold(),
                        new FontSize { Val = 16D },
                        new FontName { Val = "Calibri" }),
                    new DocumentFormat.OpenXml.Spreadsheet.Font(
                        new Italic(),
                        new FontSize { Val = 10D },
                        new FontName { Val = "Calibri" }))
                { Count = 4U, KnownFonts = true },
                new Fills(
                    new Fill(new PatternFill { PatternType = PatternValues.None }),
                    new Fill(new PatternFill { PatternType = PatternValues.Gray125 }),
                    CreateSolidFill("D9EAF7"),
                    CreateSolidFill("EDEDED"))
                { Count = 4U },
                new Borders(
                    new Border(),
                    CreateThinBorder())
                { Count = 2U },
                new CellStyleFormats(
                    new CellFormat { NumberFormatId = 0U, FontId = 0U, FillId = 0U, BorderId = 0U })
                { Count = 1U },
                new CellFormats(
                    new CellFormat { NumberFormatId = 0U, FontId = 0U, FillId = 0U, BorderId = 0U, FormatId = 0U },
                    new CellFormat
                    {
                        FontId = 2U,
                        FillId = 0U,
                        BorderId = 0U,
                        ApplyFont = true,
                        ApplyAlignment = true,
                        Alignment = CenterAlignment()
                    },
                    new CellFormat
                    {
                        FontId = 3U,
                        FillId = 0U,
                        BorderId = 0U,
                        ApplyFont = true,
                        ApplyAlignment = true,
                        Alignment = CenterAlignment()
                    },
                    new CellFormat
                    {
                        FontId = 1U,
                        FillId = 2U,
                        BorderId = 0U,
                        ApplyFont = true,
                        ApplyFill = true,
                        ApplyAlignment = true,
                        Alignment = LeftWrapAlignment()
                    },
                    new CellFormat
                    {
                        FontId = 1U,
                        FillId = 0U,
                        BorderId = 0U,
                        ApplyFont = true,
                        ApplyAlignment = true,
                        Alignment = LeftWrapAlignment()
                    },
                    new CellFormat
                    {
                        FontId = 0U,
                        FillId = 0U,
                        BorderId = 0U,
                        ApplyAlignment = true,
                        Alignment = LeftWrapAlignment()
                    },
                    new CellFormat
                    {
                        FontId = 1U,
                        FillId = 3U,
                        BorderId = 1U,
                        ApplyFont = true,
                        ApplyFill = true,
                        ApplyBorder = true,
                        ApplyAlignment = true,
                        Alignment = CenterWrapAlignment()
                    },
                    new CellFormat
                    {
                        FontId = 0U,
                        FillId = 0U,
                        BorderId = 1U,
                        ApplyBorder = true,
                        ApplyAlignment = true,
                        Alignment = LeftWrapAlignment()
                    },
                    new CellFormat
                    {
                        FontId = 0U,
                        FillId = 0U,
                        BorderId = 1U,
                        ApplyBorder = true,
                        ApplyAlignment = true,
                        Alignment = CenterWrapAlignment()
                    },
                    new CellFormat
                    {
                        NumberFormatId = 164U,
                        FontId = 0U,
                        FillId = 0U,
                        BorderId = 1U,
                        ApplyNumberFormat = true,
                        ApplyBorder = true,
                        ApplyAlignment = true,
                        Alignment = CenterWrapAlignment()
                    },
                    new CellFormat
                    {
                        NumberFormatId = 165U,
                        FontId = 0U,
                        FillId = 0U,
                        BorderId = 1U,
                        ApplyNumberFormat = true,
                        ApplyBorder = true,
                        ApplyAlignment = true,
                        Alignment = CenterWrapAlignment()
                    },
                    new CellFormat
                    {
                        FontId = 3U,
                        FillId = 0U,
                        BorderId = 0U,
                        ApplyFont = true,
                        ApplyAlignment = true,
                        Alignment = LeftWrapAlignment()
                    })
                { Count = 12U },
                new CellStyles(
                    new CellStyle { Name = "Normal", FormatId = 0U, BuiltinId = 0U })
                { Count = 1U });
        }

        private static Fill CreateSolidFill(string rgb)
        {
            return new Fill(new PatternFill(
                new ForegroundColor { Rgb = rgb },
                new BackgroundColor { Indexed = 64U })
            { PatternType = PatternValues.Solid });
        }

        private static Border CreateThinBorder()
        {
            return new Border(
                new LeftBorder(new DocumentFormat.OpenXml.Spreadsheet.Color { Auto = true }) { Style = BorderStyleValues.Thin },
                new RightBorder(new DocumentFormat.OpenXml.Spreadsheet.Color { Auto = true }) { Style = BorderStyleValues.Thin },
                new TopBorder(new DocumentFormat.OpenXml.Spreadsheet.Color { Auto = true }) { Style = BorderStyleValues.Thin },
                new BottomBorder(new DocumentFormat.OpenXml.Spreadsheet.Color { Auto = true }) { Style = BorderStyleValues.Thin },
                new DiagonalBorder());
        }

        private static Alignment CenterAlignment()
        {
            return new Alignment
            {
                Horizontal = HorizontalAlignmentValues.Center,
                Vertical = VerticalAlignmentValues.Center
            };
        }

        private static Alignment CenterWrapAlignment()
        {
            return new Alignment
            {
                Horizontal = HorizontalAlignmentValues.Center,
                Vertical = VerticalAlignmentValues.Center,
                WrapText = true
            };
        }

        private static Alignment LeftWrapAlignment()
        {
            return new Alignment
            {
                Horizontal = HorizontalAlignmentValues.Left,
                Vertical = VerticalAlignmentValues.Center,
                WrapText = true
            };
        }

        private static void WriteMergedText(
            SheetData sheetData,
            MergeCells mergeCells,
            uint startRow,
            uint startColumn,
            uint endRow,
            uint endColumn,
            string? value,
            uint styleIndex)
        {
            FillMergedRange(sheetData, startRow, startColumn, endRow, endColumn, styleIndex);
            WriteText(sheetData, startRow, startColumn, value ?? string.Empty, styleIndex);
            AddMerge(mergeCells, startRow, startColumn, endRow, endColumn);
        }

        private static void WriteMergedNumber(
            SheetData sheetData,
            MergeCells mergeCells,
            uint startRow,
            uint startColumn,
            uint endRow,
            uint endColumn,
            double value,
            uint styleIndex)
        {
            FillMergedRange(sheetData, startRow, startColumn, endRow, endColumn, styleIndex);
            WriteNumber(sheetData, startRow, startColumn, value, styleIndex);
            AddMerge(mergeCells, startRow, startColumn, endRow, endColumn);
        }

        private static void FillMergedRange(
            SheetData sheetData,
            uint startRow,
            uint startColumn,
            uint endRow,
            uint endColumn,
            uint styleIndex)
        {
            for (uint row = startRow; row <= endRow; row++)
            {
                for (uint column = startColumn; column <= endColumn; column++)
                    WriteText(sheetData, row, column, string.Empty, styleIndex);
            }
        }

        private static void AddMerge(
            MergeCells mergeCells,
            uint startRow,
            uint startColumn,
            uint endRow,
            uint endColumn)
        {
            if (startRow == endRow && startColumn == endColumn)
                return;

            string reference =
                $"{GetCellReference(startColumn, startRow)}:{GetCellReference(endColumn, endRow)}";
            mergeCells.Append(new MergeCell { Reference = reference });
        }

        private static void WriteNullableNumber(
            SheetData sheetData,
            uint rowIndex,
            uint columnIndex,
            double? value,
            uint styleIndex)
        {
            if (value.HasValue && !double.IsNaN(value.Value) && !double.IsInfinity(value.Value))
                WriteNumber(sheetData, rowIndex, columnIndex, value.Value, styleIndex);
            else
                WriteText(sheetData, rowIndex, columnIndex, string.Empty, Styles.CenterBorder);
        }

        private static void WriteNumber(
            SheetData sheetData,
            uint rowIndex,
            uint columnIndex,
            double value,
            uint styleIndex)
        {
            var cell = GetOrCreateCell(sheetData, rowIndex, columnIndex);
            cell.StyleIndex = styleIndex;
            cell.DataType = CellValues.Number;
            cell.CellValue = new CellValue(value.ToString(System.Globalization.CultureInfo.InvariantCulture));
            cell.InlineString = null;
        }

        private static void WriteText(
            SheetData sheetData,
            uint rowIndex,
            uint columnIndex,
            string value,
            uint styleIndex)
        {
            var cell = GetOrCreateCell(sheetData, rowIndex, columnIndex);
            cell.StyleIndex = styleIndex;
            cell.DataType = CellValues.InlineString;
            cell.InlineString = new InlineString(new Text(value ?? string.Empty)
            {
                Space = SpaceProcessingModeValues.Preserve
            });
            cell.CellValue = null;
        }

        private static Cell GetOrCreateCell(SheetData sheetData, uint rowIndex, uint columnIndex)
        {
            var row = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex?.Value == rowIndex);
            if (row == null)
            {
                row = new Row { RowIndex = rowIndex };
                var refRow = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex?.Value > rowIndex);
                sheetData.InsertBefore(row, refRow);
            }

            string cellReference = GetCellReference(columnIndex, rowIndex);
            var cell = row.Elements<Cell>().FirstOrDefault(c => c.CellReference?.Value == cellReference);
            if (cell != null)
                return cell;

            cell = new Cell { CellReference = cellReference };
            var refCell = row.Elements<Cell>()
                .FirstOrDefault(c => CompareCellReferences(c.CellReference?.Value, cellReference) > 0);
            row.InsertBefore(cell, refCell);

            return cell;
        }

        private static int CompareCellReferences(string? left, string right)
        {
            if (string.IsNullOrEmpty(left))
                return -1;

            uint leftColumn = GetColumnIndex(new string(left.Where(char.IsLetter).ToArray()));
            uint rightColumn = GetColumnIndex(new string(right.Where(char.IsLetter).ToArray()));
            return leftColumn.CompareTo(rightColumn);
        }

        private static string GetCellReference(uint columnIndex, uint rowIndex)
        {
            return $"{GetColumnName(columnIndex)}{rowIndex}";
        }

        private static string GetColumnName(uint columnIndex)
        {
            string columnName = string.Empty;

            while (columnIndex > 0)
            {
                uint modulo = (columnIndex - 1) % 26;
                columnName = Convert.ToChar('A' + modulo) + columnName;
                columnIndex = (columnIndex - modulo) / 26;
            }

            return columnName;
        }

        private static uint GetColumnIndex(string columnName)
        {
            uint result = 0;

            foreach (char ch in columnName.ToUpperInvariant())
                result = result * 26 + (uint)(ch - 'A' + 1);

            return result;
        }

        private static class Styles
        {
            public const uint Title = 1U;
            public const uint Subtitle = 2U;
            public const uint Section = 3U;
            public const uint Label = 4U;
            public const uint Value = 5U;
            public const uint Header = 6U;
            public const uint TextBorder = 7U;
            public const uint CenterBorder = 8U;
            public const uint Number1Border = 9U;
            public const uint Number2Border = 10U;
            public const uint Note = 11U;
        }

#if false
        private static void WriteExcelData(
            string filePath,
            SessionMetadata meta,
            List<CalibrationResultRow> calibRows,
            int kenhCount)
        {
            using var doc = SpreadsheetDocument.Open(filePath, isEditable: true);
            var workbookPart = doc.WorkbookPart;
            if (workbookPart == null) return;

            string sheetName = kenhCount <= 3 ? "3 Pos" : "5 Pos";
            if (kenhCount > 5)
                AppLogger.Warning("ExcelExporter",
                    $"kenhCount={kenhCount} > 5, dùng sheet '5 Pos', chỉ ghi 5 kênh đầu.");

            var sheet = workbookPart.Workbook.Descendants<Sheet>().FirstOrDefault(s => s.Name == sheetName);
            if (sheet == null || sheet.Id == null) return;

            var wsp = (WorksheetPart)workbookPart.GetPartById(sheet.Id);

            SetCell(wsp, "C6",  meta.TenThietBi);
            SetCell(wsp, "H7",  meta.SoHieu);
            SetCell(wsp, "C8",  meta.NoiSanXuat);
            SetCell(wsp, "H8",  meta.KyHieu);
            SetCell(wsp, "C9",  meta.DacTinhKyThuat);
            SetCell(wsp, "C13", meta.DonViSuDung);
            SetCell(wsp, "D12", meta.PhuongPhap);
            SetCell(wsp, "C16", meta.NhietDoMoiTruong);
            SetCell(wsp, "G16", meta.DoAmTuongDoi);
            SetCell(wsp, "C17", meta.ThietBiChuan);
            SetCell(wsp, "C19", meta.NgayHieuChuan.ToString("dd/MM/yyyy"));
            SetCell(wsp, "H19", meta.SoTem);

            var sheetData = wsp.Worksheet.GetFirstChild<SheetData>();
            int lastValidRow = sheetData?.Elements<Row>().Any() == true
                ? sheetData.Elements<Row>().Max(r => (int)r.RowIndex!.Value)
                : int.MaxValue;

            int maxPoints = calibRows.Count;

            string[] dataCols = kenhCount <= 3
                ? new[] { "L", "M", "N" }
                : new[] { "L", "M", "N", "O", "P" };

            for (int p = 0; p < maxPoints; p++)
            {
                var row = calibRows[p];
                int startRow = 4 + p * 6;

                if (startRow > lastValidRow) break;

                SetCell(wsp, $"K{startRow}", row.GiaTriDat.ToString("F1"));

                if (row.ChiTietLanDos == null || row.ChiTietLanDos.Count == 0)
                    continue;

                var byLanDo = row.ChiTietLanDos
                    .GroupBy(d => d.LanDo)
                    .OrderBy(g => g.Key)
                    .ToList();

                foreach (var lanDoGroup in byLanDo)
                {
                    int lanDoIdx = lanDoGroup.Key - 1;
                    if (lanDoIdx < 0) continue;
                    int excelRow = startRow + lanDoIdx;
                    if (excelRow > lastValidRow) continue;

                    foreach (var chiTiet in lanDoGroup.OrderBy(d => d.Kenh))
                    {
                        int kenhIdx = chiTiet.Kenh - 1;
                        if (kenhIdx < 0 || kenhIdx >= dataCols.Length) continue;
                        string cellRef = $"{dataCols[kenhIdx]}{excelRow}";
                        SetCell(wsp, cellRef, chiTiet.GiaTri.ToString("F2"));
                    }
                }
            }


            doc.Save();
        }

        private static void SetCell(WorksheetPart wsp, string cellRef, string value)
        {
            var worksheet = wsp.Worksheet;
            var sheetData = worksheet.GetFirstChild<SheetData>();
            if (sheetData == null) return;

            string columnName = new string(cellRef.Where(char.IsLetter).ToArray());
            if (!uint.TryParse(new string(cellRef.Where(char.IsDigit).ToArray()), out uint rowIndex))
                return;

            Row row = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex == rowIndex);
            if (row == null)
            {
                row = new Row { RowIndex = rowIndex };
                var refRow = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex > rowIndex);
                sheetData.InsertBefore(row, refRow);
            }

            Cell cell = row.Elements<Cell>().FirstOrDefault(c => c.CellReference?.Value == cellRef);
            if (cell == null)
            {
                cell = new Cell { CellReference = cellRef };
                var refCell = row.Elements<Cell>().FirstOrDefault(c => string.Compare(c.CellReference?.Value, cellRef, true) > 0);
                row.InsertBefore(cell, refCell);
            }

            cell.DataType = CellValues.InlineString;
            cell.InlineString = new InlineString { Text = new Text(value ?? string.Empty) };
        }
#endif
    }
}

