using HM_19MB_Core.Data;
using MiniSoftware;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;


namespace HM_19MB_Core.Data
{
    // Tạo báo cáo hiệu chuẩn từ dữ liệu trong database.
    public static class ReportGenerator
    {
#if false
        public static async Task ExportAsync(
            int phienId,
            int kenhCount,
            IWin32Window owner)
        {
            await DatabaseService.EnsureSchemaAsync();
            var meta = await DatabaseService.LayPhienAsync(phienId)
                ?? throw new InvalidOperationException(
                    "Không tìm thấy phiên hiệu chuẩn.");
            var calibRows = await DatabaseService.LayKetQuaHieuChuanAsync(phienId);

            if (calibRows.Count == 0)
                throw new InvalidOperationException(
                    "Chưa có điểm kiểm tra nào. " +
                    "Vui lòng thêm ít nhất 1 điểm trước khi xuất báo cáo.");

            // Load ChiTietLanDos cho từng row từ DB
            foreach (var row in calibRows)
            {
                if (row.Id > 0)
                    row.ChiTietLanDos =
                        await DatabaseService.LayChiTietLanDoAsync(row.Id);
            }

            // Xuất Word — hỏi người dùng
            await ExcelExporter.ExportWordAsync(meta, calibRows, kenhCount, owner);

            // Xuất Excel — hỏi người dùng (dialog riêng)
            await ExcelExporter.ExportExcelAsync(meta, calibRows, kenhCount, owner);
        }

#endif
        public static async Task<string> ExportToExcelAsync(int phienId, string outputPath)
        {
            var meta = await DatabaseService.LayPhienAsync(phienId)
                          ?? throw new InvalidOperationException("Không tìm thấy phiên hiệu chuẩn.");
            var ketQua = await DatabaseService.LayKetQuaTheoPhienAsync(phienId);

            if (ketQua.Count == 0)
                throw new InvalidOperationException("Không có dữ liệu đo để xuất báo cáo.");

            using var writer = new StreamWriter(outputPath, false, System.Text.Encoding.UTF8);

            await GhiHeaderMetadata(writer, meta);

            await writer.WriteLineAsync("KẾT QUẢ ĐO");
            await writer.WriteLineAsync("");
            var headerParts = new System.Text.StringBuilder("Thời gian");
            for (int i = 1; i <= 10; i++) headerParts.Append($",Nhiệt độ {i} (°C),Độ ẩm {i} (%)");
            headerParts.Append(",TB nhiệt độ,TB độ ẩm,Độ đồng đều nhiệt,Độ đồng đều ẩm,Ổn định nhiệt,Ổn định ẩm");
            await writer.WriteLineAsync(headerParts.ToString());

            // THAY vòng lặp foreach cũ (dùng SoLieuDauDo) bằng:
            foreach (var kq in ketQua)
            {
                var line = new System.Text.StringBuilder();
                line.Append($"{kq.ThoiGianDo:yyyy-MM-dd HH:mm:ss}");
                for (int i = 0; i < 10; i++)
                {
                    line.Append($",{FormatNullable(kq.HasNhietDo[i], kq.NhietDo[i])},{FormatNullable(kq.HasDoAm[i], kq.DoAm[i])}");
                }
                line.Append($",{kq.NhietDoTb:F1},{FormatNullable(kq.HasDoAmTb, kq.DoAmTb)}");
                line.Append($",{kq.DoDongDeuNhiet:F1},{FormatNullable(kq.HasDoDongDeuAm, kq.DoDongDeuAm)}");
                line.Append($",{FormatNullable(kq.HasDoOnDinhNhiet, kq.DoOnDinhNhiet)},{FormatNullable(kq.HasDoOnDinhAm, kq.DoOnDinhAm)}");
                await writer.WriteLineAsync(line.ToString());
            }


            // Thống kê — LINQ giữ nguyên vì dữ liệu đã có trong bộ nhớ
            await writer.WriteLineAsync("");
            await writer.WriteLineAsync("THỐNG KÊ TỔNG HỢP");
            await writer.WriteLineAsync("");
            await writer.WriteLineAsync(
                "Đầu đo,Nhiệt độ TB,Nhiệt độ Min,Nhiệt độ Max," +
                "Độ ẩm TB,Độ ẩm Min,Độ ẩm Max,Số lần đo");

            foreach (var stat in TinhThongKeDauDo(ketQua))
            {
                await writer.WriteLineAsync(
                    $"{stat.SoDauDo}," +
                    $"{stat.NhietDoTb:F2},{stat.NhietDoMin:F2},{stat.NhietDoMax:F2}," +
                    $"{FormatNullable(stat.HasDoAm, stat.DoAmTb)},{FormatNullable(stat.HasDoAm, stat.DoAmMin)},{FormatNullable(stat.HasDoAm, stat.DoAmMax)},{stat.SoLanDo}");
            }

            await writer.WriteLineAsync("");
            await writer.WriteLineAsync($"Tổng số lần đo:,{ketQua.Count}");
            await writer.WriteLineAsync(
                $"Thời gian bắt đầu:,{ketQua.First().ThoiGianDo:yyyy-MM-dd HH:mm:ss}");
            await writer.WriteLineAsync(
                $"Thời gian kết thúc:,{ketQua.Last().ThoiGianDo:yyyy-MM-dd HH:mm:ss}");

            return outputPath;
        }

