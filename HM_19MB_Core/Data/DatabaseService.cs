using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using Npgsql;

namespace HM_19MB_Core.Data
{
    public class SessionMetadata
    {
        public string TenThietBi { get; set; } = "";
        public string KyHieu { get; set; } = "";
        public string SoHieu { get; set; } = "";
        public string SoTem { get; set; } = "";
        public string NoiSanXuat { get; set; } = "";
        public string NamSanXuat { get; set; } = "";
        public string DonViSuDung { get; set; } = "";
        public string PhuongPhap { get; set; } = "";
        public DateTime NgayHieuChuan { get; set; } = DateTime.Today;
        public string NhietDoMoiTruong { get; set; } = "";
        public string DoAmTuongDoi { get; set; } = "";
        public string NhietDoLamViec { get; set; } = "";
        public string DacTinhKyThuat { get; set; } = "";
        public string ThietBiChuan { get; set; } = "";
    }

    public class PhienDoSummary
    {
        public int Id { get; set; }
        public string TenThietBi { get; set; } = "";
        public string KyHieu { get; set; } = "";
        public string SoHieu { get; set; } = "";
        public string DonViSuDung { get; set; } = "";
        public DateTime NgayHieuChuan { get; set; }
        public long SoDiemKiemTra { get; set; }
        public long SoLanDoTho { get; set; }
        public DateTime NgayTao { get; set; }
    }

    public static partial class DatabaseService
    {
        private static string? _connectionString;

        public static void ConfigureConnectionString(string connectionString)
        {
            _connectionString = connectionString;
        }

        public static string ConnectionString =>
            _connectionString
            ?? Environment.GetEnvironmentVariable("POSTGRES_CONN")
            ?? throw new InvalidOperationException("Missing database connection string.");

        // Tạo bảng và đăng ký function nếu chưa tồn tại
        private const int SCHEMA_VERSION = 8;
        private static bool _schemaEnsured = false;

        /// <summary>
        /// Reset flag để buộc chạy lại schema lần gọi kế tiếp (dùng khi cần migrate).
        /// </summary>
        public static void ResetSchemaFlag() => _schemaEnsured = false;

