using Npgsql;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HM_19MB_Core.Data
{
    public class CalibrationResultRow
    {
        public int Id { get; set; }
        public int STT { get; set; }

        public double GiaTriDat { get; set; }
        public double GiaTriChiThi { get; set; }

        public double[] Kenh { get; set; } = new double[10];

        public double GiaTriTrungBinh { get; set; }
        public double SoHieuChinh { get; set; }
        public double DoOnDinh { get; set; }
        public double DoDongDeu { get; set; }
        public double DoKhongDamBao { get; set; }

        // Chỉ giữ giá trị TỔNG HỢP — bỏ Uch1, Uch2, Ubk1..Ubk4
        public double Uch { get; set; }
        public double Ubk { get; set; }

        public int SoKenh { get; set; }
        public int SoLanDo { get; set; }
        public string PhuongPhapB { get; set; } = "U";

        // Mở rộng thêm cho xuất báo cáo
        public double DoPhanGiai { get; set; } = double.NaN;
        public double HeSoPhanGiai { get; set; } = double.NaN;
        public string ThongSoChuanJson { get; set; } = "";

        // Dữ liệu thô từng lần đo (không lưu DB trực tiếp — qua chi_tiet_lan_do)
        public List<ChiTietLanDo>? ChiTietLanDos { get; set; }

        public int SoKenhHopLe
        {
            get
            {
                int count = 0;
                foreach (var v in Kenh)
                    if (!double.IsNaN(v)) count++;
                return count;
            }
        }

        public CalibrationResultRow()
        {
            for (int i = 0; i < Kenh.Length; i++)
                Kenh[i] = double.NaN;
        }

        // ── Helper lấy ma trận t[i,j] từ ChiTietLanDos ──────────────────

        public double[,]? GetRawMatrix()
        {
            if (ChiTietLanDos == null || ChiTietLanDos.Count == 0) return null;

            int n = SoLanDo, k = SoKenh;
            foreach (var d in ChiTietLanDos)
            {
                if (d.LanDo > n) n = d.LanDo;
                if (d.KenhValues != null)
                {
                    for (int i = 0; i < d.KenhValues.Length; i++)
                        if (d.KenhValues[i].HasValue && i + 1 > k) k = i + 1;
                }
                else if (d.Kenh > k) k = d.Kenh;
            }
            if (n == 0 || k == 0) return null;

            var matrix = new double[n, k];
            for (int i = 0; i < n; i++)
                for (int j = 0; j < k; j++)
                    matrix[i, j] = double.NaN;

            foreach (var d in ChiTietLanDos)
            {
                int rowIndex = d.LanDo - 1;
                if (rowIndex < 0 || rowIndex >= n) continue;

                if (d.KenhValues != null)
                {
                    for (int i = 0; i < Math.Min(d.KenhValues.Length, k); i++)
                        if (d.KenhValues[i].HasValue)
                            matrix[rowIndex, i] = d.KenhValues[i]!.Value;
                }
                else if (d.Kenh >= 1 && d.Kenh <= k)
                {
                    matrix[rowIndex, d.Kenh - 1] = d.GiaTri;
                }
            }

            return matrix;
        }

        public double[]? GetChiThiArray()
        {
            if (ChiTietLanDos == null || ChiTietLanDos.Count == 0) return null;

            int n = SoLanDo;
            foreach (var d in ChiTietLanDos)
                if (d.LanDo > n) n = d.LanDo;
            if (n == 0) return null;

            var arr = new double[n];
            for (int i = 0; i < n; i++) arr[i] = double.NaN;

            foreach (var d in ChiTietLanDos)
                if (d.ChiThiUut.HasValue && (d.KenhValues != null || d.Kenh == 1))
                    arr[d.LanDo - 1] = d.ChiThiUut.Value;

            return arr;
        }
    }

    // ── Model: chi tiết lần đo ───────────────────────────────────────────

    public class ChiTietLanDo
    {
        public int LanDo { get; set; }
        public int Kenh { get; set; }
        public double GiaTri { get; set; }
        public double? ChiThiUut { get; set; }
        public double?[]? KenhValues { get; set; }
    }

    // ── DatabaseService partial ──────────────────────────────────────────

    public static partial class DatabaseService
    {
        // ── Lưu kết quả hiệu chuẩn (schema v6) ──────────────────────────

        public static async Task<int> LuuKetQuaHieuChuanAsync(
            int phienId,
            CalibrationResultRow row)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT fn_luu_ket_qua_hieu_chuan(" +
                "@phien_id, @stt," +
                "@gia_tri_dat, @gia_tri_chi_thi," +
                "@kenh_1, @kenh_2, @kenh_3, @kenh_4, @kenh_5," +
                "@kenh_6, @kenh_7, @kenh_8, @kenh_9, @kenh_10," +
                "@gia_tri_trung_binh, @so_hieu_chinh," +
                "@do_on_dinh, @do_dong_deu, @do_khong_dam_bao," +
                "@uch, @ubk," +                    // ← bỏ uch1, uch2, ubk1..ubk4
                "@so_kenh, @so_lan_do, @phuong_phap_b," +
                "@do_phan_giai, @he_so_phan_giai, @thong_so_chuan_json)", conn);

            cmd.Parameters.AddWithValue("@phien_id", phienId);
            cmd.Parameters.AddWithValue("@stt", row.STT);
            cmd.Parameters.AddWithValue("@gia_tri_dat", row.GiaTriDat);
            cmd.Parameters.AddWithValue("@gia_tri_chi_thi", row.GiaTriChiThi);

            for (int i = 0; i < 10; i++)
            {
                object val = double.IsNaN(row.Kenh[i])
                    ? DBNull.Value : (object)row.Kenh[i];
                cmd.Parameters.AddWithValue($"@kenh_{i + 1}", val);
            }

            cmd.Parameters.AddWithValue("@gia_tri_trung_binh", row.GiaTriTrungBinh);
            cmd.Parameters.AddWithValue("@so_hieu_chinh", row.SoHieuChinh);
            cmd.Parameters.AddWithValue("@do_on_dinh", row.DoOnDinh);
            cmd.Parameters.AddWithValue("@do_dong_deu", row.DoDongDeu);
            cmd.Parameters.AddWithValue("@do_khong_dam_bao", row.DoKhongDamBao);
            cmd.Parameters.AddWithValue("@uch", row.Uch);
            cmd.Parameters.AddWithValue("@ubk", row.Ubk);
            cmd.Parameters.AddWithValue("@so_kenh", row.SoKenh);
            cmd.Parameters.AddWithValue("@so_lan_do", row.SoLanDo);
            cmd.Parameters.AddWithValue("@phuong_phap_b", row.PhuongPhapB);
            
            cmd.Parameters.AddWithValue("@do_phan_giai", double.IsNaN(row.DoPhanGiai) ? DBNull.Value : (object)row.DoPhanGiai);
            cmd.Parameters.AddWithValue("@he_so_phan_giai", double.IsNaN(row.HeSoPhanGiai) ? DBNull.Value : (object)row.HeSoPhanGiai);
            cmd.Parameters.AddWithValue("@thong_so_chuan_json", string.IsNullOrEmpty(row.ThongSoChuanJson) ? DBNull.Value : (object)row.ThongSoChuanJson);

            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        // ── Lấy kết quả hiệu chuẩn (schema v6) ──────────────────────────

        public static async Task<List<CalibrationResultRow>> LayKetQuaHieuChuanAsync(int phienId)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT * FROM fn_lay_ket_qua_hieu_chuan(@p_phien_id)", conn);
            cmd.Parameters.AddWithValue("@p_phien_id", phienId);

            var list = new List<CalibrationResultRow>();
            await using var rdr = await cmd.ExecuteReaderAsync();

            while (await rdr.ReadAsync())
            {
                // Thứ tự cột theo fn_lay_ket_qua_hieu_chuan v6:
                // 0=id, 1=stt, 2=gia_tri_dat, 3=gia_tri_chi_thi,
                // 4..13=kenh_1..10,
                // 14=gia_tri_trung_binh, 15=so_hieu_chinh,
                // 16=do_on_dinh, 17=do_dong_deu, 18=do_khong_dam_bao,
                // 19=uch, 20=ubk,
                // 21=so_kenh, 22=so_lan_do, 23=phuong_phap_b
                // 24=do_phan_giai, 25=he_so_phan_giai, 26=thong_so_chuan_json

                var row = new CalibrationResultRow
                {
                    Id = rdr.GetInt32(0),
                    STT = rdr.GetInt32(1),
                    GiaTriDat = ReadDouble(rdr, 2),
                    GiaTriChiThi = ReadDouble(rdr, 3),
                    GiaTriTrungBinh = ReadDouble(rdr, 14),
                    SoHieuChinh = ReadDouble(rdr, 15),
                    DoOnDinh = ReadDouble(rdr, 16),
                    DoDongDeu = ReadDouble(rdr, 17),
                    DoKhongDamBao = ReadDouble(rdr, 18),
                    Uch = ReadDoubleNullable(rdr, 19),
                    Ubk = ReadDoubleNullable(rdr, 20),
                    SoKenh = rdr.IsDBNull(21) ? 0 : rdr.GetInt32(21),
                    SoLanDo = rdr.IsDBNull(22) ? 0 : rdr.GetInt32(22),
                    PhuongPhapB = rdr.IsDBNull(23) ? "U" : rdr.GetString(23),
                    DoPhanGiai = ReadDoubleNullable(rdr, 24),
                    HeSoPhanGiai = ReadDoubleNullable(rdr, 25),
                    ThongSoChuanJson = rdr.IsDBNull(26) ? "" : rdr.GetString(26),
                };

                for (int i = 0; i < 10; i++)
                    row.Kenh[i] = ReadDoubleNullable(rdr, 4 + i);

                list.Add(row);
            }

            return list;
        }

        // ── chi_tiet_lan_do (denormalized: 1 dòng = 1 lần đo, kenh_1..10) ──

        public static async Task LuuChiTietLanDoAsync(
            int ketQuaHcId,
            List<ChiTietLanDo> chiTiets)
        {
            if (chiTiets == null || chiTiets.Count == 0) return;

            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            // Xóa cũ trước để đảm bảo idempotent
            await using (var del = new NpgsqlCommand(
                "SELECT fn_xoa_chi_tiet_lan_do(@id)", conn))
            {
                del.Parameters.AddWithValue("@id", ketQuaHcId);
                await del.ExecuteNonQueryAsync();
            }

            // Gom nhóm theo LanDo: mỗi nhóm = 1 dòng DB
            var grouped = chiTiets
                .GroupBy(d => d.LanDo)
                .OrderBy(g => g.Key);

            // COPY binary — 1 dòng = 1 lần đo với kenh_1..10
            await using var writer = await conn.BeginBinaryImportAsync(
                "COPY chi_tiet_lan_do " +
                "(ket_qua_hc_id, lan_do, chi_thi_uut, " +
                " kenh_1, kenh_2, kenh_3, kenh_4, kenh_5, " +
                " kenh_6, kenh_7, kenh_8, kenh_9, kenh_10) " +
                "FROM STDIN (FORMAT BINARY)");

            foreach (var group in grouped)
            {
                short lanDo = (short)group.Key;
                double?[] kenhValues = new double?[10];
                double? chiThi = null;

                foreach (var d in group)
                {
                    if (d.Kenh >= 1 && d.Kenh <= 10)
                        kenhValues[d.Kenh - 1] = d.GiaTri;
                    if (d.ChiThiUut.HasValue)
                        chiThi = d.ChiThiUut;
                }

                await writer.StartRowAsync();
                await writer.WriteAsync(ketQuaHcId, NpgsqlTypes.NpgsqlDbType.Integer);
                await writer.WriteAsync(lanDo, NpgsqlTypes.NpgsqlDbType.Smallint);

                // chi_thi_uut
                if (chiThi.HasValue)
                    await writer.WriteAsync(chiThi.Value, NpgsqlTypes.NpgsqlDbType.Double);
                else
                    await writer.WriteNullAsync();

                // kenh_1..kenh_10
                for (int i = 0; i < 10; i++)
                {
                    if (kenhValues[i].HasValue)
                        await writer.WriteAsync(kenhValues[i]!.Value, NpgsqlTypes.NpgsqlDbType.Double);
                    else
                        await writer.WriteNullAsync();
                }
            }

            await writer.CompleteAsync();
        }

        public static async Task<List<ChiTietLanDo>> LayChiTietLanDoAsync(int ketQuaHcId)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT * FROM fn_lay_chi_tiet_lan_do(@id)", conn);
            cmd.Parameters.AddWithValue("@id", ketQuaHcId);

            var list = new List<ChiTietLanDo>();
            await using var rdr = await cmd.ExecuteReaderAsync();

            // fn_lay_chi_tiet_lan_do trả về:
            // 0=lan_do, 1=chi_thi_uut, 2..11=kenh_1..kenh_10
            while (await rdr.ReadAsync())
            {
                short lanDo = rdr.GetInt16(0);
                double? chiThi = rdr.IsDBNull(1) ? null : rdr.GetDouble(1);
                double?[] kenhValues = new double?[10];

                for (int k = 0; k < 10; k++)
                {
                    int ordinal = 2 + k;
                    if (!rdr.IsDBNull(ordinal))
                        kenhValues[k] = rdr.GetDouble(ordinal);
                }

                list.Add(new ChiTietLanDo
                {
                    LanDo = lanDo,
                    ChiThiUut = chiThi,
                    KenhValues = kenhValues,
                });
            }

            return list;
        }

        public static async Task XoaKetQuaHieuChuanAsync(int phienId, int stt)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT fn_xoa_ket_qua_hieu_chuan(@p_phien_id, @p_stt)", conn);
            cmd.Parameters.AddWithValue("@p_phien_id", phienId);
            cmd.Parameters.AddWithValue("@p_stt", stt);
            await cmd.ExecuteNonQueryAsync();
        }

        public static async Task<int> LaySTTTiepTheoAsync(int phienId)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT fn_lay_stt_tiep_theo(@p_phien_id)", conn);
            cmd.Parameters.AddWithValue("@p_phien_id", phienId);

            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        // ── Helpers ──────────────────────────────────────────────────────

        private static double ReadDouble(NpgsqlDataReader rdr, int ordinal)
            => rdr.IsDBNull(ordinal) ? 0.0 : Convert.ToDouble(rdr.GetValue(ordinal));

        private static double ReadDoubleNullable(NpgsqlDataReader rdr, int ordinal)
            => rdr.IsDBNull(ordinal) ? double.NaN : Convert.ToDouble(rdr.GetValue(ordinal));
    }
}