        public static async Task<string> ExportToWordAsync(int phienId, string outputPath)
        {
            var meta = await DatabaseService.LayPhienAsync(phienId)
                       ?? throw new InvalidOperationException("KhÃ´ng tÃ¬m tháº¥y phiÃªn hiá»‡u chuáº©n.");
            var rows = await DatabaseService.LayKetQuaHieuChuanAsync(phienId);

            if (rows.Count == 0)
                throw new InvalidOperationException("ChÆ°a cÃ³ káº¿t quáº£ hiá»‡u chuáº©n Ä‘á»ƒ xuáº¥t bÃ¡o cÃ¡o.");

            var templatePath = Path.Combine(
                AppContext.BaseDirectory,
                "Resources",
                "Templates",
                "GiayChungNhanHieuChuan.docx");

            if (!File.Exists(templatePath))
                throw new FileNotFoundException("KhÃ´ng tÃ¬m tháº¥y template Word.", templatePath);

            var first = rows[0];
            var data = new Dictionary<string, object?>
            {
                ["TenThietBi"] = meta.TenThietBi,
                ["KyHieu"] = meta.KyHieu,
                ["SoHieu"] = meta.SoHieu,
                ["SoTem"] = meta.SoTem,
                ["NoiSanXuat"] = meta.NoiSanXuat,
                ["DonViSuDung"] = meta.DonViSuDung,
                ["PhuongPhap"] = meta.PhuongPhap,
                ["NgayHieuChuan"] = meta.NgayHieuChuan.ToString("dd/MM/yyyy"),
                ["DacTinhKyThuat"] = meta.DacTinhKyThuat,
                ["ThietBiChuan"] = meta.ThietBiChuan,
                ["DieuKienMoiTruong"] = $"{meta.NhietDoMoiTruong}; {meta.DoAmTuongDoi}",
                ["STT"] = first.STT,
                ["GiaTriDat"] = FormatNullable(!double.IsNaN(first.GiaTriDat), first.GiaTriDat),
                ["GiaTriChiThi"] = FormatNullable(!double.IsNaN(first.GiaTriChiThi), first.GiaTriChiThi),
                ["TrungBinh"] = FormatNullable(!double.IsNaN(first.GiaTriTrungBinh), first.GiaTriTrungBinh),
                ["SoHieuChinh"] = FormatNullable(!double.IsNaN(first.SoHieuChinh), first.SoHieuChinh),
                ["DoOnDinh"] = FormatNullable(!double.IsNaN(first.DoOnDinh), first.DoOnDinh),
                ["DoDongDeu"] = FormatNullable(!double.IsNaN(first.DoDongDeu), first.DoDongDeu),
                ["DKDB"] = FormatNullable(!double.IsNaN(first.DoKhongDamBao), first.DoKhongDamBao),
            };

            await MiniWord.SaveAsByTemplateAsync(outputPath, templatePath, data);
            return outputPath;
        }

        // ── Thống kê — LINQ trong C# ──────────────────────────────────────────