        public static async Task EnsureSchemaAsync()
        {
            if (_schemaEnsured) return;

            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            // Tạo bảng lưu trữ phiên bản schema
            await using (var cmd = new NpgsqlCommand(@"
                CREATE TABLE IF NOT EXISTS cai_dat_he_thong (
                    khoa        VARCHAR(50)  PRIMARY KEY,
                    gia_tri     TEXT         NOT NULL,
                    cap_nhat    TIMESTAMP    NOT NULL DEFAULT NOW()
                )", conn))
            {
                await cmd.ExecuteNonQueryAsync();
            }
            // Đọc phiên bản hiện tại
            int dbVersion = 0;
            await using (var cmd = new NpgsqlCommand(@"
                SELECT gia_tri FROM cai_dat_he_thong
                WHERE khoa = 'phien_ban_schema'", conn))
            {
                var result = await cmd.ExecuteScalarAsync();
                if (result is string s) int.TryParse(s, out dbVersion);
            }
            if (dbVersion != SCHEMA_VERSION)
            {
                await using var cmd = new NpgsqlCommand(SqlLoader.Load("schema"), conn);
                await cmd.ExecuteNonQueryAsync();
            }

            await using (var cmd = new NpgsqlCommand(SqlLoader.Load("functions"), conn))
            {
                await cmd.ExecuteNonQueryAsync();
            }

            // Ghi lại phiên bản mới
            await using (var cmd = new NpgsqlCommand(@"
                INSERT INTO cai_dat_he_thong (khoa, gia_tri, cap_nhat)
                VALUES ('phien_ban_schema', @v, NOW())
                ON CONFLICT (khoa) DO UPDATE
                    SET gia_tri  = EXCLUDED.gia_tri,
                        cap_nhat = EXCLUDED.cap_nhat", conn))
            {
                cmd.Parameters.AddWithValue("@v", SCHEMA_VERSION.ToString());
                await cmd.ExecuteNonQueryAsync();
            }

            _schemaEnsured = true;
        }

        // Tạo phiên hiệu chuẩn mới
        public static async Task<int> TaoPhienMoiAsync(SessionMetadata meta)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT fn_tao_phien(" +
                "@p_ten_thiet_bi::varchar, @p_ky_hieu::varchar, @p_so_hieu::varchar, @p_so_tem::varchar," +
                "@p_noi_san_xuat::varchar, @p_nam_san_xuat::varchar, @p_don_vi_su_dung::varchar, @p_phuong_phap::varchar," +
                "@p_ngay_hieu_chuan::date," +
                "@p_nhiet_do_moi_truong::varchar, @p_do_am_tuong_doi::varchar, @p_nhiet_do_lam_viec::varchar," +
                "@p_dac_tinh_ky_thuat::text, @p_thiet_bi_chuan::text)", conn);

            cmd.Parameters.AddWithValue("@p_ten_thiet_bi", meta.TenThietBi);
            cmd.Parameters.AddWithValue("@p_ky_hieu", meta.KyHieu);
            cmd.Parameters.AddWithValue("@p_so_hieu", meta.SoHieu);
            cmd.Parameters.AddWithValue("@p_so_tem", meta.SoTem);
            cmd.Parameters.AddWithValue("@p_noi_san_xuat", meta.NoiSanXuat);
            cmd.Parameters.AddWithValue("@p_nam_san_xuat", meta.NamSanXuat);
            cmd.Parameters.AddWithValue("@p_don_vi_su_dung", meta.DonViSuDung);
            cmd.Parameters.AddWithValue("@p_phuong_phap", meta.PhuongPhap);
            cmd.Parameters.AddWithValue("@p_ngay_hieu_chuan", meta.NgayHieuChuan);
            cmd.Parameters.AddWithValue("@p_nhiet_do_moi_truong", meta.NhietDoMoiTruong);
            cmd.Parameters.AddWithValue("@p_do_am_tuong_doi", meta.DoAmTuongDoi);
            cmd.Parameters.AddWithValue("@p_nhiet_do_lam_viec", meta.NhietDoLamViec);
            cmd.Parameters.AddWithValue("@p_dac_tinh_ky_thuat", meta.DacTinhKyThuat);
            cmd.Parameters.AddWithValue("@p_thiet_bi_chuan", meta.ThietBiChuan);

            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        public static async Task CapNhatPhienAsync(int phienId, SessionMetadata meta)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(@"
                UPDATE phien_hieu_chuan
                SET ten_thiet_bi = @ten_thiet_bi,
                    ky_hieu = @ky_hieu,
                    so_hieu = @so_hieu,
                    so_tem = @so_tem,
                    noi_san_xuat = @noi_san_xuat,
                    nam_san_xuat = @nam_san_xuat,
                    don_vi_su_dung = @don_vi_su_dung,
                    phuong_phap = @phuong_phap,
                    ngay_hieu_chuan = @ngay_hieu_chuan,
                    nhiet_do_moi_truong = @nhiet_do_moi_truong,
                    do_am_tuong_doi = @do_am_tuong_doi,
                    nhiet_do_lam_viec = @nhiet_do_lam_viec,
                    dac_tinh_ky_thuat = @dac_tinh_ky_thuat,
                    thiet_bi_chuan = @thiet_bi_chuan
                WHERE id = @id", conn);

            cmd.Parameters.AddWithValue("@id", phienId);
            cmd.Parameters.AddWithValue("@ten_thiet_bi", meta.TenThietBi);
            cmd.Parameters.AddWithValue("@ky_hieu", meta.KyHieu);
            cmd.Parameters.AddWithValue("@so_hieu", meta.SoHieu);
            cmd.Parameters.AddWithValue("@so_tem", meta.SoTem);
            cmd.Parameters.AddWithValue("@noi_san_xuat", meta.NoiSanXuat);
            cmd.Parameters.AddWithValue("@nam_san_xuat", meta.NamSanXuat);
            cmd.Parameters.AddWithValue("@don_vi_su_dung", meta.DonViSuDung);
            cmd.Parameters.AddWithValue("@phuong_phap", meta.PhuongPhap);
            cmd.Parameters.AddWithValue("@ngay_hieu_chuan", meta.NgayHieuChuan);
            cmd.Parameters.AddWithValue("@nhiet_do_moi_truong", meta.NhietDoMoiTruong);
            cmd.Parameters.AddWithValue("@do_am_tuong_doi", meta.DoAmTuongDoi);
            cmd.Parameters.AddWithValue("@nhiet_do_lam_viec", meta.NhietDoLamViec);
            cmd.Parameters.AddWithValue("@dac_tinh_ky_thuat", meta.DacTinhKyThuat);
            cmd.Parameters.AddWithValue("@thiet_bi_chuan", meta.ThietBiChuan);

            int affectedRows = await cmd.ExecuteNonQueryAsync();
            if (affectedRows == 0)
                throw new InvalidOperationException($"Không tìm thấy phiên hiệu chuẩn ID = {phienId} để cập nhật.");
        }

        // Lưu 1 block đo
        public static async Task XoaPhienAsync(int phienId)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT fn_xoa_phien(@p_phien_id)", conn);
            cmd.Parameters.AddWithValue("@p_phien_id", phienId);

            await cmd.ExecuteNonQueryAsync();
        }

        public static async Task<int> LuuKetQuaDoAsync(
            int phienId,
            MeasurementBlock block,
            bool includeHumidity = true)
        {
            double?[] temps = new double?[10];
            double?[] hums = new double?[10];
            for (int i = 0; i < 10; i++)
            {
                temps[i] = i < block.ProbeCount && !float.IsNaN(block.ProbeTemperatures[i])
                    ? block.ProbeTemperatures[i]
                    : null;
                hums[i] = includeHumidity && i < block.ProbeCount && !float.IsNaN(block.ProbeHumidities[i])
                    ? block.ProbeHumidities[i]
                    : null;
            }

            object stabNhiet = TryParseFloat(block.StabilityTemperature, out float sn) ? sn : DBNull.Value;
            object stabAm = includeHumidity && TryParseFloat(block.StabilityHumidity, out float sa) ? sa : DBNull.Value;

            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT fn_luu_ket_qua_do(" +
                "@phien::int, @tgian::timestamp, @nd::float[], @da::float[]," +
                "@ndtb::float, @datb::float, @ddnhiet::float, @ddam::float, @odnhiet::float, @odam::float)", conn);

            cmd.Parameters.AddWithValue("@phien", phienId);
            cmd.Parameters.AddWithValue("@tgian", block.Timestamp);
            cmd.Parameters.Add(new NpgsqlParameter("@nd", NpgsqlTypes.NpgsqlDbType.Array | NpgsqlTypes.NpgsqlDbType.Double) { Value = temps });
            cmd.Parameters.Add(new NpgsqlParameter("@da", NpgsqlTypes.NpgsqlDbType.Array | NpgsqlTypes.NpgsqlDbType.Double) { Value = hums });
            cmd.Parameters.AddWithValue("@ndtb", block.AvgTemperature);
            cmd.Parameters.AddWithValue("@datb", includeHumidity && !float.IsNaN(block.AvgHumidity) ? block.AvgHumidity : (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@ddnhiet", block.UniformityTemp);
            cmd.Parameters.AddWithValue("@ddam", includeHumidity && !float.IsNaN(block.UniformityHumidity) ? block.UniformityHumidity : (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@odnhiet", stabNhiet);
            cmd.Parameters.AddWithValue("@odam", stabAm);

            return Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        // ĐỌC DỮ LIỆU

        // Lấy metadata phiên hiệu chuẩn
        public static async Task<SessionMetadata?> LayPhienAsync(int phienId)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT * FROM fn_lay_phien(@p_phien_id)", conn);
            cmd.Parameters.AddWithValue("@p_phien_id", phienId);

            await using var rdr = await cmd.ExecuteReaderAsync();
            if (!await rdr.ReadAsync()) return null;

            return new SessionMetadata
            {
                TenThietBi = rdr.GetString(0),
                KyHieu = rdr.GetString(1),
                SoHieu = rdr.GetString(2),
                SoTem = rdr.GetString(3),
                NoiSanXuat = rdr.GetString(4),
                NamSanXuat = rdr.GetString(5),
                DonViSuDung = rdr.GetString(6),
                PhuongPhap = rdr.GetString(7),
                NgayHieuChuan = rdr.GetDateTime(8),
                NhietDoMoiTruong = rdr.GetString(9),
                DoAmTuongDoi = rdr.GetString(10),
                NhietDoLamViec = rdr.GetString(11),
                DacTinhKyThuat = rdr.GetString(12),
                ThietBiChuan = rdr.GetString(13),
            };
        }

        // Lấy kết quả đo của 1 phiên
        public static async Task<List<PhienDoSummary>> LayDanhSachPhienAsync()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT * FROM fn_lay_danh_sach_phien()", conn);

            var danhSach = new List<PhienDoSummary>();
            await using var rdr = await cmd.ExecuteReaderAsync();

            while (await rdr.ReadAsync())
            {
                danhSach.Add(new PhienDoSummary
                {
                    Id = rdr.GetInt32(0),
                    TenThietBi = rdr.GetString(1),
                    KyHieu = rdr.GetString(2),
                    SoHieu = rdr.GetString(3),
                    DonViSuDung = rdr.GetString(4),
                    NgayHieuChuan = rdr.GetDateTime(5),
                    SoDiemKiemTra = rdr.GetInt64(6),
                    SoLanDoTho = rdr.GetInt64(7),
                    NgayTao = rdr.GetDateTime(8),
                });
            }

            return danhSach;
        }

        public static async Task<List<KetQuaDo>> LayKetQuaTheoPhienAsync(int phienId)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT * FROM fn_lay_ket_qua_theo_phien(@p_phien_id)", conn);
            cmd.Parameters.AddWithValue("@p_phien_id", phienId);

            var danhSach = new List<KetQuaDo>();
            await using var rdr = await cmd.ExecuteReaderAsync();

            while (await rdr.ReadAsync())
            {
                var kq = new KetQuaDo
                {
                    Id = rdr.GetInt32(0),
                    ThoiGianDo = rdr.GetDateTime(1),
                    NhietDoTb = ReadSingle(rdr, 22),
                    DoAmTb = ReadSingleNullable(rdr, 23),
                    HasDoAmTb = !rdr.IsDBNull(23),
                    DoDongDeuNhiet = ReadSingle(rdr, 24),
                    DoDongDeuAm = ReadSingleNullable(rdr, 25),
                    HasDoDongDeuAm = !rdr.IsDBNull(25),
                    DoOnDinhNhiet = ReadSingleNullable(rdr, 26),
                    HasDoOnDinhNhiet = !rdr.IsDBNull(26),
                    DoOnDinhAm = ReadSingleNullable(rdr, 27),
                    HasDoOnDinhAm = !rdr.IsDBNull(27),
                };

                // Đọc 10 đầu đo từ cột nhiet_do_1..10 và do_am_1..10
                for (int i = 0; i < 10; i++)
                {
                    int tempOrdinal = 2 + i;
                    int humidityOrdinal = 12 + i;
                    kq.HasNhietDo[i] = !rdr.IsDBNull(tempOrdinal);
                    kq.HasDoAm[i] = !rdr.IsDBNull(humidityOrdinal);
                    kq.NhietDo[i] = ReadSingleNullable(rdr, tempOrdinal);
                    kq.DoAm[i] = ReadSingleNullable(rdr, humidityOrdinal);
                }

                danhSach.Add(kq);
            }

            return danhSach;
        }

        private static float ReadSingle(NpgsqlDataReader reader, int ordinal)
            => Convert.ToSingle(reader.GetValue(ordinal));

        private static float ReadSingleNullable(NpgsqlDataReader reader, int ordinal)
             => reader.IsDBNull(ordinal) ? 0f : Convert.ToSingle(reader.GetValue(ordinal));

        private static bool TryParseFloat(string value, out float result)
            => float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out result);


        [Obsolete("Dùng TaoPhienMoiAsync thay thế.")]
        public static Task<int> InsertSessionAsync(SessionMetadata meta)
            => TaoPhienMoiAsync(meta);

        [Obsolete("Dùng LuuKetQuaDoAsync thay thế.")]
        public static Task<int> InsertMeasurementRecordAsync(int sessionId, MeasurementBlock block)
            => LuuKetQuaDoAsync(sessionId, block);
    }
}