        /// Tính AVG/MIN/MAX cho từng đầu đo từ danh sách kết quả đã load.
        public static List<ThongKeDauDo> TinhThongKeDauDo(List<KetQuaDo> danhSach)
        {
            var result = new List<ThongKeDauDo>();
            for (int i = 0; i < 10; i++)
            {
                var vals = danhSach
                    .Where(kq => kq.HasNhietDo[i])
                    .ToList();
                if (vals.Count == 0) continue;

                var humVals = vals.Where(kq => kq.HasDoAm[i]).ToList();
                result.Add(new ThongKeDauDo
                {
                    SoDauDo = i + 1,
                    NhietDoTb = vals.Average(kq => kq.NhietDo[i]),
                    NhietDoMin = vals.Min(kq => kq.NhietDo[i]),
                    NhietDoMax = vals.Max(kq => kq.NhietDo[i]),
                    HasDoAm = humVals.Count > 0,
                    DoAmTb = humVals.Count > 0 ? humVals.Average(kq => kq.DoAm[i]) : 0,
                    DoAmMin = humVals.Count > 0 ? humVals.Min(kq => kq.DoAm[i]) : 0,
                    DoAmMax = humVals.Count > 0 ? humVals.Max(kq => kq.DoAm[i]) : 0,
                    SoLanDo = vals.Count,
                });
            }
            return result;
        }

        private static async Task GhiHeaderMetadata(StreamWriter writer, SessionMetadata m)
        {
            await writer.WriteLineAsync("BIÊN BẢN HIỆU CHUẨN THIẾT BỊ");
            await writer.WriteLineAsync("");
            await writer.WriteLineAsync($"Tên phương tiện đo:,{m.TenThietBi}");
            await writer.WriteLineAsync($"Ký hiệu:,{m.KyHieu}");
            await writer.WriteLineAsync($"Số hiệu:,{m.SoHieu}");
            await writer.WriteLineAsync($"Số tem hiệu chuẩn:,{m.SoTem}");
            await writer.WriteLineAsync($"Nơi sản xuất:,{m.NoiSanXuat}");
            await writer.WriteLineAsync($"Năm sản xuất:,{m.NamSanXuat}");
            await writer.WriteLineAsync($"Đơn vị sử dụng:,{m.DonViSuDung}");
            await writer.WriteLineAsync($"Phương pháp thực hiện:,{m.PhuongPhap}");
            await writer.WriteLineAsync($"Ngày hiệu chuẩn:,{m.NgayHieuChuan:dd/MM/yyyy}");
            await writer.WriteLineAsync($"Nhiệt độ môi trường:,{m.NhietDoMoiTruong}");
            await writer.WriteLineAsync($"Độ ẩm tương đối:,{m.DoAmTuongDoi}");
            await writer.WriteLineAsync($"Đặc tính kỹ thuật:,{m.DacTinhKyThuat}");
            await writer.WriteLineAsync($"Các phương tiện đo sử dụng:,{m.ThietBiChuan}");
            await writer.WriteLineAsync("");
        }

        private static string FormatNullable(bool hasValue, float value)
            => hasValue ? value.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) : "";

        private static string FormatNullable(bool hasValue, double value)
            => hasValue ? value.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) : "";

        [Obsolete("Dùng LayPhienAsync + LayKetQuaTheoPhienAsync thay thế.")]
        public static async Task<SessionReportData> GetSessionDataAsync(int sessionId)
        {
            var meta = await DatabaseService.LayPhienAsync(sessionId) ?? new SessionMetadata();
            var ketQua = await DatabaseService.LayKetQuaTheoPhienAsync(sessionId);

            return new SessionReportData
            {
                Metadata = meta,
                MeasurementRecords = ketQua.Select(kq => new MeasurementRecordData
                {
                    RecordId = kq.Id,
                    ReceivedAt = kq.ThoiGianDo,
                    AvgTemperature = kq.NhietDoTb,
                    AvgHumidity = kq.DoAmTb,
                    UniformityTemp = kq.DoDongDeuNhiet,
                    UniformityHumidity = kq.DoDongDeuAm,
                    StabilityRaw = $"{kq.DoOnDinhNhiet:F1} / {kq.DoOnDinhAm:F1}", // thay DoOnDinhRaw
                    ProbeData = Enumerable.Range(0, 10).Select(i => new ProbeData
                    {
                        ProbeNumber = i + 1,
                        Temperature = kq.NhietDo[i],
                        Humidity = kq.DoAm[i],
                    }).Where(p => kq.HasNhietDo[p.ProbeNumber - 1] || kq.HasDoAm[p.ProbeNumber - 1]).ToList(),
                }).ToList(),
            };
        }

        [Obsolete("Dùng TinhThongKeDauDo(List<KetQuaDo>) thay thế.")]
        public static List<ProbeStatistics> CalculateProbeStatistics(List<MeasurementRecordData> records)
        {
            var mapped = records.Select(r =>
            {
                var kq = new KetQuaDo();
                foreach (var p in r.ProbeData)
                {
                    int idx = p.ProbeNumber - 1;
                    if (idx >= 0 && idx < 10)
                    {
                        kq.NhietDo[idx] = p.Temperature;
                        kq.DoAm[idx] = p.Humidity;
                        kq.HasNhietDo[idx] = true;
                        kq.HasDoAm[idx] = true;
                    }
                }
                return kq;
            }).ToList();

            return TinhThongKeDauDo(mapped).Select(s => new ProbeStatistics
            {
                ProbeNumber = s.SoDauDo,
                AvgTemperature = s.NhietDoTb,
                MinTemperature = s.NhietDoMin,
                MaxTemperature = s.NhietDoMax,
                AvgHumidity = s.DoAmTb,
                MinHumidity = s.DoAmMin,
                MaxHumidity = s.DoAmMax,
                Count = s.SoLanDo,
            }).ToList();
        }
    }


    public class DuLieuBaoCao
    {
        public SessionMetadata Metadata { get; set; } = new();
        public List<KetQuaDo> DanhSachKetQua { get; set; } = new();
    }

    public class KetQuaDo
    {
        public int Id { get; set; }
        public DateTime ThoiGianDo { get; set; }
        public float[] NhietDo { get; set; } = new float[10];
        public float[] DoAm { get; set; } = new float[10];
        public bool[] HasNhietDo { get; set; } = new bool[10];
        public bool[] HasDoAm { get; set; } = new bool[10];
        public float NhietDoTb { get; set; }
        public float DoAmTb { get; set; }
        public bool HasDoAmTb { get; set; }
        public float DoDongDeuNhiet { get; set; }
        public float DoDongDeuAm { get; set; }
        public bool HasDoDongDeuAm { get; set; }
        public float DoOnDinhNhiet { get; set; }
        public bool HasDoOnDinhNhiet { get; set; }
        public float DoOnDinhAm { get; set; }
        public bool HasDoOnDinhAm { get; set; }
    }

    public class SoLieuDauDo
    {
        public int SoDauDo { get; set; }
        public float NhietDo { get; set; }
        public float DoAm { get; set; }
    }

    public class ThongKeDauDo
    {
        public int SoDauDo { get; set; }
        public double NhietDoTb { get; set; }
        public double NhietDoMin { get; set; }
        public double NhietDoMax { get; set; }
        public double DoAmTb { get; set; }
        public double DoAmMin { get; set; }
        public double DoAmMax { get; set; }
        public bool HasDoAm { get; set; }
        public int SoLanDo { get; set; }
    }


    [Obsolete("Dùng DuLieuBaoCao thay thế.")]
    public class SessionReportData
    {
        public SessionMetadata Metadata { get; set; } = new();
        public List<MeasurementRecordData> MeasurementRecords { get; set; } = new();
    }

    [Obsolete("Dùng KetQuaDo thay thế.")]
    public class MeasurementRecordData
    {
        public int RecordId { get; set; }
        public DateTime ReceivedAt { get; set; }
        public float AvgTemperature { get; set; }
        public float AvgHumidity { get; set; }
        public float UniformityTemp { get; set; }
        public float UniformityHumidity { get; set; }
        public string StabilityRaw { get; set; } = "";
        public List<ProbeData> ProbeData { get; set; } = new();
    }

    [Obsolete("Dùng SoLieuDauDo thay thế.")]
    public class ProbeData
    {
        public int ProbeNumber { get; set; }
        public float Temperature { get; set; }
        public float Humidity { get; set; }
    }

    [Obsolete("Dùng ThongKeDauDo thay thế.")]
    public class ProbeStatistics
    {
        public int ProbeNumber { get; set; }
        public double AvgTemperature { get; set; }
        public double MinTemperature { get; set; }
        public double MaxTemperature { get; set; }
        public double AvgHumidity { get; set; }
        public double MinHumidity { get; set; }
        public double MaxHumidity { get; set; }
        public int Count { get; set; }
    }
}
